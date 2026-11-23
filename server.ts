import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  getHeritageDatabase,
  HERITAGE_SYSTEM_INSTRUCTION,
  buildGroundedUserPrompt,
} from './server/heritageData.ts';
import { retrieveHeritageRecords } from './shared/ragSearch.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '1mb' }));

// Load & validate database at startup
const heritageDb = getHeritageDatabase();
console.log(
  `[C03 Data] Đã nạp ${heritageDb.records.length} bản ghi và ${heritageDb.sources.length} nguồn (${heritageDb.validLinks} liên kết hợp lệ, ${heritageDb.brokenLinks.length} liên kết lỗi).`
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const DEPRECATED_MODEL_PREFIXES = [
  'gemini-1.0',
  'gemini-1.5',
  'gemini-2.0',
  'gemini-2.5',
  'gemini-pro',
];

const PREFERRED_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-flash-lite-latest',
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
];

let lastWorkingModel: string | null = null;

function stripModelsPrefix(name: string): string {
  return name.replace(/^models\//, '').trim();
}

function isCompatibleTextModel(modelName: string): boolean {
  const clean = stripModelsPrefix(modelName).toLowerCase();
  if (!clean.includes('gemini')) return false;
  if (DEPRECATED_MODEL_PREFIXES.some((p) => clean.startsWith(p))) return false;
  if (
    clean.includes('image') ||
    clean.includes('nano-banana') ||
    clean.includes('tts') ||
    clean.includes('transcribe') ||
    clean.includes('live') ||
    clean.includes('embedding') ||
    clean.includes('omni') ||
    clean.includes('lyria') ||
    clean.includes('aqa') ||
    clean.includes('bisect') ||
    clean.includes('vision') ||
    clean.includes('robotics') ||
    clean.includes('computer-use')
  ) {
    return false;
  }
  return true;
}

interface DiscoveredModelsCache {
  fetchedAt: number;
  allAccessibleModels: string[];
  candidateTextModels: string[];
}

let modelsCache: DiscoveredModelsCache | null = null;
const MODELS_CACHE_TTL_MS = 5 * 60 * 1000;

async function discoverCompatibleModels(ai: GoogleGenAI): Promise<DiscoveredModelsCache> {
  if (modelsCache && Date.now() - modelsCache.fetchedAt < MODELS_CACHE_TTL_MS) {
    return modelsCache;
  }

  const accessible: string[] = [];
  try {
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    for await (const model of pager) {
      const name = stripModelsPrefix(model.name || '');
      const actions = model.supportedActions || [];
      const supportsGenerate =
        actions.length === 0 || actions.includes('generateContent');
      if (name && supportsGenerate) {
        accessible.push(name);
      }
    }
  } catch (err) {
    console.warn('[Gemini Models] Không thể liệt kê models từ API:', (err as any)?.message || err);
  }

  const envModel = process.env.GEMINI_MODEL
    ? stripModelsPrefix(process.env.GEMINI_MODEL)
    : '';

  const candidateSet = new Set<string>();

  // 1. Honor explicit GEMINI_MODEL env if configured and accessible (or if list() failed)
  if (envModel) {
    if (accessible.length === 0 || accessible.includes(envModel)) {
      candidateSet.add(envModel);
    } else {
      console.warn(
        `[Gemini Models] GEMINI_MODEL="${envModel}" không nằm trong danh sách model khả dụng của tài khoản.`
      );
    }
  }

  // 2. Add preferred verified models that exist in accessible list (or fallback to preferred if list empty)
  for (const pref of PREFERRED_MODELS) {
    if (accessible.length === 0 || accessible.includes(pref)) {
      candidateSet.add(pref);
    }
  }

  // 3. Add any other accessible compatible flash text models from the account
  for (const name of accessible) {
    if (isCompatibleTextModel(name) && name.includes('flash')) {
      candidateSet.add(name);
    }
  }

  // 4. Add remaining accessible compatible text models (excluding paid-only if possible, or as last resort)
  for (const name of accessible) {
    if (isCompatibleTextModel(name)) {
      candidateSet.add(name);
    }
  }

  modelsCache = {
    fetchedAt: Date.now(),
    allAccessibleModels: accessible,
    candidateTextModels: Array.from(candidateSet),
  };

  return modelsCache;
}

function extractRetryAfterMs(error: any): number | null {
  const retryAfterHeader =
    error?.headers?.get?.('retry-after') ||
    error?.headers?.['retry-after'] ||
    error?.response?.headers?.['retry-after'];

  if (!retryAfterHeader) return null;
  const seconds = Number(retryAfterHeader);
  if (!Number.isNaN(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, 3000);
  }
  return null;
}

interface ClassifiedError {
  statusCode: number;
  errorCode: string;
  userMessage: string;
  retryable: boolean;
  switchModel: boolean;
  retryAfterMs: number | null;
}

function classifyGeminiError(error: any): ClassifiedError {
  const rawMsg = String(error?.message || error || '');
  const status = Number(error?.status || error?.code || 0);
  const upperMsg = rawMsg.toUpperCase();
  const retryAfterMs = extractRetryAfterMs(error);

  if (
    status === 401 ||
    status === 403 ||
    (status === 400 && upperMsg.includes('API_KEY')) ||
    upperMsg.includes('API_KEY_INVALID') ||
    upperMsg.includes('PERMISSION_DENIED') ||
    upperMsg.includes('UNAUTHENTICATED') ||
    upperMsg.includes('API KEY NOT VALID')
  ) {
    return {
      statusCode: status === 401 ? 401 : 403,
      errorCode: 'AUTH_ERROR',
      userMessage:
        'Lỗi xác thực API key hoặc quyền truy cập Gemini (401/403). Vui lòng kiểm tra lại GEMINI_API_KEY trong phần cấu hình Secrets.',
      retryable: false,
      switchModel: false,
      retryAfterMs: null,
    };
  }

  if (status === 400 || upperMsg.includes('INVALID_ARGUMENT')) {
    return {
      statusCode: 400,
      errorCode: 'BAD_REQUEST',
      userMessage:
        'Yêu cầu gửi tới mô hình AI không hợp lệ (400). Vui lòng thử diễn đạt lại câu hỏi.',
      retryable: false,
      switchModel: true,
      retryAfterMs: null,
    };
  }

  if (
    status === 404 ||
    upperMsg.includes('404') ||
    upperMsg.includes('NOT_FOUND')
  ) {
    return {
      statusCode: 404,
      errorCode: 'MODEL_NOT_FOUND',
      userMessage:
        'Endpoint hoặc mô hình Gemini được cấu hình không tồn tại hoặc không hỗ trợ tài khoản này (404).',
      retryable: false,
      switchModel: true,
      retryAfterMs: null,
    };
  }

  if (
    status === 429 ||
    upperMsg.includes('429') ||
    upperMsg.includes('RESOURCE_EXHAUSTED') ||
    upperMsg.includes('QUOTA') ||
    upperMsg.includes('RATE_LIMIT')
  ) {
    return {
      statusCode: 429,
      errorCode: 'RATE_LIMITED',
      userMessage:
        'Hệ thống đã vượt giới hạn lượt truy vấn Gemini API (429). Vui lòng đợi ít giây rồi thử lại.',
      retryable: true,
      switchModel: true,
      retryAfterMs,
    };
  }

  if (
    status === 503 ||
    upperMsg.includes('503') ||
    upperMsg.includes('UNAVAILABLE') ||
    upperMsg.includes('HIGH DEMAND') ||
    upperMsg.includes('OVERLOADED')
  ) {
    return {
      statusCode: 503,
      errorCode: 'SERVICE_UNAVAILABLE',
      userMessage:
        'Dịch vụ AI tạm thời không khả dụng do lượng truy cập cao (503). Dữ liệu tư liệu vẫn có thể tra cứu trực tiếp.',
      retryable: true,
      switchModel: true,
      retryAfterMs,
    };
  }

  if (
    status === 504 ||
    error?.name === 'AbortError' ||
    upperMsg.includes('TIMEOUT') ||
    upperMsg.includes('DEADLINE_EXCEEDED') ||
    upperMsg.includes('TIMED OUT')
  ) {
    return {
      statusCode: 504,
      errorCode: 'GATEWAY_TIMEOUT',
      userMessage:
        'Yêu cầu tới trợ lý Gemini vượt quá thời gian chờ (Timeout). Vui lòng nhấn thử lại.',
      retryable: true,
      switchModel: true,
      retryAfterMs: null,
    };
  }

  if (
    status === 502 ||
    upperMsg.includes('ECONNRESET') ||
    upperMsg.includes('ENOTFOUND') ||
    upperMsg.includes('ECONNREFUSED') ||
    upperMsg.includes('FETCH FAILED') ||
    upperMsg.includes('BAD_GATEWAY')
  ) {
    return {
      statusCode: 502,
      errorCode: 'BAD_GATEWAY',
      userMessage:
        'Lỗi kết nối tới dịch vụ Gemini phía sau (502). Vui lòng thử lại sau vài giây.',
      retryable: true,
      switchModel: true,
      retryAfterMs: null,
    };
  }

  return {
    statusCode: 500,
    errorCode: 'INTERNAL_SERVER_ERROR',
    userMessage:
      'Máy chủ gặp sự cố khi xử lý yêu cầu Gemini (500). Dữ liệu tư liệu vẫn có thể tra cứu trực tiếp.',
    retryable: true,
    switchModel: true,
    retryAfterMs: null,
  };
}

function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      timeout: 18000,
    },
  });
}

