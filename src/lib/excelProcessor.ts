// ─── Excel Processor ─────────────────────────────────────────────────────────

import * as XLSX from "xlsx";
import type {
  SourceRow,
  OpenFDAEnrichmentRow,
  ResultRow,
  GenericItem,
  GenericCompact,
  SummaryMetrics,
} from "../types/dashboard";

/**
 * Parse uploaded Excel file and extract source rows.
 * Expects columns: 순번, Product
 */
export function parseSourceExcel(file: File): Promise<{ rows: SourceRow[]; columnNames: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (!raw.length) {
          reject(new Error("Excel file is empty or has no data rows."));
          return;
        }

        const columnNames = Object.keys(raw[0]);

        // Find 순번 and Product columns (flexible matching)
        const seqKey = columnNames.find((c) =>
          /순번|seq|no\.?|number|#|index/i.test(c)
        ) ?? columnNames[0];
        const prodKey = columnNames.find((c) =>
          /product|brand|name|제품|품목|english/i.test(c)
        ) ?? columnNames[1] ?? columnNames[0];

        const rows: SourceRow[] = raw.map((r, idx) => ({
          순번: r[seqKey] !== undefined ? String(r[seqKey]) : String(idx + 1),
          Product: String(r[prodKey] ?? "").trim(),
        })).filter((r) => r.Product);

        resolve({ rows, columnNames });
      } catch (err) {
        reject(new Error(`Failed to parse Excel: ${err}`));
      }
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsArrayBuffer(file);
  });
}

function makeWorksheet<T extends object>(data: T[]): XLSX.WorkSheet {
  if (!data.length) return XLSX.utils.aoa_to_sheet([[]]);
  return XLSX.utils.json_to_sheet(data);
}

/**
 * Generate final output Excel workbook with all 5 sheets.
 */
export function generateOutputExcel(params: {
  filled: ResultRow[];
  openfda_enrichment: OpenFDAEnrichmentRow[];
  generic_items: GenericItem[];
  generic_list_compact: GenericCompact[];
  summary: SummaryMetrics;
}): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: filled (main results)
  const filledData = params.filled.map((r) => ({
    "순번": r.순번,
    "Product": r.Product,
    "Product_norm": r.Product_norm,
    "Ingredient_base": r.Ingredient_base,
    "OpenFDA Confidence": r.openfda_confidence,
    "신약(원개발의약품) 여부": r.original_허가여부,
    "제네릭 수 (신약 제외)": r.generic_count_excluding_original,
    "MFDS 전체 품목수": r.total_count_including_original,
    "MFDS 미검색": r.mfds_not_found ? "Y" : "N",
  }));
  XLSX.utils.book_append_sheet(wb, makeWorksheet(filledData), "filled");

  // Sheet 2: openfda_enrichment
  XLSX.utils.book_append_sheet(wb, makeWorksheet(params.openfda_enrichment), "openfda_enrichment");

  // Sheet 3: generic_items
  XLSX.utils.book_append_sheet(wb, makeWorksheet(params.generic_items), "generic_items");

  // Sheet 4: generic_list_compact
  XLSX.utils.book_append_sheet(wb, makeWorksheet(params.generic_list_compact), "generic_list_compact");

  // Sheet 5: summary
  const summaryData = [
    { Metric: "Total Rows", Value: params.summary.total_rows },
    { Metric: "OpenFDA REVIEW count", Value: params.summary.openfda_review_count },
    { Metric: "MFDS Not Found", Value: params.summary.mfds_not_found },
    { Metric: "Confidence HIGH", Value: params.summary.confidence_HIGH },
    { Metric: "Confidence MEDIUM", Value: params.summary.confidence_MEDIUM },
    { Metric: "Confidence REVIEW", Value: params.summary.confidence_REVIEW },
    { Metric: "Total Generic Item Rows", Value: params.summary.total_generic_item_rows },
    { Metric: "Average Generic per Source", Value: params.summary.average_generic_per_source },
    { Metric: "Validation Errors", Value: params.summary.validation_errors.join(" | ") || "None" },
  ];
  XLSX.utils.book_append_sheet(wb, makeWorksheet(summaryData), "summary");

  XLSX.writeFile(wb, "MFDS_matching_output.xlsx");
}

/**
 * Generate only the OpenFDA enrichment sheet for independent download.
 */
export function downloadEnrichmentSheet(rows: OpenFDAEnrichmentRow[]): void {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeWorksheet(rows), "openfda_enrichment");
  XLSX.writeFile(wb, "openfda_enrichment.xlsx");
}
