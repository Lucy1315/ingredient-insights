import React, { useState } from "react";
import type { OpenFDAEnrichmentRow } from "@/types/dashboard";
import { Download, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadEnrichmentSheet } from "@/lib/excelProcessor";

interface EnrichmentTableProps {
  rows: OpenFDAEnrichmentRow[];
}

type SortKey = keyof OpenFDAEnrichmentRow;

const ConfidenceBadge = ({ value }: { value: string }) => {
  if (value === "HIGH") return <span className="status-high px-2 py-0.5 rounded text-xs font-semibold">HIGH</span>;
  if (value === "MEDIUM") return <span className="status-medium px-2 py-0.5 rounded text-xs font-semibold">MEDIUM</span>;
  return <span className="status-review px-2 py-0.5 rounded text-xs font-semibold">REVIEW</span>;
};

const EnrichmentTable: React.FC<EnrichmentTableProps> = ({ rows }) => {
  const [sortKey, setSortKey] = useState<SortKey>("순번");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState("");

  const sorted = [...rows]
    .filter((r) =>
      filter
        ? Object.values(r).some((v) => String(v).toLowerCase().includes(filter.toLowerCase()))
        : true
    )
    .sort((a, b) => {
      const av = String(a[sortKey] ?? "");
      const bv = String(b[sortKey] ?? "");
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
      : null;

  const columns: { key: SortKey; label: string; width?: string }[] = [
    { key: "순번", label: "순번", width: "w-12" },
    { key: "Product", label: "제품명" },
    { key: "openfda_brand_name", label: "FDA 브랜드명" },
    { key: "openfda_generic_name", label: "FDA 일반명" },
    { key: "openfda_active_ingredients_raw", label: "활성 성분 (원문)" },
    { key: "Ingredient_base", label: "성분명(영문)" },
    { key: "Ingredient_base_ko", label: "한국어 성분명 (MFDS)" },
    { key: "openfda_confidence", label: "신뢰도" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <input
          className="flex-1 max-w-xs px-3 py-1.5 rounded bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="행 필터…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          onClick={() => downloadEnrichmentSheet(rows)}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-primary/10 border border-primary/30 text-primary text-sm hover:bg-primary/20 transition-colors"
        >
          <Download className="w-4 h-4" />
          시트 다운로드
        </button>
      </div>

      <div className="overflow-auto rounded-lg border border-border max-h-96">
        <table className="w-full text-xs min-w-[900px]">
          <thead className="sticky top-0 bg-secondary border-b border-border">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn("px-3 py-2 text-left text-muted-foreground font-semibold cursor-pointer hover:text-foreground select-none whitespace-nowrap", col.width)}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  <SortIcon col={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className="table-row-hover border-b border-border/50">
                <td className="px-3 py-2 font-mono text-muted-foreground">{row.순번}</td>
                <td className="px-3 py-2 font-medium text-foreground max-w-[140px] truncate">{row.Product}</td>
                <td className="px-3 py-2 text-foreground max-w-[110px] truncate">{row.openfda_brand_name || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2 text-muted-foreground max-w-[110px] truncate">{row.openfda_generic_name || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate" title={row.openfda_active_ingredients_raw}>{row.openfda_active_ingredients_raw || "—"}</td>
                <td className="px-3 py-2 text-primary font-mono max-w-[140px] truncate" title={row.Ingredient_base}>{row.Ingredient_base}</td>
                <td className="px-3 py-2 max-w-[130px]">
                  {row.Ingredient_base_ko ? (
                    <span className="flex items-center gap-1">
                      <span className="status-high px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0">매핑</span>
                      <span className="text-success font-medium truncate" title={row.Ingredient_base_ko}>{row.Ingredient_base_ko}</span>
                    </span>
                  ) : (
                    <span className="status-review px-1.5 py-0.5 rounded text-[10px]">미매핑</span>
                  )}
                </td>
                <td className="px-3 py-2"><ConfidenceBadge value={row.openfda_confidence} /></td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">데이터가 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground text-right">{sorted.length} / {rows.length} rows</p>
    </div>
  );
};

export default EnrichmentTable;
