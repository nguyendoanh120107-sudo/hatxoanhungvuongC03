import { SOURCES, exportDataAsJson } from '../data/database.ts';
import { ShieldCheck, ExternalLink, Download, Heart, BookCheck, Users, Landmark } from 'lucide-react';

export function SourcesCommunityScreen() {
  return (
    <div className="space-y-12 py-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E7E2D6] pb-6">
        <div>
          <div className="text-xs font-semibold text-[#9A3412] tracking-wider uppercase">
            Hồ sơ học thuật & Tài liệu lưu trữ
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1">
            9 Nguồn Tư Liệu Xác Thực & Ghi Nhận Cộng Đồng
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1.5 max-w-2xl leading-relaxed">
            Hệ thống danh mục tài liệu gốc từ hồ sơ đệ trình UNESCO, Viện Âm nhạc Quốc gia, Cục Di sản Văn hóa và các công trình nghiên cứu dân tộc nhạc học của các học giả hàng đầu.
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportDataAsJson(SOURCES, 'hat_xoan_9_sources.json')}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white hover:bg-stone-50 border border-[#E7E2D6] text-stone-800 transition-colors shadow-2xs shrink-0"
          title="Xuất file JSON danh mục 9 nguồn tư liệu"
        >
          <Download className="w-4 h-4 text-[#9A3412]" />
          <span>Tải danh mục nguồn (.json)</span>
        </button>
      </div>

      {/* Grid of 9 Authentic Sources */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {SOURCES.map((source) => (
          <div
            key={source.id}
            className="bg-white rounded-xl p-5 border border-[#E7E2D6] hover:border-[#9A3412]/40 transition-all flex flex-col justify-between space-y-4 shadow-2xs"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-[#9A3412] bg-[#9A3412]/10 px-2 py-0.5 rounded">
                  {source.id}
                </span>
                <span className="text-[11px] text-stone-500 font-medium">
                  {source.loai_hinh}
                </span>
              </div>

              <h3 className="font-serif font-bold text-stone-900 text-sm leading-snug">
                {source.ten_nguon}
              </h3>

              <div className="text-xs text-stone-600 space-y-1">
                <div>
                  <strong className="text-stone-700">Cơ quan / Tác giả:</strong> {source.tac_gia_co_quan}
                </div>
                <div>
                  <strong className="text-stone-700">Năm công bố:</strong> {source.nam_xuat_ban}
                </div>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed pt-1 border-t border-[#E7E2D6]/70">
                {source.mo_ta}
              </p>
            </div>

            <div className="pt-3 border-t border-[#E7E2D6] flex items-center justify-between text-xs">
              <span className="text-[11px] text-stone-400">Nguồn chính thống</span>
              {source.link ? (
                <a
                  href={source.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#9A3412] hover:underline font-semibold"
                >
                  <span>Truy cập nguồn</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="text-stone-400 italic text-[11px]">Lưu trữ bản giấy</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Community Tribute Section */}
      <section className="bg-[#F5F2EA] rounded-2xl p-6 sm:p-8 border border-[#E7E2D6] space-y-6">
        <div className="flex items-center gap-2.5">
          <Heart className="w-5 h-5 text-[#9A3412]" />
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900">
            Tri Ân Cộng Đồng 4 Phường Xoan Gốc
          </h2>
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-stone-700 leading-relaxed max-w-4xl">
          <p>
            Dự án xin bày tỏ lòng biết ơn sâu sắc nhất tới toàn thể cộng đồng cư dân và các bậc nghệ nhân cao niên, các cụ Trùm phường, kép, đào thuộc 4 phường Xoan gốc: <strong>An Thái, Phù Đức, Kim Đái (Kim Đới) và Thét</strong>.
          </p>
          <p>
            Chính sự bền bỉ gìn giữ "cha truyền con nối", những đêm hát canh cửa đình không mệt mỏi, và sự trao truyền hào hiệp qua nhiều thế hệ đã giúp nghệ thuật Hát Xoan vượt qua những thăng trầm của lịch sử, được vinh danh là Di sản văn hóa phi vật thể đại diện của nhân loại.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          {[
            {
              title: 'Phường An Thái',
              role: 'Bảo lưu lề lối hát thờ uy nghiêm và nghĩa tình giã bạn',
            },
            {
              title: 'Phường Phù Đức',
              role: 'Giữ ngọn lửa huyền thoại Miếu Lãi Lèn cội nguồn',
            },
            {
              title: 'Phường Kim Đái',
              role: 'Lưu giữ tinh hoa âm luật 14 Quả Cách thi ca bác học',
            },
            {
              title: 'Phường Thét',
              role: 'Gìn giữ sự phong phú của các điệu Hát Hội và múa Bỏ Bộ',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white p-4 rounded-xl border border-[#E7E2D6] space-y-1.5"
            >
              <h4 className="font-serif font-bold text-stone-900 text-sm">{item.title}</h4>
              <p className="text-[11px] text-stone-600 leading-relaxed">{item.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ethical Code Confirmation */}
      <section className="bg-white rounded-xl p-6 border border-[#E7E2D6] space-y-3">
        <div className="flex items-center gap-2 font-serif font-bold text-stone-900 text-base">
          <ShieldCheck className="w-4 h-4 text-[#9A3412]" />
          <span>Chuẩn mực liêm chính học thuật di sản</span>
        </div>
        <p className="text-xs text-stone-600 leading-relaxed">
          Tất cả 21 bản ghi trong dự án được tổng hợp trung thực từ các công trình khảo cứu đã được thẩm định khoa học. Đề tài cam kết không tự sáng tác thêm bản ghi giả mạo, không mô tả tư liệu tổng hợp là tài liệu do cá nhân tự phát hiện, và luôn đối chiếu chéo với 9 nguồn tư liệu chính thống được công bố.
        </p>
      </section>
    </div>
  );
}