// API Routes
app.get('/api/status', async (_req, res) => {
  const db = getHeritageDatabase();
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY);
  const configuredModel = process.env.GEMINI_MODEL
    ? stripModelsPrefix(process.env.GEMINI_MODEL)
    : 'gemini-3.8-flash';

  let accessibleModels: string[] = [];
  if (hasApiKey) {
    try {
      const ai = createGeminiClient(process.env.GEMINI_API_KEY!);
      const discovered = await discoverCompatibleModels(ai);
      accessibleModels = discovered.candidateTextModels;
    } catch {
      // Keep status non-fatal
    }
  }

  res.json({
    status: 'ok',
    hasApiKey,
    configuredModel,
    availableModels: accessibleModels,
    totalRecords: db.records.length,
    totalSources: db.sources.length,
    validSourceLinks: db.validLinks,
    project: 'C03 - Hát Xoan và tín ngưỡng thờ Hùng Vương',
    author: 'Nguyễn Ngọc Doanh - MSV TH04122 (Nhóm 2 - IMTA TECH x FPT Polytechnic)',
  });
});

app.get('/api/models', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      status: 'error',
      error: 'MISSING_API_KEY',
      message: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.',
    });
  }

  try {
    const ai = createGeminiClient(apiKey);
    modelsCache = null; // Force fresh check
    const discovered = await discoverCompatibleModels(ai);
    const configured = process.env.GEMINI_MODEL
      ? stripModelsPrefix(process.env.GEMINI_MODEL)
      : 'gemini-4-hydrogen';

    let probeResults: Array<{ model: string; ok: boolean; status?: number; error?: string }> | undefined;
    if (req.query.probe === '1') {
      const toProbe = discovered.candidateTextModels.slice(0, 22);
      probeResults = await Promise.all(
        toProbe.map(async (m) => {
          try {
            const r = await ai.models.generateContent({
              model: m,
              contents: 'Trả lời 1 từ: OK',
            });
            return { model: m, ok: Boolean(r.text) };
          } catch (err: any) {
            const c = classifyGeminiError(err);
            return { model: m, ok: false, status: c.statusCode, error: c.errorCode };
          }
        })
      );
    }

    return res.json({
      status: 'ok',
      configuredModelChecked: configured,
      isConfiguredModelAccessible: discovered.allAccessibleModels.includes(configured),
      recommendedModel: discovered.candidateTextModels[0] || null,
      candidateTextModels: discovered.candidateTextModels,
      allAccessibleModels: discovered.allAccessibleModels,
      ...(probeResults ? { probeResults } : {}),
    });
  } catch (err: any) {
    const classified = classifyGeminiError(err);
    return res.status(classified.statusCode).json({
      status: 'error',
      error: classified.errorCode,
      message: classified.userMessage,
    });
  }
});

