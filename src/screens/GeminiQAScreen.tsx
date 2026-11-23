import { useState, useRef } from 'react';
import type { ServerStatus, RecordItem, SourceItem } from '../types.ts';
import { RECORDS, SOURCES } from '../data/database.ts';
import { retrieveHeritageRecords } from '../../shared/ragSearch.ts';
import {
  Sparkles,
  Send,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
  RefreshCw,
  BookOpen,
  ShieldCheck,
  ExternalLink,
  Search,
  FileText,
  ArrowUpRight,
  Database,
  Clock,
  SlidersHorizontal,
} from 'lucide-react';

interface GeminiQAScreenProps {
  serverStatus: ServerStatus | null;
  onRefreshStatus: () => void;
  onOpenArchive?: () => void;
  onSelectRecord?: (record: RecordItem) => void;
  onOpenSources?: () => void;
}

type LoadingPhase = 'idle' | 'searching' | 'calling_gemini';

interface MessageItem {
  id: string;
  sender: 'user' | 'assistant';
  mode?: 'gemini' | 'local_fallback' | 'error';
  text: string;
  timestamp: string;
  model?: string;
  cached?: boolean;
  hasEvidence?: boolean;
  matchedRecords?: RecordItem[];
  citedSources?: SourceItem[];
  error?: boolean;
  errorCode?: string;
  httpStatus?: number;
  quotaScope?: 'daily' | 'minute' | 'unknown' | null;
  retryAfterSeconds?: number | null;
  resetAt?: string | null;
  failedQuestion?: string;
  fallbackRecords?: RecordItem[];
  fallbackSources?: SourceItem[];
  needsDeepReasoning?: boolean;
}

function formatResetNotice(retryAfterSeconds?: number | null, resetAt?: string | null): string {
  if (resetAt) {
    const dt = new Date(resetAt);
    if (!Number.isNaN(dt.getTime())) {
      const timeStr = dt.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      if (retryAfterSeconds && retryAfterSeconds > 0) {
        return `Dự kiến khôi phục lúc ${timeStr} (còn khoảng ${retryAfterSeconds} giây)`;
      }
      return `Dự kiến khôi phục lúc ${timeStr}`;
    }
  }
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    return `Dự kiến khôi phục sau khoảng ${retryAfterSeconds} giây`;
  }
  return 'Chưa xác định thời điểm khôi phục';
}

function mapHttpStatusToVietnamese(status: number): string {
  switch (status) {
    case 400:
      return 'Yêu cầu gửi tới dịch vụ AI không hợp lệ (400).';
    case 401:
    case 403:
      return 'Không có quyền truy cập hoặc khóa API Gemini không hợp lệ (401/403).';
    case 404:
      return 'Mô hình Gemini được cấu hình không tồn tại trên tài khoản này (404).';
    case 429:
      return 'Trợ lý Gemini đã sử dụng hết hạn mức API của dự án. Bạn vẫn có thể tra cứu 21 bản ghi tư liệu và 9 nguồn trực tiếp. Vui lòng thử lại khi hạn mức được khôi phục.';
    case 502:
      return 'Lỗi kết nối tới dịch vụ Gemini (502). Dữ liệu 21 bản ghi và 9 nguồn vẫn tra cứu được trực tiếp.';
    case 503:
      return 'Dịch vụ Gemini tạm thời không khả dụng (503). Bạn vẫn có thể tra cứu trực tiếp 21 bản ghi tư liệu bên dưới.';
    case 504:
      return 'Yêu cầu tới trợ lý Gemini vượt quá thời gian chờ (Timeout). Bạn có thể xem kết quả tra cứu trực tiếp bên dưới.';
    default:
      return 'Máy chủ gặp sự cố khi xử lý yêu cầu Gemini (500). Bạn vẫn có thể tra cứu trực tiếp 21 bản ghi tư liệu.';
  }
}

function renderFormattedText(text: string) {
  const lines = text.split('\n');
  return (
    <div className="space-y-2 text-xs sm:text-sm leading-relaxed text-stone-800">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={idx} className="h-1" />;
        }

        const isBullet = /^[-*•]\s+/.test(line);
        const cleanLine = isBullet ? line.replace(/^[-*•]\s+/, '') : line;
        const isHeading = /^#{1,3}\s+/.test(cleanLine);
        const headingText = isHeading ? cleanLine.replace(/^#{1,3}\s+/, '') : cleanLine;

        const parts = headingText.split(/(\*\*[^*]+\*\*)/g).map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return (
              <strong key={pIdx} className="font-semibold text-stone-900">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <span key={pIdx}>{part}</span>;
        });

        if (isHeading) {
          return (
            <h4 key={idx} className="font-serif font-bold text-stone-900 text-sm sm:text-base pt-1">
              {parts}
            </h4>
          );
        }

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-[#9A3412] font-bold mt-0.5" aria-hidden="true">
                ·
              </span>
              <span className="flex-1">{parts}</span>
            </div>
          );
        }

        return <p key={idx}>{parts}</p>;
      })}
    </div>
  );
}

