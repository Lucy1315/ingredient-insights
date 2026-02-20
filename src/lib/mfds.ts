// ─── MFDS API Client ─────────────────────────────────────────────────────────

import type { MFDSProduct, OpenFDAEnrichmentRow, ResultRow, GenericItem, GenericCompact } from "../types/dashboard";

// 공공데이터포털 MFDS API 서비스 키 (공개 키)
const MFDS_SERVICE_KEY = "78dd2db3fe72d72859ddac4b14b20240198fb736aebc531227e72a6f14d8783b";

// 의약품 허가정보 서비스 (e약은요 + 의약품 통합정보)
// Primary endpoint: 의약품 성분별 품목 조회
const MFDS_BASE = "https://apis.data.go.kr/1471000";

const INGREDIENT_CACHE = new Map<string, MFDSProduct[]>();

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, retries = 3, backoff = 600): Promise<Response> {
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
 * 의약품 허가정보 서비스 — getDrugPrdtPrmsnInfoList01
 * 성분명 기반 품목 전체 조회 (페이지네이션 포함)
 */
async function queryDrugPermitByIngredient(
  ingredientName: string,
  pageNo = 1,
  numOfRows = 100
): Promise<{ items: MFDSProduct[]; totalCount: number }> {
  const params = new URLSearchParams({
    serviceKey: MFDS_SERVICE_KEY,
    type: "json",
    numOfRows: String(numOfRows),
    pageNo: String(pageNo),
    ingrKorName: ingredientName,       // 성분 한글명 검색
  });

  const url = `${MFDS_BASE}/DrugPrdtPrmsnInfoService04/getDrugPrdtPrmsnDtlInq03?${params}`;

  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // 응답 구조 처리 (공공데이터포털 표준 응답)
    const header = data?.header ?? data?.response?.header ?? {};
    const body = data?.body ?? data?.response?.body ?? {};

    if (header?.resultCode && header.resultCode !== "00" && header.resultCode !== "0000") {
      throw new Error(`MFDS API error: ${header.resultMsg}`);
    }

    const items = body?.items?.item ?? body?.items ?? [];
    const itemArray = Array.isArray(items) ? items : items ? [items] : [];
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
    console.warn(`[MFDS] query failed for "${ingredientName}":`, err);
    return { items: [], totalCount: 0 };
  }
}

/**
 * e약은요 서비스 — getDrbEasyDrugList (용이하게 검색 가능한 fallback)
 * 품목명/성분명 통합 검색
 */
async function queryEasyDrugList(
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
    const items = body?.items?.item ?? body?.items ?? [];
    const itemArray = Array.isArray(items) ? items : items ? [items] : [];

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
    console.warn(`[MFDS] easy drug list failed for "${keyword}":`, err);
    return [];
  }
}

/**
 * 전체 페이지 로드 (100건 이상 결과 처리)
 */
async function fetchAllPages(ingredientName: string): Promise<MFDSProduct[]> {
  const first = await queryDrugPermitByIngredient(ingredientName, 1, 100);
  let all = [...first.items];

  const totalPages = Math.ceil(first.totalCount / 100);
  if (totalPages > 1) {
    const pagePromises = [];
    for (let p = 2; p <= Math.min(totalPages, 10); p++) {
      // max 1000 results
      pagePromises.push(queryDrugPermitByIngredient(ingredientName, p, 100));
    }
    const pages = await Promise.all(pagePromises);
    for (const page of pages) {
      all = [...all, ...page.items];
    }
  }

  // Fallback to e약은요 if primary returns nothing
  if (all.length === 0) {
    const fallback = await queryEasyDrugList(ingredientName, 1, 100);
    all = fallback;
  }

  return all;
}

/**
 * Query MFDS API for products by ingredient base key.
 */
export async function queryMFDSByIngredient(
  ingredientBase: string,
  includeRevoked: boolean = false
): Promise<MFDSProduct[]> {
  if (!ingredientBase) return [];

  const cacheKey = `${ingredientBase}__${includeRevoked}`;
  if (INGREDIENT_CACHE.has(cacheKey)) {
    return INGREDIENT_CACHE.get(cacheKey)!;
  }

  // Extract first ingredient (before semicolon) as primary search term
  const primaryIngredient = ingredientBase.split(";")[0].trim();
  if (!primaryIngredient) return [];

  const all = await fetchAllPages(primaryIngredient);

  const products = all.filter(
    (p) => includeRevoked || p.취소취하 !== "Y"
  );

  INGREDIENT_CACHE.set(cacheKey, products);
  return products;
}

export function clearMFDSCache() {
  INGREDIENT_CACHE.clear();
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
    options.onProgress?.(i, enrichmentRows.length, `MFDS 조회: ${row.Ingredient_base}`);

    let mfdsProducts: MFDSProduct[] = [];
    try {
      mfdsProducts = await queryMFDSByIngredient(row.Ingredient_base, options.includeRevoked);
    } catch {
      mfdsProducts = [];
    }

    const mfdsNotFound = mfdsProducts.length === 0;
    const hasOriginal = mfdsProducts.some((p) =>
      p.신약구분 === "Y" || p.신약구분?.includes("신약")
    );

    // Filter by count mode
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
      openfda_confidence: row.openfda_confidence,
      original_허가여부: mfdsNotFound ? "-" : hasOriginal ? "Y" : "N",
      generic_count_excluding_original: mfdsNotFound ? 0 : genericCount,
      total_count_including_original: mfdsNotFound ? 0 : uniqueKeys.size,
      mfds_not_found: mfdsNotFound,
    };
    resultRows.push(result);

    // Generic items
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

    // Validation: count consistency check
    if (options.countMode === "ingredient" && rowGenericItems.length !== genericCount) {
      validationErrors.push(
        `Row 순번=${row.순번} (${row.Product}): item count mismatch — items=${rowGenericItems.length}, generic_count=${genericCount}`
      );
    }

    await sleep(100); // 100ms pacing between rows to respect API rate limits
  }

  // Build compact sheet
  const genericCompact: GenericCompact[] = enrichmentRows.map((row) => {
    const items = allGenericItems.filter((g) => String(g.source_순번) === String(row.순번));
    const resultRow = resultRows.find((r) => String(r.순번) === String(row.순번));
    const genericCount = resultRow?.generic_count_excluding_original ?? 0;
    if (items.length !== genericCount) {
      const errMsg = `Row 순번=${row.순번}: generic_items rows (${items.length}) ≠ generic_count (${genericCount})`;
      if (!validationErrors.includes(errMsg)) {
        validationErrors.push(errMsg);
      }
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