app.get('/api/records', (_req, res) => {
  const db = getHeritageDatabase();
  res.json(db.records);
});

app.get('/api/sources', (_req, res) => {
  const db = getHeritageDatabase();
  res.json(db.sources);
});

app.post('/api/search', (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({
        status: 'error',
        error: 'INVALID_QUESTION',
        message: 'Vui lòng nhập từ khóa hoặc câu hỏi hợp lệ.',
      });
    }

    const db = getHeritageDatabase();
    const retrieval = retrieveHeritageRecords(question, db.records, db.sources);

    return res.json({
      status: 'ok',
      query: retrieval.query,
      totalFound: retrieval.records.length,
      intent: retrieval.intent,
      records: retrieval.records,
      sources: retrieval.sources,
    });
  } catch (err: any) {
    console.error('[Search /api/search] Lỗi:', err);
    return res.status(500).json({
      status: 'error',
      error: 'SEARCH_ERROR',
      message: 'Không thể thực hiện tìm kiếm tư liệu lúc này.',
    });
  }
});

app.post('/api/ask', async (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({
        status: 'error',
        error: 'INVALID_QUESTION',
        message: 'Vui lòng nhập câu hỏi hợp lệ (400).',
      });
    }

    const cleanQuestion = question.normalize('NFC').trim();
    const db = getHeritageDatabase();

    // Phase 1: Always run grounded local retrieval against all 21 records and 9 sources
    const retrieval = retrieveHeritageRecords(cleanQuestion, db.records, db.sources);

    // Optional mock error header for automated verification (TEST 7) in non-production
    const mockErrorHeader = !isProduction
      ? String(req.headers['x-mock-gemini-error'] || '')
      : '';
    if (mockErrorHeader === '503' || mockErrorHeader === '429' || mockErrorHeader === '500') {
      const code = Number(mockErrorHeader);
      const mockErr = classifyGeminiError({ status: code, message: `Mock ${code} error` });
      return res.status(mockErr.statusCode).json({
        status: 'error',
        error: mockErr.errorCode,
        httpStatus: mockErr.statusCode,
        message: mockErr.userMessage,
        fallbackRecords: retrieval.records,
        fallbackSources: retrieval.sources,
        matchedCount: retrieval.records.length,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        status: 'error',
        error: 'MISSING_API_KEY',
        httpStatus: 503,
        message:
          'Máy chủ chưa được cấu hình GEMINI_API_KEY trong hệ thống Secrets. Vui lòng cấu hình khóa để kích hoạt trợ lý Gemini.',
        fallbackRecords: retrieval.records,
        fallbackSources: retrieval.sources,
        matchedCount: retrieval.records.length,
      });
    }

    const ai = createGeminiClient(apiKey);
    const discovered = await discoverCompatibleModels(ai);
    const baseCandidates =
      discovered.candidateTextModels.length > 0
        ? discovered.candidateTextModels
        : PREFERRED_MODELS;

    // Prioritize lastWorkingModel (unless GEMINI_MODEL is explicitly pinned first)
    const candidateModels =
      lastWorkingModel && baseCandidates.includes(lastWorkingModel) && !process.env.GEMINI_MODEL
        ? [lastWorkingModel, ...baseCandidates.filter((m) => m !== lastWorkingModel)]
        : baseCandidates;

    const userPrompt = buildGroundedUserPrompt(cleanQuestion, retrieval, db);

    let lastClassified: ClassifiedError | null = null;

    // Try up to 8 compatible text models so overloaded models are bypassed cleanly
    const modelsToTry = candidateModels.slice(0, 8);

    for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
      const modelName = modelsToTry[mIdx];
      const maxAttempts = modelsToTry.length > 1 ? 1 : 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const config: Record<string, any> = {
            systemInstruction: HERITAGE_SYSTEM_INSTRUCTION,
          };

          // Apply ThinkingLevel.LOW only on Gemini 3 / 4 models that support it
          if (modelName.startsWith('gemini-3.8') || modelName.startsWith('gemini-4')) {
            config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
          }

          const response = await ai.models.generateContent({
            model: modelName,
            contents: userPrompt,
            config,
          });

          const answerText = (response.text || '').trim();
          if (!answerText) {
            throw new Error('Empty response from Gemini');
          }

          lastWorkingModel = modelName;

          return res.json({
            status: 'success',
            answer: answerText,
            grounded: true,
            hasEvidence: retrieval.records.length > 0,
            model: modelName,
            matchedRecords: retrieval.records,
            citedSources: retrieval.sources,
            timestamp: new Date().toISOString(),
          });
        } catch (err: any) {
          const classified = classifyGeminiError(err);
          // Do not overwrite an informative 503/429 with a fallback model's 404
          if (!lastClassified || classified.statusCode !== 404) {
            lastClassified = classified;
          }
          console.warn(
            `[Gemini /api/ask] Model=${modelName} Attempt=${attempt}/${maxAttempts} Code=${classified.errorCode} Status=${classified.statusCode}`
          );

          // Never retry auth errors (401/403)
          if (!classified.retryable && !classified.switchModel) {
            return res.status(classified.statusCode).json({
              status: 'error',
              error: classified.errorCode,
              httpStatus: classified.statusCode,
              message: classified.userMessage,
              fallbackRecords: retrieval.records,
              fallbackSources: retrieval.sources,
              matchedCount: retrieval.records.length,
            });
          }

          if (classified.retryable && attempt < maxAttempts) {
            const backoffMs =
              classified.retryAfterMs ??
              450 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
            await sleep(backoffMs);
            continue;
          }

          // Clear cached working model if it just failed
          if (lastWorkingModel === modelName) {
            lastWorkingModel = null;
          }

          // Switch to next model candidate
          break;
        }
      }
    }

    const finalErr = lastClassified ?? {
      statusCode: 503,
      errorCode: 'SERVICE_UNAVAILABLE',
      userMessage: 'Dịch vụ AI tạm thời không khả dụng. Dữ liệu tư liệu vẫn có thể tra cứu trực tiếp.',
    };

    // All model attempts exhausted — return structured API error + real local search fallback
    return res.status(finalErr.statusCode).json({
      status: 'error',
      error: finalErr.errorCode,
      httpStatus: finalErr.statusCode,
      message: finalErr.userMessage,
      fallbackRecords: retrieval.records,
      fallbackSources: retrieval.sources,
      matchedCount: retrieval.records.length,
    });
  } catch (error: any) {
    console.error('[Gemini /api/ask] Lỗi không mong muốn:', error);
    const classified = classifyGeminiError(error);
    return res.status(classified.statusCode).json({
      status: 'error',
      error: classified.errorCode,
      httpStatus: classified.statusCode,
      message: classified.userMessage,
      fallbackRecords: [],
      fallbackSources: [],
      matchedCount: 0,
    });
  }
});

// Ensure unknown /api/* routes return JSON 404 instead of HTML fallback
app.all('/api/*', (_req, res) => {
  res.status(404).json({
    status: 'error',
    error: 'ENDPOINT_NOT_FOUND',
    httpStatus: 404,
    message: 'Đường dẫn API không tồn tại (404).',
  });
});

// Setup Vite or Static File Serving
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[C03 Server] Ứng dụng Hát Xoan đang chạy tại http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Không thể khởi động server:', err);
  process.exit(1);
});
