// ─── MFDS API Client ─────────────────────────────────────────────────────────

import type { MFDSProduct, OpenFDAEnrichmentRow, ResultRow, GenericItem, GenericCompact } from "../types/dashboard";
import { getPrimaryKorean, ingredientBaseToKorean } from "./innMapping";

// 공공데이터포털 MFDS API 서비스 키 (공개 키)
const MFDS_SERVICE_KEY = "78dd2db3fe72d72859ddac4b14b20240198fb736aebc531227e72a6f14d8783b";

// MFDS 의약품 허가정보 엔드포인트 (Vite 프록시 경유 → CORS 우회)
const MFDS_BASE = "/mfds-api/1471000";

const INGREDIENT_CACHE = new Map<string, MFDSProduct[]>();

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, retries = 3, backoff = 800): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (res.status === 429 || res.status === 503) {
        await sleep(backoff * (i + 1));
        continue;
      }
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(backoff * (i + 1));
    }
  }
  throw new Error("MFDS API: max retries exceeded");
}

/**
 * 의약품 허가정보 — 성분명(한국어)으로 조회
 * endpoint: getDrugPrdtPrmsnDtlInq03 (ingrKorName)
 */
async function queryByKorIngredient(
  korName: string,
  pageNo = 1,
  numOfRows = 100
): Promise<{ items: MFDSProduct[]; totalCount: number }> {
  // 서비스 키는 이미 인코딩된 hex 문자열이므로 URLSearchParams로 이중 인코딩 방지
  // 나머지 파라미터만 URLSearchParams로 처리 후 serviceKey를 raw로 붙임
  const params = new URLSearchParams({
    type: "json",
    numOfRows: String(numOfRows),
    pageNo: String(pageNo),
    ingrKorName: korName,
  });

  const url = `${MFDS_BASE}/DrugPrdtPrmsnInfoService04/getDrugPrdtPrmsnDtlInq03?serviceKey=${MFDS_SERVICE_KEY}&${params}`;

  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      console.warn(`[MFDS] getDrugPrdtPrmsnDtlInq03 HTTP ${res.status} for "${korName}"`);
      return { items: [], totalCount: 0 };
    }
    const text = await res.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      console.warn(`[MFDS] non-JSON response for "${korName}":`, text.slice(0, 200));
      return { items: [], totalCount: 0 };
    }

    const body = (data?.body ?? (data as Record<string, Record<string, unknown>>)?.response?.body ?? {}) as Record<string, unknown>;
    const header = (data?.header ?? (data as Record<string, Record<string, unknown>>)?.response?.header ?? {}) as Record<string, string>;

    if (header?.resultCode && !["00", "000", "0000"].includes(String(header.resultCode))) {
      console.warn(`[MFDS] resultCode=${header.resultCode} for "${korName}": ${header.resultMsg}`);
      return { items: [], totalCount: 0 };
    }

    const rawItems = (body?.items as Record<string, unknown>)?.item ?? body?.items ?? [];
    const itemArray = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
    const totalCount = Number(body?.totalCount ?? 0);

    const products: MFDSProduct[] = (itemArray as Record<string, string>[]).map((item) => ({
      품목기준코드: item.ITEM_SEQ ?? item.itemSeq ?? "",
      제품명: item.ITEM_NAME ?? item.itemName ?? "",
      업체명: item.ENTP_NAME ?? item.entpName ?? "",
      제형: item.FORM_CODE_NAME ?? item.formCodeName ?? "",
      신약구분: item.NEW_DRUG_CLASS_NAME ?? item.newDrugClass ?? item.NEW_DRUG_CLASS ?? "",
      취소취하: (item.CANCEL_DATE ?? item.cancelDate ?? "") ? "Y" : "N",
      성분: item.MAIN_ITEM_INGR ?? item.INGR_NAME ?? item.materialName ?? "",
    }));

    console.log(`[MFDS] getDrugPrdtPrmsnDtlInq03 "${korName}" → ${products.length} items (total: ${totalCount})`);
    return { items: products, totalCount };
  } catch (err) {
    console.warn(`[MFDS] query failed for "${korName}":`, err);
    return { items: [], totalCount: 0 };
  }
}

/**
 * e약은요 — 품목명으로 fallback 검색
 */
