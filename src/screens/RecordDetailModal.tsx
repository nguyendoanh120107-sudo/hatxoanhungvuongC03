import { useEffect } from 'react';
import type { RecordItem } from '../types.ts';
import { getSourceById, exportDataAsJson } from '../data/database.ts';
import { AudioSpeechReader } from '../components/AudioSpeechReader.tsx';
import { X, Download, MapPin, Users, BookOpen, Quote, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

interface RecordDetailModalProps {
  record: RecordItem | null;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onViewSource?: (sourceId: string) => void;
}

export function RecordDetailModal({
  record,
  onClose,
  onNext,
  onPrev,
  hasPrev,
  hasNext,
  onViewSource,
}: RecordDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && hasNext && onNext) onNext();
      if (e.key === 'ArrowLeft' && hasPrev && onPrev) onPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, hasNext, hasPrev, onNext, onPrev]);

  if (!record) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
    >
      {/* Background click to close */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Card */}
      <div className="relative w-full max-w-3xl bg-[#FBF9F5] rounded-2xl border border-[#E7E2D6] shadow-2xl overflow-hidden my-6 z-10">
        {/* Top bar of modal */}
        <div className="bg-[#F5F2EA] px-6 py-4 border-b border-[#E7E2D6] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#9A3412]/10 text-[#9A3412] border border-[#9A3412]/20">
              {record.id}
            </span>
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              {record.nhom_bai}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportDataAsJson(record, `${record.id}_${record.ten_bai}.json`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-[#E7E2D6] hover:bg-stone-50 text-stone-700 transition-colors shadow-2xs"
              title="Xuất bản ghi này dưới dạng file JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xuất JSON</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
              aria-label="Đóng bảng chi tiết"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Title & Stage */}
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1C1917] tracking-tight">
              {record.ten_bai}
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              {record.noi_dung_tom_tat}
            </p>
          </div>

          {/* Web Speech Synthesis for lyrics recitation */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-800">
              <Quote className="w-4 h-4 text-[#9A3412]" />
              <span>Trích đoạn lời ca cổ truyền</span>
            </div>
            <div className="p-4 rounded-xl bg-white border border-[#E7E2D6] font-serif text-sm sm:text-base leading-relaxed text-stone-800 italic space-y-1.5">
              {record.loi_ca_trich_doan.split('/').map((line, idx) => (
                <p key={idx} className="pl-3 border-l-2 border-[#9A3412]/30">
                  {line.trim()}
                </p>
              ))}
            </div>

            {/* Audio Reader Component */}
            <AudioSpeechReader
              text={record.loi_ca_trich_doan}
              title={record.ten_bai}
              pieceId={record.id}
            />
          </div>

          {/* Detailed Metadata Grid */}
          <div className="pt-2 border-t border-[#E7E2D6] space-y-4 text-xs">
            {/* Geographic Dual-Fields */}
            <div className="bg-[#F5F2EA] p-4 rounded-xl border border-[#E7E2D6] space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-stone-800">
                <MapPin className="w-4 h-4 text-[#9A3412]" />
                <span>Địa bàn hành chính & Không gian di sản:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-stone-600">
                <div>
                  <span className="font-semibold text-stone-800 block">Địa bàn hiện nay:</span>
                  <span>{record.dia_danh_hien_nay}</span>
                </div>
                <div>
                  <span className="font-semibold text-stone-800 block">
                    Địa danh cũ (trước 01/7/2025):
                  </span>
                  <span>{record.dia_danh_cu}</span>
                </div>
              </div>
            </div>

            {/* Community & Practice Context */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#9A3412]" />
                  <span>Cộng đồng thực hành:</span>
                </span>
                <p className="text-stone-600 leading-relaxed">{record.cong_dong}</p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#9A3412]" />
                  <span>Bối cảnh diễn xướng:</span>
                </span>
                <p className="text-stone-600 leading-relaxed">{record.boi_canh}</p>
              </div>
            </div>

            {/* Custodians & Usage Scope */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E7E2D6]">
              <div className="space-y-1">
                <span className="font-semibold text-stone-800">Người cung cấp & lưu trữ:</span>
                <p className="text-stone-600 leading-relaxed">{record.nguoi_cung_cap}</p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-stone-800">Phạm vi sử dụng:</span>
                <p className="text-stone-600 leading-relaxed">{record.pham_vi_su_dung}</p>
              </div>
            </div>

            {/* Cited Sources */}
            <div className="pt-2 border-t border-[#E7E2D6] space-y-2">
              <span className="font-semibold text-stone-800">Nguồn tư liệu tham chiếu:</span>
              <div className="flex flex-wrap gap-2">
                {record.nguon_id.map((sId) => {
                  const s = getSourceById(sId);
                  return (
                    <div
                      key={sId}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#E7E2D6] text-[11px] text-stone-700 hover:border-[#9A3412]/50 transition-colors"
                    >
                      <span className="font-mono font-bold text-[#9A3412]">{sId}</span>
                      <span className="truncate max-w-[200px] sm:max-w-xs">{s ? s.ten_nguon : sId}</span>
                      {s && s.link && (
                        <a
                          href={s.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#9A3412] hover:underline"
                          title="Mở liên kết nguồn chính thức"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer with Previous / Next Navigation */}
        <div className="bg-[#F5F2EA] px-6 py-3 border-t border-[#E7E2D6] flex items-center justify-between">
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev}
            className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              hasPrev
                ? 'text-stone-700 hover:bg-stone-200'
                : 'text-stone-300 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Bản ghi trước</span>
          </button>

          <span className="text-xs text-stone-400 font-mono">
            {record.id} / 21
          </span>

          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              hasNext
                ? 'text-stone-700 hover:bg-stone-200'
                : 'text-stone-300 cursor-not-allowed'
            }`}
          >
            <span>Bản ghi sau</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
