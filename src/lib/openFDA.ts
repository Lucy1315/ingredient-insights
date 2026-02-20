// ─── OpenFDA API Client ───────────────────────────────────────────────────────

import {
  normalizeProductName,
  extractPrimaryToken,
  generateIngredientBase,
} from "./ingredientNormalizer";
import { getPrimaryKorean, toKoreanINN } from "./innMapping";
import type { OpenFDAConfidence, OpenFDAEnrichmentRow, SourceRow } from "../types/dashboard";

const OPENFDA_BASE = "https://api.fda.gov/drug";
const CACHE = new Map<string, OpenFDAEnrichmentRow>();

interface OpenFDALabelResult {
  brand_name?: string[];
  generic_name?: string[];
  active_ingredient?: string[];
  application_number?: string[];
}

interface OpenFDANDCResult {
  brand_name?: string;
  generic_name?: string;
  active_ingredients?: Array<{ name: string; strength: string }>;
  application_number?: string;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, retries = 3, backoff = 800): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.status === 429) {
        await sleep(backoff * (i + 1));
        continue;
      }
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(backoff * (i + 1));
    }
  }
  throw new Error("Max retries exceeded");
}

async function queryLabelEndpoint(token: string): Promise<{
  brand: string;
  generic: string;
  ingredients: string;
  appNo: string;
  confidence: OpenFDAConfidence;
} | null> {
  const q = encodeURIComponent(`openfda.brand_name:"${token}"`);
  const url = `${OPENFDA_BASE}/label.json?search=${q}&limit=1`;
  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) return null;
    const data = await res.json();
    const result: OpenFDALabelResult = data?.results?.[0]?.openfda ?? {};
    const ingredients: string = data?.results?.[0]?.active_ingredient?.[0] ?? "";
    const brand = result.brand_name?.[0] ?? "";
    const generic = result.generic_name?.[0] ?? "";
    const appNo = result.application_number?.[0] ?? "";

    if (!ingredients && !brand) return null;
    const confidence: OpenFDAConfidence = brand && ingredients ? "HIGH" : brand || ingredients ? "MEDIUM" : "REVIEW";
    return { brand, generic, ingredients, appNo, confidence };
  } catch {
    return null;
  }
}

async function queryNDCEndpoint(token: string): Promise<{
  brand: string;
  generic: string;
  ingredients: string;
  appNo: string;
  confidence: OpenFDAConfidence;
} | null> {
  const q = encodeURIComponent(`brand_name:"${token}"`);
  const url = `${OPENFDA_BASE}/ndc.json?search=${q}&limit=1`;
  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) return null;
    const data = await res.json();
    const result: OpenFDANDCResult = data?.results?.[0] ?? {};
    const brand = result.brand_name ?? "";
    const generic = result.generic_name ?? "";
    const appNo = result.application_number ?? "";
    const ingredients = result.active_ingredients?.map((i) => `${i.name} ${i.strength}`).join("; ") ?? "";
    if (!brand && !ingredients) return null;
    const confidence: OpenFDAConfidence = brand && ingredients ? "HIGH" : "MEDIUM";
    return { brand, generic, ingredients, appNo, confidence };
  } catch {
    return null;
  }
}

export async function enrichRowWithOpenFDA(
  row: SourceRow,
  onProgress?: (msg: string) => void
): Promise<OpenFDAEnrichmentRow> {
  const norm = normalizeProductName(row.Product);

  if (CACHE.has(norm)) {
    return { ...CACHE.get(norm)!, 순번: row.순번, Product: row.Product };
  }

  const token = extractPrimaryToken(norm);
  onProgress?.(`Querying OpenFDA: ${token}`);

  // Try label endpoint first, then NDC
  let found = await queryLabelEndpoint(token);
  if (!found) {
    await sleep(200); // gentle rate limit
    found = await queryNDCEndpoint(token);
  }

  // Fallback: try shortened token (first word only)
  if (!found && token !== norm.split(" ")[0]) {
    const shortToken = norm.split(" ")[0];
    await sleep(200);
    found = await queryLabelEndpoint(shortToken);
  }

  const ingredientBase = found?.ingredients ? generateIngredientBase(found.ingredients) : norm;

  // 한국어 성분명 결정 우선순위:
  // 1. ingredientBase(INN명)로 매핑 시도
  // 2. 원래 제품명 토큰(브랜드명)으로 직접 매핑 시도
  // 3. 정규화된 전체 제품명으로 시도
  let koName = getPrimaryKorean(ingredientBase) ?? "";
  if (!koName) {
    koName = toKoreanINN(token) ?? "";
  }
  if (!koName) {
    koName = toKoreanINN(norm) ?? "";
  }

  const enriched: OpenFDAEnrichmentRow = {
    순번: row.순번,
    Product: row.Product,
    Product_norm: norm,
    openfda_brand_name: found?.brand ?? "",
    openfda_generic_name: found?.generic ?? "",
    openfda_active_ingredients_raw: found?.ingredients ?? "",
    Ingredient_base: ingredientBase,
    openfda_confidence: found?.confidence ?? "REVIEW",
    Ingredient_base_ko: koName,
    mfds_search_term: koName,
    inn_mapped: koName !== "",
  };

  CACHE.set(norm, enriched);
  return enriched;
}

export function clearOpenFDACache() {
  CACHE.clear();
}

export async function batchEnrich(
  rows: SourceRow[],
  onProgress?: (current: number, total: number, msg: string) => void,
  signal?: AbortSignal
): Promise<OpenFDAEnrichmentRow[]> {
  const results: OpenFDAEnrichmentRow[] = [];
  const BATCH_SIZE = 5;
  const BATCH_DELAY = 500;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    if (signal?.aborted) break;
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((row) =>
        enrichRowWithOpenFDA(row, (msg) =>
          onProgress?.(i + batch.indexOf(row), rows.length, msg)
        )
      )
    );
    results.push(...batchResults);
    onProgress?.(Math.min(i + BATCH_SIZE, rows.length), rows.length, "Batch complete");
    if (i + BATCH_SIZE < rows.length) {
      await sleep(BATCH_DELAY);
    }
  }
  return results;
}
