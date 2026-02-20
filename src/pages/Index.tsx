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
              <h1 className="text-sm font-bold text-foreground tracking-tight">MFDS Matching Dashboard</h1>
              <p className="text-[10px] text-muted-foreground">OpenFDA → MFDS Integrated Workflow</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDone && (
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export Excel
              </button>
            )}
            {(job.status !== "idle") && (
              <button
                onClick={() => { reset(); setUploadedFile(null); setActiveTab("setup"); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={cn("pulse-dot", isRunning ? "" : isDone ? "!bg-success" : "!bg-muted-foreground")} />
              {isRunning ? "Processing…" : isDone ? "Ready" : "Idle"}
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
              <span className="text-sm font-semibold text-warning">Validation Issues ({job.errors.length})</span>
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
              <Settings className="w-3.5 h-3.5" /> Setup
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center gap-1.5 text-xs px-3 py-1.5" disabled={job.status === "idle"}>
              <Activity className="w-3.5 h-3.5" /> Progress
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-1.5 text-xs px-3 py-1.5" disabled={!isDone}>
              <List className="w-3.5 h-3.5" /> Results
              {isDone && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px]">{job.resultRows.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="enrichment" className="flex items-center gap-1.5 text-xs px-3 py-1.5" disabled={!isDone}>
              <Database className="w-3.5 h-3.5" /> OpenFDA Enrichment
              {isDone && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px]">{job.enrichmentRows.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="generics" className="flex items-center gap-1.5 text-xs px-3 py-1.5" disabled={!isDone}>
              <FlaskConical className="w-3.5 h-3.5" /> Generic Items
              {isDone && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px]">{job.genericItems.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="review" className="flex items-center gap-1.5 text-xs px-3 py-1.5" disabled={!isDone}>
              <Eye className="w-3.5 h-3.5" /> Review Queue
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
                    <p className="text-sm font-semibold text-foreground">Quick Test with Sample Data</p>
                    <p className="text-xs text-muted-foreground">20 well-known drugs (Aspirin, Lipitor, Plavix…) pre-loaded for pipeline testing</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSamplePreview((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-secondary text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    <Table2 className="w-3.5 h-3.5" />
                    {showSamplePreview ? "Hide Preview" : "Preview"}
                  </button>
                  <button
                    onClick={downloadSampleExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-secondary text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Download .xlsx
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
                    Use Sample & Run
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
                  <h2 className="text-sm font-semibold text-foreground mb-1">Step 1 — Source Upload</h2>
                  <p className="text-xs text-muted-foreground">Upload an Excel file with columns: <code className="bg-muted px-1 py-0.5 rounded text-xs">순번</code> and <code className="bg-muted px-1 py-0.5 rounded text-xs">Product</code></p>
                </div>
                <FileUpload onFile={handleFile} disabled={isRunning} />
                {uploadedFile && (
                  <div className="flex items-center gap-2 p-2 rounded bg-primary/8 border border-primary/20">
                    <div className="pulse-dot flex-shrink-0" />
                    <span className="text-xs text-primary font-medium truncate">{uploadedFile.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">ready</span>
                  </div>
                )}
              </div>

              <div className="panel p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground mb-1">Processing Options</h2>
                  <p className="text-xs text-muted-foreground">Configure matching behavior before running</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-2">Count Mode</label>
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
                          {mode === "ingredient" ? "Ingredient Only" : "Ingredient + 제형"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border">
                    <div>
                      <p className="text-xs font-medium text-foreground">Include Revoked (취소/취하)</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Count products that have been cancelled</p>
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
                        Processing…
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Run Full Pipeline
                      </>
                    )}
                  </button>

                  {!uploadedFile && (
                    <p className="text-xs text-muted-foreground text-center">Upload a file above to enable processing</p>
                  )}
                </div>

                {/* Workflow summary */}
                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Pipeline Steps</p>
                  {[
                    "Parse Excel & detect 순번 / Product",
                    "Normalize & query OpenFDA (label + NDC)",
                    "Generate Ingredient_base (salt-stripped, sorted)",
                    "Match against MFDS ingredient search API",
                    "Calculate 신약 여부 + generic counts",
                    "Validate & export 5-sheet Excel",
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
              <h2 className="text-sm font-semibold text-foreground">Pipeline Progress</h2>
              <ProgressPipeline status={job.status} progress={job.progress} message={job.message} />

              {/* Live stats during run */}
              {(isRunning || isDone) && (
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                  <div className="text-center">
                    <p className="text-xl font-bold font-mono text-foreground">{job.sourceRows.length}</p>
                    <p className="text-xs text-muted-foreground">Source Rows</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold font-mono text-primary">{job.enrichmentRows.length}</p>
                    <p className="text-xs text-muted-foreground">Enriched</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold font-mono text-foreground">{job.resultRows.length}</p>
                    <p className="text-xs text-muted-foreground">Matched</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* RESULTS TAB */}
          <TabsContent value="results" className="mt-4">
            <div className="panel p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">Results — 신약 여부 & Generic Counts</h2>
                <span className="text-xs text-muted-foreground">Count mode: <strong className="text-primary">{job.countMode}</strong></span>
              </div>
              <ResultsTable rows={job.resultRows} />
            </div>
          </TabsContent>

          {/* OPENFDA ENRICHMENT TAB */}
          <TabsContent value="enrichment" className="mt-4">
            <div className="panel p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">OpenFDA Enrichment Layer</h2>
              <EnrichmentTable rows={job.enrichmentRows} />
            </div>
          </TabsContent>

          {/* GENERIC ITEMS TAB */}
          <TabsContent value="generics" className="mt-4">
            <div className="panel p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Generic Transparency Sheets</h2>
              <GenericItemsTable items={job.genericItems} compact={job.genericCompact} />
            </div>
          </TabsContent>

          {/* REVIEW QUEUE TAB */}
          <TabsContent value="review" className="mt-4">
            <div className="panel p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Review Queue — Low Confidence Items</h2>
              <ReviewQueue rows={job.enrichmentRows} />
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer note */}
        <footer className="text-center text-xs text-muted-foreground py-2 border-t border-border">
          MFDS Matching Dashboard · OpenFDA API + MFDS Open API · Data is cached per session
        </footer>
      </main>
    </div>
  );
};

export default Index;
