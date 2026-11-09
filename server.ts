import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// Load data files safely
const recordsPath = path.resolve(__dirname, 'data/records.json');
const sourcesPath = path.resolve(__dirname, 'data/sources.json');

let recordsData: any[] = [];
let sourcesData: any[] = [];

try {
  recordsData = JSON.parse(fs.readFileSync(recordsPath, 'utf-8'));
  sourcesData = JSON.parse(fs.readFileSync(sourcesPath, 'utf-8'));
} catch (err) {
  console.error('Error loading data files:', err);
}

// System instruction prompt for Gemini grounding
const SYSTEM_INSTRUCTION = `Bạn là Chuyên gia Tư liệu số và Cố vấn Di sản của Dự án C03: "Hát Xoan và tín ngưỡng thờ Hùng Vương".
Dự án được nghiên cứu bởi tác giả Nguyễn Ngọc Doanh (MSV TH04122, Nhóm 2, Chương trình Thực tập sinh Đợt 15 IMTA TECH x FPT Polytechnic - dự án xã hội phi lợi nhuận).

BẠN CHỈ ĐƯỢC PHÉP TRẢ LỜI DỰA TRÊN DỮ LIỆU CUNG CẤP DƯỚI ĐÂY GỒM 21 BẢN GHI (records) VÀ 9 NGUỒN TƯ LIỆU (sources).
TUYỆT ĐỐI KHÔNG BỊA ĐẶT THÔNG TIN. NẾU THÔNG TIN KHÔNG CÓ TRONG CƠ SỞ DỮ LIỆU, BẠN BẮT BUỘC PHẢI TRẢ LỜI NGUYÊN VĂN:
"Chưa có tư liệu trong cơ sở dữ liệu để trả lời câu hỏi này."

CÁC NGUYÊN TẮC BẮT BUỘC:
1. Mọi câu trả lời có chứa thông tin về bản ghi phải trích dẫn rõ:
   - Mã bản ghi (ví dụ: [XOAN-01], [XOAN-05],...)
   - Tên bài và Nhóm bài (Hát Thờ, Hát Quả Cách, hoặc Hát Hội)
   - Cộng đồng thực hành: Luôn ghi đủ "Cộng đồng 4 phường Xoan gốc: An Thái, Phù Đức, Kim Đái (Kim Đới), Thét"
   - Luôn giữ đủ hai trường địa danh:
     + Địa bàn hiện nay: "Phường Vân Phú, tỉnh Phú Thọ"
     + Địa danh cũ: "Xã Phượng Lâu và xã Kim Đức, thành phố Việt Trì, tỉnh Phú Thọ (trước 01/7/2025)"
   - Mã nguồn tham chiếu tương ứng (ví dụ: [SRC-01], [SRC-03],...)
   - Không tự gán tên bài cụ thể cho riêng một phường nếu nguồn chưa chứng minh.
2. Đạo đức nghiên cứu di sản:
   - Tuyệt đối không sinh nội dung giả định phỏng vấn nghệ nhân, không tự phong danh hiệu nghệ nhân.
   - Thể hiện sự tôn kính với Di sản văn hóa phi vật thể của nhân loại và Tín ngưỡng thờ cúng Hùng Vương.
   - Sử dụng tiếng Việt chuẩn xác có dấu, văn phong học thuật, trong sáng, nhân văn.

DỮ LIỆU NGUỒN TƯ LIỆU (sources.json):
${JSON.stringify(sourcesData, null, 2)}

DỮ LIỆU BẢN GHI DI SẢN (records.json):
${JSON.stringify(recordsData, null, 2)}
`;

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    totalRecords: recordsData.length,
    totalSources: sourcesData.length,
    project: 'C03 - Hát Xoan và tín ngưỡng thờ Hùng Vương',
    author: 'Nguyễn Ngọc Doanh - MSV TH04122 (Nhóm 2 - IMTA TECH x FPT Polytechnic)'
  });
});

app.get('/api/records', (req, res) => {
  res.json(recordsData);
});

app.get('/api/sources', (req, res) => {
  res.json(sourcesData);
});

app.post('/api/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'INVALID_QUESTION', message: 'Vui lòng nhập câu hỏi hợp lệ.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'MISSING_API_KEY',
        message: 'Máy chủ chưa được cấu hình GEMINI_API_KEY trong hệ thống secrets. Vui lòng cấu hình khóa để kích hoạt tính năng hỏi đáp chuyên sâu.'
      });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: question.trim(),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    const answer = response.text || 'Chưa có tư liệu trong cơ sở dữ liệu để trả lời câu hỏi này.';
    return res.json({
      answer: answer,
      grounded: true,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Lỗi khi gọi Gemini API:', error);
    const errorMessage = error?.message || 'Đã có lỗi xảy ra khi xử lý câu hỏi.';
    return res.status(500).json({
      error: 'GEMINI_ERROR',
      message: errorMessage.includes('API key') 
        ? 'Khóa API không hợp lệ hoặc đã hết hạn ngạch. Vui lòng kiểm tra lại trong Settings > Secrets.' 
        : `Lỗi máy chủ: ${errorMessage}`
    });
  }
});

// Setup Vite or Static File Serving
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[C03 Server] Ứng dụng Hát Xoan đang chạy tại http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Không thể khởi động server:', err);
  process.exit(1);
});
