import React, { useState } from "react";
import type { ResultRow } from "@/types/dashboard";
import { ChevronUp, ChevronDown, CheckCircle, XCircle, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResultsTableProps {
  rows: ResultRow[];
}

const OriginalBadge = ({ value }: { value: "Y" | "N" | "-" }) => {
  if (value === "Y")
    return (
      <span className="flex items-center gap-1 status-high px-2 py-0.5 rounded text-xs font-bold w-fit">
        <CheckCircle className="w-3 h-3" /> Y
      </span>
    );
  if (value === "N")
    return (
      <span className="flex items-center gap-1 status-review px-2 py-0.5 rounded text-xs font-bold w-fit">
        <XCircle className="w-3 h-3" /> N
      </span>
    );
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-muted text-muted-foreground border border-border w-fit">
      <Minus className="w-3 h-3" /> —
    </span>
  );
};

type SortKey = keyof ResultRow;

const ResultsTable: React.FC<ResultsTableProps> = ({ rows }) => {
  const [sortKey, setSortKey] = useState<SortKey>("순번");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState("");
  const [onlyNotFound, setOnlyNotFound] = useState(false);
  const [onlyOriginal, setOnlyOriginal] = useState(false);

  const filtered = rows
    .filter((r) => (onlyNotFound ? r.mfds_not_found : true))
    .filter((r) => (onlyOriginal ? r.original_허가여부 === "Y" : true))
    .filter((r) =>
      filter
        ? [r.Product, r.Ingredient_base, r.Product_norm].some((v) =>
            v.toLowerCase().includes(filter.toLowerCase())
          )
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="flex-1 min-w-[160px] max-w-xs px-3 py-1.5 rounded bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Filter by product or ingredient…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={onlyNotFound} onChange={(e) => setOnlyNotFound(e.target.checked)} className="accent-primary" />
          <span className="text-muted-foreground">MFDS Not Found only</span>
        </label>
        <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={onlyOriginal} onChange={(e) => setOnlyOriginal(e.target.checked)} className="accent-primary" />
          <span className="text-muted-foreground">신약 only</span>
        </label>
      </div>

      <div className="overflow-auto rounded-lg border border-border max-h-96">
        <table className="w-full text-xs min-w-[800px]">
          <thead className="sticky top-0 bg-secondary border-b border-border">
            <tr>
              {[
                { key: "순번" as SortKey, label: "순번" },
                { key: "Product" as SortKey, label: "Product" },
                { key: "Ingredient_base" as SortKey, label: "Ingredient_base" },
                { key: "openfda_confidence" as SortKey, label: "Confidence" },
                { key: "original_허가여부" as SortKey, label: "신약 여부" },
                { key: "generic_count_excluding_original" as SortKey, label: "제네릭 수" },
                { key: "total_count_including_original" as SortKey, label: "전체 품목" },
                { key: "mfds_not_found" as SortKey, label: "MFDS" },
              ].map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left text-muted-foreground font-semibold cursor-pointer hover:text-foreground select-none whitespace-nowrap"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  <SortIcon col={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  "table-row-hover border-b border-border/50",
                  row.mfds_not_found && "bg-destructive/5"
                )}
              >
                <td className="px-3 py-2 font-mono text-muted-foreground">{row.순번}</td>
                <td className="px-3 py-2 font-medium text-foreground max-w-[140px] truncate">{row.Product}</td>
                <td className="px-3 py-2 text-primary font-mono max-w-[180px] truncate" title={row.Ingredient_base}>{row.Ingredient_base}</td>
                <td className="px-3 py-2">
                  <span className={cn("px-2 py-0.5 rounded text-xs font-semibold",
                    row.openfda_confidence === "HIGH" ? "status-high" :
                    row.openfda_confidence === "MEDIUM" ? "status-medium" : "status-review"
                  )}>
                    {row.openfda_confidence}
                  </span>
                </td>
                <td className="px-3 py-2"><OriginalBadge value={row.original_허가여부} /></td>
                <td className="px-3 py-2 font-mono text-center text-foreground">
                  {row.mfds_not_found ? <span className="text-muted-foreground">—</span> : (
                    <span className={cn(row.generic_count_excluding_original > 0 ? "text-info" : "text-muted-foreground")}>
                      {row.generic_count_excluding_original}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-center text-muted-foreground">{row.mfds_not_found ? "—" : row.total_count_including_original}</td>
                <td className="px-3 py-2">
                  {row.mfds_not_found ? (
                    <span className="status-review px-2 py-0.5 rounded text-xs">미검색</span>
                  ) : (
                    <span className="status-high px-2 py-0.5 rounded text-xs">검색됨</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No matching rows</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground text-right">{filtered.length} / {rows.length} rows</p>
    </div>
  );
};

export default ResultsTable;
