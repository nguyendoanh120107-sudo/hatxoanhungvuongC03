import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import type { RecordItem, SourceItem } from '../src/types.ts';
import type { EnrichedRecord, RetrievalResult } from '../shared/ragSearch.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LoadedHeritageDatabase {
  records: RecordItem[];
  sources: SourceItem[];
  recordsPath: string;
  sourcesPath: string;
  validLinks: number;
  brokenLinks: Array<{ recordId: string; sourceId: string }>;
  dataVersion: string;
  instructionVersion: string;
}

function resolveDataFile(filename: string): string {
  const candidates = [
    path.resolve(__dirname, '../data', filename),
    path.resolve(__dirname, '../../data', filename),
    path.resolve(process.cwd(), 'data', filename),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Không tìm thấy tệp dữ liệu ${filename}. Đã kiểm tra tại: ${candidates.join(', ')}`
  );
}

function normalizeTextField(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.normalize('NFC').trim();
}

function normalizeRecord(raw: any): RecordItem {
  return {
    id: normalizeTextField(raw?.id),
    ten_bai: normalizeTextField(raw?.ten_bai),
    nhom_bai: (normalizeTextField(raw?.nhom_bai) || 'Hát Thờ') as RecordItem['nhom_bai'],
    dia_danh_hien_nay: normalizeTextField(raw?.dia_danh_hien_nay),
    dia_danh_cu: normalizeTextField(raw?.dia_danh_cu),
    cong_dong: normalizeTextField(raw?.cong_dong),
    boi_canh: normalizeTextField(raw?.boi_canh),
    nguoi_cung_cap: normalizeTextField(raw?.nguoi_cung_cap),
    pham_vi_su_dung: normalizeTextField(raw?.pham_vi_su_dung),
    nguon_id: Array.isArray(raw?.nguon_id)
      ? raw.nguon_id.map((id: unknown) => normalizeTextField(id)).filter(Boolean)
      : [],
    noi_dung_tom_tat: normalizeTextField(raw?.noi_dung_tom_tat),
    loi_ca_trich_doan: normalizeTextField(raw?.loi_ca_trich_doan),
  };
}

function normalizeSource(raw: any): SourceItem {
  return {
    id: normalizeTextField(raw?.id),
    ten_nguon: normalizeTextField(raw?.ten_nguon),
    tac_gia_co_quan: normalizeTextField(raw?.tac_gia_co_quan),
    nam_xuat_ban: normalizeTextField(raw?.nam_xuat_ban),
    loai_hinh: normalizeTextField(raw?.loai_hinh),
    link: normalizeTextField(raw?.link),
    mo_ta: normalizeTextField(raw?.mo_ta),
  };
}

let cachedDatabase: LoadedHeritageDatabase | null = null;

export function getHeritageDatabase(): LoadedHeritageDatabase {
  if (cachedDatabase) return cachedDatabase;

  const recordsPath = resolveDataFile('records.json');
  const sourcesPath = resolveDataFile('sources.json');

  const rawRecords = JSON.parse(fs.readFileSync(recordsPath, 'utf-8'));
  const rawSources = JSON.parse(fs.readFileSync(sourcesPath, 'utf-8'));

  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    throw new Error('Dữ liệu records.json rỗng hoặc sai định dạng mảng.');
  }
  if (!Array.isArray(rawSources) || rawSources.length === 0) {
    throw new Error('Dữ liệu sources.json rỗng hoặc sai định dạng mảng.');
  }

  const records = rawRecords.map(normalizeRecord).filter((r) => Boolean(r.id && r.ten_bai));
  const sources = rawSources.map(normalizeSource).filter((s) => Boolean(s.id && s.ten_nguon));

  const sourceIds = new Set(sources.map((s) => s.id));
  const brokenLinks: Array<{ recordId: string; sourceId: string }> = [];
  let validLinks = 0;

  for (const rec of records) {
    for (const sid of rec.nguon_id) {
      if (sourceIds.has(sid)) {
        validLinks++;
      } else {
        brokenLinks.push({ recordId: rec.id, sourceId: sid });
      }
    }
  }

  const dataRawStr = JSON.stringify({ records, sources });
  const dataVersion = crypto.createHash('sha256').update(dataRawStr).digest('hex').slice(0, 12);
  const instructionVersion = crypto
    .createHash('sha256')
    .update(HERITAGE_SYSTEM_INSTRUCTION)
    .digest('hex')
    .slice(0, 12);

  cachedDatabase = {
    records,
    sources,
    recordsPath,
    sourcesPath,
    validLinks,
    brokenLinks,
    dataVersion,
    instructionVersion,
  };

  return cachedDatabase;
}

export const HERITAGE_SYSTEM_INSTRUCTION = `Bạn là trợ lý nghiên cứu chuyên về Hát Xoan Phú Thọ và tín ngưỡng thờ cúng Hùng Vương.

Bạn có nhiệm vụ trả lời câu hỏi bằng thông tin được cung cấp từ kho tư liệu.

Khi trả lời:
1. Đọc toàn bộ nội dung các bản ghi liên quan.
2. Trả lời trực tiếp câu hỏi của người dùng.
3. Có thể tổng hợp thông tin từ nhiều bản ghi.
4. Không tự sáng tác sự kiện, lời hát, niên đại hoặc nguồn.
5. Dẫn mã bản ghi và nguồn phù hợp.
6. Phân biệt thông tin có trong hồ sơ và phần diễn giải tổng hợp.
7. Không từ chối chỉ vì câu hỏi không trùng nguyên văn với tên bản ghi.
8. Chỉ trả lời không đủ tư liệu khi đã tìm kiếm và thực sự không tìm được bằng chứng.
9. Nếu chỉ có một phần thông tin, trả lời phần có bằng chứng và nêu phần còn thiếu.
10. Nếu câu hỏi ngoài phạm vi Hát Xoan và tín ngưỡng thờ Hùng Vương, giải thích rõ phạm vi dữ liệu hiện có.

Quy tắc chuẩn mực dữ liệu bắt buộc:
- Khi nêu địa bàn bản ghi, luôn giữ đủ hai trường địa danh: "Phường Vân Phú, tỉnh Phú Thọ" (hiện nay) và "Xã Phượng Lâu và xã Kim Đức, thành phố Việt Trì, tỉnh Phú Thọ (trước 01/7/2025)".
- Khi nêu cộng đồng thực hành, ghi rõ: "Cộng đồng 4 phường Xoan gốc: An Thái, Phù Đức, Kim Đái (Kim Đới), Thét". Không tự gán tên bài cụ thể cho riêng một phường nếu nguồn chưa chứng minh.
- Trả lời bằng tiếng Việt tự nhiên, có dấu, súc tích và mạch lạc (khoảng 120–350 từ cho câu hỏi đơn lẻ; liệt kê đầy đủ khi hỏi hệ thống nhiều bài). Không xuất mã JSON thô.`;

function formatRecordForPrompt(rec: EnrichedRecord): string {
  const sourceLines = rec.sources.length
    ? rec.sources
        .map((s) => `  - [${s.id}] ${s.ten_nguon} (${s.tac_gia_co_quan}, ${s.nam_xuat_ban}) - ${s.link}`)
        .join('\n')
    : `  - Mã nguồn: ${rec.nguon_id.join(', ')}`;

  return [
    `[${rec.id}] Tên bài: ${rec.ten_bai} | Nhóm bài: ${rec.nhom_bai}`,
    `- Tóm tắt nội dung: ${rec.noi_dung_tom_tat}`,
    `- Bối cảnh diễn xướng: ${rec.boi_canh}`,
    `- Trích đoạn lời ca: ${rec.loi_ca_trich_doan}`,
    `- Cộng đồng thực hành: ${rec.cong_dong}`,
    `- Địa bàn hiện nay: ${rec.dia_danh_hien_nay}`,
    `- Địa danh cũ: ${rec.dia_danh_cu}`,
    `- Người cung cấp & lưu trữ: ${rec.nguoi_cung_cap}`,
    `- Phạm vi sử dụng: ${rec.pham_vi_su_dung}`,
    `- Nguồn liên kết:\n${sourceLines}`,
  ].join('\n');
}

export function buildGroundedUserPrompt(
  question: string,
  retrieval: RetrievalResult,
  db: LoadedHeritageDatabase
): string {
  const indexSummary = db.records
    .map((r) => `${r.id}: ${r.ten_bai} (${r.nhom_bai})`)
    .join('; ');

  const allSourcesSummary = db.sources
    .map((s) => `${s.id}: ${s.ten_nguon} (${s.tac_gia_co_quan}, ${s.nam_xuat_ban})`)
    .join('\n');

  if (retrieval.records.length === 0) {
    return `CÂU HỎI CỦA NGƯỜI DÙNG:
"${question}"

KẾT QUẢ TÌM KIẾM TRONG KHO 21 BẢN GHI:
Không tìm thấy bản ghi nào trong 21 bản ghi Hát Xoan khớp trực tiếp với chủ đề câu hỏi này.

MỤC LỤC TOÀN BỘ 21 BẢN GHI HIỆN CÓ (để xác nhận phạm vi kho tư liệu):
${indexSummary}

DANH MỤC 9 NGUỒN TƯ LIỆU HIỆN CÓ:
${allSourcesSummary}

YÊU CẦU TRẢ LỜI:
- Nếu câu hỏi thuộc chủ đề ngoài phạm vi Hát Xoan và Tín ngưỡng thờ cúng Hùng Vương (ví dụ: Quan họ Bắc Ninh, Ca trù, hoặc bài hát không tồn tại trong 21 bản ghi), hãy nêu rõ câu hỏi nằm ngoài phạm vi hoặc chưa có dữ liệu phù hợp trong 21 bản ghi và 9 nguồn của kho tư liệu Hát Xoan Phú Thọ hiện tại, đồng thời nêu vắn tắt phạm vi dữ liệu hiện có (3 chặng: Hát Thờ, Hát Quả Cách, Hát Hội).
- Tuyệt đối không tự bịa thông tin hay lời hát.`;
  }

  const includeIndex =
    retrieval.intent.isSynthesis ||
    retrieval.intent.isAllQuaCach ||
    retrieval.intent.isAllHatTho ||
    retrieval.intent.isAllHatHoi;

  const detailedContext = retrieval.records.map(formatRecordForPrompt).join('\n\n---\n\n');

  return `CÂU HỎI CỦA NGƯỜI DÙNG:
"${question}"

TƯ LIỆU TRÍCH XUẤT LIÊN QUAN (${retrieval.records.length}/21 bản ghi):

${detailedContext}${
    includeIndex
      ? `\n\nMỤC LỤC TOÀN BỘ 21 BẢN GHI TRONG KHO (để kiểm tra tính đầy đủ khi tổng hợp):\n${indexSummary}`
      : ''
  }

YÊU CẦU TRẢ LỜI:
- Trả lời trực tiếp, súc tích, mạch lạc bằng tiếng Việt có dấu dựa trên các bản ghi trên.
- Trích dẫn cụ thể tên bài, mã bản ghi [XOAN-XX] và mã nguồn [SRC-XX] đã dùng.
- Nếu là câu hỏi tổng hợp (như Hệ thống 14 Quả Cách), liệt kê đầy đủ các bản ghi Quả Cách có trong kho và đối chiếu rõ.
- Nếu câu hỏi nhắc tới khía cạnh chưa có trong hồ sơ, chỉ rõ phần nào có bằng chứng và phần nào chưa đủ tư liệu.`;
}
