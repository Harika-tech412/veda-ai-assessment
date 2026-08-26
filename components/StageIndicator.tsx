"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import type { ProcessingStage } from "@/lib/types";

const STEPS: { key: ProcessingStage; label: string }[] = [
  { key: "uploading", label: "Uploading" },
  { key: "extracting-questions", label: "Extracting Questions" },
  { key: "extracting-answers", label: "Extracting Answers" },
  { key: "mapping", label: "Mapping" },
  { key: "done", label: "Done" },
];

export function StageIndicator() {
  const processingStage = useAppStore((state) => state.processingStage);
  const currentIndex = STEPS.findIndex((step) => step.key === processingStage);

  return (
    <ol className="flex w-full items-start">
      {STEPS.map((step, index) => {
        const isComplete = currentIndex > index;
        const isActive = currentIndex === index;

        return (
          <li key={step.key} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  isComplete && "border-accent bg-accent text-white",
                  isActive && !isComplete && "border-accent bg-surface text-accent",
                  !isActive && !isComplete && "border-border bg-muted-bg text-muted"
                )}
              >
                {isComplete ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "w-20 text-center text-[11px] font-medium leading-tight",
                  isActive ? "text-ink" : isComplete ? "text-ink-soft" : "text-muted"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 mt-3.5 h-px flex-1",
                  isComplete ? "bg-accent" : "bg-border"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
