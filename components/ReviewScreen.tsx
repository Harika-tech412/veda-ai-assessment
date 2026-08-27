"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronDown, FileText, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { HighlightOverlay } from "@/components/HighlightOverlay";
import type { AnswerSegment } from "@/lib/types";

function FileChip({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-muted-bg px-3 py-1.5 text-xs font-medium text-ink-soft">
      <FileText className="h-3.5 w-3.5 text-muted" />
      <span className="max-w-[220px] truncate">{label}</span>
    </span>
  );
}

function formatQuestionLabel(number: string): string {
  return /^q/i.test(number) ? number : `Q${number}`;
}

export function ReviewScreen() {
  const questionPaper = useAppStore((state) => state.questionPaper);
  const answerSheet = useAppStore((state) => state.answerSheet);
  const questions = useAppStore((state) => state.questions);
  const answers = useAppStore((state) => state.answers);
  const matchResult = useAppStore((state) => state.matchResult);
  const selectedQuestionId = useAppStore((state) => state.selectedQuestionId);
  const selectedAnswerId = useAppStore((state) => state.selectedAnswerId);
  const setSelectedQuestionId = useAppStore((state) => state.setSelectedQuestionId);
  const setSelectedAnswerId = useAppStore((state) => state.setSelectedAnswerId);
  const reset = useAppStore((state) => state.reset);

  const [unmatchedExpanded, setUnmatchedExpanded] = useState(true);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);

  const selectQuestion = useCallback(
    (questionId: string) => {
      setSelectedAnswerId(null);
      setSelectedQuestionId(questionId);
    },
    [setSelectedAnswerId, setSelectedQuestionId]
  );

  const selectAnswer = useCallback(
    (answerId: string) => {
      setSelectedQuestionId(null);
      setSelectedAnswerId(answerId);
    },
    [setSelectedQuestionId, setSelectedAnswerId]
  );

  const activeAnswer = useMemo(() => {
    if (selectedAnswerId) {
      return answers.find((answer) => answer.id === selectedAnswerId) ?? null;
    }
    if (selectedQuestionId && matchResult) {
      const answerId = matchResult.mapping[selectedQuestionId];
      if (!answerId) return null;
      return answers.find((answer) => answer.id === answerId) ?? null;
    }
    return null;
  }, [selectedAnswerId, selectedQuestionId, matchResult, answers]);

  const isSelectedQuestionUnanswered = Boolean(
    selectedQuestionId && matchResult && !matchResult.mapping[selectedQuestionId]
  );

  const highlightLabel = useMemo(() => {
    if (selectedQuestionId && matchResult?.mapping[selectedQuestionId]) {
      const question = questions.find((q) => q.id === selectedQuestionId);
      return question ? formatQuestionLabel(question.number) : undefined;
    }
    if (selectedAnswerId) {
      const answer = answers.find((a) => a.id === selectedAnswerId);
      return answer?.rawLabel || "Unmatched";
    }
    return undefined;
  }, [selectedQuestionId, selectedAnswerId, matchResult, questions, answers]);

  const segmentsByPage = useMemo(() => {
    const grouped = new Map<number, AnswerSegment[]>();
    if (!activeAnswer) return grouped;
    for (const segment of activeAnswer.segments) {
      const existing = grouped.get(segment.pageIndex) ?? [];
      existing.push(segment);
      grouped.set(segment.pageIndex, existing);
    }
    return grouped;
  }, [activeAnswer]);

  useEffect(() => {
    if (!activeAnswer || activeAnswer.segments.length === 0) return;
    const firstPageIndex = Math.min(
      ...activeAnswer.segments.map((segment) => segment.pageIndex)
    );
    pageRefs.current[firstPageIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [activeAnswer]);

  const unmatchedAnswerIds = matchResult?.unmatchedAnswerIds ?? [];

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <FileChip label={questionPaper.fileName ?? "Question paper"} />
          <FileChip label={answerSheet.fileName ?? "Answer sheet"} />
        </div>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-muted-bg"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Start Over
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[380px] shrink-0 overflow-y-auto border-r border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">
              Extracted Questions{" "}
              <span className="font-normal text-muted">(from question paper)</span>
            </h2>
          </div>

          <ol className="flex flex-col gap-2 p-4">
            {questions.map((question, index) => {
              const isAnswered = Boolean(matchResult?.mapping[question.id]);
              const isSelected = selectedQuestionId === question.id;

              return (
                <li key={question.id}>
                  <button
                    type="button"
                    onClick={() => selectQuestion(question.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                      isSelected
                        ? "border-accent bg-accent-light/30 border-l-4"
                        : "border-border bg-surface hover:bg-muted-bg"
                    )}
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug text-ink">
                        <span className="mr-1.5 text-xs font-medium text-muted">
                          {question.number}
                        </span>
                        {question.text}
                      </span>
                      {question.marks !== null && (
                        <span className="mt-1 block text-xs text-muted">
                          {question.marks} marks
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        isAnswered
                          ? "bg-success-bg text-success"
                          : "bg-warning-bg text-warning"
                      )}
                    >
                      {isAnswered ? "Answered" : "Unanswered"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {unmatchedAnswerIds.length > 0 && (
            <div className="border-t border-border p-4">
              <button
                type="button"
                onClick={() => setUnmatchedExpanded((value) => !value)}
                className="flex w-full items-center justify-between text-sm font-semibold text-ink"
              >
                Unmatched Answers ({unmatchedAnswerIds.length})
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted transition-transform",
                    unmatchedExpanded && "rotate-180"
                  )}
                />
              </button>

              {unmatchedExpanded && (
                <ol className="mt-3 flex flex-col gap-2">
                  {unmatchedAnswerIds.map((answerId) => {
                    const answer = answers.find((a) => a.id === answerId);
                    if (!answer) return null;
                    const isSelected = selectedAnswerId === answerId;

                    return (
                      <li key={answerId}>
                        <button
                          type="button"
                          onClick={() => selectAnswer(answerId)}
                          className={cn(
                            "w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                            isSelected
                              ? "border-accent bg-accent-light/30 border-l-4"
                              : "border-border bg-muted-bg hover:bg-border/40"
                          )}
                        >
                          <span className="block text-xs font-semibold text-ink-soft">
                            {answer.rawLabel || "(no label)"}
                          </span>
                          <span className="mt-0.5 block text-ink-soft">
                            {answer.text.slice(0, 90)}
                            {answer.text.length > 90 ? "…" : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
        </aside>

        <section className="relative flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 bg-surface">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-sm font-semibold text-ink">Answer Sheet</h2>
              <p className="text-xs text-muted">
                {answerSheet.pages.length} page
                {answerSheet.pages.length === 1 ? "" : "s"}
              </p>
            </div>

            {isSelectedQuestionUnanswered && (
              <div className="flex justify-center border-b border-border px-6 py-3">
                <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-bg px-4 py-2.5 text-sm font-medium text-warning shadow-sm">
                  <AlertCircle className="h-4 w-4" />
                  No answer found for this question
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6 p-6">
            {answerSheet.pages.map((page, pageIndex) => (
              <div
                key={pageIndex}
                ref={(element) => {
                  pageRefs.current[pageIndex] = element;
                }}
                className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
              >
                <div className="border-b border-border px-3 py-1.5 text-xs font-medium text-muted">
                  Page {pageIndex + 1} of {answerSheet.pages.length}
                </div>
                <HighlightOverlay
                  page={page}
                  pageIndex={pageIndex}
                  segments={segmentsByPage.get(pageIndex) ?? []}
                  label={highlightLabel}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