export function GeminiQAScreen({
  serverStatus,
  onRefreshStatus,
  onOpenArchive,
  onSelectRecord,
  onOpenSources,
}: GeminiQAScreenProps) {
  const [question, setQuestion] = useState<string>('');
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('idle');
  const [foundCountPreview, setFoundCountPreview] = useState<number>(0);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [showModelConfig, setShowModelConfig] = useState<boolean>(false);
  const [quotaExhaustedNotice, setQuotaExhaustedNotice] = useState<{
    message: string;
    retryAfterSeconds?: number | null;
    resetAt?: string | null;
  } | null>(null);

  const inFlightRef = useRef<boolean>(false);
  const isLoading = loadingPhase !== 'idle';

  const isDailyQuotaLimited = Boolean(
    quotaExhaustedNotice ||
      (serverStatus?.quotaState && serverStatus.quotaState.scope === 'daily')
  );

  const sampleQuestions = [
    {
      title: 'Ý nghĩa bài Giáo trống',
      text: 'Bài Giáo trống có ý nghĩa gì trong chặng Hát Thờ?',
    },
    {
      title: 'Hệ thống 14 Quả Cách',
      text: 'Hệ thống 14 Quả Cách của Hát Xoan gồm những bài nào? Cho biết ý nghĩa của bài Du xuân cách và Tứ mùa cách.',
    },
    {
      title: 'Chặng Hát Hội & Đố Huê',
      text: 'Bài Xin Huê Đố Huê có đặc điểm gì?',
    },
    {
      title: 'Địa danh hành chính 4 phường',
      text: 'Phạm vi địa lý hiện nay và địa danh cũ trước 01/7/2025 của cộng đồng 4 phường Xoan là gì?',
    },
    {
      title: 'Kiểm tra câu hỏi ngoài dữ liệu',
      text: 'Cho biết thông tin các làn điệu Quan họ Bắc Ninh.',
    },
  ];

  const runLocalArchiveSearch = async (textToSend: string) => {
    let localResult = retrieveHeritageRecords(textToSend, RECORDS, SOURCES);
    try {
      const searchRes = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: textToSend }),
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (Array.isArray(searchData.records)) {
          localResult = {
            ...localResult,
            records: searchData.records,
            sources: searchData.sources || [],
            intent: searchData.intent || localResult.intent,
          };
        }
      }
    } catch {
      // Keep direct client dataset result cleanly
    }
    return localResult;
  };

  const handleAsk = async (
    queryText?: string,
    options: { isRetry?: boolean; bypassCooldown?: boolean; forceLocal?: boolean } = {}
  ) => {
    const textToSend = (queryText ?? question).trim();
    if (!textToSend || inFlightRef.current) return;

    inFlightRef.current = true;
    const { isRetry = false, bypassCooldown = false, forceLocal = false } = options;

    const userMsg: MessageItem = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!isRetry) {
      setQuestion('');
    }

    // Phase 1: Always search local 21 records & 9 sources first
    setLoadingPhase('searching');
    setFoundCountPreview(0);

    const localFallback = await runLocalArchiveSearch(textToSend);
    setFoundCountPreview(localFallback.records.length);

    // If explicitly searching locally OR already in daily quota limit without explicit Gemini retry,
    // immediately serve direct archive search WITHOUT spamming Gemini API!
    if (forceLocal || (isDailyQuotaLimited && !bypassCooldown)) {
      const directMsg: MessageItem = {
        id: 'loc_' + Date.now(),
        sender: 'assistant',
        mode: 'local_fallback',
        text:
          quotaExhaustedNotice?.message ||
          'Trợ lý Gemini đã sử dụng hết hạn mức API của dự án. Bạn vẫn có thể tra cứu 21 bản ghi tư liệu và 9 nguồn trực tiếp. Vui lòng thử lại khi hạn mức được khôi phục.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        httpStatus: isDailyQuotaLimited ? 429 : undefined,
        retryAfterSeconds: quotaExhaustedNotice?.retryAfterSeconds ?? null,
        resetAt: quotaExhaustedNotice?.resetAt ?? null,
        failedQuestion: textToSend,
        fallbackRecords: localFallback.records,
        fallbackSources: localFallback.sources,
        needsDeepReasoning: localFallback.intent.needsDeepReasoning,
      };
      setMessages((prev) => [...prev, directMsg]);
      setLoadingPhase('idle');
      inFlightRef.current = false;
      return;
    }

    // Phase 2: Call Gemini backend endpoint
    setLoadingPhase('calling_gemini');

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: textToSend,
          selectedModel: selectedModel || undefined,
          bypassCooldown,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await res.json()
        : {
            status: 'error',
            error: `HTTP_${res.status}`,
            httpStatus: res.status,
            message: mapHttpStatusToVietnamese(res.status),
          };

      if (!res.ok || data.status === 'error') {
        const statusNum = Number(data.httpStatus || res.status || 500);
        const safeMessage =
          typeof data.message === 'string' && !data.message.trim().startsWith('{')
            ? data.message
            : mapHttpStatusToVietnamese(statusNum);

        if (statusNum === 429) {
          setQuotaExhaustedNotice({
            message: safeMessage,
            retryAfterSeconds: data.retryAfterSeconds ?? null,
            resetAt: data.resetAt ?? null,
          });
        }

        const errRecords: RecordItem[] =
          Array.isArray(data.fallbackRecords) && data.fallbackRecords.length > 0
            ? data.fallbackRecords
            : localFallback.records;
        const errSources: SourceItem[] =
          Array.isArray(data.fallbackSources) && data.fallbackSources.length > 0
            ? data.fallbackSources
            : localFallback.sources;

        const errMsg: MessageItem = {
          id: 'err_' + Date.now(),
          sender: 'assistant',
          mode: 'error',
          text: safeMessage,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          error: true,
          errorCode: data.error || `HTTP_${statusNum}`,
          httpStatus: statusNum,
          quotaScope: data.quotaScope || null,
          retryAfterSeconds: data.retryAfterSeconds ?? null,
          resetAt: data.resetAt ?? null,
          failedQuestion: textToSend,
          fallbackRecords: errRecords,
          fallbackSources: errSources,
          needsDeepReasoning:
            typeof data.needsDeepReasoning === 'boolean'
              ? data.needsDeepReasoning
              : localFallback.intent.needsDeepReasoning,
        };

        setMessages((prev) => [...prev, errMsg]);
        return;
      }

      // Gemini succeeded — clear any active quota exhaustion banner
      if (quotaExhaustedNotice) {
        setQuotaExhaustedNotice(null);
      }

      const botMsg: MessageItem = {
        id: 'bot_' + Date.now(),
        sender: 'assistant',
        mode: 'gemini',
        text: data.answer || 'Chưa tìm thấy thông tin phù hợp trong 21 bản ghi hiện có.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        model: data.model,
        cached: Boolean(data.cached),
        hasEvidence: Boolean(data.hasEvidence),
        matchedRecords: Array.isArray(data.matchedRecords) ? data.matchedRecords : [],
        citedSources: Array.isArray(data.citedSources) ? data.citedSources : [],
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const errMsg: MessageItem = {
        id: 'err_' + Date.now(),
        sender: 'assistant',
        mode: 'error',
        text: 'Không thể kết nối máy chủ trợ lý Gemini lúc này. Bạn vẫn có thể tra cứu trực tiếp 21 bản ghi tư liệu bên dưới.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        error: true,
        errorCode: 'NETWORK_ERROR',
        failedQuestion: textToSend,
        fallbackRecords: localFallback.records,
        fallbackSources: localFallback.sources,
        needsDeepReasoning: localFallback.intent.needsDeepReasoning,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoadingPhase('idle');
      inFlightRef.current = false;
    }
  };

  const handleCopy = (id: string, msg: MessageItem) => {
    const refsText =
      msg.matchedRecords && msg.matchedRecords.length > 0
        ? `\n\nTƯ LIỆU ĐỐI CHIẾU:\n${msg.matchedRecords
            .map((r) => `- [${r.id}] ${r.ten_bai} (${r.nhom_bai})`)
            .join('\n')}${
            msg.citedSources && msg.citedSources.length > 0
              ? `\n${msg.citedSources
                  .map((s) => `- [${s.id}] ${s.ten_nguon} (${s.link})`)
                  .join('\n')}`
              : ''
          }`
        : '';

    navigator.clipboard.writeText(`${msg.text}${refsText}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const availableModels = serverStatus?.availableModels ?? [];
  const activeModelLabel = selectedModel || serverStatus?.configuredModel || 'gemini-3-flash-preview';

  return (
    <div className="space-y-8 py-6 max-w-4xl mx-auto">
      {/* Title & Description */}
      <div className="border-b border-[#E7E2D6] pb-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#9A3412] tracking-wider uppercase">
          <Sparkles className="w-4 h-4" />
          <span>Trợ lý tư liệu số thông minh</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1">
          Hỏi Đáp Tư Liệu Bằng Gemini
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 mt-1.5 leading-relaxed">
          Hệ thống tìm kiếm đối chiếu trên 21 bản ghi di sản (records.json) và 9 nguồn lưu trữ uy tín (sources.json), kết hợp tổng hợp học thuật qua Gemini và chế độ tra cứu dự phòng trực tiếp.
        </p>
      </div>

      {/* API Key & Model Status Notice */}
      {serverStatus && !serverStatus.hasApiKey ? (
        <div className="bg-amber-50 rounded-xl p-5 border border-amber-200 text-xs text-amber-900 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Chưa cấu hình GEMINI_API_KEY tại máy chủ</span>
          </div>
          <p className="leading-relaxed">
            Máy chủ hiện chưa phát hiện biến môi trường{' '}
            <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">
              GEMINI_API_KEY
            </code>{' '}
            trong hệ thống Secrets. Khi chưa có khóa, bạn vẫn có thể sử dụng chế độ tra cứu trực tiếp trên 21 bản ghi và 9 nguồn tư liệu.
          </p>
          <div className="pt-1 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRefreshStatus}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Kiểm tra lại trạng thái</span>
            </button>
            {onOpenArchive && (
              <button
                type="button"
                onClick={onOpenArchive}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100/50 text-amber-900 border border-amber-300 font-medium transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Tra cứu trong 21 bản ghi</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div
            className={`rounded-xl p-3.5 border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              isDailyQuotaLimited
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-start sm:items-center gap-2">
              {isDailyQuotaLimited ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
              )}
              <div className="space-y-0.5">
                <div>
                  {isDailyQuotaLimited ? (
                    <span>
                      <strong>Gemini đang tạm hết hạn mức (429).</strong> Hệ thống đã kích hoạt{' '}
                      <strong>chế độ tra cứu trực tiếp 21 bản ghi & 9 nguồn</strong> (không tốn lượt API).
                    </span>
                  ) : (
                    <span>
                      Máy chủ đã kết nối sẵn sàng với dịch vụ <strong>Gemini AI</strong> ({activeModelLabel}) và bộ tìm kiếm RAG trên {serverStatus?.totalRecords ?? 21} bản ghi, {serverStatus?.totalSources ?? 9} nguồn tư liệu.
                    </span>
                  )}
                </div>
                {isDailyQuotaLimited && (
                  <div className="text-[11px] text-amber-800 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>
                      Thời điểm khôi phục:{' '}
                      {formatResetNotice(
                        quotaExhaustedNotice?.retryAfterSeconds ??
                          serverStatus?.quotaState?.retryAfterSeconds,
                        quotaExhaustedNotice?.resetAt ?? serverStatus?.quotaState?.resetAt
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {availableModels.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowModelConfig((v) => !v)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white border border-black/10 text-[11px] font-medium text-stone-700 transition-colors"
                  title="Chọn mô hình Gemini đã xác thực"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>Mô hình</span>
                </button>
              )}
              <button
                type="button"
                onClick={onRefreshStatus}
                className="p-1.5 rounded-lg hover:bg-black/5 text-stone-700 transition-colors"
                title="Làm mới trạng thái máy chủ"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Optional Admin Model Selector (only verified non-paid accessible models) */}
          {showModelConfig && availableModels.length > 0 && (
            <div className="bg-[#F5F2EA] rounded-xl p-3.5 border border-[#E7E2D6] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="font-semibold text-stone-800">
                  Lựa chọn mô hình Gemini đã xác thực khả dụng trên tài khoản:
                </div>
                <div className="text-[11px] text-stone-600">
                  Mặc định máy chủ sử dụng <code className="font-mono">{serverStatus?.configuredModel}</code> (có thể cấu hình qua biến <code className="font-mono">GEMINI_MODEL</code>). Chọn mô hình khác nếu mô hình hiện tại hết hạn mức ngày.
                </div>
              </div>
              <select
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  setQuotaExhaustedNotice(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-white border border-[#D6CEBE] text-xs text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#9A3412]/30"
              >
                <option value="">Tự động theo cấu hình máy chủ ({serverStatus?.configuredModel})</option>
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Suggested Questions Grid */}
      <div className="space-y-2.5">
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
          Gợi ý câu hỏi mẫu theo chuẩn hồ sơ di sản:
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {sampleQuestions.map((q) => (
            <button
              key={q.title}
              type="button"
              onClick={() => handleAsk(q.text)}
              disabled={isLoading}
              className="text-left p-3 rounded-xl bg-white hover:bg-[#F5F2EA] border border-[#E7E2D6] hover:border-[#9A3412]/40 transition-all text-xs space-y-1 group shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="font-semibold text-stone-900 group-hover:text-[#9A3412] flex items-center justify-between">
                <span>{q.title}</span>
                <span className="text-[10px] text-stone-400 group-hover:text-[#9A3412]">
                  {isDailyQuotaLimited ? 'Tra cứu →' : 'Hỏi ngay →'}
                </span>
              </div>
              <p className="text-stone-600 line-clamp-2 text-[11px] leading-relaxed">
                {q.text}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Conversation Thread Area */}
      <div className="space-y-4 pt-2">
        {messages.length === 0 ? (
          <div className="bg-[#F5F2EA] rounded-2xl p-8 text-center border border-[#E7E2D6] space-y-3">
            <BookOpen className="w-10 h-10 text-stone-400 mx-auto" />
            <h3 className="font-serif font-bold text-stone-800 text-base">
              Hệ thống sẵn sàng tiếp nhận câu hỏi
            </h3>
            <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
              Bạn có thể hỏi về ý nghĩa từng bài Xoan, hệ thống 14 Quả Cách, Hát Thờ, Hát Hội, địa danh 4 phường Xoan gốc hoặc đối chiếu nguồn tài liệu.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setMessages([])}
                disabled={isLoading}
                className="text-[11px] font-medium text-stone-500 hover:text-[#9A3412] transition-colors disabled:opacity-50"
              >
                Xóa lịch sử hỏi đáp
              </button>
            </div>

            {messages.map((msg) => {
              const isFallbackOrError = msg.error || msg.mode === 'local_fallback';
              const isQuota429 = msg.httpStatus === 429;
              const recordsToShow = msg.fallbackRecords ?? msg.matchedRecords ?? [];
              const sourcesToShow = msg.fallbackSources ?? msg.citedSources ?? [];

              return (
                <div
                  key={msg.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    msg.sender === 'user'
                      ? 'bg-white border-[#E7E2D6] ml-4 sm:ml-12'
                      : msg.error
                      ? isQuota429
                        ? 'bg-amber-50/70 border-amber-200 text-amber-950 mr-2 sm:mr-10'
                        : 'bg-red-50/70 border-red-200 text-red-950 mr-2 sm:mr-10'
                      : msg.mode === 'local_fallback'
                      ? 'bg-[#F5F2EA] border-[#D6CEBE] mr-2 sm:mr-10'
                      : 'bg-[#FBF9F5] border-[#D6CEBE] mr-2 sm:mr-10'
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-black/5 text-[11px] text-stone-500">
                    <div className="flex flex-wrap items-center gap-2 font-semibold text-stone-800">
                      <span>
                        {msg.sender === 'user'
                          ? 'Bạn'
                          : msg.mode === 'local_fallback'
                          ? 'TRA CỨU TRỰC TIẾP TỪ KHO TƯ LIỆU'
                          : msg.error
                          ? isQuota429
                            ? 'Thông báo hạn mức Gemini (429)'
                            : `Thông báo dịch vụ AI${msg.httpStatus ? ` (${msg.httpStatus})` : ''}`
                          : 'Cố vấn tư liệu di sản (Gemini)'}
                      </span>
                      {msg.cached && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                          <Database className="w-3 h-3" />
                          <span>Từ bộ nhớ đệm</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{msg.timestamp}</span>
                      {!isFallbackOrError && (
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 hover:text-stone-900 text-stone-500 hover:bg-stone-200/50 rounded transition-colors"
                          title="Sao chép câu trả lời"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-medium">Đã chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Sao chép</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* User Message */}
                  {msg.sender === 'user' && (
                    <div className="text-xs sm:text-sm leading-relaxed text-stone-900 font-medium">
                      {msg.text}
                    </div>
                  )}

                  {/* Successful Gemini Answer */}
                  {msg.sender === 'assistant' && !isFallbackOrError && (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold tracking-wider uppercase text-[#9A3412]">
                          Câu trả lời
                        </div>
                        {msg.hasEvidence === false &&
                          (!msg.matchedRecords || msg.matchedRecords.length === 0) && (
                            <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-900 font-medium">
                              Chưa tìm thấy thông tin phù hợp trong 21 bản ghi hiện có.
                            </div>
                          )}
                        {renderFormattedText(msg.text)}
                      </div>

                      {/* Reference Section */}
                      {((msg.matchedRecords && msg.matchedRecords.length > 0) ||
                        (msg.citedSources && msg.citedSources.length > 0)) && (
                        <div className="pt-4 border-t border-[#E7E2D6] space-y-4">
                          <div className="text-[11px] font-bold tracking-wider uppercase text-stone-600">
                            Tư liệu đối chiếu
                          </div>

                          {msg.matchedRecords && msg.matchedRecords.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-[11px] font-semibold text-stone-500">
                                Bản ghi trong kho ({msg.matchedRecords.length}):
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {msg.matchedRecords.map((rec) => (
                                  <div
                                    key={rec.id}
                                    className="p-3 rounded-xl bg-white border border-[#E7E2D6] flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                                        <span className="font-mono font-bold text-[#9A3412]">
                                          {rec.id}
                                        </span>
                                        <span aria-hidden="true">·</span>
                                        <span className="truncate">{rec.nhom_bai}</span>
                                      </div>
                                      <div className="text-xs font-serif font-bold text-stone-900 truncate">
                                        {rec.ten_bai}
                                      </div>
                                    </div>
                                    {onSelectRecord && (
                                      <button
                                        type="button"
                                        onClick={() => onSelectRecord(rec)}
                                        className="px-2.5 py-1.5 rounded-lg bg-[#F5F2EA] hover:bg-[#9A3412] hover:text-white text-[#9A3412] text-[11px] font-semibold transition-colors shrink-0 inline-flex items-center gap-1"
                                      >
                                        <span>Mở bản ghi</span>
                                        <ArrowUpRight className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {msg.citedSources && msg.citedSources.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-[11px] font-semibold text-stone-500">
                                Nguồn đã sử dụng ({msg.citedSources.length}):
                              </div>
                              <div className="space-y-1.5">
                                {msg.citedSources.map((src) => (
                                  <div
                                    key={src.id}
                                    className="p-2.5 rounded-xl bg-white border border-[#E7E2D6] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                  >
                                    <div className="min-w-0 space-y-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono font-bold text-[#9A3412] text-[11px]">
                                          {src.id}
                                        </span>
                                        <span className="font-semibold text-stone-900 truncate">
                                          {src.ten_nguon}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-stone-500 truncate">
                                        {src.tac_gia_co_quan} · {src.nam_xuat_ban}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {src.link && (
                                        <a
                                          href={src.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-medium transition-colors"
                                        >
                                          <span>Xem nguồn</span>
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                      {onOpenSources && (
                                        <button
                                          type="button"
                                          onClick={onOpenSources}
                                          className="text-[11px] font-medium text-[#9A3412] hover:underline px-1.5"
                                        >
                                          Danh mục nguồn
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error & Direct Local Archive Lookup Mode (Never claims AI authorship) */}
                  {msg.sender === 'assistant' && isFallbackOrError && (
                    <div className="space-y-4">
                      {msg.error && (
                        <div className="space-y-1.5">
                          <div
                            className={`flex items-start gap-2 text-xs font-semibold ${
                              isQuota429 ? 'text-amber-900' : 'text-red-900'
                            }`}
                          >
                            <AlertTriangle
                              className={`w-4 h-4 shrink-0 mt-0.5 ${
                                isQuota429 ? 'text-amber-600' : 'text-red-700'
                              }`}
                            />
                            <span>{msg.text}</span>
                          </div>
                          {isQuota429 && (
                            <p className="text-[11px] text-amber-800 pl-6 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Thời điểm khôi phục:{' '}
                                {formatResetNotice(msg.retryAfterSeconds, msg.resetAt)}
                              </span>
                            </p>
                          )}
                        </div>
                      )}

                      {!msg.error && msg.mode === 'local_fallback' && (
                        <p className="text-xs text-stone-700 leading-relaxed">
                          Kết quả bên dưới được trích xuất trực tiếp từ 21 bản ghi và 9 nguồn lưu trữ (không sử dụng Gemini AI).
                        </p>
                      )}

                      {/* Required Action Buttons */}
                      {msg.failedQuestion && (
                        <div className="flex flex-wrap items-center gap-2">
                          {onOpenArchive && (
                            <button
                              type="button"
                              onClick={onOpenArchive}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-stone-50 text-stone-800 border border-[#D6CEBE] text-xs font-medium transition-colors"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-[#9A3412]" />
                              <span>Tra cứu trong 21 bản ghi</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleAsk(msg.failedQuestion, {
                                isRetry: true,
                                bypassCooldown: true,
                              })
                            }
                            disabled={isLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#9A3412] hover:bg-[#832b0e] text-white text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Thử lại khi Gemini khả dụng</span>
                          </button>
                        </div>
                      )}

                      {/* Direct Archive Search Results (Strictly non-AI) */}
                      <div className="pt-3 border-t border-black/10 space-y-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase text-[#9A3412]">
                          <FileText className="w-4 h-4 shrink-0" />
                          <span>TRA CỨU TRỰC TIẾP TỪ KHO TƯ LIỆU</span>
                        </div>

                        {msg.needsDeepReasoning && (
                          <div className="p-2.5 rounded-lg bg-white/80 border border-stone-300 text-[11px] text-stone-700 leading-relaxed">
                            Lưu ý giới hạn tìm kiếm cục bộ: Câu hỏi có yêu cầu tổng hợp hoặc phân tích chuyên sâu. Chế độ tra cứu trực tiếp chỉ hiển thị đúng dữ liệu gốc có trong hồ sơ lưu trữ, không tự suy diễn thay cho Gemini.
                          </div>
                        )}

                        {recordsToShow.length > 0 ? (
                          <div className="space-y-3">
                            <p className="text-xs text-stone-700">
                              Tìm thấy <strong className="text-stone-900">{recordsToShow.length}</strong> hồ sơ liên quan trong kho 21 bản ghi:
                            </p>

                            <div className="space-y-2.5">
                              {recordsToShow.map((rec) => (
                                <div
                                  key={rec.id}
                                  className="p-3.5 rounded-xl bg-white border border-[#E7E2D6] space-y-2"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="flex items-center gap-2 text-[11px] text-stone-500">
                                        <span className="font-mono font-bold text-[#9A3412]">
                                          {rec.id}
                                        </span>
                                        <span aria-hidden="true">·</span>
                                        <span>{rec.nhom_bai}</span>
                                      </div>
                                      <h4 className="font-serif font-bold text-stone-900 text-sm">
                                        {rec.ten_bai}
                                      </h4>
                                    </div>
                                    {onSelectRecord && (
                                      <button
                                        type="button"
                                        onClick={() => onSelectRecord(rec)}
                                        className="px-2.5 py-1.5 rounded-lg bg-[#9A3412] hover:bg-[#832b0e] text-white text-[11px] font-semibold transition-colors shrink-0"
                                      >
                                        Xem chi tiết
                                      </button>
                                    )}
                                  </div>

                                  <p className="text-xs text-stone-700 leading-relaxed">
                                    {rec.noi_dung_tom_tat}
                                  </p>

                                  {rec.boi_canh && (
                                    <p className="text-[11px] text-stone-600 leading-relaxed">
                                      <strong className="text-stone-800">Bối cảnh:</strong>{' '}
                                      {rec.boi_canh}
                                    </p>
                                  )}

                                  {rec.loi_ca_trich_doan && (
                                    <p className="text-[11px] italic text-stone-600 bg-[#FBF9F5] p-2 rounded-lg border border-[#E7E2D6]">
                                      “{rec.loi_ca_trich_doan}”
                                    </p>
                                  )}

                                  <div className="text-[11px] text-stone-500 space-y-0.5 pt-1">
                                    <div>
                                      <strong className="text-stone-700">Cộng đồng:</strong>{' '}
                                      {rec.cong_dong}
                                    </div>
                                    <div>
                                      <strong className="text-stone-700">Hiện nay:</strong>{' '}
                                      {rec.dia_danh_hien_nay}
                                    </div>
                                    <div>
                                      <strong className="text-stone-700">Trước 01/7/2025:</strong>{' '}
                                      {rec.dia_danh_cu}
                                    </div>
                                    <div>
                                      <strong className="text-stone-700">Mã nguồn:</strong>{' '}
                                      {rec.nguon_id.join(', ')}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {sourcesToShow.length > 0 && (
                              <div className="pt-2 space-y-1.5">
                                <div className="text-[11px] font-semibold text-stone-600">
                                  Nguồn đối chiếu của các hồ sơ tìm được ({sourcesToShow.length}):
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {sourcesToShow.map((src) => (
                                    <a
                                      key={src.id}
                                      href={src.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#E7E2D6] hover:border-[#9A3412]/50 text-[11px] text-stone-700"
                                    >
                                      <span className="font-mono font-bold text-[#9A3412]">
                                        {src.id}
                                      </span>
                                      <span className="truncate max-w-[200px]">
                                        {src.ten_nguon}
                                      </span>
                                      <ExternalLink className="w-3 h-3 text-[#9A3412]" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-stone-600">
                            Tra cứu trực tiếp không tìm thấy hồ sơ phù hợp trong 21 bản ghi hiện có (câu hỏi có thể nằm ngoài phạm vi Hát Xoan và Tín ngưỡng thờ Hùng Vương).
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Two-phase Loading Indicator */}
        {loadingPhase === 'searching' && (
          <div className="p-5 rounded-2xl bg-[#F5F2EA] border border-[#E7E2D6] text-xs text-stone-700 flex items-center gap-3">
            <Search className="w-4 h-4 text-[#9A3412] animate-pulse shrink-0" />
            <span>Đang tìm kiếm dữ liệu liên quan trong 21 bản ghi và 9 nguồn tư liệu...</span>
          </div>
        )}

        {loadingPhase === 'calling_gemini' && (
          <div className="p-5 rounded-2xl bg-[#F5F2EA] border border-[#E7E2D6] text-xs text-stone-700 flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-[#9A3412] animate-spin shrink-0" />
            <span>
              {foundCountPreview > 0
                ? `Đã tìm thấy ${foundCountPreview} hồ sơ liên quan. Đang gọi trợ lý Gemini tổng hợp câu trả lời...`
                : 'Đang gọi trợ lý Gemini đối chiếu phạm vi kho tư liệu...'}
            </span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk();
        }}
        className="sticky bottom-4 bg-[#FBF9F5]/95 backdrop-blur-md p-2 rounded-2xl border border-[#E7E2D6] shadow-md flex items-center gap-2"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={
            isDailyQuotaLimited
              ? 'Nhập từ khóa để tra cứu trực tiếp 21 bản ghi (ví dụ: Giáo trống, Du xuân cách)...'
              : 'Nhập câu hỏi về Hát Xoan và Tín ngưỡng thờ Hùng Vương...'
          }
          disabled={isLoading}
          className="flex-1 px-4 py-3 text-xs sm:text-sm bg-white rounded-xl border border-[#E7E2D6] focus:outline-none focus:ring-2 focus:ring-[#9A3412]/30 text-stone-900 placeholder:text-stone-400"
        />
        <button
          type="button"
          onClick={() => handleAsk(undefined, { forceLocal: true })}
          disabled={!question.trim() || isLoading}
          title="Tra cứu trực tiếp trong 21 bản ghi không tốn lượt gọi Gemini"
          className={`px-3 py-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-all ${
            question.trim() && !isLoading
              ? 'bg-white hover:bg-[#F5F2EA] text-stone-800 border-[#D6CEBE] cursor-pointer'
              : 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed'
          }`}
        >
          <Search className="w-4 h-4 text-[#9A3412]" />
          <span className="hidden md:inline">Tra cứu kho</span>
        </button>
        <button
          type="submit"
          disabled={!question.trim() || isLoading}
          className={`px-5 py-3 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-all shadow-xs ${
            question.trim() && !isLoading
              ? 'bg-[#9A3412] hover:bg-[#832b0e] text-white cursor-pointer'
              : 'bg-stone-300 text-stone-500 cursor-not-allowed'
          }`}
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">
            {isDailyQuotaLimited ? 'Tra cứu' : 'Gửi câu hỏi'}
          </span>
        </button>
      </form>

      {/* Grounding guarantee */}
      <div className="text-center text-[11px] text-stone-500 flex items-center justify-center gap-1.5 pt-2">
        <ShieldCheck className="w-3.5 h-3.5 text-[#9A3412]" />
        <span>
          Truy xuất đối chiếu trực tiếp từ 21 bản ghi (records.json) và 9 nguồn tư liệu (sources.json), hỗ trợ bộ nhớ đệm và tra cứu trực tiếp khi hết hạn mức API.
        </span>
      </div>
    </div>
  );
}
