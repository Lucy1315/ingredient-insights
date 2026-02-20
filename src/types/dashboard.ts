// ─── Core Types ──────────────────────────────────────────────────────────────

export interface SourceRow {
  순번: number | string;
  Product: string;
}

export type OpenFDAConfidence = "HIGH" | "MEDIUM" | "REVIEW";

export interface OpenFDAEnrichmentRow {
  순번: number | string;
  Product: string;
  Product_norm: string;
  openfda_brand_name: string;
  openfda_generic_name: string;
  openfda_active_ingredients_raw: string;
  Ingredient_base: string;
  openfda_confidence: OpenFDAConfidence;
  // Korean INN translation for MFDS lookup
  Ingredient_base_ko: string;       // Korean name used to query MFDS
  mfds_search_term: string;         // Exact term sent to MFDS API
  inn_mapped: boolean;              // Whether an INN mapping was found
}

export interface MFDSProduct {
  품목기준코드: string;
  제품명: string;
  업체명: string;
  제형: string;
  신약구분: string;
  취소취하: string;
  성분: string;
}

export interface ResultRow {
  순번: number | string;
  Product: string;
  Product_norm: string;
  Ingredient_base: string;
  Ingredient_base_ko: string;
  mfds_search_term: string;
  inn_mapped: boolean;
  openfda_confidence: OpenFDAConfidence;
  original_허가여부: "Y" | "N" | "-";
  generic_count_excluding_original: number;
  total_count_including_original: number;
  mfds_not_found: boolean;
}

export interface GenericItem {
  source_순번: number | string;
  source_Product: string;
  Ingredient_base: string;
  generic_품목기준코드: string;
  generic_제품명: string;
  generic_업체명: string;
  generic_제형: string;
  generic_신약구분: string;
  generic_취소취하: string;
}

export interface GenericCompact {
  순번: number | string;
  Product: string;
  Ingredient_base: string;
  generic_count: number;
  joined_product_names: string;
}

export interface SummaryMetrics {
  total_rows: number;
  openfda_review_count: number;
  mfds_not_found: number;
  confidence_HIGH: number;
  confidence_MEDIUM: number;
  confidence_REVIEW: number;
  total_generic_item_rows: number;
  average_generic_per_source: number;
  validation_errors: string[];
}

export interface ProcessingJob {
  id: string;
  status: "idle" | "uploading" | "enriching" | "matching" | "calculating" | "done" | "error";
  progress: number;
  message: string;
  sourceRows: SourceRow[];
  enrichmentRows: OpenFDAEnrichmentRow[];
  resultRows: ResultRow[];
  genericItems: GenericItem[];
  genericCompact: GenericCompact[];
  summary: SummaryMetrics;
  errors: string[];
  cancelRevoked: boolean;
  countMode: "ingredient" | "ingredient+form";
  includeRevoked: boolean;
}

export type JobStatus = ProcessingJob["status"];
