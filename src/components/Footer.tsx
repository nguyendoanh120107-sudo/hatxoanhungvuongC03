import type { TabKey } from '../types.ts';
import { Heart, ShieldCheck, ExternalLink, Download } from 'lucide-react';
import { exportDataAsJson, RECORDS, SOURCES } from '../data/database.ts';

interface FooterProps {
  onSelectTab: (tab: TabKey) => void;
}

export function Footer({ onSelectTab }: FooterProps) {
  return (
    <footer className="mt-20 border-t border-[#E7E2D6] bg-[#F5F2EA] text-[#44403C]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1: About Project */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-[#9A3412] text-white flex items-center justify-center font-serif text-xs font-bold">
                X
              </div>
              <span className="font-serif font-bold text-base text-[#1C1917]">
                Dự Án C03: Hát Xoan & Thờ Hùng Vương
              </span>
            </div>
            <p className="text-xs leading-relaxed text-stone-600 max-w-lg">
              Công trình nghiên cứu số hóa phi lợi nhuận nhằm lưu trữ, tra cứu và tôn vinh Di sản văn hóa phi vật thể đại diện của nhân loại Hát Xoan Phú Thọ trong mối quan hệ gắn bó hữu cơ với Tín ngưỡng thờ cúng Hùng Vương.
            </p>
            <div className="text-xs text-stone-700 bg-[#EBE6DF] p-3 rounded-lg border border-[#D6CEBE]/80 space-y-1">
              <div>
                <strong className="text-stone-900">Tác giả:</strong> Nguyễn Ngọc Doanh · <strong className="text-stone-900">MSV:</strong> TH04122 · <strong className="text-stone-900">Nhóm:</strong> 2
              </div>
              <div>
                Chương trình Thực tập sinh Đợt 15 IMTA TECH x FPT Polytechnic
              </div>
              <div className="text-stone-500 text-[11px] pt-1">
                Dự án xã hội vì cộng đồng, phi thương mại, không thu phí, không quảng cáo.
              </div>
            </div>
          </div>

          {/* Col 2: Navigation & Sections */}
          <div className="space-y-3 text-xs">
            <h4 className="font-serif font-semibold text-stone-900 tracking-wide">
              Các chuyên mục
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTab('home')}
                  className="hover:text-[#9A3412] transition-colors"
                >
                  Trang chủ di sản
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTab('archive')}
                  className="hover:text-[#9A3412] transition-colors"
                >
                  Kho 21 bản ghi di sản
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTab('guilds')}
                  className="hover:text-[#9A3412] transition-colors"
                >
                  4 Phường Xoan gốc & Cửa đình
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTab('ask')}
                  className="hover:text-[#9A3412] transition-colors"
                >
                  Hỏi đáp tư liệu với Gemini
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTab('sources')}
                  className="hover:text-[#9A3412] transition-colors"
                >
                  9 Nguồn lưu trữ & Tri ân
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTab('author')}
                  className="hover:text-[#9A3412] transition-colors"
                >
                  Thông tin tác giả
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Research Ethics & Exports */}
          <div className="space-y-3 text-xs">
            <h4 className="font-serif font-semibold text-stone-900 tracking-wide">
              Đạo đức & Dữ liệu mở
            </h4>
            <p className="text-stone-600 leading-relaxed text-[11px]">
              Dự án thực hiện nghiêm ngặt quy tắc đạo đức di sản: Không giả phỏng vấn nghệ nhân, không sinh hình ảnh giả mạo chân dung hay nghi lễ, tôn trọng quyền sở hữu trí tuệ cộng đồng.
            </p>
            <div className="pt-1 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => exportDataAsJson(RECORDS, 'hat_xoan_21_records.json')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-stone-200/80 hover:bg-stone-300 text-stone-800 text-[11px] font-medium transition-colors w-fit"
                title="Tải toàn bộ 21 bản ghi dưới dạng JSON"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải dữ liệu 21 bản ghi (.json)</span>
              </button>
              <button
                type="button"
                onClick={() => exportDataAsJson(SOURCES, 'hat_xoan_9_sources.json')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-stone-200/80 hover:bg-stone-300 text-stone-800 text-[11px] font-medium transition-colors w-fit"
                title="Tải 9 nguồn tư liệu dưới dạng JSON"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải 9 nguồn tư liệu (.json)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-6 border-t border-[#E7E2D6] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-stone-500">
          <div>
            Địa bàn nghiên cứu: Phường Vân Phú, tỉnh Phú Thọ (Địa danh cũ trước 01/7/2025: xã Phượng Lâu và xã Kim Đức, TP. Việt Trì).
          </div>
          <div className="flex items-center gap-1">
            <span>Đề án Thực tập sinh IMTA TECH x FPT Polytechnic</span>
            <span>·</span>
            <span>Dự án C03</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
