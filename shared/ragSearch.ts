import type { RecordItem, SourceItem } from '../src/types.ts';

export interface EnrichedRecord extends RecordItem {
  sources: SourceItem[];
}

export interface SearchMatch {
  record: EnrichedRecord;
  score: number;
  matchedFields: string[];
}

export interface RetrievalResult {
  query: string;
  normalizedQuery: string;
  intent: {
    isAllQuaCach: boolean;
    isAllHatTho: boolean;
    isAllHatHoi: boolean;
    isSynthesis: boolean;
    isCommunityOrLocation: boolean;
    needsDeepReasoning: boolean;
  };
  matches: SearchMatch[];
  records: EnrichedRecord[];
  sources: SourceItem[];
}

const VIETNAMESE_STOPWORDS = new Set([
  'la', 'gi', 'nao', 'cua', 'va', 'voi', 'trong', 'cho', 'biet', 'thong', 'tin',
  've', 'mot', 'nhung', 'cac', 'bai', 'hat', 'y', 'nghia', 'dac', 'diem', 'ra',
  'sao', 'nhu', 'the', 'gom', 'co', 'khong', 'duoc', 'tu', 'lieu', 'co', 'so',
  'du', 'he', 'thong', 'hoi', 'dap', 'giai', 'thich', 'so', 'sanh', 'tai', 'sao',
  'khi', 'o', 'dau', 'ai', 'nguoi', 'ke', 'ten', 'nhom', 'chang', 'lan', 'dieu',
  'ho', 'so', 'ban', 'ghi', 'hien', 'nay', 'truoc', 'sau', 'hay', 'hoac', 'va',
  'ton', 'tai', 'khac', 'nhau', 'the', 'nao', 'phan', 'tich', 'tom', 'tat', 'noi',
  'dung', 'boi', 'canh', 'nguon', 'trich', 'doan', 'loi', 'ca', 'muc', 'dich',
  'cach'
]);

/**
 * Normalize Vietnamese text to NFC, lowercase, strip diacritics, handle đ/Đ,
 * and clean punctuation for tolerant matching (e.g. "Du xuân cách" == "Du Xuan Cach").
 */
