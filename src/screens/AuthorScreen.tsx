import { User, Award, ShieldCheck, Heart, Mail, GraduationCap, Code2, Globe } from 'lucide-react';

export function AuthorScreen() {
  return (
    <div className="space-y-12 py-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="border-b border-[#E7E2D6] pb-6">
        <div className="text-xs font-semibold text-[#9A3412] tracking-wider uppercase">
          Thông tin đề tài & Nhà phát triển
        </div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1">
          Giới Thiệu Tác Giả & Dự Án C03
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 mt-1.5 leading-relaxed">
          Đề án nghiên cứu ứng dụng công nghệ số hóa và trí tuệ nhân tạo nhằm bảo tồn, lan tỏa Di sản văn hóa phi vật thể Hát Xoan Phú Thọ và Tín ngưỡng thờ cúng Hùng Vương.
        </p>
      </div>

      {/* Author Profile Card */}
      <div className="bg-white rounded-2xl border border-[#E7E2D6] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-[#9A3412] text-white flex items-center justify-center font-serif text-2xl font-bold shadow-md shrink-0">
            D
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900">
                Nguyễn Ngọc Doanh
              </h2>
              <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                MSV: TH04122
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-[#9A3412]">
              Nhóm 2 · Chương trình Thực tập sinh Đợt 15 IMTA TECH x FPT Polytechnic
            </p>
          </div>
        </div>

        {/* Key Metrics / Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#E7E2D6] text-xs">
          <div className="bg-[#F5F2EA] p-3.5 rounded-xl border border-[#E7E2D6] space-y-1">
            <span className="text-stone-500 text-[11px] block">Mã số đề án</span>
            <strong className="text-stone-900 text-sm font-serif block">Dự án C03</strong>
            <span className="text-stone-600 text-[11px]">Hát Xoan & Thờ Hùng Vương</span>
          </div>

          <div className="bg-[#F5F2EA] p-3.5 rounded-xl border border-[#E7E2D6] space-y-1">
            <span className="text-stone-500 text-[11px] block">Mô hình hoạt động</span>
            <strong className="text-stone-900 text-sm font-serif block">Dự án xã hội</strong>
            <span className="text-stone-600 text-[11px]">100% Phi lợi nhuận · Không thu phí</span>
          </div>

          <div className="bg-[#F5F2EA] p-3.5 rounded-xl border border-[#E7E2D6] space-y-1">
            <span className="text-stone-500 text-[11px] block">Dữ liệu chuẩn hóa</span>
            <strong className="text-stone-900 text-sm font-serif block">21 Bản ghi · 9 Nguồn</strong>
            <span className="text-stone-600 text-[11px]">Hồ sơ UNESCO & Viện Âm nhạc</span>
          </div>
        </div>

        {/* Narrative & Goals */}
        <div className="space-y-3 text-xs sm:text-sm text-stone-700 leading-relaxed border-t border-[#E7E2D6] pt-5">
          <h3 className="font-serif font-bold text-stone-900 text-base">
            Mục tiêu & Tôn chỉ đề tài
          </h3>
          <p>
            Dự án được xây dựng với tình yêu tha thiết đối với kho tàng văn hóa dân tộc vùng Đất Tổ Phú Thọ. Mục tiêu trọng tâm của đề án là xây dựng một cổng thông tin số hóa chuẩn mực, cung cấp đầy đủ thông tin về 21 bài Xoan cổ (gồm chặng Hát Thờ, 14 Quả Cách, và các tiết mục Hát Hội giao duyên), lưu giữ song song cả hai trường địa danh hành chính (địa bàn hiện nay phường Vân Phú và địa danh cũ trước 01/7/2025 là xã Phượng Lâu và xã Kim Đức, TP. Việt Trì).
          </p>
          <p>
            Đặc biệt, dự án tích hợp công nghệ AI (Gemini 3.8 Flash) có kiểm duyệt nghiêm ngặt (Strict Grounding) nhằm hỗ trợ các bạn học sinh, sinh viên, giáo viên và du khách dễ dàng tra cứu, học tập mà không lo ngại thông tin sai lệch hay bịa đặt.
          </p>
        </div>

        {/* Technology stack */}
        <div className="space-y-3 pt-4 border-t border-[#E7E2D6]">
          <h3 className="font-serif font-bold text-stone-900 text-base flex items-center gap-1.5">
            <Code2 className="w-4 h-4 text-[#9A3412]" />
            <span>Nền tảng công nghệ xây dựng</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-stone-700">
            <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200">
              <span className="font-semibold text-stone-900 block">Frontend</span>
              <span className="text-stone-500 text-[11px]">React 19 & TypeScript</span>
            </div>
            <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200">
              <span className="font-semibold text-stone-900 block">Giao diện</span>
              <span className="text-stone-500 text-[11px]">Tailwind CSS v4</span>
            </div>
            <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200">
              <span className="font-semibold text-stone-900 block">Máy chủ API</span>
              <span className="text-stone-500 text-[11px]">Express + Node.js (tsx)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200">
              <span className="font-semibold text-stone-900 block">Trí tuệ nhân tạo</span>
              <span className="text-stone-500 text-[11px]">Gemini 3.8 Flash</span>
            </div>
          </div>
        </div>

        {/* Non-Profit & Ethics Commitment */}
        <div className="p-4 rounded-xl bg-[#EBE6DF] border border-[#D6CEBE] text-xs text-stone-700 space-y-2">
          <div className="font-semibold text-stone-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#9A3412]" />
            <span>Cam kết trách nhiệm xã hội</span>
          </div>
          <p className="leading-relaxed">
            Tác giả cam kết đề tài không phục vụ bất kỳ mục đích thương mại nào; tuyệt đối không chèn quảng cáo, không thu phí người dùng dưới bất kỳ hình thức nào, và luôn ghi nhận công lao to lớn của cộng đồng 4 họ Xoan truyền đời.
          </p>
        </div>
      </div>
    </div>
  );
}
