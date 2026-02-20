import React from "react";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Search } from "lucide-react";
import type { SummaryMetrics } from "@/types/dashboard";
import { cn } from "@/lib/utils";

interface MetricsGridProps {
  metrics: SummaryMetrics;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  variant?: "default" | "success" | "warning" | "error" | "info";
  icon?: React.ReactNode;
}

function MetricCard({ label, value, sub, variant = "default", icon }: MetricCardProps) {
  const colorMap = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    error: "text-destructive",
    info: "text-info",
  };
  return (
    <div className="metric-card p-4 space-y-1 animate-slide-up">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <p className={cn("text-2xl font-bold font-mono", colorMap[variant])}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricCard
        label="전체 행 수"
        value={metrics.total_rows}
        sub="소스 품목"
        icon={<TrendingUp className="w-4 h-4" />}
      />
      <MetricCard
        label="OpenFDA 검토 필요"
        value={metrics.openfda_review_count}
        sub="수동 검토 필요"
        variant={metrics.openfda_review_count > 0 ? "warning" : "success"}
        icon={<AlertTriangle className="w-4 h-4" />}
      />
      <MetricCard
        label="MFDS 미검색"
        value={metrics.mfds_not_found}
        sub="MFDS 매칭 없음"
        variant={metrics.mfds_not_found > 0 ? "error" : "success"}
        icon={<Search className="w-4 h-4" />}
      />
      <MetricCard
        label="평균 제네릭 수"
        value={metrics.average_generic_per_source.toFixed(1)}
        sub="소스 품목당"
        icon={<Minus className="w-4 h-4" />}
      />

      <MetricCard
        label="HIGH 신뢰도"
        value={metrics.confidence_HIGH}
        variant="success"
        icon={<CheckCircle className="w-4 h-4" />}
      />
      <MetricCard
        label="MEDIUM 신뢰도"
        value={metrics.confidence_MEDIUM}
        variant="warning"
      />
      <MetricCard
        label="REVIEW 신뢰도"
        value={metrics.confidence_REVIEW}
        variant="error"
      />
      <MetricCard
        label="제네릭 항목 행"
        value={metrics.total_generic_item_rows}
        sub="generic_items 시트 합계"
        icon={<TrendingDown className="w-4 h-4" />}
      />
    </div>
  );
};

export default MetricsGrid;