async function queryEasyDrugByKorName(
  keyword: string,
  pageNo = 1,
  numOfRows = 100
): Promise<MFDSProduct[]> {
  const params = new URLSearchParams({
    type: "json",
    numOfRows: String(numOfRows),
    pageNo: String(pageNo),
    itemName: keyword,
  });

  // serviceKey를 raw로 붙여 이중 인코딩 방지
  const url = `${MFDS_BASE}/DrbEasyDrugInfoService/getDrbEasyDrugList?serviceKey=${MFDS_SERVICE_KEY}&${params}`;

  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      console.warn(`[MFDS] getDrbEasyDrugList HTTP ${res.status} for "${keyword}"`);
      return [];
    }
    const text = await res.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      console.warn(`[MFDS] non-JSON response for "${keyword}":`, text.slice(0, 200));
      return [];
    }
    const body = (data?.body ?? (data as Record<string, Record<string, unknown>>)?.response?.body ?? {}) as Record<string, unknown>;
    const rawItems = (body?.items as Record<string, unknown>)?.item ?? body?.items ?? [];
    const itemArray = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

    const results = (itemArray as Record<string, string>[]).map((item) => ({
      품목기준코드: item.itemSeq ?? "",
      제품명: item.itemName ?? "",
      업체명: item.entpName ?? "",
      제형: item.formCodeName ?? "",
      신약구분: item.newDrugClass ?? "",
      취소취하: item.cancelDate ? "Y" : "N",
      성분: item.materialName ?? "",
    }));

    console.log(`[MFDS] getDrbEasyDrugList "${keyword}" → ${results.length} items`);
    return results;
  } catch (err) {
    console.warn(`[MFDS] easy drug query failed for "${keyword}":`, err);
    return [];
  }
}

/**
 * Paginated fetch for permit API
 */
async function fetchAllPages(korName: string): Promise<MFDSProduct[]> {
  const first = await queryByKorIngredient(korName, 1, 100);
  let all = [...first.items];

  if (first.totalCount > 100) {
    const totalPages = Math.min(Math.ceil(first.totalCount / 100), 10);
    const pagePromises = [];
    for (let p = 2; p <= totalPages; p++) {
      pagePromises.push(queryByKorIngredient(korName, p, 100));
    }
    const pages = await Promise.all(pagePromises);
    for (const page of pages) all = [...all, ...page.items];
  }

  // Fallback: if primary returned nothing, try e약은요 by Korean name
  if (all.length === 0) {
    const fallback = await queryEasyDrugByKorName(korName, 1, 100);
    all = fallback;
  }

  return all;
}

/**
 * Query MFDS by Ingredient_base — translates to Korean first.
 * koOverride: 외부(수동 매핑 or Ingredient_base_ko)에서 직접 한국어 성분명을 전달하면 우선 사용.
 * Returns products + the Korean search term that was used.
 */
export async function queryMFDSByIngredient(
  ingredientBase: string,
  includeRevoked: boolean = false,
  koOverride?: string
): Promise<{ products: MFDSProduct[]; searchTerm: string; innMapped: boolean }> {
  if (!ingredientBase) return { products: [], searchTerm: "", innMapped: false };

  // koOverride가 있으면 캐시 키에 포함하여 같은 영문 성분이라도 구분
  const cacheKey = `${koOverride ?? ingredientBase}__${includeRevoked}`;
  if (INGREDIENT_CACHE.has(cacheKey)) {
    const cached = INGREDIENT_CACHE.get(cacheKey)!;
    const cachedMeta = SEARCH_TERM_CACHE.get(cacheKey) ?? { searchTerm: "", innMapped: false };
    return { products: cached, ...cachedMeta };
  }

  // koOverride 우선 사용, 없으면 INN 사전 번역
  const dictKo = getPrimaryKorean(ingredientBase);
  const primaryKo = koOverride || dictKo;
  const innMapped = primaryKo !== null && primaryKo !== "";

  // 한국어 검색어 결정
  const searchTerm = primaryKo ?? ingredientBase.split(";")[0].trim();

  let allProducts: MFDSProduct[] = [];
  if (searchTerm) {
    allProducts = await fetchAllPages(searchTerm);
  }

  // 검색 결과가 없고 koOverride가 없으면 다중 성분 secondary fallback 시도
  if (allProducts.length === 0 && !koOverride) {
    const { mapped } = ingredientBaseToKorean(ingredientBase);
    for (const { ko } of mapped.slice(1)) {
      if (ko && ko !== primaryKo) {
        const secondary = await fetchAllPages(ko);
        if (secondary.length > 0) { allProducts = secondary; break; }
        await sleep(100);
      }
    }
  }

  // 신약구분 판별 헬퍼 (Y, 신약, 또는 신약 포함 문자열)
  const isOriginal = (p: MFDSProduct) => {
    const v = (p.신약구분 ?? "").trim();
    return v === "Y" || v === "신약" || v.includes("신약");
  };

  const filtered = allProducts.filter((p) => includeRevoked || p.취소취하 !== "Y");

  INGREDIENT_CACHE.set(cacheKey, filtered);
  SEARCH_TERM_CACHE.set(cacheKey, { searchTerm, innMapped });

  return { products: filtered, searchTerm, innMapped };
}

// Secondary meta cache
const SEARCH_TERM_CACHE = new Map<string, { searchTerm: string; innMapped: boolean }>();

export function clearMFDSCache() {
  INGREDIENT_CACHE.clear();
  SEARCH_TERM_CACHE.clear();
}

