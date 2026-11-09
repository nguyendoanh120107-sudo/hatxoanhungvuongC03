import { useState, useEffect } from 'react';
import type { ServerStatus } from '../types.ts';
import { Sparkles, Send, AlertTriangle, CheckCircle, Copy, Check, RefreshCw, BookOpen, ShieldCheck } from 'lucide-react';

interface GeminiQAScreenProps {
  serverStatus: ServerStatus | null;
  onRefreshStatus: () => void;
}

interface MessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  error?: boolean;
}

export function GeminiQAScreen({ serverStatus, onRefreshStatus }: GeminiQAScreenProps) {
  const [question, setQuestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sampleQuestions = [
    {
      title: 'Ý nghĩa bài Giáo trống',
      text: 'Bài Giáo trống có ý nghĩa gì trong chặng Hát Thờ và được diễn xướng trong bối cảnh nào?',
    },
    {
      title: 'Hệ thống 14 Quả Cách',
      text: 'Hệ thống 14 Quả Cách của Hát Xoan gồm những bài nào? Cho biết ý nghĩa của bài Du xuân cách và Tứ mùa cách.',
    },
    {
      title: 'Chặng Hát Hội & Đố Huê',
      text: 'Bài Xin Huê Đố Huê thuộc chặng hát nào và có đặc điểm giao duyên đối đáp ra sao?',
    },
    {
      title: 'Địa danh hành chính 4 phường',
      text: 'Phạm vi địa lý hiện nay và địa danh cũ trước 01/7/2025 của cộng đồng 4 phường Xoan là gì?',
    },
    {
      title: 'Kiểm tra câu hỏi ngoài dữ liệu',
      text: 'Cho tôi biết thông tin về các làn điệu Quan họ Bắc Ninh hoặc Ca trù Thăng Long?',
    },
  ];

  const handleAsk = async (queryText?: string) => {
    const textToSend = queryText || question;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: MessageItem = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuestion('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: textToSend.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Lỗi khi kết nối với máy chủ AI.');
      }

      const botMsg: MessageItem = {
        id: 'bot_' + Date.now(),
        sender: 'assistant',
        text: data.answer || 'Chưa có tư liệu trong cơ sở dữ liệu để trả lời câu hỏi này.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errMsg: MessageItem = {
        id: 'err_' + Date.now(),
        sender: 'assistant',
        text: err?.message || 'Không thể nhận phản hồi từ Gemini. Vui lòng kiểm tra lại kết nối mạng.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        error: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
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
          Tra cứu chuyên sâu được đối chiếu nghiêm ngặt trên nền tảng 21 bản ghi di sản (records.json) và 9 nguồn lưu trữ uy tín (sources.json). Hệ thống chỉ trả lời đúng phạm vi tư liệu xác thực.
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
            Máy chủ AI Studio hiện chưa phát hiện biến môi trường <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">GEMINI_API_KEY</code> trong hệ thống Secrets.
            Để sử dụng tính năng hỏi đáp chuyên sâu này, bạn vui lòng gắn khóa API tại thanh công cụ <strong>Settings &gt; Secrets</strong> của AI Studio.
          </p>
          <div className="pt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={onRefreshStatus}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Kiểm tra lại trạng thái</span>
            </button>
            <span className="text-stone-500 text-[11px]">
              Tất cả các tính năng tra cứu 21 bản ghi, phát âm thanh và xuất JSON khác vẫn hoạt động bình thường!
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 rounded-xl p-3.5 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Máy chủ đã kết nối sẵn sàng với mô hình <strong>Gemini 3.8 Flash</strong>. Dữ liệu câu trả lời sẽ được trích xuất trực tiếp từ 21 bản ghi di sản.
            </span>
          </div>
          <button
            type="button"
            onClick={onRefreshStatus}
            className="p-1 rounded text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 transition-colors"
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
              className="text-left p-3 rounded-xl bg-white hover:bg-[#F5F2EA] border border-[#E7E2D6] hover:border-[#9A3412]/40 transition-all text-xs space-y-1 group shadow-2xs"
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
              Bạn có thể hỏi về nguồn gốc từng bài Xoan, lời ca, cấu trúc 14 quả cách, phong tục kết nghĩa giã bạn hay mối liên hệ với Giỗ Tổ Hùng Vương.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-5 rounded-2xl border transition-all ${
                  msg.sender === 'user'
                    ? 'bg-white border-[#E7E2D6] ml-6 sm:ml-12'
                    : msg.error
                    ? 'bg-red-50 border-red-200 text-red-900 mr-6 sm:mr-12'
                    : 'bg-[#FBF9F5] border-[#D6CEBE] mr-6 sm:mr-12'
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-black/5 text-[11px] text-stone-500">
                  <span className="font-semibold text-stone-800">
                    {msg.sender === 'user' ? 'Bạn' : 'Cố vấn tư liệu di sản (Gemini)'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>{msg.timestamp}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="p-1 hover:text-stone-800 text-stone-400 rounded transition-colors"
                      title="Sao chép câu trả lời"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans text-stone-800">
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="p-5 rounded-2xl bg-[#F5F2EA] border border-[#E7E2D6] text-xs text-stone-600 flex items-center gap-3 animate-pulse">
            <Sparkles className="w-4 h-4 text-[#9A3412] animate-spin" />
            <span>Đang tra cứu cơ sở dữ liệu 21 bản ghi di sản và 9 nguồn lưu trữ...</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk();
        }}
        className="sticky bottom-4 bg-[#FBF9F5]/90 backdrop-blur-md p-2 rounded-2xl border border-[#E7E2D6] shadow-md flex items-center gap-2"
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
          Cơ chế khóa căn cứ nghiêm ngặt (Strict Grounding): Chỉ trả lời thông tin có trong 21 bản ghi và 9 nguồn lưu trữ.
        </span>
      </div>
    </div>
  );
}