export function normalizeVietnamese(input: string): string {
  if (!input) return '';
  return input
    .normalize('NFC')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeContent(input: string): string[] {
  const norm = normalizeVietnamese(input);
  if (!norm) return [];
  const rawTokens = norm.split(' ').filter((t) => t.length >= 2);
  const filtered = rawTokens.filter((t) => !VIETNAMESE_STOPWORDS.has(t));
  return Array.from(new Set(filtered));
}

function buildBigrams(tokens: string[]): string[] {
  const normTokens = tokens;
  const bigrams: string[] = [];
  for (let i = 0; i < normTokens.length - 1; i++) {
    bigrams.push(`${normTokens[i]} ${normTokens[i + 1]}`);
  }
  return bigrams;
}

/**
 * Detect whether a normalized song title (with and without parenthetical alias)
 * appears in the normalized query.
 */
function getTitleVariants(tenBai: string): string[] {
  const variants: string[] = [];
  const full = normalizeVietnamese(tenBai);
  if (full) variants.push(full);

  // Split out parenthetical alias e.g. "Tứ mùa cách (Tứ quý cách)" -> ["tu mua cach", "tu quy cach"]
  const match = tenBai.match(/^([^(]+)\(([^)]+)\)/);
  if (match) {
    const main = normalizeVietnamese(match[1]);
    const alias = normalizeVietnamese(match[2]);
    if (main) variants.push(main);
    if (alias) variants.push(alias);
  }
  return Array.from(new Set(variants));
}

export function retrieveHeritageRecords(
  query: string,
  allRecords: RecordItem[],
  allSources: SourceItem[]
): RetrievalResult {
  const cleanQuery = (query || '').normalize('NFC').trim();
  const normQuery = normalizeVietnamese(cleanQuery);
  const queryWordsAll = normQuery.split(' ').filter((w) => w.length >= 2);
  const contentTokens = tokenizeContent(cleanQuery);
  const queryBigrams = buildBigrams(queryWordsAll);

  const sourceMap = new Map<string, SourceItem>(
    allSources.map((s) => [s.id, s])
  );

  const enrichedAll: EnrichedRecord[] = allRecords.map((r) => ({
    ...r,
    sources: (r.nguon_id || [])
      .map((sid) => sourceMap.get(sid))
      .filter((s): s is SourceItem => Boolean(s)),
  }));

  // Intent detection
  const isAllQuaCach =
    normQuery.includes('qua cach') ||
    normQuery.includes('14 bai') ||
    normQuery.includes('muoi bon');

  const isAllHatTho =
    normQuery.includes('hat tho') ||
    normQuery.includes('chang tho') ||
    normQuery.includes('chang 1') ||
    normQuery.includes('chang i ');

  const isAllHatHoi =
    normQuery.includes('hat hoi') ||
    normQuery.includes('chang hoi') ||
    normQuery.includes('chang 3') ||
    normQuery.includes('chang iii') ||
    normQuery.includes('giao duyen');

  const isCommunityOrLocation =
    normQuery.includes('4 phuong') ||
    normQuery.includes('bon phuong') ||
    normQuery.includes('an thai') ||
    normQuery.includes('phu duc') ||
    normQuery.includes('kim dai') ||
    normQuery.includes('kim doi') ||
    normQuery.includes('thet') ||
    normQuery.includes('van phu') ||
    normQuery.includes('phuong lau') ||
    normQuery.includes('kim duc') ||
    normQuery.includes('viet tri') ||
    normQuery.includes('dia danh') ||
    normQuery.includes('dia ban') ||
    normQuery.includes('phu tho') ||
    normQuery.includes('hung vuong') ||
    normQuery.includes('cua dinh');

  const isSynthesis =
    isAllQuaCach ||
    isAllHatTho ||
    isAllHatHoi ||
    normQuery.includes('tong hop') ||
    normQuery.includes('tat ca') ||
    normQuery.includes('toan bo') ||
    normQuery.includes('gom nhung') ||
    normQuery.includes('cac chang') ||
    normQuery.includes('3 chang') ||
    normQuery.includes('ba chang') ||
    normQuery.includes('21 ban ghi') ||
    normQuery.includes('hai mot');

  const needsDeepReasoning =
    isSynthesis ||
    normQuery.includes('so sanh') ||
    normQuery.includes('phan tich') ||
    normQuery.includes('vi sao') ||
    normQuery.includes('tai sao') ||
    normQuery.includes('khac nhau') ||
    normQuery.includes('lien he') ||
    normQuery.includes('vai tro') ||
    normQuery.includes('gia tri');

  // Detect explicit non-Xoan heritage genres when NOT discussing Xoan
  const mentionsExternalGenre =
    (normQuery.includes('quan ho') ||
      normQuery.includes('bac ninh') ||
      normQuery.includes('ca tru') ||
      normQuery.includes('thang long') ||
      normQuery.includes('don ca tai tu') ||
      normQuery.includes('nha nhac hue') ||
      normQuery.includes('bai choi') ||
      normQuery.includes('hat cheo') ||
      normQuery.includes('cai luong') ||
      normQuery.includes('vi giam')) &&
    !normQuery.includes('xoan') &&
    !normQuery.includes('hung vuong') &&
    !normQuery.includes('qua cach');

  if (mentionsExternalGenre) {
    return {
      query: cleanQuery,
      normalizedQuery: normQuery,
      intent: {
        isAllQuaCach: false,
        isAllHatTho: false,
        isAllHatHoi: false,
        isSynthesis: false,
        isCommunityOrLocation: false,
        needsDeepReasoning: false,
      },
      matches: [],
      records: [],
      sources: [],
    };
  }

  // Precompute document frequency for BM25-style IDF weighting across the 21 records
  const N = enrichedAll.length || 1;
  const docTokensList = enrichedAll.map((rec) => {
    const combined = [
      rec.id,
      rec.ten_bai,
      rec.nhom_bai,
      rec.noi_dung_tom_tat,
      rec.boi_canh,
      rec.loi_ca_trich_doan,
      rec.cong_dong,
      rec.dia_danh_hien_nay,
      rec.dia_danh_cu,
      rec.nguoi_cung_cap,
      rec.sources.map((s) => `${s.id} ${s.ten_nguon} ${s.tac_gia_co_quan} ${s.mo_ta}`).join(' '),
    ].join(' ');
    return normalizeVietnamese(combined);
  });

  const avgDocLen =
    docTokensList.reduce((sum, d) => sum + d.split(' ').length, 0) / N || 100;

  const idfMap = new Map<string, number>();
  for (const token of contentTokens) {
    let df = 0;
    for (const docText of docTokensList) {
      if (docText.includes(token)) df++;
    }
    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
    idfMap.set(token, Math.max(idf, 0.2));
  }

  const scored: SearchMatch[] = [];

  for (let idx = 0; idx < enrichedAll.length; idx++) {
    const rec = enrichedAll[idx];
    let score = 0;
    const matchedFields = new Set<string>();

    const normId = normalizeVietnamese(rec.id);
    const normGroup = normalizeVietnamese(rec.nhom_bai);
    const normSummary = normalizeVietnamese(rec.noi_dung_tom_tat);
    const normContext = normalizeVietnamese(rec.boi_canh);
    const normLyrics = normalizeVietnamese(rec.loi_ca_trich_doan);
    const normCommunity = normalizeVietnamese(
      `${rec.cong_dong} ${rec.dia_danh_hien_nay} ${rec.dia_danh_cu} ${rec.nguoi_cung_cap}`
    );
    const normSources = normalizeVietnamese(
      rec.sources.map((s) => `${s.id} ${s.ten_nguon} ${s.tac_gia_co_quan} ${s.mo_ta}`).join(' ')
    );

    // 1. Exact ID match
    if (normQuery.includes(normId)) {
      score += 120;
      matchedFields.add('id');
    }

    // 2. Exact / alias title match (highest priority)
    const titleVariants = getTitleVariants(rec.ten_bai);
    for (const variant of titleVariants) {
      if (variant.length >= 3 && normQuery.includes(variant)) {
        score += 100;
        matchedFields.add('ten_bai');
      } else {
        // Also check partial significant title match without trailing "cach" / "hat"
        const strippedVariant = variant.replace(/\b(cach|hat)\b/g, '').trim();
        if (strippedVariant.length >= 4 && normQuery.includes(strippedVariant)) {
          score += 65;
          matchedFields.add('ten_bai');
        }
      }
    }

    // 3. Group intent matching
    if (isAllQuaCach && normGroup.includes('qua cach')) {
      score += 45;
      matchedFields.add('nhom_bai');
    }
    if (isAllHatTho && normGroup.includes('hat tho')) {
      score += 45;
      matchedFields.add('nhom_bai');
    }
    if (isAllHatHoi && normGroup.includes('hat hoi')) {
      score += 45;
      matchedFields.add('nhom_bai');
    }

    // 4. Bigram phrase matching in title, summary, context, lyrics
    for (const bg of queryBigrams) {
      if (bg.split(' ').every((w) => VIETNAMESE_STOPWORDS.has(w))) continue;
      if (titleVariants.some((v) => v.includes(bg))) {
        score += 22;
        matchedFields.add('ten_bai');
      }
      if (normSummary.includes(bg)) {
        score += 12;
        matchedFields.add('noi_dung_tom_tat');
      }
      if (normContext.includes(bg)) {
        score += 12;
        matchedFields.add('boi_canh');
      }
      if (normLyrics.includes(bg)) {
        score += 10;
        matchedFields.add('loi_ca_trich_doan');
      }
    }

    // 5. Weighted BM25-inspired token scoring
    const docText = docTokensList[idx];
    const docLen = docText.split(' ').length;
    const k1 = 1.2;
    const b = 0.75;
    let specificHits = 0;

    for (const token of contentTokens) {
      const idf = idfMap.get(token) ?? 0.5;
      let fieldWeight = 0;

      if (titleVariants.some((v) => v.includes(token))) {
        fieldWeight += 5.0;
        matchedFields.add('ten_bai');
      }
      if (normGroup.includes(token)) {
        fieldWeight += 3.0;
        matchedFields.add('nhom_bai');
      }
      if (normSummary.includes(token)) {
        fieldWeight += 2.5;
        matchedFields.add('noi_dung_tom_tat');
      }
      if (normContext.includes(token)) {
        fieldWeight += 2.5;
        matchedFields.add('boi_canh');
      }
      if (normLyrics.includes(token)) {
        fieldWeight += 2.0;
        matchedFields.add('loi_ca_trich_doan');
      }
      if (normCommunity.includes(token)) {
        fieldWeight += 1.0;
        matchedFields.add('cong_dong_dia_danh');
      }
      if (normSources.includes(token)) {
        fieldWeight += 1.0;
        matchedFields.add('nguon');
      }

      if (fieldWeight > 0) {
        // Count how rare the token is; ignore ultra-common shared heritage boilerplate alone
        if (idf > 0.35 || matchedFields.has('ten_bai') || matchedFields.has('noi_dung_tom_tat') || matchedFields.has('loi_ca_trich_doan')) {
          specificHits++;
        }
        const tfNorm = (fieldWeight * (k1 + 1)) / (fieldWeight + k1 * (1 - b + b * (docLen / avgDocLen)));
        score += idf * tfNorm * 4;
      }
    }

    // Prevent false positives when ONLY ubiquitous boilerplate words ("phu tho", "phuong", "xoan") matched
    // unless the user specifically asked a synthesis/community/location question
    const onlyBoilerplateMatched =
      !isCommunityOrLocation &&
      !isSynthesis &&
      matchedFields.size > 0 &&
      Array.from(matchedFields).every((f) => f === 'cong_dong_dia_danh' || f === 'nguon') &&
      score < 12;

    if (!onlyBoilerplateMatched && (score >= 7.5 || specificHits >= 2 || matchedFields.has('ten_bai') || matchedFields.has('id'))) {
      scored.push({
        record: rec,
        score: Number(score.toFixed(2)),
        matchedFields: Array.from(matchedFields),
      });
    }
  }

  // Sort by score descending, then by ID ascending
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.record.id.localeCompare(b.record.id);
  });

  // For broad synthesis/community questions with few direct hits, include representative records across all 3 stages
  let selectedMatches = scored;
  if (isAllQuaCach) {
    // Ensure ALL 14 Quả Cách records are included cleanly
    const quaCachIds = new Set(scored.map((m) => m.record.id));
    for (const rec of enrichedAll) {
      if (normalizeVietnamese(rec.nhom_bai).includes('qua cach') && !quaCachIds.has(rec.id)) {
        selectedMatches.push({ record: rec, score: 40, matchedFields: ['nhom_bai'] });
      }
    }
  } else if (isAllHatTho) {
    const existingIds = new Set(scored.map((m) => m.record.id));
    for (const rec of enrichedAll) {
      if (normalizeVietnamese(rec.nhom_bai).includes('hat tho') && !existingIds.has(rec.id)) {
        selectedMatches.push({ record: rec, score: 40, matchedFields: ['nhom_bai'] });
      }
    }
  } else if (isAllHatHoi) {
    const existingIds = new Set(scored.map((m) => m.record.id));
    for (const rec of enrichedAll) {
      if (normalizeVietnamese(rec.nhom_bai).includes('hat hoi') && !existingIds.has(rec.id)) {
        selectedMatches.push({ record: rec, score: 40, matchedFields: ['nhom_bai'] });
      }
    }
  } else if ((isCommunityOrLocation || isSynthesis) && selectedMatches.length === 0) {
    // Broad question about the 4 wards, Hung Kings worship, or all 3 stages
    const representatives = ['XOAN-01', 'XOAN-03', 'XOAN-05', 'XOAN-14', 'XOAN-19', 'XOAN-21'];
    selectedMatches = enrichedAll
      .filter((r) => representatives.includes(r.id))
      .map((r) => ({ record: r, score: 15, matchedFields: ['cong_dong_dia_danh'] }));
  }

  // If specific song title(s) matched and user didn't ask for a broad synthesis/group list,
  // keep high-relevance matches rather than trailing weak hits.
  const exactTitleMatches = selectedMatches.filter((m) => m.score >= 95);
  if (exactTitleMatches.length > 0 && !isSynthesis) {
    selectedMatches = selectedMatches.filter((m) => m.score >= 60);
  } else if (isAllQuaCach && !isAllHatTho && !isAllHatHoi) {
    selectedMatches = selectedMatches.filter((m) =>
      normalizeVietnamese(m.record.nhom_bai).includes('qua cach')
    );
  } else if ((isAllHatTho || isAllHatHoi) && !isAllQuaCach) {
    selectedMatches = selectedMatches.filter((m) => {
      const grp = normalizeVietnamese(m.record.nhom_bai);
      return (isAllHatTho && grp.includes('hat tho')) || (isAllHatHoi && grp.includes('hat hoi'));
    });
  }

  // Keep up to 16 matches (enough for all 14 Quả Cách + any cross-referenced songs!)
  const finalMatches = selectedMatches.slice(0, 16);
  const finalRecords = finalMatches.map((m) => m.record);

  // Deduplicate linked sources
  const seenSources = new Map<string, SourceItem>();
  for (const rec of finalRecords) {
    for (const src of rec.sources) {
      if (!seenSources.has(src.id)) {
        seenSources.set(src.id, src);
      }
    }
  }

  // If community/location synthesis matched general sources directly
  if (isCommunityOrLocation && seenSources.size === 0) {
    for (const src of allSources) {
      seenSources.set(src.id, src);
    }
  }

  return {
    query: cleanQuery,
    normalizedQuery: normQuery,
    intent: {
      isAllQuaCach,
      isAllHatTho,
      isAllHatHoi,
      isSynthesis,
      isCommunityOrLocation,
      needsDeepReasoning,
    },
    matches: finalMatches,
    records: finalRecords,
    sources: Array.from(seenSources.values()),
  };
}
