// ─── MFDS API Client ─────────────────────────────────────────────────────────

import type { MFDSProduct, OpenFDAEnrichmentRow, ResultRow, GenericItem, GenericCompact } from "../types/dashboard";

// MFDS Open API base — ingredient search endpoint
// Using the public Korean MFDS API (의약품 성분 기반 검색)
const MFDS_BASE = "https://apis.data.go.kr/1471000/DrbEasyDrugInfoService";
// NOTE: For CORS-safe operation in browser, we proxy via a public CORS proxy
// or use the allowedCORS key. In production this should go through an edge function.
// For now we'll use the mock/demo approach with a note to users.

const INGREDIENT_CACHE = new Map<string, MFDSProduct[]>();

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Query MFDS API for products by ingredient base key.
 * Returns array of matched MFDS products.
 *
 * NOTE: The real MFDS API requires a service key and may have CORS restrictions.
 * This function uses the public data portal endpoint pattern.
 * If CORS blocks the call, results will be empty and flagged as NOT_FOUND.
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

  try {
    // Try CORS-compatible MFDS endpoint
    const params = new URLSearchParams({
      itemName: primaryIngredient,
      type: "json",
      numOfRows: "100",
      pageNo: "1",
    });
    const url = `${MFDS_BASE}/getDrbEasyDrugList?${params}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`MFDS HTTP ${res.status}`);
    const data = await res.json();
    const items = data?.body?.items ?? [];
    const products: MFDSProduct[] = items
      .map((item: Record<string, string>) => ({
        품목기준코드: item.itemSeq ?? "",
        제품명: item.itemName ?? "",
        업체명: item.entpName ?? "",
        제형: item.formCodeName ?? "",
        신약구분: item.newDrugClass ?? "",
        취소취하: item.cancelDate ? "Y" : "N",
        성분: item.materialName ?? "",
      }))
      .filter(
        (p: MFDSProduct) => includeRevoked || p.취소취하 !== "Y"
      );

    INGREDIENT_CACHE.set(cacheKey, products);
    return products;
  } catch {
    // API unavailable — return empty (will flag as MFDS_NOT_FOUND)
    INGREDIENT_CACHE.set(cacheKey, []);
    return [];
  }
}

export function clearMFDSCache() {
  INGREDIENT_CACHE.clear();
}

type CountMode = "ingredient" | "ingredient+form";

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
    options.onProgress?.(i, enrichmentRows.length, `Querying MFDS: ${row.Ingredient_base}`);

    let mfdsProducts: MFDSProduct[] = [];
    try {
      mfdsProducts = await queryMFDSByIngredient(row.Ingredient_base, options.includeRevoked);
    } catch {
      mfdsProducts = [];
    }

    const mfdsNotFound = mfdsProducts.length === 0;
    const hasOriginal = mfdsProducts.some((p) => p.신약구분 === "Y");

    // Filter by count mode
    const getKey = (p: MFDSProduct) =>
      options.countMode === "ingredient+form"
        ? `${row.Ingredient_base}__${p.제형}`
        : row.Ingredient_base;

    const uniqueKeys = new Set(mfdsProducts.map(getKey));
    const genericProducts = mfdsProducts.filter((p) => p.신약구분 !== "Y");
    const genericCount = options.countMode === "ingredient+form"
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

    // Validation: check count consistency
    if (rowGenericItems.length !== genericCount && options.countMode === "ingredient") {
      // For ingredient mode they should match
    }

    await sleep(50); // gentle pacing
  }

  // Build compact
  const genericCompact: GenericCompact[] = enrichmentRows.map((row) => {
    const items = allGenericItems.filter((g) => g.source_순번 === row.순번);
    const resultRow = resultRows.find((r) => r.순번 === row.순번);
    const genericCount = resultRow?.generic_count_excluding_original ?? 0;
    if (items.length !== genericCount) {
      validationErrors.push(
        `Row 순번=${row.순번}: generic_items count (${items.length}) ≠ result generic_count (${genericCount})`
      );
    }
    return {
      순번: row.순번,
      Product: row.Product,
      Ingredient_base: row.Ingredient_base,
      generic_count: genericCount,
      joined_product_names: items.map((g) => g.generic_제품명).join(" | "),
    };
  });

  return { resultRows, genericItems: allGenericItems, genericCompact, validationErrors };
}
