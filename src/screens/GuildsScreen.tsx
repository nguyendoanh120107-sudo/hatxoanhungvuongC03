import { useState } from 'react';
import { Landmark, Users, MapPin, ShieldAlert, Award, Compass, HeartHandshake } from 'lucide-react';

export function GuildsScreen() {
  const [activeGuild, setActiveGuild] = useState<string>('anthai');

  const guilds = [
    {
      id: 'anthai',
      name: 'Phường Xoan An Thái',
      diTich: 'Đình An Thái',
      diaDanhHienNay: 'Phường Vân Phú, tỉnh Phú Thọ',
      diaDanhCu: 'Xã Phượng Lâu, thành phố Việt Trì, tỉnh Phú Thọ (trước 01/7/2025)',
      dacDiem:
        'Phường Xoan An Thái nằm sát bờ sông Lô lịch sử, nơi bảo lưu nhiều làn điệu hát thờ và hát giao duyên cổ xưa. Đình An Thái là trung tâm sinh hoạt tín ngưỡng thiêng liêng, nơi các thế hệ nghệ nhân tổ chức hát thờ Thành hoàng và gắn kết chặt chẽ với các làng kết nghĩa.',
      tucKetNghia:
        'Có tục "kết nghĩa giã bạn" truyền đời với các làng sở tại dọc đôi bờ sông. Khi họ Xoan An Thái tới hát, dân làng đón tiếp như anh em ruột thịt, chia sẻ sản vật và cùng nhau gìn giữ câu ca cửa đình.',
      vaiTro: 'Lưu giữ các làn điệu mở đầu trang trọng của chặng Hát Thờ và nghệ thuật múa dâng nhang uyển chuyển.',
    },
    {
      id: 'phuduc',
      name: 'Phường Xoan Phù Đức',
      diTich: 'Miếu Lãi Lèn',
      diaDanhHienNay: 'Phường Vân Phú, tỉnh Phú Thọ',
      diaDanhCu: 'Xã Kim Đức, thành phố Việt Trì, tỉnh Phú Thọ (trước 01/7/2025)',
      dacDiem:
        'Phù Đức gắn liền với Miếu Lãi Lèn - di tích lịch sử huyền thoại được coi là nơi phát tích đầu tiên của nghệ thuật Hát Xoan. Theo truyền thuyết dân gian Đất Tổ, đây là nơi Vua Hùng đã truyền dạy cho con dân vùng ngã ba sông cách múa hát và gõ trống phách.',
      tucKetNghia:
        'Lễ hội mở cửa đình tại Miếu Lãi Lèn vào mùa xuân là nơi hội tụ các nghệ nhân cao niên, trao truyền cho lớp đào kép trẻ từng lề lối xướng họa cổ xưa.',
      vaiTro: 'Biểu tượng lịch sử khởi nguồn của di sản, giữ gìn tính nguyên hợp giữa nghi lễ tín ngưỡng và nghệ thuật dân gian.',
    },
    {
      id: 'kimdai',
      name: 'Phường Xoan Kim Đái (Kim Đới)',
      diTich: 'Đình Kim Đái',
      diaDanhHienNay: 'Phường Vân Phú, tỉnh Phú Thọ',
      diaDanhCu: 'Xã Kim Đức, thành phố Việt Trì, tỉnh Phú Thọ (trước 01/7/2025)',
      dacDiem:
        'Kim Đái (xưa còn gọi là Kim Đới) nổi tiếng với truyền thống nắm giữ trọn vẹn và tinh tế nhất hệ thống 14 Quả Cách thi ca bác học. Các trùm phường Kim Đái qua nhiều đời nổi tiếng về sự am hiểu âm luật và nghệ thuật điểm trống phách.',
      tucKetNghia:
        'Tục kết họ kết chạ với các đình miếu vùng lân cận; giữ quy ước nghiêm ngặt về tư cách của người kép, người đào khi bước vào không gian thiêng nơi cửa đình.',
      vaiTro: 'Cái nôi lưu giữ văn bản học và lề lối hát 14 quả cách - đỉnh cao âm nhạc học cổ truyền của Hát Xoan.',
    },
    {
      id: 'thet',
      name: 'Phường Xoan Thét',
      diTich: 'Đình Thét',
      diaDanhHienNay: 'Phường Vân Phú, tỉnh Phú Thọ',
      diaDanhCu: 'Xã Kim Đức, thành phố Việt Trì, tỉnh Phú Thọ (trước 01/7/2025)',
      dacDiem:
        'Phường Xoan Thét gắn với ngôi Đình Thét cổ kính rợp bóng cây đa cổ thụ. Nơi đây bảo tồn sống động kho tàng Hát Hội và các làn điệu Hát Bỏ Bộ, Xin Huê Đố Huê với nhiều động tác múa dân gian sinh động mô phỏng nghề nông và sông nước.',
      tucKetNghia:
        'Mối quan hệ nghĩa tình sâu sắc với cộng đồng dân cư trong việc tổ chức canh hát thâu đêm suốt sáng đầu xuân, đón mừng năm mới và chúc phúc cho dân làng.',
      vaiTro: 'Lưu giữ nghệ thuật giao duyên đối đáp dí dỏm, tinh tế và các khúc ca giã bạn thấm đượm tình người vùng Đất Tổ.',
    },
  ];

  const currentGuild = guilds.find((g) => g.id === activeGuild) || guilds[0];

  return (
    <div className="space-y-12 py-6">
      {/* Page Title */}
      <div className="border-b border-[#E7E2D6] pb-6">
        <div className="text-xs font-semibold text-[#9A3412] tracking-wider uppercase">
          Không gian văn hóa & Cộng đồng bảo tồn
        </div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 mt-1">
          Cộng Đồng & 4 Phường Xoan Gốc
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 mt-1.5 max-w-2xl leading-relaxed">
          Tìm hiểu cội nguồn 4 phường Xoan cổ (An Thái, Phù Đức, Kim Đái, Thét), các di tích đình miếu linh thiêng và mối liên hệ bền chặt với Tín ngưỡng thờ cúng Hùng Vương.
        </p>
      </div>

      {/* Interactive Tabs for 4 Guilds */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: 4 Guild Tabs */}
        <div className="lg:col-span-4 space-y-2">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider px-1">
            Chọn phường Xoan:
          </div>
          {guilds.map((g) => {
            const isSelected = g.id === activeGuild;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveGuild(g.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-white border-[#9A3412] shadow-sm ring-1 ring-[#9A3412]/20'
                    : 'bg-[#F5F2EA] border-[#E7E2D6] hover:bg-white text-stone-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-serif font-bold text-sm ${isSelected ? 'text-[#9A3412]' : 'text-stone-900'}`}>
                    {g.name}
                  </span>
                  <Landmark className={`w-4 h-4 ${isSelected ? 'text-[#9A3412]' : 'text-stone-400'}`} />
                </div>
                <div className="text-[11px] text-stone-500 flex items-center gap-1">
                  <span>Di tích:</span>
                  <span className="font-medium text-stone-700">{g.diTich}</span>
                </div>
              </button>
            );
          })}

          {/* Ethics reminder */}
          <div className="bg-[#EBE6DF] p-3.5 rounded-xl border border-[#D6CEBE] text-[11px] text-stone-600 space-y-1 mt-4">
            <div className="font-semibold text-stone-800 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#9A3412]" />
              <span>Ghi chú khoa học di sản:</span>
            </div>
            <p className="leading-relaxed">
              Theo quy định học thuật của hồ sơ UNESCO, 21 bản ghi Xoan là tài sản chung của cả cộng đồng 4 họ Xoan, không tự ý gán độc quyền một bài cụ thể cho riêng một phường nếu chưa có tư liệu chứng minh.
            </p>
          </div>
        </div>

        {/* Right Side: Guild Details */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E7E2D6] p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="space-y-2 border-b border-[#E7E2D6] pb-5">
            <div className="text-xs font-semibold text-[#9A3412] tracking-wider uppercase">
              Không gian di tích chính: {currentGuild.diTich}
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900">
              {currentGuild.name}
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1 text-xs text-stone-600">
              <div className="flex items-center gap-1 text-stone-800 font-semibold">
                <MapPin className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Hiện nay:</span>
              </div>
              <span>{currentGuild.diaDanhHienNay}</span>
              <span className="hidden sm:inline text-stone-300">|</span>
              <div className="text-stone-500">
                <strong className="text-stone-700">Trước 01/7/2025:</strong> {currentGuild.diaDanhCu}
              </div>
            </div>
          </div>

          {/* Detailed Narrative */}
          <div className="space-y-4 text-xs sm:text-sm text-stone-700 leading-relaxed">
            <div className="space-y-1.5">
              <h3 className="font-serif font-bold text-stone-900 text-base">
                Đặc điểm lịch sử và diễn xướng
              </h3>
              <p>{currentGuild.dacDiem}</p>
            </div>

            <div className="space-y-1.5 pt-2">
              <h3 className="font-serif font-bold text-stone-900 text-base flex items-center gap-1.5">
                <HeartHandshake className="w-4 h-4 text-[#9A3412]" />
                <span>Phong tục kết nghĩa giã bạn</span>
              </h3>
              <p>{currentGuild.tucKetNghia}</p>
            </div>

            <div className="space-y-1.5 pt-2">
              <h3 className="font-serif font-bold text-stone-900 text-base flex items-center gap-1.5">
                <Award className="w-4 h-4 text-[#9A3412]" />
                <span>Đóng góp then chốt vào kho tàng 21 bài Xoan</span>
              </h3>
              <p>{currentGuild.vaiTro}</p>
            </div>
          </div>

          {/* Structure of a Xoan Guild */}
          <div className="pt-4 border-t border-[#E7E2D6] space-y-3">
            <h4 className="font-serif font-bold text-stone-900 text-sm">
              Cơ cấu tổ chức truyền thống của một Họ Xoan
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#F5F2EA] border border-[#E7E2D6] space-y-1">
                <strong className="text-stone-900 block font-serif">Ông Trùm (Trùm Phường)</strong>
                <p className="text-stone-600 text-[11px] leading-relaxed">
                  Bậc cao niên đức độ, thuộc lòng trọn vẹn 21 bài Xoan, giữ vai trò chỉ huy canh hát và liên hệ với các làng sở tại.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#F5F2EA] border border-[#E7E2D6] space-y-1">
                <strong className="text-stone-900 block font-serif">Kép Xoan (Nam giới)</strong>
                <p className="text-stone-600 text-[11px] leading-relaxed">
                  Đánh trống cái, gõ trống cơm, phách nhịp, hát lĩnh xướng mở đầu các quả cách và hát đối đáp giao duyên.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#F5F2EA] border border-[#E7E2D6] space-y-1">
                <strong className="text-stone-900 block font-serif">Đào Xoan (Nữ giới)</strong>
                <p className="text-stone-600 text-[11px] leading-relaxed">
                  Hát đệm theo lời lĩnh xướng của kép, múa dâng nhang, múa quạt, đố hoa và thể hiện các điệu bộ lao động duyên dáng.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Relationship with Hung Kings Worship Section */}
      <section className="bg-[#F5F2EA] rounded-2xl p-6 sm:p-8 border border-[#E7E2D6] space-y-5">
        <div className="max-w-3xl space-y-2">
          <div className="text-xs font-semibold text-[#9A3412] tracking-wider uppercase">
            Cội nguồn tâm linh
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900">
            Hát Xoan Trong Mối Quan Hệ Với Tín Ngưỡng Thờ Cúng Hùng Vương
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            Hát Xoan không chỉ là một hình thức ca hát dân gian đơn thuần, mà là khúc thức diễn xướng nghi lễ gắn bó máu thịt với Tín ngưỡng thờ cúng Hùng Vương - cội nguồn tâm linh thiêng liêng của toàn thể dân tộc Việt Nam.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-stone-700">
          <div className="bg-white p-4 rounded-xl border border-[#E7E2D6] space-y-2">
            <h3 className="font-serif font-bold text-stone-900 text-sm">
              Lễ Hát Cửa Đình Dâng Lên Vua Hùng
            </h3>
            <p className="leading-relaxed text-stone-600">
              Vào mùa lễ hội Đền Hùng tháng 3 âm lịch, 4 phường Xoan cổ theo lệ xưa đều tề tựu về các đền đài trên núi Nghĩa Lĩnh và các di tích thờ vua lân cận để hát phục vụ nghi lễ tri ân tiên tổ.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E7E2D6] space-y-2">
            <h3 className="font-serif font-bold text-stone-900 text-sm">
              Ý Niệm Về Cội Nguồn Dân Tộc
            </h3>
            <p className="leading-relaxed text-stone-600">
              Trong các bài Hát Thờ và 14 Quả Cách, hình ảnh non sông Lạc Long Quân - Âu Cơ, công đức 18 đời Hùng Vương khai sơn lập quốc luôn được tôn xưng bằng những ca từ trang trọng và thành kính nhất.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E7E2D6] space-y-2">
            <h3 className="font-serif font-bold text-stone-900 text-sm">
              Trao Truyền Bền Bỉ Của Cộng Đồng
            </h3>
            <p className="leading-relaxed text-stone-600">
              Chính lòng tôn kính Vua Hùng đã trở thành động lực tinh thần mạnh mẽ giúp cộng đồng 4 phường gìn giữ được nguyên vẹn 21 bài bản qua hàng thế kỷ, đưa di sản ra khỏi danh sách bảo vệ khẩn cấp của UNESCO năm 2017.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
