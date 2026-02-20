import React, { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Activity, Database, FlaskConical, Eye, List, AlertTriangle, Download, RefreshCw, Play, Settings, FileDown, Zap, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadSampleExcel, getSampleFile, SAMPLE_PRODUCT_LIST } from "@/lib/sampleData";

import FileUpload from "@/components/dashboard/FileUpload";
import ProgressPipeline from "@/components/dashboard/ProgressPipeline";
import MetricsGrid from "@/components/dashboard/MetricsGrid";
import EnrichmentTable from "@/components/dashboard/EnrichmentTable";
import ResultsTable from "@/components/dashboard/ResultsTable";
import GenericItemsTable from "@/components/dashboard/GenericItemsTable";
import ReviewQueue from "@/components/dashboard/ReviewQueue";
import { useDashboard } from "@/hooks/useDashboard";
import { generateOutputExcel } from "@/lib/excelProcessor";

const Index: React.FC = () => {
  const { job, patch, reset, runPipeline } = useDashboard();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState("setup");

  const [showSamplePreview, setShowSamplePreview] = useState(false);

  const handleFile = useCallback((file: File) => {
    setUploadedFile(file);
  }, []);

  const handleRun = useCallback(async () => {
    if (!uploadedFile) return;
    setActiveTab("progress");
    await runPipeline(uploadedFile, {
      countMode: job.countMode,
      includeRevoked: job.includeRevoked,
    });
    setActiveTab("results");
  }, [uploadedFile, job.countMode, job.includeRevoked, runPipeline]);

  const handleExport = useCallback(() => {
    generateOutputExcel({
      filled: job.resultRows,
      openfda_enrichment: job.enrichmentRows,
      generic_items: job.genericItems,
      generic_list_compact: job.genericCompact,
      summary: job.summary,
    });
  }, [job]);

  const isRunning = ["uploading", "enriching", "matching", "calculating"].includes(job.status);
  const isDone = job.status === "done";
  const hasErrors = job.errors.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary/20 border border-primary/40 flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-primary" />
            </div>
            <div>
            <h1 className="text-sm font-bold text-foreground tracking-tight">MFDS 매칭 대시보드</h1>
              <p className="text-[10px] text-muted-foreground">OpenFDA → MFDS 통합 워크플로우</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDone && (
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                엑셀 내보내기
              </button>
            )}
            {(job.status !== "idle") && (
              <button
                onClick={() => { reset(); setUploadedFile(null); setActiveTab("setup"); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                초기화
              </button>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={cn("pulse-dot", isRunning ? "" : isDone ? "!bg-success" : "!bg-muted-foreground")} />
              {isRunning ? "처리 중…" : isDone ? "완료" : "대기"}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* Metrics — shown when done */}
        {isDone && (
          <div className="animate-slide-up">
            <MetricsGrid metrics={job.summary} />
          </div>
        )}

        {/* Validation warnings */}
        {isDone && hasErrors && (
          <div className="panel p-4 border-warning/30 bg-warning/5 animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span className="text-sm font-semibold text-warning">검증 오류 ({job.errors.length})</span>
            </div>
            <ul className="space-y-1">
              {job.errors.map((e, i) => (
                <li key={i} className="text-xs text-muted-foreground font-mono">{e}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card border border-border w-full justify-start overflow-x-auto h-auto p-1 gap-0.5">
            <TabsTrigger value="setup" className="flex items-center gap-1.5 text-xs px-3 py-1.5">
              <Settings className="w-3.5 h-3.5" /> 설정
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center gap-1.5 text-xs px-3 py-1.5" disabled={job.status === "idle"}>
              <Activity className="w-3.5 h-3.5" /> 진행 상황
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-1.5 text-xs px-3 py-1.5" disabled={!isDone}>
              <List className="w-3.5 h-3.5" /> 결과
              {isDone && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px]">{job.resultRows.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="enrichment" className="flex items-center gap-1.5 text-xs px-3 py-1.5" disabled={!isDone}>
              <Database className="w-3.5 h-3.5" /> OpenFDA 보강
              {isDone && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px]">{job.enrichmentRows.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="generics" className="flex items-center gap-1.5 text-xs px-3 py-1.5" disabled={!isDone}>
              <FlaskConical className="w-3.5 h-3.5" /> 제네릭 목록
              {isDone && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px]">{job.genericItems.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="review" className="flex items-center gap-1.5 text-xs px-3 py-1.5" disabled={!isDone}>
              <Eye className="w-3.5 h-3.5" /> 검토 대기열
              {isDone && job.summary.openfda_review_count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-warning/20 text-warning text-[10px]">{job.summary.openfda_review_count}</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* SETUP TAB */}
          <TabsContent value="setup" className="mt-4 space-y-5">
            {/* Sample Quick-Start Banner */}
            <div className="panel p-4 border-primary/20 bg-primary/5 animate-slide-up">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                  <p className="text-sm font-semibold text-foreground">샘플 데이터로 빠른 테스트</p>
                  <p className="text-xs text-muted-foreground">20개 주요 의약품 (아스피린, 리피토, 플라빅스…) 파이프라인 테스트용 사전 탑재</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSamplePreview((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-secondary text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    <Table2 className="w-3.5 h-3.5" />
                    {showSamplePreview ? "미리보기 닫기" : "미리보기"}
                  </button>
                  <button
                    onClick={downloadSampleExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-secondary text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    .xlsx 다운로드
                  </button>
                  <button
                    onClick={async () => {
                      const file = getSampleFile();
                      setUploadedFile(file);
                      setActiveTab("progress");
                      await runPipeline(file, {
                        countMode: job.countMode,
                        includeRevoked: job.includeRevoked,
                      });
                      setActiveTab("results");
                    }}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    샘플로 실행
                  </button>
                </div>
              </div>

              {/* Sample preview table */}
              {showSamplePreview && (
                <div className="mt-4 border-t border-border pt-4 animate-slide-up">
                  <div className="overflow-auto rounded-lg border border-border max-h-52">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-secondary border-b border-border">
                        <tr>
                          <th className="px-3 py-2 text-left text-muted-foreground font-semibold w-16">순번</th>
                          <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Product</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SAMPLE_PRODUCT_LIST.map((row) => (
                          <tr key={row.순번} className="table-row-hover border-b border-border/40">
                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{row.순번}</td>
                            <td className="px-3 py-1.5 font-medium text-foreground">{row.Product}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="panel p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground mb-1">1단계 — 소스 업로드</h2>
                  <p className="text-xs text-muted-foreground">열이 있는 엑셀 파일 업로드: <code className="bg-muted px-1 py-0.5 rounded text-xs">순번</code> 및 <code className="bg-muted px-1 py-0.5 rounded text-xs">Product</code></p>
                </div>
                <FileUpload onFile={handleFile} disabled={isRunning} />
                {uploadedFile && (
                  <div className="flex items-center gap-2 p-2 rounded bg-primary/8 border border-primary/20">
                    <div className="pulse-dot flex-shrink-0" />
                    <span className="text-xs text-primary font-medium truncate">{uploadedFile.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">준비 완료</span>
                  </div>
                )}
              </div>

              <div className="panel p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground mb-1">처리 옵션</h2>
                  <p className="text-xs text-muted-foreground">실행 전 매칭 동작 설정</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-2">카운트 방식</label>
                    <div className="flex gap-2">
                      {(["ingredient", "ingredient+form"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => patch({ countMode: mode })}
                          className={cn(
                            "flex-1 px-3 py-2 rounded border text-xs font-medium transition-colors",
                            job.countMode === mode
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                          )}
                        >
                          {mode === "ingredient" ? "성분만" : "성분 + 제형"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border">
                    <div>
                      <p className="text-xs font-medium text-foreground">취소/취하 품목 포함</p>
                      <p className="text-xs text-muted-foreground mt-0.5">취소된 품목도 카운트에 포함</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={job.includeRevoked}
                        onChange={(e) => patch({ includeRevoked: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-border peer-checked:bg-primary rounded-full transition-colors peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                    </label>
                  </div>

                  <button
                    onClick={handleRun}
                    disabled={!uploadedFile || isRunning}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm transition-all",
                      uploadedFile && !isRunning
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-primary/20"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    {isRunning ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        처리 중…
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        전체 파이프라인 실행
                      </>
                    )}
                  </button>

                  {!uploadedFile && (
                    <p className="text-xs text-muted-foreground text-center">처리를 시작하려면 파일을 업로드하세요</p>
                  )}
                </div>

                {/* Workflow summary */}
                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">파이프라인 단계</p>
                  {[
                    "엑셀 파싱 및 순번 / Product 열 감지",
                    "정규화 후 OpenFDA 조회 (label + NDC)",
                    "Ingredient_base 생성 (염 제거, 정렬)",
                    "MFDS 성분 검색 API 매칭",
                    "신약 여부 + 제네릭 수 산출",
                    "검증 후 5시트 엑셀 내보내기",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-[10px] font-mono text-primary mt-0.5 flex-shrink-0">{i + 1}.</span>
                      <span className="text-xs text-muted-foreground">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* PROGRESS TAB */}
          <TabsContent value="progress" className="mt-4">
            <div className="panel p-6 space-y-6">
              <h2 className="text-sm font-semibold text-foreground">파이프라인 진행 상황</h2>
              <ProgressPipeline status={job.status} progress={job.progress} message={job.message} />

              {/* Live stats during run */}
              {(isRunning || isDone) && (
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                  <div className="text-center">
                    <p className="text-xl font-bold font-mono text-foreground">{job.sourceRows.length}</p>
                    <p className="text-xs text-muted-foreground">소스 행</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold font-mono text-primary">{job.enrichmentRows.length}</p>
                    <p className="text-xs text-muted-foreground">보강 완료</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold font-mono text-foreground">{job.resultRows.length}</p>
                    <p className="text-xs text-muted-foreground">매칭 완료</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* RESULTS TAB */}
          <TabsContent value="results" className="mt-4">
            <div className="panel p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">결과 — 신약 여부 & 제네릭 수</h2>
                <span className="text-xs text-muted-foreground">카운트 방식: <strong className="text-primary">{job.countMode}</strong></span>
              </div>
              <ResultsTable rows={job.resultRows} />
            </div>
          </TabsContent>

          {/* OPENFDA ENRICHMENT TAB */}
          <TabsContent value="enrichment" className="mt-4">
            <div className="panel p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">OpenFDA 보강 레이어</h2>
              <EnrichmentTable rows={job.enrichmentRows} />
            </div>
          </TabsContent>

          {/* GENERIC ITEMS TAB */}
          <TabsContent value="generics" className="mt-4">
            <div className="panel p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">제네릭 투명성 시트</h2>
              <GenericItemsTable items={job.genericItems} compact={job.genericCompact} />
            </div>
          </TabsContent>

          {/* REVIEW QUEUE TAB */}
          <TabsContent value="review" className="mt-4">
            <div className="panel p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">검토 대기열 — 낮은 신뢰도 항목</h2>
              <ReviewQueue rows={job.enrichmentRows} />
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer note */}
        <footer className="text-center text-xs text-muted-foreground py-2 border-t border-border">
          MFDS 매칭 대시보드 · OpenFDA API + MFDS 공공 API · 세션 내 데이터 캐시 적용
        </footer>
      </main>
    </div>
  );
};

export default Index;
