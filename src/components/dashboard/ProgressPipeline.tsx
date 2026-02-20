import React from "react";
import { Loader2, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/types/dashboard";

interface Step {
  id: JobStatus;
  label: string;
  sub: string;
}

const STEPS: Step[] = [
  { id: "uploading", label: "소스 업로드", sub: "엑셀 파싱 및 열 감지" },
  { id: "enriching", label: "OpenFDA 보강", sub: "FDA label & NDC 엔드포인트 조회" },
  { id: "matching", label: "MFDS 매칭", sub: "성분 기반 품목 조회" },
  { id: "calculating", label: "계산", sub: "오리지널 / 제네릭 수 산출 + 검증" },
  { id: "done", label: "완료", sub: "내보내기 준비 완료" },
];

const STATUS_ORDER: JobStatus[] = ["idle", "uploading", "enriching", "matching", "calculating", "done", "error"];

interface ProgressPipelineProps {
  status: JobStatus;
  progress: number;
  message: string;
}

const ProgressPipeline: React.FC<ProgressPipelineProps> = ({ status, progress, message }) => {
  const currentIdx = STATUS_ORDER.indexOf(status);

  const getStepState = (step: Step) => {
    const stepIdx = STATUS_ORDER.indexOf(step.id);
    if (status === "error") return stepIdx <= currentIdx - 1 ? "done" : stepIdx === currentIdx ? "error" : "pending";
    if (stepIdx < currentIdx) return "done";
    if (stepIdx === currentIdx) return "active";
    return "pending";
  };

  return (
    <div className="space-y-4">
      {/* Step indicators */}
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const state = getStepState(step);
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                    state === "done" && "bg-success/20 border-success text-success",
                    state === "active" && "bg-primary/20 border-primary text-primary animate-pulse",
                    state === "error" && "bg-destructive/20 border-destructive text-destructive",
                    state === "pending" && "bg-muted border-border text-muted-foreground"
                  )}
                >
                  {state === "done" ? <Check className="w-4 h-4" /> : state === "active" ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-xs font-bold">{i + 1}</span>}
                </div>
                <span className={cn("text-[10px] font-medium whitespace-nowrap max-w-[72px] text-center leading-tight",
                  state === "active" ? "text-primary" : state === "done" ? "text-success" : "text-muted-foreground"
                )}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("flex-1 h-0.5 mx-1 transition-all duration-500 mb-5",
                  getStepState(STEPS[i + 1]) === "pending" ? "bg-border" : "bg-primary/50"
                )} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Progress bar */}
      {status !== "idle" && status !== "done" && status !== "error" && (
        <div className="space-y-1.5">
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground truncate">{message}</p>
        </div>
      )}

      {status === "error" && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          처리 중 오류가 발생했습니다. 아래 오류 내용을 확인하세요.
        </div>
      )}
    </div>
  );
};

export default ProgressPipeline;
