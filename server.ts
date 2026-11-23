import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  getHeritageDatabase,
  HERITAGE_SYSTEM_INSTRUCTION,
  buildGroundedUserPrompt,
} from './server/heritageData.ts';
import { normalizeVietnamese, retrieveHeritageRecords } from './shared/ragSearch.ts';
import type { EnrichedRecord } from './shared/ragSearch.ts';
import type { QuotaCooldownInfo, SourceItem } from './src/types.ts';

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
  `[C03 Data] Đã nạp ${heritageDb.records.length} bản ghi và ${heritageDb.sources.length} nguồn (${heritageDb.validLinks} liên kết hợp lệ, ${heritageDb.brokenLinks.length} liên kết lỗi, phiên bản dữ liệu ${heritageDb.dataVersion}).`
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const DEPRECATED_MODEL_PREFIXES = [
  'gemini-1.0',
  'gemini-1.5',
  'gemini-2.0',
  'gemini-2.5',
  'gemini-pro',
];

// Models known to require paid billing / higher quota tier (never auto-switch into these without explicit admin config)
const PAID_ONLY_MODELS = new Set([
  'gemini-4-carbon',
  'gemini-4-neon',
  'gemini-4-argon',
  'gemini-3.1-pro-preview',
  'gemini-3.1-pro-preview-customtools',
  'gemini-pro-latest',
  'gemini-3-pro-image',
  'gemini-3-pro-image-preview',
  'gemini-nano-banana-2.1',
  'gemini-3.1-flash-lite-image',
  'gemini-omni-1.2-flash',
  'genie-4',
  'lyria-3-clip-preview',
  'lyria-3-pro-preview',
]);

// Verified free-tier-capable text models ordered by reliability & quota suitability
const FREE_TIER_PREFERRED_MODELS = [
  'gemini-3-flash-preview',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-4-hydrogen',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
];

