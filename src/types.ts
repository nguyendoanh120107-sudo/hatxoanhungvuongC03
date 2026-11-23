export interface RecordItem {
  id: string;
  ten_bai: string;
  nhom_bai: 'Hát Thờ' | 'Hát Quả Cách' | 'Hát Hội';
  dia_danh_hien_nay: string;
  dia_danh_cu: string;
  cong_dong: string;
  boi_canh: string;
  nguoi_cung_cap: string;
  pham_vi_su_dung: string;
  nguon_id: string[];
  noi_dung_tom_tat: string;
  loi_ca_trich_doan: string;
}

export interface SourceItem {
  id: string;
  ten_nguon: string;
  tac_gia_co_quan: string;
  nam_xuat_ban: string;
  loai_hinh: string;
  link: string;
  mo_ta: string;
}

export interface QuotaCooldownInfo {
  scope: 'daily' | 'minute' | 'unknown';
  retryAfterSeconds: number | null;
  resetAt: string | null;
  exhaustedModels: string[];
}

export interface ServerStatus {
  status: string;
  hasApiKey: boolean;
  configuredModel?: string;
  availableModels?: string[];
  totalRecords: number;
  totalSources: number;
  validSourceLinks?: number;
  cacheEntries?: number;
  dataVersion?: string;
  environment?: string;
  quotaState?: QuotaCooldownInfo | null;
  project: string;
  author: string;
}

export type TabKey = 'home' | 'archive' | 'guilds' | 'ask' | 'sources' | 'author';
