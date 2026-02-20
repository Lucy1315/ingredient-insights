import { useState, useCallback, useRef } from "react";
import type {
  ProcessingJob,
  SourceRow,
  SummaryMetrics,
} from "@/types/dashboard";
import { parseSourceExcel } from "@/lib/excelProcessor";
import { batchEnrich } from "@/lib/openFDA";
import { calculateResults } from "@/lib/mfds";

const DEFAULT_SUMMARY: SummaryMetrics = {
  total_rows: 0,
  openfda_review_count: 0,
  mfds_not_found: 0,
  confidence_HIGH: 0,
  confidence_MEDIUM: 0,
  confidence_REVIEW: 0,
  total_generic_item_rows: 0,
  average_generic_per_source: 0,
  validation_errors: [],
};

const INITIAL_JOB: ProcessingJob = {
  id: "",
  status: "idle",
  progress: 0,
  message: "",
  sourceRows: [],
  enrichmentRows: [],
  resultRows: [],
  genericItems: [],
  genericCompact: [],
  summary: DEFAULT_SUMMARY,
  errors: [],
  cancelRevoked: false,
  countMode: "ingredient",
  includeRevoked: false,
};

export function useDashboard() {
  const [job, setJob] = useState<ProcessingJob>(INITIAL_JOB);
  const abortRef = useRef<AbortController | null>(null);

  const patch = useCallback((update: Partial<ProcessingJob>) => {
    setJob((prev) => ({ ...prev, ...update }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setJob({ ...INITIAL_JOB, id: crypto.randomUUID() });
  }, []);

  const runPipeline = useCallback(
    async (file: File, options: { countMode: "ingredient" | "ingredient+form"; includeRevoked: boolean }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const jobId = crypto.randomUUID();

      patch({ id: jobId, status: "uploading", progress: 2, message: "Parsing Excel…", errors: [], countMode: options.countMode, includeRevoked: options.includeRevoked });

      let sourceRows: SourceRow[] = [];
      try {
        const parsed = await parseSourceExcel(file);
        sourceRows = parsed.rows;
        patch({ sourceRows, status: "enriching", progress: 10, message: `${sourceRows.length} rows loaded. Starting OpenFDA enrichment…` });
      } catch (err) {
        patch({ status: "error", errors: [String(err)] });
        return;
      }

      // STEP 2: OpenFDA enrichment
      let enrichmentRows = [];
      try {
        enrichmentRows = await batchEnrich(
          sourceRows,
          (current, total, msg) => {
            const pct = 10 + Math.round((current / total) * 40);
            patch({ progress: pct, message: `[${current}/${total}] ${msg}` });
          },
          controller.signal
        );
        patch({ enrichmentRows, status: "matching", progress: 52, message: "OpenFDA enrichment complete. Starting MFDS matching…" });
      } catch (err) {
        patch({ status: "error", errors: [String(err)] });
        return;
      }

      if (controller.signal.aborted) return;

      // STEP 3 + 4: MFDS matching + calculation
      try {
        const { resultRows, genericItems, genericCompact, validationErrors } = await calculateResults(
          enrichmentRows,
          {
            countMode: options.countMode,
            includeRevoked: options.includeRevoked,
            onProgress: (current, total, msg) => {
              const pct = 52 + Math.round((current / total) * 44);
              patch({ progress: pct, message: `[${current}/${total}] ${msg}`, status: "calculating" });
            },
            signal: controller.signal,
          }
        );

        if (controller.signal.aborted) return;

        // Build summary
        const summary: SummaryMetrics = {
          total_rows: sourceRows.length,
          openfda_review_count: enrichmentRows.filter((r) => r.openfda_confidence === "REVIEW").length,
          mfds_not_found: resultRows.filter((r) => r.mfds_not_found).length,
          confidence_HIGH: enrichmentRows.filter((r) => r.openfda_confidence === "HIGH").length,
          confidence_MEDIUM: enrichmentRows.filter((r) => r.openfda_confidence === "MEDIUM").length,
          confidence_REVIEW: enrichmentRows.filter((r) => r.openfda_confidence === "REVIEW").length,
          total_generic_item_rows: genericItems.length,
          average_generic_per_source: sourceRows.length > 0 ? +(genericItems.length / sourceRows.length).toFixed(2) : 0,
          validation_errors: validationErrors,
        };

        patch({
          resultRows,
          genericItems,
          genericCompact,
          summary,
          status: "done",
          progress: 100,
          message: "Processing complete.",
          errors: validationErrors,
        });
      } catch (err) {
        patch({ status: "error", errors: [String(err)] });
      }
    },
    [patch]
  );

  return { job, patch, reset, runPipeline };
}
