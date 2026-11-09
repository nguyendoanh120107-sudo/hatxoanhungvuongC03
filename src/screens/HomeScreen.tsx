import type { TabKey, RecordItem } from '../types.ts';
import { RECORDS } from '../data/database.ts';
import { BookOpen, Sparkles, MapPin, Landmark, ArrowRight, ShieldCheck, Heart, Award } from 'lucide-react';

interface HomeScreenProps {
  onSelectTab: (tab: TabKey) => void;
  onSelectRecord: (record: RecordItem) => void;
}

export function HomeScreen({ onSelectTab, onSelectRecord }: HomeScreenProps) {
  const hatTho = RECORDS.filter((r) => r.nhom_bai === 'Hát Thờ');
  const hatQuaCach = RECORDS.filter((r) => r.nhom_bai === 'Hát Quả Cách');
  const hatHoi = RECORDS.filter((r) => r.nhom_bai === 'Hát Hội');

  return (
    <div className="space-y-16 py-6 sm:py-10">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl bg-[#F5F2EA] border border-[#E7E2D6] p-6 sm:p-10 lg:p-12 shadow-xs">
        {/* Decorative cultural backdrop watermark patterns */}
        <div className="max-w-3xl space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-stone-500">
            <span className="text-[#9A3412] font-semibold tracking-wider uppercase">
              Di sản văn hóa phi vật thể của nhân loại (UNESCO)
            </span>
            <span aria-hidden="true">·</span>
            <span>Tín ngưỡng thờ cúng Hùng Vương</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-[#1C1917] tracking-tight leading-[1.18] text-balance">
            Hát Xoan & Tín ngưỡng thờ Hùng Vương
          </h1>

          <p className="text-stone-600 text-sm sm:text-base leading-relaxed">
            Hệ thống tư liệu số hóa nguyên bản 21 bài bản Xoan cổ thuộc 3 chặng diễn xướng cung đình và cửa đình, kết tinh từ cội nguồn văn minh sông Hồng và được gìn giữ qua hàng ngàn năm bởi cộng đồng 4 phường Xoan gốc vùng Đất Tổ Phú Thọ.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onSelectTab('archive')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#9A3412] hover:bg-[#832b0e] text-white text-sm font-semibold transition-all shadow-sm"
            >
              <BookOpen className="w-4 h-4" />
              <span>Tra cứu 21 bản ghi</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('ask')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white hover:bg-stone-50 text-stone-800 text-sm font-semibold border border-[#E7E2D6] transition-colors shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-[#9A3412]" />
              <span>Hỏi đáp tư liệu bằng AI</span>
            </button>
          </div>

          {/* Geographic baseline banner */}
          <div className="mt-6 pt-5 border-t border-[#E7E2D6] text-xs text-stone-600 flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex items-center gap-1.5 text-stone-800 font-semibold shrink-0">
              <MapPin className="w-4 h-4 text-[#9A3412]" />
              <span>Địa bàn khảo sát:</span>
            </div>
            <div className="space-x-1">
              <span className="font-medium text-stone-800">Hiện nay:</span>
              <span>Phường Vân Phú, tỉnh Phú Thọ</span>
              <span className="text-stone-400">/</span>
              <span className="font-medium text-stone-800">Địa danh cũ trước 01/7/2025:</span>
              <span>Xã Phượng Lâu và xã Kim Đức, TP. Việt Trì, tỉnh Phú Thọ</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Phường Xoan Gốc Showcase */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-[#9A3412] tracking-wider uppercase">
              Không gian cộng đồng
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1">
              4 Phường Xoan Gốc
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onSelectTab('guilds')}
            className="text-xs font-semibold text-[#9A3412] hover:text-[#832b0e] inline-flex items-center gap-1 transition-colors group"
          >
            <span>Tìm hiểu chi tiết về phong tục 4 phường</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              name: 'Phường Xoan An Thái',
              oldLoc: 'Xã Phượng Lâu cũ',
              nowLoc: 'Phường Vân Phú',
              desc: 'Gắn liền với Đình An Thái, di tích lịch sử thờ cúng tiền nhân và phong tục kết nghĩa giã bạn lâu đời.',
              dinh: 'Đình An Thái',
            },
            {
              name: 'Phường Xoan Phù Đức',
              oldLoc: 'Xã Kim Đức cũ',
              nowLoc: 'Phường Vân Phú',
              desc: 'Gắn bó với Miếu Lãi Lèn - nơi lưu giữ truyền thuyết Vua Hùng dạy dân múa hát đầu tiên.',
              dinh: 'Miếu Lãi Lèn',
            },
            {
              name: 'Phường Xoan Kim Đái',
              oldLoc: 'Kim Đới, Xã Kim Đức cũ',
              nowLoc: 'Phường Vân Phú',
              desc: 'Cái nôi lưu giữ hệ thống 14 quả cách chuẩn mực và nghệ thuật gõ trống cơm, phách nhịp.',
              dinh: 'Đình Kim Đái',
            },
            {
              name: 'Phường Xoan Thét',
              oldLoc: 'Xã Kim Đức cũ',
              nowLoc: 'Phường Vân Phú',
              desc: 'Nổi tiếng với Đình Thét cổ kính, phong cách hát đối đáp giao duyên và các điệu bỏ bộ trữ tình.',
              dinh: 'Đình Thét',
            },
          ].map((item, index) => (
            <div
              key={item.name}
              className="bg-white rounded-xl p-5 border border-[#E7E2D6] hover:border-[#9A3412]/40 transition-all flex flex-col justify-between space-y-4 shadow-2xs"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-stone-400">0{index + 1}</span>
                  <Landmark className="w-4 h-4 text-[#9A3412]" />
                </div>
                <h3 className="text-base font-serif font-bold text-stone-900">{item.name}</h3>
                <p className="text-xs text-stone-600 leading-relaxed">{item.desc}</p>
              </div>

              <div className="pt-3 border-t border-[#E7E2D6] text-[11px] text-stone-500 space-y-1">
                <div>
                  <strong className="text-stone-700">Di tích chính:</strong> {item.dinh}
                </div>
                <div>
                  <strong className="text-stone-700">Trước 01/7/2025:</strong> {item.oldLoc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3 Chặng Hát Cổ Truyền */}
      <section className="space-y-6">
        <div>
          <div className="text-xs font-semibold text-[#9A3412] tracking-wider uppercase">
            Cấu trúc diễn xướng
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1">
            3 Chặng Hát Cổ Truyền Trong Canh Xoan
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 mt-1.5 max-w-2xl">
            Một canh hát Xoan truyền thống kéo dài từ chập tối tới sáng hôm sau tại đình làng, tuân thủ nghiêm ngặt 3 giai đoạn diễn xướng.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Stage 1: Hát Thờ */}
          <div className="bg-white rounded-xl p-6 border border-[#E7E2D6] space-y-4 shadow-2xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                  Chặng I · Nghi Lễ
                </span>
                <span className="font-mono text-xs text-stone-500">4 bài</span>
              </div>
              <h3 className="text-xl font-serif font-bold text-stone-900">Hát Thờ</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Diễn xướng trang nghiêm trước hương án cửa đình, kính cáo thần linh, Thành hoàng và các Vua Hùng, cầu mong quốc thái dân an, mưa thuận gió hòa.
              </p>

              <div className="pt-2 space-y-1.5">
                {hatTho.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectRecord(item)}
                    className="w-full text-left p-2 rounded-lg bg-stone-50 hover:bg-[#9A3412]/10 transition-colors flex items-center justify-between text-xs group"
                  >
                    <span className="font-medium text-stone-800 group-hover:text-[#9A3412]">
                      {item.ten_bai}
                    </span>
                    <span className="font-mono text-[10px] text-stone-400">{item.id}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-[#E7E2D6] text-[11px] text-stone-500">
              Nhạc cụ chính: Trống con, trống cái, phách tre.
            </div>
          </div>

          {/* Stage 2: Hát Quả Cách */}
          <div className="bg-white rounded-xl p-6 border border-[#E7E2D6] space-y-4 shadow-2xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A3412]">
                  Chặng II · Bác Học
                </span>
                <span className="font-mono text-xs text-stone-500">14 quả cách</span>
              </div>
              <h3 className="text-xl font-serif font-bold text-stone-900">Hát Quả Cách</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Hệ thống 14 quả cách đồ sộ mang tính thi ca bác học, vịnh cảnh bốn mùa, răn dạy đạo lý tam cương ngũ thường và công ơn vua tôi bờ cõi.
              </p>

              <div className="pt-2 space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {hatQuaCach.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectRecord(item)}
                    className="w-full text-left p-2 rounded-lg bg-stone-50 hover:bg-[#9A3412]/10 transition-colors flex items-center justify-between text-xs group"
                  >
                    <span className="font-medium text-stone-800 group-hover:text-[#9A3412] truncate">
                      {item.ten_bai}
                    </span>
                    <span className="font-mono text-[10px] text-stone-400 shrink-0">{item.id}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onSelectTab('archive')}
                  className="w-full py-1.5 text-center text-xs text-[#9A3412] hover:underline font-medium"
                >
                  + Xem thêm 9 quả cách khác
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E7E2D6] text-[11px] text-stone-500">
              Kép Trùm lĩnh xướng, các cô đào hát đệm và phụ họa.
            </div>
          </div>

          {/* Stage 3: Hát Hội */}
          <div className="bg-white rounded-xl p-6 border border-[#E7E2D6] space-y-4 shadow-2xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                  Chặng III · Giao Duyên
                </span>
                <span className="font-mono text-xs text-stone-500">3 tiết mục</span>
              </div>
              <h3 className="text-xl font-serif font-bold text-stone-900">Hát Hội (Giao Duyên)</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Không khí hội xuân tưng bừng, đào Xoan và trai làng đối đáp xin hoa đố hoa, hát múa các làn điệu bỏ bộ, thắt chặt mối lương duyên nghĩa tình.
              </p>

              <div className="pt-2 space-y-1.5">
                {hatHoi.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectRecord(item)}
                    className="w-full text-left p-2 rounded-lg bg-stone-50 hover:bg-[#9A3412]/10 transition-colors flex items-center justify-between text-xs group"
                  >
                    <span className="font-medium text-stone-800 group-hover:text-[#9A3412]">
                      {item.ten_bai}
                    </span>
                    <span className="font-mono text-[10px] text-stone-400">{item.id}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-[#E7E2D6] text-[11px] text-stone-500">
              Kết thúc bằng khúc Hát Đơm Khế giã bạn lúc rạng sáng.
            </div>
          </div>
        </div>
      </section>

      {/* Ethical Code & Non-Profit Mission Card */}
      <section className="bg-[#EBE6DF] rounded-xl p-6 sm:p-8 border border-[#D6CEBE] space-y-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-[#9A3412]" />
          <h3 className="text-lg font-serif font-bold text-stone-900">
            Tuyên bố Trách nhiệm & Đạo đức Di sản C03
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-stone-700 leading-relaxed">
          <div className="space-y-1">
            <strong className="text-stone-900">Bảo vệ tính chân xác:</strong>
            <p>
              Không sử dụng trí tuệ nhân tạo để sinh chân dung giả lập của người dân hay nghệ nhân; không giả lập phỏng vấn nhân chứng; tôn trọng sự thật lịch sử và nguyên tác làn điệu.
            </p>
          </div>
          <div className="space-y-1">
            <strong className="text-stone-900">Ghi nhận cội nguồn cộng đồng:</strong>
            <p>
              Mọi bản ghi đều ghi nhận công ơn truyền dạy của các thế hệ kép đào 4 họ Xoan; tôn trọng cả hai trường thông tin địa danh hành chính mới và cũ.
            </p>
          </div>
          <div className="space-y-1">
            <strong className="text-stone-900">Phi thương mại & Mở:</strong>
            <p>
              Dự án phục vụ mục đích học thuật, nghiên cứu và giáo dục di sản; hoàn toàn không thu phí, không thương mại hóa, không quảng cáo.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
