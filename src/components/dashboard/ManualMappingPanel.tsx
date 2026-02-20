import React, { useState, useMemo } from "react";
import type { OpenFDAEnrichmentRow } from "@/types/dashboard";
import { Edit3, Check, X, AlertTriangle, Search, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MappingEntry {
  순번: number | string;
  Product: string;
  Ingredient_base: string;
  currentKo: string;
  draft: string;
  saved: boolean;
}

interface ManualMappingPanelProps {
  rows: OpenFDAEnrichmentRow[];
  /** 사용자가 저장한 매핑을 확정하면 호출 — 업데이트된 전체 enrichmentRows 반환 */
  onApply: (updated: OpenFDAEnrichmentRow[]) => void;
  /** 재처리 요청 콜백 */
  onRerun: (updated: OpenFDAEnrichmentRow[]) => void;
  isRerunning?: boolean;
}

const MAX_KO_LENGTH = 100;

const ManualMappingPanel: React.FC<ManualMappingPanelProps> = ({
  rows,
  onApply,
  onRerun,
  isRerunning = false,
}) => {
  const unmapped = useMemo(
    () => rows.filter((r) => !r.Ingredient_base_ko || r.Ingredient_base_ko.trim() === ""),
    [rows]
  );

  const [entries, setEntries] = useState<MappingEntry[]>(() =>
    unmapped.map((r) => ({
      순번: r.순번,
      Product: r.Product,
      Ingredient_base: r.Ingredient_base,
      currentKo: r.Ingredient_base_ko ?? "",
      draft: r.Ingredient_base_ko ?? "",
      saved: false,
    }))
  );

  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const filtered = entries.filter(
    (e) =>
      !filter ||
      e.Product.toLowerCase().includes(filter.toLowerCase()) ||
      e.Ingredient_base.toLowerCase().includes(filter.toLowerCase())
  );

  const savedCount = entries.filter((e) => e.saved).length;
  const allSaved = entries.length > 0 && savedCount === entries.length;

  const handleChange = (realIdx: number, value: string) => {
    // 입력 길이 제한
    if (value.length > MAX_KO_LENGTH) return;
    setEntries((prev) =>
      prev.map((e, i) => (i === realIdx ? { ...e, draft: value } : e))
    );
  };

  const handleSave = (realIdx: number) => {
    const entry = entries[realIdx];
    // 빈 값 허용하지 않음
    if (!entry.draft.trim()) return;
    setEntries((prev) =>
      prev.map((e, i) =>
        i === realIdx ? { ...e, currentKo: e.draft.trim(), saved: true } : e
      )
    );
    setEditingIdx(null);
  };

  const handleCancel = (realIdx: number) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === realIdx ? { ...e, draft: e.currentKo } : e))
    );
    setEditingIdx(null);
  };

  const handleApply = () => {
    // entries에서 저장된 매핑을 enrichmentRows에 반영
    const updatedRows = rows.map((r) => {
      const match = entries.find(
        (e) =>
          e.순번 === r.순번 &&
          e.Ingredient_base === r.Ingredient_base
      );
      if (match && match.saved && match.currentKo) {
        return {
          ...r,
          Ingredient_base_ko: match.currentKo,
          mfds_search_term: match.currentKo,
          inn_mapped: true,
        };
      }
      return r;
    });
    onApply(updatedRows);
  };

  const handleRerun = () => {
    const updatedRows = rows.map((r) => {
      const match = entries.find(
        (e) =>
          e.순번 === r.순번 &&
          e.Ingredient_base === r.Ingredient_base
      );
      if (match && match.saved && match.currentKo) {
        return {
          ...r,
          Ingredient_base_ko: match.currentKo,
          mfds_search_term: match.currentKo,
          inn_mapped: true,
        };
      }
      return r;
    });
    onRerun(updatedRows);
  };

  if (unmapped.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/30">
        <Check className="w-4 h-4 text-success flex-shrink-0" />
        <p className="text-sm text-success font-medium">모든 항목이 한국어 성분명으로 매핑되어 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/30">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
          <p className="text-sm text-warning font-medium">
            <strong>{unmapped.length}</strong>개 항목의 한국어 성분명이 누락되었습니다.
            MFDS 조회에 사용될 한국어명을 직접 입력하세요.
          </p>
        </div>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="ml-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          {collapsed ? "펼치기" : "접기"}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* 필터 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                className="w-full pl-8 pr-3 py-1.5 rounded bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="제품명 또는 성분으로 검색…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {savedCount} / {entries.length} 저장됨
            </span>
          </div>

          {/* 테이블 */}
          <div className="overflow-auto rounded-lg border border-border max-h-80">
            <table className="w-full text-xs min-w-[640px]">
              <thead className="sticky top-0 bg-secondary border-b border-border z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-muted-foreground font-semibold w-12">순번</th>
                  <th className="px-3 py-2 text-left text-muted-foreground font-semibold">제품명</th>
                  <th className="px-3 py-2 text-left text-muted-foreground font-semibold">성분명(영문)</th>
                  <th className="px-3 py-2 text-left text-muted-foreground font-semibold">한국어 성분명 입력</th>
                  <th className="px-3 py-2 text-left text-muted-foreground font-semibold w-20">상태</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const realIdx = entries.findIndex(
                    (e) => e.순번 === entry.순번 && e.Ingredient_base === entry.Ingredient_base
                  );
                  const isEditing = editingIdx === realIdx;

                  return (
                    <tr
                      key={`${entry.순번}-${entry.Ingredient_base}`}
                      className={cn(
                        "border-b border-border/50 transition-colors",
                        entry.saved ? "bg-success/5" : "bg-background hover:bg-muted/40"
                      )}
                    >
                      <td className="px-3 py-2 font-mono text-muted-foreground">{entry.순번}</td>
                      <td className="px-3 py-2 font-medium text-foreground max-w-[130px] truncate" title={entry.Product}>
                        {entry.Product}
                      </td>
                      <td className="px-3 py-2 text-primary font-mono max-w-[150px] truncate" title={entry.Ingredient_base}>
                        {entry.Ingredient_base}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              autoFocus
                              className="flex-1 min-w-0 px-2 py-1 rounded bg-background border border-primary text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                              value={entry.draft}
                              maxLength={MAX_KO_LENGTH}
                              onChange={(e) => handleChange(realIdx, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSave(realIdx);
                                if (e.key === "Escape") handleCancel(realIdx);
                              }}
                              placeholder="예: 아토르바스타틴"
                            />
                            <button
                              onClick={() => handleSave(realIdx)}
                              disabled={!entry.draft.trim()}
                              className="p-1 rounded text-success hover:bg-success/10 disabled:opacity-40 transition-colors flex-shrink-0"
                              title="저장 (Enter)"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCancel(realIdx)}
                              className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
                              title="취소 (Esc)"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "flex-1 truncate",
                                entry.currentKo ? "text-foreground font-medium" : "text-muted-foreground italic"
                              )}
                            >
                              {entry.currentKo || "미입력"}
                            </span>
                            <button
                              onClick={() => setEditingIdx(realIdx)}
                              className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
                              title="편집"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {entry.saved ? (
                          <span className="status-high px-2 py-0.5 rounded text-[10px] font-bold">저장됨</span>
                        ) : (
                          <span className="status-review px-2 py-0.5 rounded text-[10px]">미입력</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      검색 결과가 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              입력 후 <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">Enter</kbd> 또는 ✓ 버튼으로 저장
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleApply}
                disabled={savedCount === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/40 bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" />
                매핑 적용 ({savedCount}건)
              </button>
              <button
                onClick={handleRerun}
                disabled={savedCount === 0 || isRerunning}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                {isRerunning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    재처리 중…
                  </>
                ) : (
                  <>
                    MFDS 재조회 ({savedCount}건)
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ManualMappingPanel;
