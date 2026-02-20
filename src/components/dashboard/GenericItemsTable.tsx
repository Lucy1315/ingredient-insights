import React, { useState } from "react";
import type { GenericItem, GenericCompact } from "@/types/dashboard";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface GenericItemsTableProps {
  items: GenericItem[];
  compact: GenericCompact[];
}

const GenericItemsTable: React.FC<GenericItemsTableProps> = ({ items, compact }) => {
  const [filter, setFilter] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filteredItems = items.filter((r) =>
    filter
      ? [r.source_Product, r.Ingredient_base, r.generic_제품명, r.generic_업체명].some((v) =>
          v.toLowerCase().includes(filter.toLowerCase())
        )
      : true
  );

  const filteredCompact = compact.filter((r) =>
    filter
      ? [r.Product, r.Ingredient_base, r.joined_product_names].some((v) =>
          v.toLowerCase().includes(filter.toLowerCase())
        )
      : true
  );

  return (
    <div className="space-y-3">
      <input
        className="w-full max-w-sm px-3 py-1.5 rounded bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder="필터…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <Tabs defaultValue="items">
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="items" className="text-xs">제네릭 항목 ({filteredItems.length})</TabsTrigger>
          <TabsTrigger value="compact" className="text-xs">요약 목록 ({filteredCompact.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <div className="overflow-auto rounded-lg border border-border max-h-96 mt-2">
            <table className="w-full text-xs min-w-[900px]">
              <thead className="sticky top-0 bg-secondary border-b border-border">
                <tr>
                  {["순번", "Product", "Ingredient_base", "품목기준코드", "제품명", "업체명", "제형", "신약구분", "취소/취하"].map((col) => (
                    <th key={col} className="px-3 py-2 text-left text-muted-foreground font-semibold whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((row, i) => (
                  <tr key={i} className="table-row-hover border-b border-border/50">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{row.source_순번}</td>
                    <td className="px-3 py-2 max-w-[120px] truncate">{row.source_Product}</td>
                    <td className="px-3 py-2 text-primary font-mono max-w-[150px] truncate" title={row.Ingredient_base}>{row.Ingredient_base}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{row.generic_품목기준코드}</td>
                    <td className="px-3 py-2 max-w-[140px] truncate">{row.generic_제품명}</td>
                    <td className="px-3 py-2 max-w-[100px] truncate text-muted-foreground">{row.generic_업체명}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.generic_제형}</td>
                    <td className="px-3 py-2">
                      {row.generic_신약구분 === "Y" ? (
                        <span className="status-high px-2 py-0.5 rounded text-xs">신약</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.generic_취소취하 === "Y" ? (
                        <span className="status-review px-2 py-0.5 rounded text-xs">취소</span>
                      ) : (
                        <span className="text-muted-foreground">유효</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">항목이 없습니다</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="compact">
          <div className="overflow-auto rounded-lg border border-border max-h-96 mt-2">
            <table className="w-full text-xs min-w-[600px]">
              <thead className="sticky top-0 bg-secondary border-b border-border">
                <tr>
                  {["순번", "제품명", "성분명(영문)", "제네릭 수", "제품명 목록 (합산)"].map((col) => (
                    <th key={col} className="px-3 py-2 text-left text-muted-foreground font-semibold whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCompact.map((row, i) => (
                  <tr key={i} className="table-row-hover border-b border-border/50">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{row.순번}</td>
                    <td className="px-3 py-2 font-medium">{row.Product}</td>
                    <td className="px-3 py-2 text-primary font-mono max-w-[160px] truncate" title={row.Ingredient_base}>{row.Ingredient_base}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn("font-mono font-bold", row.generic_count > 0 ? "text-info" : "text-muted-foreground")}>
                        {row.generic_count}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[280px] truncate" title={row.joined_product_names}>{row.joined_product_names || "—"}</td>
                  </tr>
                ))}
                {filteredCompact.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">데이터가 없습니다</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GenericItemsTable;
