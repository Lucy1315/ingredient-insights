// ─── MFDS API Client ─────────────────────────────────────────────────────────

import type { MFDSProduct, OpenFDAEnrichmentRow, ResultRow, GenericItem, GenericCompact } from "../types/dashboard";
import { getPrimaryKorean, ingredientBaseToKorean } from "./innMapping";

// 공공데이터포털 MFDS API 서비스 키 (공개 키)
const MFDS_SERVICE_KEY = "78dd2db3fe72d72859ddac4b14b20240198fb736aebc531227e72a6f14d8783b";

// MFDS 의약품 허가정보 엔드포인트
const MFDS_BASE = "https://apis.data.go.kr/1471000";

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
  const params = new URLSearchParams({
    serviceKey: MFDS_SERVICE_KEY,
    type: "json",
    numOfRows: String(numOfRows),
    pageNo: String(pageNo),
    ingrKorName: korName,
  });

  const url = `${MFDS_BASE}/DrugPrdtPrmsnInfoService04/getDrugPrdtPrmsnDtlInq03?${params}`;

  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const body = data?.body ?? data?.response?.body ?? {};
    const header = data?.header ?? data?.response?.header ?? {};

    if (header?.resultCode && !["00", "000", "0000"].includes(String(header.resultCode))) {
      console.warn(`[MFDS] resultCode=${header.resultCode} for "${korName}": ${header.resultMsg}`);
      return { items: [], totalCount: 0 };
    }

    const rawItems = body?.items?.item ?? body?.items ?? [];
    const itemArray = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
    const totalCount = Number(body?.totalCount ?? 0);

    const products: MFDSProduct[] = itemArray.map((item: Record<string, string>) => ({
      품목기준코드: item.ITEM_SEQ ?? item.itemSeq ?? "",
      제품명: item.ITEM_NAME ?? item.itemName ?? "",
      업체명: item.ENTP_NAME ?? item.entpName ?? "",
      제형: item.FORM_CODE_NAME ?? item.formCodeName ?? "",
      신약구분: item.NEW_DRUG_CLASS_NAME ?? item.newDrugClass ?? item.NEW_DRUG_CLASS ?? "",
      취소취하: (item.CANCEL_DATE ?? item.cancelDate ?? "") ? "Y" : "N",
      성분: item.MAIN_ITEM_INGR ?? item.INGR_NAME ?? item.materialName ?? "",
    }));

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
    serviceKey: MFDS_SERVICE_KEY,
    type: "json",
    numOfRows: String(numOfRows),
    pageNo: String(pageNo),
    itemName: keyword,
  });

  const url = `${MFDS_BASE}/DrbEasyDrugInfoService/getDrbEasyDrugList?${params}`;

  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const body = data?.body ?? data?.response?.body ?? {};
    const rawItems = body?.items?.item ?? body?.items ?? [];
    const itemArray = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

    return itemArray.map((item: Record<string, string>) => ({
      품목기준코드: item.itemSeq ?? "",
      제품명: item.itemName ?? "",
      업체명: item.entpName ?? "",
      제형: item.formCodeName ?? "",
      신약구분: item.newDrugClass ?? "",
      취소취하: item.cancelDate ? "Y" : "N",
      성분: item.materialName ?? "",
    }));
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
 * Returns products + the Korean search term that was used.
 */
export async function queryMFDSByIngredient(
  ingredientBase: string,
  includeRevoked: boolean = false
): Promise<{ products: MFDSProduct[]; searchTerm: string; innMapped: boolean }> {
  if (!ingredientBase) return { products: [], searchTerm: "", innMapped: false };

  const cacheKey = `${ingredientBase}__${includeRevoked}`;
  if (INGREDIENT_CACHE.has(cacheKey)) {
    const cached = INGREDIENT_CACHE.get(cacheKey)!;
    // read cached search term from a parallel map
    const cachedMeta = SEARCH_TERM_CACHE.get(cacheKey) ?? { searchTerm: "", innMapped: false };
    return { products: cached, ...cachedMeta };
  }

  // Translate Ingredient_base to Korean
  const primaryKo = getPrimaryKorean(ingredientBase);
  const innMapped = primaryKo !== null;

  // If no mapping, try first token as-is (MFDS sometimes accepts partial English)
  const searchTerm = primaryKo ?? ingredientBase.split(";")[0].trim();

  let allProducts: MFDSProduct[] = [];
  if (searchTerm) {
    allProducts = await fetchAllPages(searchTerm);
  }

  // If multi-component, also try secondary components
  if (allProducts.length === 0) {
    const { mapped } = ingredientBaseToKorean(ingredientBase);
    for (const { ko } of mapped.slice(1)) {
      if (ko && ko !== primaryKo) {
        const secondary = await fetchAllPages(ko);
        if (secondary.length > 0) { allProducts = secondary; break; }
        await sleep(100);
      }
    }
  }

  const filtered = allProducts.filter(
    (p) => includeRevoked || p.취소취하 !== "Y"
  );

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
      const result = await queryMFDSByIngredient(row.Ingredient_base, options.includeRevoked);
      mfdsProducts = result.products;
      searchTerm = result.searchTerm;
      innMapped = result.innMapped;
    } catch {
      mfdsProducts = [];
    }

    const mfdsNotFound = mfdsProducts.length === 0;
    const hasOriginal = mfdsProducts.some((p) =>
      p.신약구분 === "Y" || p.신약구분?.includes("신약")
    );

    const getKey = (p: MFDSProduct) =>
      options.countMode === "ingredient+form"
        ? `${row.Ingredient_base}__${p.제형}`
        : row.Ingredient_base;

    const uniqueKeys = new Set(mfdsProducts.map(getKey));
    const genericProducts = mfdsProducts.filter((p) =>
      p.신약구분 !== "Y" && !p.신약구분?.includes("신약")
    );
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
