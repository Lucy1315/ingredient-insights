import React from "react";
import type { OpenFDAEnrichmentRow } from "@/types/dashboard";
import { AlertTriangle, ExternalLink } from "lucide-react";

interface ReviewQueueProps {
  rows: OpenFDAEnrichmentRow[];
}

const ReviewQueue: React.FC<ReviewQueueProps> = ({ rows }) => {
  const reviewRows = rows.filter((r) => r.openfda_confidence === "REVIEW");

  if (reviewRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-success" />
        </div>
        <p className="text-foreground font-medium">No rows require review</p>
        <p className="text-sm text-muted-foreground">All products resolved with HIGH or MEDIUM confidence</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
        <p className="text-sm text-warning">
          <strong>{reviewRows.length}</strong> products could not be resolved via OpenFDA and require manual ingredient input or review.
        </p>
      </div>

      <div className="overflow-auto rounded-lg border border-border max-h-96">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="sticky top-0 bg-secondary border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left text-muted-foreground font-semibold">순번</th>
              <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Product</th>
              <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Product_norm</th>
              <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Ingredient_base (fallback)</th>
              <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {reviewRows.map((row, i) => (
              <tr key={i} className="table-row-hover border-b border-border/50">
                <td className="px-3 py-2 font-mono text-muted-foreground">{row.순번}</td>
                <td className="px-3 py-2 font-medium text-foreground max-w-[140px] truncate">{row.Product}</td>
                <td className="px-3 py-2 text-muted-foreground max-w-[140px] truncate">{row.Product_norm}</td>
                <td className="px-3 py-2 text-warning font-mono max-w-[180px] truncate" title={row.Ingredient_base}>
                  {row.Ingredient_base || <span className="text-destructive">EMPTY</span>}
                </td>
                <td className="px-3 py-2">
                  <a
                    href={`https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(row.Product_norm)}"&limit=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    OpenFDA
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        For REVIEW items, the Ingredient_base is derived from the normalized product name (fallback). Manual verification is recommended.
      </p>
    </div>
  );
};

export default ReviewQueue;
