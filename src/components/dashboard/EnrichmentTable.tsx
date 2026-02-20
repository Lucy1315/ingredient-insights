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
    { key: "Product", label: "Product" },
    { key: "openfda_brand_name", label: "FDA Brand" },
    { key: "openfda_generic_name", label: "FDA Generic" },
    { key: "openfda_active_ingredients_raw", label: "Active Ingredients (raw)" },
    { key: "Ingredient_base", label: "Ingredient_base" },
    { key: "openfda_confidence", label: "Confidence" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <input
          className="flex-1 max-w-xs px-3 py-1.5 rounded bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Filter rows…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          onClick={() => downloadEnrichmentSheet(rows)}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-primary/10 border border-primary/30 text-primary text-sm hover:bg-primary/20 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download Sheet
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
                <td className="px-3 py-2 font-medium text-foreground max-w-[160px] truncate">{row.Product}</td>
                <td className="px-3 py-2 text-foreground max-w-[120px] truncate">{row.openfda_brand_name || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{row.openfda_generic_name || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate" title={row.openfda_active_ingredients_raw}>{row.openfda_active_ingredients_raw || "—"}</td>
                <td className="px-3 py-2 text-primary font-mono max-w-[160px] truncate" title={row.Ingredient_base}>{row.Ingredient_base}</td>
                <td className="px-3 py-2"><ConfidenceBadge value={row.openfda_confidence} /></td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground text-right">{sorted.length} / {rows.length} rows</p>
    </div>
  );
};

export default EnrichmentTable;
