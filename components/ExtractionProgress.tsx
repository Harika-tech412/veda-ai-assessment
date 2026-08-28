"use client";

import { Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { ProcessingStage } from "@/lib/types";

const SUBTEXT_BY_STAGE: Partial<Record<ProcessingStage, string>> = {
  "extracting-questions": "Reading the question paper...",
  "extracting-answers": "Reading the answer sheet...",
  mapping: "Matching answers and grading...",
};

export function ExtractionProgress() {
  const processingStage = useAppStore((state) => state.processingStage);
  const subtext = SUBTEXT_BY_STAGE[processingStage] ?? "This may take a while";

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Sparkles className="h-10 w-10 animate-pulse text-accent" />
      <h2 className="text-xl font-bold text-ink">Extracting...</h2>
      <p className="text-sm text-muted">{subtext}</p>
    </div>
  );
}