export type CountMode = "ingredient" | "ingredient+form";

/**
 * Calculate result rows from enrichment data + MFDS matches.
 */
export async function calculateResults(
  enrichmentRows: OpenFDAEnrichmentRow[],
  options: {
    countMode: CountMode;
    includeRevoked: boolean;
    onProgress?: (current: number, total: number, msg: string) => void;
    signal?: AbortSignal;
  }
): Promise<{
  resultRows: ResultRow[];
  genericItems: GenericItem[];
  genericCompact: GenericCompact[];
  validationErrors: string[];
}> {
  const resultRows: ResultRow[] = [];
  const allGenericItems: GenericItem[] = [];
  const validationErrors: string[] = [];

  for (let i = 0; i < enrichmentRows.length; i++) {
    if (options.signal?.aborted) break;
    const row = enrichmentRows[i];

    const { korean } = ingredientBaseToKorean(row.Ingredient_base);
    const koLabel = korean[0] ? `(${korean[0]})` : "(미매핑)";
    options.onProgress?.(i, enrichmentRows.length, `MFDS 조회 ${i + 1}/${enrichmentRows.length}: ${row.Ingredient_base} ${koLabel}`);

    let mfdsProducts: MFDSProduct[] = [];
    let searchTerm = "";
    let innMapped = false;
    try {
      // Ingredient_base_ko(브랜드→INN 자동매핑 or 수동매핑) 우선 사용
      const koOverride = (row.Ingredient_base_ko || row.mfds_search_term) || undefined;
      const result = await queryMFDSByIngredient(row.Ingredient_base, options.includeRevoked, koOverride);
      mfdsProducts = result.products;
      searchTerm = result.searchTerm;
      innMapped = result.innMapped;
    } catch {
      mfdsProducts = [];
    }

    // 신약구분 판별 헬퍼 (강화 버전)
    const isOriginalProduct = (p: MFDSProduct) => {
      const v = (p.신약구분 ?? "").trim();
      return v === "Y" || v === "신약" || v.includes("신약");
    };

    const mfdsNotFound = mfdsProducts.length === 0;
    const hasOriginal = mfdsProducts.some(isOriginalProduct);

    const getKey = (p: MFDSProduct) =>
      options.countMode === "ingredient+form"
        ? `${row.Ingredient_base}__${p.제형}`
        : row.Ingredient_base;

    const uniqueKeys = new Set(mfdsProducts.map(getKey));
    const genericProducts = mfdsProducts.filter((p) => !isOriginalProduct(p));
    const genericCount =
      options.countMode === "ingredient+form"
        ? new Set(genericProducts.map((p) => getKey(p))).size
        : genericProducts.length;

    const result: ResultRow = {
      순번: row.순번,
      Product: row.Product,
      Product_norm: row.Product_norm,
      Ingredient_base: row.Ingredient_base,
      Ingredient_base_ko: row.Ingredient_base_ko,
      mfds_search_term: searchTerm,
      inn_mapped: innMapped,
      openfda_confidence: row.openfda_confidence,
      original_허가여부: mfdsNotFound ? "-" : hasOriginal ? "Y" : "N",
      generic_count_excluding_original: mfdsNotFound ? 0 : genericCount,
      total_count_including_original: mfdsNotFound ? 0 : uniqueKeys.size,
      mfds_not_found: mfdsNotFound,
    };
    resultRows.push(result);

    const rowGenericItems: GenericItem[] = genericProducts.map((p) => ({
      source_순번: row.순번,
      source_Product: row.Product,
      Ingredient_base: row.Ingredient_base,
      generic_품목기준코드: p.품목기준코드,
      generic_제품명: p.제품명,
      generic_업체명: p.업체명,
      generic_제형: p.제형,
      generic_신약구분: p.신약구분,
      generic_취소취하: p.취소취하,
    }));
    allGenericItems.push(...rowGenericItems);

    await sleep(120);
  }

  // Build compact
  const genericCompact: GenericCompact[] = enrichmentRows.map((row) => {
    const items = allGenericItems.filter((g) => String(g.source_순번) === String(row.순번));
    const resultRow = resultRows.find((r) => String(r.순번) === String(row.순번));
    const genericCount = resultRow?.generic_count_excluding_original ?? 0;
    if (items.length !== genericCount) {
      const errMsg = `Row 순번=${row.순번}: generic_items rows (${items.length}) ≠ generic_count (${genericCount})`;
      if (!validationErrors.includes(errMsg)) validationErrors.push(errMsg);
    }
    return {
      순번: row.순번,
      Product: row.Product,
      Ingredient_base: row.Ingredient_base,
      generic_count: genericCount,
      joined_product_names: items.map((g) => g.generic_제품명).filter(Boolean).join(" | "),
    };
  });

  return { resultRows, genericItems: allGenericItems, genericCompact, validationErrors };
}
