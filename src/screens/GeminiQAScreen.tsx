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
  text: string;
  timestamp: string;
  model?: string;
  hasEvidence?: boolean;
  matchedRecords?: RecordItem[];
  citedSources?: SourceItem[];
  error?: boolean;
  errorCode?: string;
  httpStatus?: number;
  failedQuestion?: string;
  fallbackRecords?: RecordItem[];
  fallbackSources?: SourceItem[];
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

        // Render **bold** segments safely as React elements
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
  const inFlightRef = useRef<boolean>(false);

  const isLoading = loadingPhase !== 'idle';

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

  const handleAsk = async (queryText?: string, isRetry = false) => {
    const textToSend = (queryText ?? question).trim();
    if (!textToSend || inFlightRef.current) return;

    inFlightRef.current = true;

    const userMsg: MessageItem = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!isRetry && !queryText) {
      setQuestion('');
    } else if (!isRetry && queryText) {
      setQuestion('');
    }

    // Phase 1: Search relevant records in the archive
    setLoadingPhase('searching');
    setFoundCountPreview(0);

    let localFallback = retrieveHeritageRecords(textToSend, RECORDS, SOURCES);

    try {
      const searchRes = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: textToSend }),
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        setFoundCountPreview(Number(searchData.totalFound || 0));
        if (Array.isArray(searchData.records)) {
          localFallback = {
            ...localFallback,
            records: searchData.records,
            sources: searchData.sources || [],
          };
        }
      } else {
        setFoundCountPreview(localFallback.records.length);
      }
    } catch {
      setFoundCountPreview(localFallback.records.length);
    }

    // Phase 2: Call Gemini endpoint with retrieved evidence
    setLoadingPhase('calling_gemini');

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: textToSend }),
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await res.json()
        : {
            error: `HTTP_${res.status}`,
            httpStatus: res.status,
            message: 'Máy chủ trả về định dạng không hợp lệ.',
          };

      if (!res.ok || data.status === 'error') {
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
          text:
            data.message ||
            'Không thể kết nối trợ lý Gemini lúc này. Dữ liệu tư liệu vẫn có thể tra cứu trực tiếp.',
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          error: true,
          errorCode: data.error || `HTTP_${res.status}`,
          httpStatus: data.httpStatus || res.status,
          failedQuestion: textToSend,
          fallbackRecords: errRecords,
          fallbackSources: errSources,
        };

        setMessages((prev) => [...prev, errMsg]);
        return;
      }

      const botMsg: MessageItem = {
        id: 'bot_' + Date.now(),
        sender: 'assistant',
        text: data.answer || 'Chưa tìm thấy thông tin phù hợp trong 21 bản ghi hiện có.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        model: data.model,
        hasEvidence: Boolean(data.hasEvidence),
        matchedRecords: Array.isArray(data.matchedRecords) ? data.matchedRecords : [],
        citedSources: Array.isArray(data.citedSources) ? data.citedSources : [],
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      // Network/connection failure: never fake an AI response; provide local fallback records
      const errMsg: MessageItem = {
        id: 'err_' + Date.now(),
        sender: 'assistant',
        text: 'Không thể kết nối trợ lý Gemini lúc này. Dữ liệu tư liệu vẫn có thể tra cứu trực tiếp.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        error: true,
        errorCode: 'NETWORK_ERROR',
        failedQuestion: textToSend,
        fallbackRecords: localFallback.records,
        fallbackSources: localFallback.sources,
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
          Hệ thống tìm kiếm đối chiếu trên 21 bản ghi di sản (records.json) và 9 nguồn lưu trữ uy tín (sources.json), kết hợp tổng hợp học thuật qua Gemini.
        </p>
      </div>

      {/* API Key Status Notice */}
      {serverStatus && !serverStatus.hasApiKey ? (
        <div className="bg-amber-50 rounded-xl p-5 border border-amber-200 text-xs text-amber-900 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Chưa cấu hình GEMINI_API_KEY tại máy chủ</span>
          </div>
          <p className="leading-relaxed">
            Máy chủ hiện chưa phát hiện biến môi trường <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">GEMINI_API_KEY</code> trong hệ thống Secrets.
            Vui lòng cấu hình khóa tại <strong>Settings &gt; Secrets</strong> để kích hoạt trợ lý Gemini. Khi chưa có khóa, hệ thống vẫn hỗ trợ tra cứu trực tiếp trên 21 bản ghi.
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
                <span>Mở Kho 21 bản ghi</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 rounded-xl p-3.5 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Máy chủ đã kết nối sẵn sàng với dịch vụ <strong>Gemini AI</strong> và bộ tìm kiếm RAG trên {serverStatus?.totalRecords ?? 21} bản ghi, {serverStatus?.totalSources ?? 9} nguồn tư liệu.
            </span>
          </div>
          <button
            type="button"
            onClick={onRefreshStatus}
            className="p-1 rounded text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 transition-colors shrink-0"
            title="Làm mới trạng thái"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
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
                <span className="text-[10px] text-stone-400 group-hover:text-[#9A3412]">Hỏi ngay &rarr;</span>
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

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-5 rounded-2xl border transition-all ${
                  msg.sender === 'user'
                    ? 'bg-white border-[#E7E2D6] ml-4 sm:ml-12'
                    : msg.error
                    ? 'bg-red-50/70 border-red-200 text-red-950 mr-2 sm:mr-10'
                    : 'bg-[#FBF9F5] border-[#D6CEBE] mr-2 sm:mr-10'
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-black/5 text-[11px] text-stone-500">
                  <div className="flex items-center gap-2 font-semibold text-stone-800">
                    <span>
                      {msg.sender === 'user'
                        ? 'Bạn'
                        : msg.error
                        ? `Thông báo dịch vụ AI${msg.httpStatus ? ` (${msg.httpStatus})` : ''}`
                        : 'Cố vấn tư liệu di sản (Gemini)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{msg.timestamp}</span>
                    {!msg.error && (
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
                {msg.sender === 'assistant' && !msg.error && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold tracking-wider uppercase text-[#9A3412]">
                        Câu trả lời
                      </div>
                      {msg.hasEvidence === false && (!msg.matchedRecords || msg.matchedRecords.length === 0) && (
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

                        {/* Matched Records List */}
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
                                      <span className="font-mono font-bold text-[#9A3412]">{rec.id}</span>
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

                        {/* Cited Sources List */}
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

                {/* Error + Local Search Fallback Mode */}
                {msg.sender === 'assistant' && msg.error && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-red-900">
                        <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
                        <span>
                          Không thể kết nối trợ lý Gemini lúc này. Dữ liệu tư liệu vẫn có thể tra cứu trực tiếp.
                        </span>
                      </div>
                      <p className="text-xs text-red-800 leading-relaxed pl-6">
                        {msg.text}
                      </p>
                    </div>

                    {/* Retry & Archive actions */}
                    {msg.failedQuestion && (
                      <div className="flex flex-wrap items-center gap-2 pl-6">
                        <button
                          type="button"
                          onClick={() => handleAsk(msg.failedQuestion, true)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Thử lại câu hỏi này</span>
                        </button>
                        {onOpenArchive && (
                          <button
                            type="button"
                            onClick={onOpenArchive}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-stone-50 text-stone-700 border border-red-200 text-xs font-medium transition-colors"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-[#9A3412]" />
                            <span>Mở Kho 21 bản ghi</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Local Fallback Search Results (Honest, non-AI) */}
                    <div className="pt-3 border-t border-red-200/80 space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800">
                        <FileText className="w-4 h-4 text-[#9A3412]" />
                        <span>Chế độ tra cứu trực tiếp từ kho tư liệu (không dùng AI):</span>
                      </div>

                      {msg.fallbackRecords && msg.fallbackRecords.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-xs text-stone-700">
                            Tạm thời không thể sử dụng Gemini. Đã tìm thấy{' '}
                            <strong className="text-stone-900">{msg.fallbackRecords.length}</strong> hồ sơ liên quan trong kho tư liệu. Bạn có thể xem trực tiếp các hồ sơ bên dưới.
                          </p>

                          <div className="space-y-2">
                            {msg.fallbackRecords.map((rec) => (
                              <div
                                key={rec.id}
                                className="p-3.5 rounded-xl bg-white border border-[#E7E2D6] space-y-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2 text-[11px] text-stone-500">
                                      <span className="font-mono font-bold text-[#9A3412]">{rec.id}</span>
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
                                <p className="text-xs text-stone-600 leading-relaxed">
                                  {rec.noi_dung_tom_tat}
                                </p>
                                <div className="text-[11px] text-stone-500 space-y-0.5">
                                  <div>
                                    <strong className="text-stone-700">Hiện nay:</strong> {rec.dia_danh_hien_nay}
                                  </div>
                                  <div>
                                    <strong className="text-stone-700">Trước 01/7/2025:</strong> {rec.dia_danh_cu}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {msg.fallbackSources && msg.fallbackSources.length > 0 && (
                            <div className="pt-2 space-y-1.5">
                              <div className="text-[11px] font-semibold text-stone-600">
                                Nguồn liên kết của các hồ sơ tìm được ({msg.fallbackSources.length}):
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {msg.fallbackSources.map((src) => (
                                  <a
                                    key={src.id}
                                    href={src.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#E7E2D6] hover:border-[#9A3412]/50 text-[11px] text-stone-700"
                                  >
                                    <span className="font-mono font-bold text-[#9A3412]">{src.id}</span>
                                    <span className="truncate max-w-[200px]">{src.ten_nguon}</span>
                                    <ExternalLink className="w-3 h-3 text-[#9A3412]" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-stone-600">
                          Tra cứu cục bộ không tìm thấy hồ sơ khớp trực tiếp trong 21 bản ghi hiện có cho câu hỏi này.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
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
          placeholder="Nhập câu hỏi về Hát Xoan và Tín ngưỡng thờ Hùng Vương..."
          disabled={isLoading}
          className="flex-1 px-4 py-3 text-xs sm:text-sm bg-white rounded-xl border border-[#E7E2D6] focus:outline-none focus:ring-2 focus:ring-[#9A3412]/30 text-stone-900 placeholder:text-stone-400"
        />
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
          <span className="hidden sm:inline">Gửi câu hỏi</span>
        </button>
      </form>

      {/* Grounding guarantee */}
      <div className="text-center text-[11px] text-stone-500 flex items-center justify-center gap-1.5 pt-2">
        <ShieldCheck className="w-3.5 h-3.5 text-[#9A3412]" />
        <span>
          Truy xuất đối chiếu trực tiếp từ 21 bản ghi (records.json) và 9 nguồn tư liệu (sources.json), có chế độ tra cứu dự phòng khi API bận.
        </span>
      </div>
    </div>
  );
}
