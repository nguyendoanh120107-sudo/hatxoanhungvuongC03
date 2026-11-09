import { useState, useMemo } from 'react';
import type { RecordItem } from '../types.ts';
import { RECORDS, exportDataAsJson } from '../data/database.ts';
import { Search, Filter, Download, BookOpen, Volume2, MapPin, Users, ArrowUpRight } from 'lucide-react';

interface ArchiveScreenProps {
  onSelectRecord: (record: RecordItem) => void;
}

export function ArchiveScreen({ onSelectRecord }: ArchiveScreenProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  const filteredRecords = useMemo(() => {
    return RECORDS.filter((rec) => {
      // Group filter
      if (selectedGroup !== 'all' && rec.nhom_bai !== selectedGroup) {
        return false;
      }
      // Search term
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        rec.id.toLowerCase().includes(q) ||
        rec.ten_bai.toLowerCase().includes(q) ||
        rec.nhom_bai.toLowerCase().includes(q) ||
        rec.noi_dung_tom_tat.toLowerCase().includes(q) ||
        rec.loi_ca_trich_doan.toLowerCase().includes(q) ||
        rec.dia_danh_cu.toLowerCase().includes(q) ||
        rec.dia_danh_hien_nay.toLowerCase().includes(q)
      );
    });
  }, [searchTerm, selectedGroup]);

  return (
    <div className="space-y-8 py-6">
      {/* Header and overview */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E7E2D6] pb-6">
        <div>
          <div className="text-xs font-semibold text-[#9A3412] tracking-wider uppercase">
            Cơ sở dữ liệu di sản
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1">
            Kho 21 Bản Ghi Hát Xoan Cổ Truyền
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1.5 max-w-2xl leading-relaxed">
            Tuyển tập 21 bài bản Xoan lưu truyền tại cộng đồng 4 họ Xoan gốc, lưu giữ nguyên vẹn 2 trường địa danh hành chính và lời ca trích đoạn có dấu.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => exportDataAsJson(filteredRecords, 'hat_xoan_filtered_records.json')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white hover:bg-stone-50 border border-[#E7E2D6] text-stone-800 transition-colors shadow-2xs"
            title="Xuất danh sách đang lọc dưới dạng file JSON"
          >
            <Download className="w-4 h-4 text-[#9A3412]" />
            <span>Xuất JSON ({filteredRecords.length})</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#F5F2EA] rounded-xl p-4 border border-[#E7E2D6] space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên bài (ví dụ: Du xuân cách, Thơ nhang, Giáo trống...), lời ca, mã bản ghi..."
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-lg bg-white border border-[#E7E2D6] focus:outline-none focus:ring-2 focus:ring-[#9A3412]/30 text-stone-900 placeholder:text-stone-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700"
              >
                Xóa
              </button>
            )}
          </div>

          {/* Group Tabs (Segmented Buttons) */}
          <div className="flex items-center gap-1 p-1 bg-stone-200/70 rounded-lg overflow-x-auto">
            {[
              { id: 'all', label: 'Tất cả (21)' },
              { id: 'Hát Thờ', label: 'Hát Thờ (4)' },
              { id: 'Hát Quả Cách', label: '14 Quả Cách' },
              { id: 'Hát Hội', label: 'Hát Hội (3)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedGroup(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  selectedGroup === tab.id
                    ? 'bg-white text-stone-900 shadow-xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Counter & quick search hints */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 pt-1">
          <div>
            Hiển thị <span className="font-semibold text-stone-900">{filteredRecords.length}</span> / 21 bản ghi
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span>Gợi ý tìm nhanh:</span>
            {['Giáo trống', 'Càn vị cách', 'Xin Huê', 'Thuyền chèo'].map((kw) => (
              <button
                key={kw}
                type="button"
                onClick={() => setSearchTerm(kw)}
                className="underline hover:text-[#9A3412] transition-colors"
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Records */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-[#E7E2D6] space-y-3">
          <BookOpen className="w-8 h-8 text-stone-300 mx-auto" />
          <h3 className="text-base font-semibold text-stone-800">
            Không tìm thấy bản ghi phù hợp
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Không có bài Xoan nào khớp với từ khóa "{searchTerm}". Vui lòng thử từ khóa khác hoặc xóa bộ lọc.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedGroup('all');
            }}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRecords.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl p-5 border border-[#E7E2D6] hover:border-[#9A3412]/40 hover:shadow-xs transition-all flex flex-col justify-between space-y-4"
            >
              {/* Header of Card */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span className="font-mono font-bold text-[#9A3412] bg-[#9A3412]/10 px-2 py-0.5 rounded">
                    {item.id}
                  </span>
                  <span className="font-medium text-stone-600">{item.nhom_bai}</span>
                </div>

                <div>
                  <h3 className="text-lg font-serif font-bold text-stone-900 group-hover:text-[#9A3412] transition-colors">
                    {item.ten_bai}
                  </h3>
                  <p className="text-xs text-stone-600 line-clamp-2 mt-1 leading-relaxed">
                    {item.noi_dung_tom_tat}
                  </p>
                </div>

                {/* Excerpt of Lyrics */}
                <div className="p-3 rounded-lg bg-[#FBF9F5] border border-[#E7E2D6]/80 text-xs font-serif italic text-stone-700 leading-relaxed line-clamp-3">
                  "{item.loi_ca_trich_doan}"
                </div>

                {/* Geographic & Community Info */}
                <div className="space-y-1.5 text-[11px] text-stone-500 pt-1">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#9A3412] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-stone-700">Hiện nay:</strong> {item.dia_danh_hien_nay}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5 pl-5 text-[10px] text-stone-400">
                    <span>
                      <strong className="text-stone-600">Trước 01/7/2025:</strong> {item.dia_danh_cu}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#E7E2D6] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectRecord(item)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A3412] hover:text-[#832b0e] transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Xem chi tiết & Nghe đọc</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    exportDataAsJson(item, `${item.id}_${item.ten_bai}.json`);
                  }}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                  title="Tải JSON bản ghi"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
