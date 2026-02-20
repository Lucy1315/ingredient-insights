// ─── Sample Data Generator ───────────────────────────────────────────────────

import * as XLSX from "xlsx";

const SAMPLE_PRODUCTS = [
  { 순번: 1,  Product: "Aspirin" },
  { 순번: 2,  Product: "Ibuprofen" },
  { 순번: 3,  Product: "Acetaminophen" },
  { 순번: 4,  Product: "Lipitor" },
  { 순번: 5,  Product: "Norvasc" },
  { 순번: 6,  Product: "Glucophage" },
  { 순번: 7,  Product: "Prilosec" },
  { 순번: 8,  Product: "Zestril" },
  { 순번: 9,  Product: "Cozaar" },
  { 순번: 10, Product: "Lopressor" },
  { 순번: 11, Product: "Plavix" },
  { 순번: 12, Product: "Zocor" },
  { 순번: 13, Product: "Synthroid" },
  { 순번: 14, Product: "Nexium" },
  { 순번: 15, Product: "Amoxicillin" },
  { 순번: 16, Product: "Augmentin" },
  { 순번: 17, Product: "Prozac" },
  { 순번: 18, Product: "Zoloft" },
  { 순번: 19, Product: "Warfarin" },
  { 순번: 20, Product: "Metoprolol Succinate" },
];

export function downloadSampleExcel() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(SAMPLE_PRODUCTS);

  // Column widths
  ws["!cols"] = [{ wch: 8 }, { wch: 28 }];

  XLSX.utils.book_append_sheet(wb, ws, "source");
  XLSX.writeFile(wb, "sample_source_products.xlsx");
}

export function getSampleFile(): File {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(SAMPLE_PRODUCTS);
  ws["!cols"] = [{ wch: 8 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws, "source");

  const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return new File([blob], "sample_source_products.xlsx", { type: blob.type });
}

export const SAMPLE_PRODUCT_LIST = SAMPLE_PRODUCTS;