function stripModelsPrefix(name: string): string {
  return name.replace(/^models\//, '').trim();
}

function isCompatibleFreeTierTextModel(modelName: string): boolean {
  const clean = stripModelsPrefix(modelName).toLowerCase();
  if (!clean.includes('gemini')) return false;
  if (DEPRECATED_MODEL_PREFIXES.some((p) => clean.startsWith(p))) return false;
  if (PAID_ONLY_MODELS.has(clean)) return false;
  if (
    clean.includes('pro') ||
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
    clean.includes('computer-use') ||
    clean.includes('antigravity') ||
    clean.includes('deep-research')
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

  // 1. Honor explicit GEMINI_MODEL env if configured and accessible (or if list() returned empty)
  if (envModel) {
    if (accessible.length === 0 || accessible.includes(envModel)) {
      candidateSet.add(envModel);
    } else {
      console.warn(
        `[Gemini Models] GEMINI_MODEL="${envModel}" không nằm trong danh sách model khả dụng của tài khoản.`
      );
    }
  }

  // 2. Add verified non-paid text models that are accessible on this account
  for (const pref of FREE_TIER_PREFERRED_MODELS) {
    if (accessible.length === 0 || accessible.includes(pref)) {
      candidateSet.add(pref);
    }
  }

  // 3. Add any other accessible compatible free-tier text models
  for (const name of accessible) {
    if (isCompatibleFreeTierTextModel(name)) {
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

// Track per-model quota cooldowns so exhausted models are not hammered continuously
interface ModelCooldown {
  scope: 'daily' | 'minute' | 'unknown';
  untilMs: number;
  retryAfterSeconds: number | null;
  resetAt: string | null;
  recordedAt: number;
}

const modelCooldowns = new Map<string, ModelCooldown>();
const DAILY_COOLDOWN_GUARD_MS = 15 * 60 * 1000;

function getActiveModelCooldown(modelName: string): ModelCooldown | null {
  const entry = modelCooldowns.get(modelName);
  if (!entry) return null;
  if (Date.now() >= entry.untilMs) {
    modelCooldowns.delete(modelName);
    return null;
  }
  return entry;
}

function getAggregatedQuotaState(candidateModels: string[]): QuotaCooldownInfo | null {
  const exhausted: string[] = [];
  let primaryCooldown: ModelCooldown | null = null;

  for (const m of candidateModels) {
    const cd = getActiveModelCooldown(m);
    if (cd) {
      exhausted.push(m);
      if (!primaryCooldown) primaryCooldown = cd;
    }
  }

  if (exhausted.length === 0 || !primaryCooldown) return null;
  // Only report global quota exhaustion if all candidate models are cooled down (or at least 1 if pinned)
  if (exhausted.length < candidateModels.length) return null;

  const remainingSec = primaryCooldown.resetAt
    ? Math.max(1, Math.ceil((new Date(primaryCooldown.resetAt).getTime() - Date.now()) / 1000))
    : null;

  return {
    scope: primaryCooldown.scope,
    retryAfterSeconds: remainingSec,
    resetAt: primaryCooldown.resetAt,
    exhaustedModels: exhausted,
  };
}

// Server-side response cache (ONLY successful responses, never errors)
interface CachedAskEntry {
  answer: string;
  grounded: boolean;
  hasEvidence: boolean;
  model: string;
  matchedRecords: EnrichedRecord[];
  citedSources: SourceItem[];
  createdAt: string;
  cachedAtMs: number;
}

const ANSWER_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ENTRIES = 200;
const answerCache = new Map<string, CachedAskEntry>();
const inFlightAskRequests = new Map<string, Promise<any>>();

function buildAnswerCacheKey(
  normalizedQuestion: string,
  modelScope: string,
  dataVersion: string,
  instructionVersion: string
): string {
  return crypto
    .createHash('sha256')
    .update(`${normalizedQuestion}|${modelScope}|${dataVersion}|${instructionVersion}`)
    .digest('hex');
}

function getCachedAnswer(key: string): CachedAskEntry | null {
  const entry = answerCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAtMs > ANSWER_CACHE_TTL_MS) {
    answerCache.delete(key);
    return null;
  }
  // Refresh LRU order
  answerCache.delete(key);
  answerCache.set(key, entry);
  return entry;
}

function setCachedAnswer(key: string, entry: CachedAskEntry): void {
  if (answerCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = answerCache.keys().next().value;
    if (oldestKey) answerCache.delete(oldestKey);
  }
  answerCache.set(key, entry);
}

function parseRetryDelaySeconds(error: any): number | null {
  const headerVal =
    error?.headers?.get?.('retry-after') ||
    error?.headers?.['retry-after'] ||
    error?.response?.headers?.['retry-after'];

  if (headerVal) {
    const parsedHeader = Number(headerVal);
    if (!Number.isNaN(parsedHeader) && parsedHeader > 0) {
      return Math.ceil(parsedHeader);
    }
  }

  const rawText = `${String(error?.message || '')} ${JSON.stringify(error?.details || '')}`;
  const retryDelayMatch = rawText.match(/retryDelay["']?\s*[:=]\s*["']?(\d+(?:\.\d+)?)s/i);
  if (retryDelayMatch) {
    return Math.ceil(Number(retryDelayMatch[1]));
  }
  const pleaseRetryMatch = rawText.match(/retry in\s+(\d+(?:\.\d+)?)\s*s/i);
  if (pleaseRetryMatch) {
    return Math.ceil(Number(pleaseRetryMatch[1]));
  }
  return null;
}

function detectQuotaScope(rawMsg: string, retryAfterSeconds: number | null): 'daily' | 'minute' | 'unknown' {
  const upper = rawMsg.toUpperCase();
  if (
    upper.includes('PERDAY') ||
    upper.includes('PER_DAY') ||
    upper.includes('FREE_TIER_REQUESTS') ||
    upper.includes('GENERATEREQUESTSPERDAY') ||
    upper.includes('REQUESTS_PER_DAY') ||
    upper.includes('LIMIT: 20') ||
    (retryAfterSeconds !== null && retryAfterSeconds > 3600)
  ) {
    return 'daily';
  }
  if (
    upper.includes('PERMINUTE') ||
    upper.includes('PER_MINUTE') ||
    upper.includes('RPM') ||
    upper.includes('TPM') ||
    (retryAfterSeconds !== null && retryAfterSeconds <= 120)
  ) {
    return 'minute';
  }
  return 'unknown';
}

interface ClassifiedError {
  statusCode: number;
  errorCode: string;
  userMessage: string;
  retryable: boolean;
  switchModel: boolean;
  quotaScope?: 'daily' | 'minute' | 'unknown';
  retryAfterSeconds: number | null;
  resetAt: string | null;
}

const QUOTA_EXHAUSTED_VI_MSG =
  'Trợ lý Gemini đã sử dụng hết hạn mức API của dự án. Bạn vẫn có thể tra cứu 21 bản ghi tư liệu và 9 nguồn trực tiếp. Vui lòng thử lại khi hạn mức được khôi phục.';

function classifyGeminiError(error: any): ClassifiedError {
  const rawMsg = String(error?.message || error || '');
  const status = Number(error?.status || error?.code || 0);
  const upperMsg = rawMsg.toUpperCase();
  const retryAfterSeconds = parseRetryDelaySeconds(error);

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
        'Không có quyền truy cập hoặc khóa API Gemini không hợp lệ (401/403). Vui lòng kiểm tra cấu hình Secrets trên máy chủ.',
      retryable: false,
      switchModel: false,
      retryAfterSeconds: null,
      resetAt: null,
    };
  }

  if (status === 400 || upperMsg.includes('INVALID_ARGUMENT')) {
    return {
      statusCode: 400,
      errorCode: 'BAD_REQUEST',
      userMessage:
        'Yêu cầu gửi tới mô hình AI không hợp lệ (400). Vui lòng thử diễn đạt lại câu hỏi.',
      retryable: false,
      switchModel: false,
      retryAfterSeconds: null,
      resetAt: null,
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
        'Mô hình Gemini được chọn không tồn tại hoặc không hỗ trợ trên tài khoản này (404).',
      retryable: false,
      switchModel: true,
      retryAfterSeconds: null,
      resetAt: null,
    };
  }

  if (
    status === 429 ||
    upperMsg.includes('429') ||
    upperMsg.includes('RESOURCE_EXHAUSTED') ||
    upperMsg.includes('QUOTA') ||
    upperMsg.includes('RATE_LIMIT')
  ) {
    const quotaScope = detectQuotaScope(rawMsg, retryAfterSeconds);
    const resetAt =
      retryAfterSeconds !== null
        ? new Date(Date.now() + retryAfterSeconds * 1000).toISOString()
        : null;

    return {
      statusCode: 429,
      errorCode: 'RESOURCE_EXHAUSTED',
      userMessage: QUOTA_EXHAUSTED_VI_MSG,
      // Never auto-retry daily quota errors; allow controlled single backoff ONLY for short per-minute limits
      retryable: quotaScope === 'minute' && retryAfterSeconds !== null && retryAfterSeconds <= 3,
      switchModel: true,
      quotaScope,
      retryAfterSeconds,
      resetAt,
    };
  }

  if (
    status === 503 ||
    upperMsg.includes('503') ||
    upperMsg.includes('UNAVAILABLE') ||
    upperMsg.includes('HIGH DEMAND') ||
    upperMsg.includes('OVERLOADED')
  ) {
    const resetAt =
      retryAfterSeconds !== null
        ? new Date(Date.now() + retryAfterSeconds * 1000).toISOString()
        : null;
    return {
      statusCode: 503,
      errorCode: 'SERVICE_UNAVAILABLE',
      userMessage:
        'Dịch vụ Gemini tạm thời không khả dụng do quá tải (503). Bạn vẫn có thể tra cứu trực tiếp 21 bản ghi bên dưới.',
      retryable: true,
      switchModel: true,
      retryAfterSeconds,
      resetAt,
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
        'Yêu cầu tới trợ lý Gemini vượt quá thời gian chờ (Timeout). Bạn có thể sử dụng kết quả tra cứu trực tiếp bên dưới.',
      retryable: false,
      switchModel: true,
      retryAfterSeconds: null,
      resetAt: null,
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
        'Lỗi kết nối tới dịch vụ Gemini (502). Dữ liệu 21 bản ghi và 9 nguồn vẫn tra cứu được trực tiếp.',
      retryable: false,
      switchModel: true,
      retryAfterSeconds: null,
      resetAt: null,
    };
  }

  return {
    statusCode: 500,
    errorCode: 'INTERNAL_SERVER_ERROR',
    userMessage:
      'Máy chủ gặp sự cố khi xử lý yêu cầu Gemini (500). Bạn vẫn có thể tra cứu trực tiếp 21 bản ghi tư liệu.',
    retryable: false,
    switchModel: true,
    retryAfterSeconds: null,
    resetAt: null,
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
  const envConfigured = process.env.GEMINI_MODEL
    ? stripModelsPrefix(process.env.GEMINI_MODEL)
    : '';

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

  const configuredModel =
    envConfigured || accessibleModels[0] || FREE_TIER_PREFERRED_MODELS[0];
  const quotaState =
    accessibleModels.length > 0 ? getAggregatedQuotaState(accessibleModels) : null;

  res.json({
    status: 'ok',
    hasApiKey,
    configuredModel,
    availableModels: accessibleModels,
    totalRecords: db.records.length,
    totalSources: db.sources.length,
    validSourceLinks: db.validLinks,
    cacheEntries: answerCache.size,
    dataVersion: db.dataVersion,
    environment: isProduction ? 'production' : 'preview',
    quotaState,
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
      : discovered.candidateTextModels[0] || FREE_TIER_PREFERRED_MODELS[0];

    let probeResults:
      | Array<{ model: string; ok: boolean; status?: number; error?: string }>
      | undefined;

    if (req.query.probe === '1') {
      const toProbe = discovered.candidateTextModels.slice(0, 12);
      probeResults = await Promise.all(
        toProbe.map(async (m) => {
          try {
            const r = await ai.models.generateContent({
              model: m,
              contents: 'OK',
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
    console.error('[Search /api/search] Lỗi:', err?.message || err);
    return res.status(500).json({
      status: 'error',
      error: 'SEARCH_ERROR',
      message: 'Không thể thực hiện tìm kiếm tư liệu lúc này.',
    });
  }
});

app.post('/api/ask', async (req, res) => {
  try {
    const { question, selectedModel, bypassCooldown } = req.body || {};
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({
        status: 'error',
        error: 'INVALID_QUESTION',
        message: 'Vui lòng nhập câu hỏi hợp lệ (400).',
      });
    }

    const cleanQuestion = question.normalize('NFC').trim();
    const normalizedQuestion = normalizeVietnamese(cleanQuestion);
    const db = getHeritageDatabase();

    // Phase 1: Always run grounded local retrieval BEFORE touching Gemini (saves API calls)
    const retrieval = retrieveHeritageRecords(cleanQuestion, db.records, db.sources);

    // Optional mock error header for automated verification (TEST 2 / TEST 7) in non-production
    const mockErrorHeader = !isProduction
      ? String(req.headers['x-mock-gemini-error'] || '')
      : '';
    if (
      mockErrorHeader === '429' ||
      mockErrorHeader === '429-daily' ||
      mockErrorHeader === '429-minute' ||
      mockErrorHeader === '503' ||
      mockErrorHeader === '500'
    ) {
      const code = mockErrorHeader.startsWith('429') ? 429 : Number(mockErrorHeader);
      const mockMsg =
        mockErrorHeader === '429-minute'
          ? '429 RESOURCE_EXHAUSTED PerMinute retry in 25s'
          : mockErrorHeader.startsWith('429')
          ? '429 RESOURCE_EXHAUSTED quota exceeded for generativelanguage.googleapis.com/generate_content_free_tier_requests PerDay limit: 20'
          : `Mock ${code} error`;
      const mockErr = classifyGeminiError({ status: code, message: mockMsg });
      return res.status(mockErr.statusCode).json({
        status: 'error',
        error: mockErr.errorCode,
        httpStatus: mockErr.statusCode,
        quotaScope: mockErr.quotaScope || null,
        retryAfterSeconds: mockErr.retryAfterSeconds,
        resetAt: mockErr.resetAt,
        message: mockErr.userMessage,
        fallbackRecords: retrieval.records,
        fallbackSources: retrieval.sources,
        needsDeepReasoning: retrieval.intent.needsDeepReasoning,
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
          'Máy chủ chưa được cấu hình GEMINI_API_KEY trong hệ thống Secrets. Bạn vẫn có thể tra cứu trực tiếp 21 bản ghi.',
        fallbackRecords: retrieval.records,
        fallbackSources: retrieval.sources,
        needsDeepReasoning: retrieval.intent.needsDeepReasoning,
        matchedCount: retrieval.records.length,
      });
    }

    const ai = createGeminiClient(apiKey);
    const discovered = await discoverCompatibleModels(ai);

    const envPinnedModel = process.env.GEMINI_MODEL
      ? stripModelsPrefix(process.env.GEMINI_MODEL)
      : '';
    const clientSelectedModel =
      typeof selectedModel === 'string' && selectedModel.trim()
        ? stripModelsPrefix(selectedModel)
        : '';

    // Validate client-selected model strictly against discovered accessible free-tier candidates
    const validatedSelectedModel =
      clientSelectedModel && discovered.candidateTextModels.includes(clientSelectedModel)
        ? clientSelectedModel
        : '';

    const pinnedModel = validatedSelectedModel || envPinnedModel;
    const modelScope = pinnedModel || 'auto-verified-free';

    // Phase 2: Check server-side response cache BEFORE quota cooldown or Gemini call (TEST 5)
    const cacheKey = buildAnswerCacheKey(
      normalizedQuestion,
      modelScope,
      db.dataVersion,
      db.instructionVersion
    );
    const cachedHit = getCachedAnswer(cacheKey);
    if (cachedHit) {
      return res.json({
        status: 'success',
        answer: cachedHit.answer,
        grounded: cachedHit.grounded,
        hasEvidence: cachedHit.hasEvidence,
        model: cachedHit.model,
        cached: true,
        matchedRecords: cachedHit.matchedRecords,
        citedSources: cachedHit.citedSources,
        timestamp: cachedHit.createdAt,
      });
    }

    // Build candidate list: if a model is pinned by admin/env, respect that pin instead of unapproved switches
    const candidateModels = pinnedModel
      ? [pinnedModel]
      : discovered.candidateTextModels.length > 0
      ? discovered.candidateTextModels
      : FREE_TIER_PREFERRED_MODELS;

    // Clear cooldowns ONLY on explicit manual retry button ("Thử lại khi Gemini khả dụng")
    if (bypassCooldown === true) {
      for (const m of candidateModels) {
        modelCooldowns.delete(m);
      }
    }

    // Check cooldowns so exhausted daily quota is NEVER hammered repeatedly
    const nonCooledModels = candidateModels.filter((m) => !getActiveModelCooldown(m));
    if (nonCooledModels.length === 0) {
      const existingCooldown = getActiveModelCooldown(candidateModels[0]);
      const retryAfterSeconds = existingCooldown?.resetAt
        ? Math.max(1, Math.ceil((new Date(existingCooldown.resetAt).getTime() - Date.now()) / 1000))
        : existingCooldown?.retryAfterSeconds ?? null;

      return res.status(429).json({
        status: 'error',
        error: 'RESOURCE_EXHAUSTED',
        httpStatus: 429,
        quotaScope: existingCooldown?.scope || 'daily',
        retryAfterSeconds,
        resetAt: existingCooldown?.resetAt || null,
        message: QUOTA_EXHAUSTED_VI_MSG,
        fallbackRecords: retrieval.records,
        fallbackSources: retrieval.sources,
        needsDeepReasoning: retrieval.intent.needsDeepReasoning,
        matchedCount: retrieval.records.length,
      });
    }

    // Phase 3: Coalesce duplicate in-flight requests for the exact same normalized question & model scope (TEST 6)
    const existingFlight = inFlightAskRequests.get(cacheKey);
    if (existingFlight) {
      const sharedResult = await existingFlight;
      return res.status(sharedResult.httpStatus || 200).json(sharedResult.payload);
    }

    const askPromise = (async () => {
      const userPrompt = buildGroundedUserPrompt(cleanQuestion, retrieval, db);
      let lastClassified: ClassifiedError | null = null;

      // Try up to 3 verified non-cooled models (no infinite loops, no hammering exhausted models)
      const modelsToTry = nonCooledModels.slice(0, 3);

      for (const modelName of modelsToTry) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const config: Record<string, any> = {
              systemInstruction: HERITAGE_SYSTEM_INSTRUCTION,
            };

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

            const createdAt = new Date().toISOString();
            setCachedAnswer(cacheKey, {
              answer: answerText,
              grounded: true,
              hasEvidence: retrieval.records.length > 0,
              model: modelName,
              matchedRecords: retrieval.records,
              citedSources: retrieval.sources,
              createdAt,
              cachedAtMs: Date.now(),
            });

            return {
              httpStatus: 200,
              payload: {
                status: 'success',
                answer: answerText,
                grounded: true,
                hasEvidence: retrieval.records.length > 0,
                model: modelName,
                cached: false,
                matchedRecords: retrieval.records,
                citedSources: retrieval.sources,
                timestamp: createdAt,
              },
            };
          } catch (err: any) {
            const classified = classifyGeminiError(err);
            if (!lastClassified || classified.statusCode !== 404) {
              lastClassified = classified;
            }
            console.warn(
              `[Gemini /api/ask] Model=${modelName} Attempt=${attempt} Code=${classified.errorCode} Status=${classified.statusCode}`
            );

            // Record 429 quota cooldown for this model so it is NOT retried repeatedly
            if (classified.statusCode === 429) {
              const scope = classified.quotaScope || 'unknown';
              if (scope === 'minute' && classified.retryAfterSeconds && classified.retryAfterSeconds <= 3 && attempt === 1) {
                await sleep(classified.retryAfterSeconds * 1000);
                continue;
              }
              const cooldownMs =
                classified.retryAfterSeconds !== null
                  ? classified.retryAfterSeconds * 1000
                  : scope === 'minute'
                  ? 30 * 1000
                  : DAILY_COOLDOWN_GUARD_MS;

              modelCooldowns.set(modelName, {
                scope,
                untilMs: Date.now() + cooldownMs,
                retryAfterSeconds: classified.retryAfterSeconds,
                resetAt: classified.resetAt,
                recordedAt: Date.now(),
              });
              break; // Move to next verified model (if unpinned) or stop immediately (if pinned)
            }

            // Never retry 401/403/400 auth/bad-request
            if (!classified.retryable) {
              if (!classified.switchModel) {
                return {
                  httpStatus: classified.statusCode,
                  payload: {
                    status: 'error',
                    error: classified.errorCode,
                    httpStatus: classified.statusCode,
                    message: classified.userMessage,
                    fallbackRecords: retrieval.records,
                    fallbackSources: retrieval.sources,
                    needsDeepReasoning: retrieval.intent.needsDeepReasoning,
                    matchedCount: retrieval.records.length,
                  },
                };
              }
              break;
            }

            // Single controlled retry only on 503 with bounded backoff
            if (attempt === 1) {
              const waitMs =
                classified.retryAfterSeconds !== null
                  ? Math.min(classified.retryAfterSeconds * 1000, 2500)
                  : 700;
              await sleep(waitMs);
              continue;
            }
          }
        }
      }

      const finalErr = lastClassified ?? {
        statusCode: 503,
        errorCode: 'SERVICE_UNAVAILABLE',
        userMessage:
          'Dịch vụ Gemini tạm thời không khả dụng. Bạn vẫn có thể tra cứu trực tiếp 21 bản ghi bên dưới.',
        quotaScope: undefined,
        retryAfterSeconds: null,
        resetAt: null,
      };

      return {
        httpStatus: finalErr.statusCode,
        payload: {
          status: 'error',
          error: finalErr.errorCode,
          httpStatus: finalErr.statusCode,
          quotaScope: finalErr.quotaScope || null,
          retryAfterSeconds: finalErr.retryAfterSeconds,
          resetAt: finalErr.resetAt,
          message: finalErr.userMessage,
          fallbackRecords: retrieval.records,
          fallbackSources: retrieval.sources,
          needsDeepReasoning: retrieval.intent.needsDeepReasoning,
          matchedCount: retrieval.records.length,
        },
      };
    })();

    inFlightAskRequests.set(cacheKey, askPromise);
    try {
      const result = await askPromise;
      return res.status(result.httpStatus).json(result.payload);
    } finally {
      inFlightAskRequests.delete(cacheKey);
    }
  } catch (error: any) {
    console.error('[Gemini /api/ask] Lỗi không mong muốn:', error?.message || error);
    const classified = classifyGeminiError(error);
    return res.status(classified.statusCode).json({
      status: 'error',
      error: classified.errorCode,
      httpStatus: classified.statusCode,
      quotaScope: classified.quotaScope || null,
      retryAfterSeconds: classified.retryAfterSeconds,
      resetAt: classified.resetAt,
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
