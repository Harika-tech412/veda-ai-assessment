"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Minus,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { HighlightOverlay } from "@/components/HighlightOverlay";
import type { AnswerSegment } from "@/lib/types";

const ZOOM_LEVELS = [75, 100, 125, 150];
const DEFAULT_ZOOM_INDEX = 1; // 100%
const MAX_VIEWER_WIDTH = 900;

type MobileTab = "questions" | "answerSheet";

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
  const grades = useAppStore((state) => state.grades);
  const gradingError = useAppStore((state) => state.gradingError);
  const setGradingError = useAppStore((state) => state.setGradingError);
  const selectedQuestionId = useAppStore((state) => state.selectedQuestionId);
  const selectedAnswerId = useAppStore((state) => state.selectedAnswerId);
  const setSelectedQuestionId = useAppStore((state) => state.setSelectedQuestionId);
  const setSelectedAnswerId = useAppStore((state) => state.setSelectedAnswerId);
  const reset = useAppStore((state) => state.reset);

  const [unmatchedExpanded, setUnmatchedExpanded] = useState(true);
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Set<string>>(new Set());
  const [mobileTab, setMobileTab] = useState<MobileTab>("questions");
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const pageCount = answerSheet.pages.length;
  const zoomLevel = ZOOM_LEVELS[zoomIndex];

  const selectQuestion = useCallback(
    (questionId: string) => {
      setSelectedAnswerId(null);
      setSelectedQuestionId(questionId);
      setMobileTab("answerSheet");
    },
    [setSelectedAnswerId, setSelectedQuestionId]
  );

  const selectAnswer = useCallback(
    (answerId: string) => {
      setSelectedQuestionId(null);
      setSelectedAnswerId(answerId);
      setMobileTab("answerSheet");
    },
    [setSelectedQuestionId, setSelectedAnswerId]
  );

  const allExpanded = questions.length > 0 && expandedQuestionIds.size === questions.length;

  const toggleExpandAll = useCallback(() => {
    setExpandedQuestionIds(
      allExpanded ? new Set() : new Set(questions.map((question) => question.id))
    );
  }, [allExpanded, questions]);

  const handleQuestionClick = useCallback(
    (questionId: string) => {
      selectQuestion(questionId);
      setExpandedQuestionIds((prev) => {
        const isSolelyOpen = prev.has(questionId) && prev.size === 1;
        return isSolelyOpen ? new Set() : new Set([questionId]);
      });
    },
    [selectQuestion]
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

  const answerPageIndexes = useMemo(() => {
    if (!activeAnswer) return [];
    return Array.from(new Set(activeAnswer.segments.map((segment) => segment.pageIndex))).sort(
      (a, b) => a - b
    );
  }, [activeAnswer]);

  // Auto-jump to the first page the selected answer appears on. currentPageIndex
  // is otherwise free-standing state (the user can page through independently),
  // so this is a "reset on selection change" case adjusted during render per
  // https://react.dev/learn/you-might-not-need-an-effect rather than an effect.
  const activeAnswerKey = activeAnswer?.id ?? null;
  const [lastAnswerKey, setLastAnswerKey] = useState<string | null>(null);
  if (activeAnswerKey !== lastAnswerKey) {
    setLastAnswerKey(activeAnswerKey);
    if (activeAnswer && activeAnswer.segments.length > 0) {
      setCurrentPageIndex(
        Math.min(...activeAnswer.segments.map((segment) => segment.pageIndex))
      );
    }
  }

  const zoomOut = useCallback(() => {
    setZoomIndex((index) => Math.max(0, index - 1));
  }, []);
  const zoomIn = useCallback(() => {
    setZoomIndex((index) => Math.min(ZOOM_LEVELS.length - 1, index + 1));
  }, []);
  const goToPreviousPage = useCallback(() => {
    setCurrentPageIndex((page) => Math.max(0, page - 1));
  }, []);
  const goToNextPage = useCallback(() => {
    setCurrentPageIndex((page) => Math.min(pageCount - 1, page + 1));
  }, [pageCount]);

  const unmatchedAnswerIds = matchResult?.unmatchedAnswerIds ?? [];
  const currentPage = answerSheet.pages[currentPageIndex];

  return (
    <div className="flex h-full flex-col bg-canvas">
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

      {gradingError && (
        <div className="flex items-center justify-between gap-3 border-b border-warning/30 bg-warning-bg px-6 py-2.5 text-sm text-warning">
          <span>Automatic grading couldn&apos;t fully complete: {gradingError}</span>
          <button
            type="button"
            onClick={() => setGradingError(null)}
            aria-label="Dismiss"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-warning/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex border-b border-border bg-surface md:hidden">
        <button
          type="button"
          onClick={() => setMobileTab("questions")}
          className={cn(
            "flex-1 border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
            mobileTab === "questions"
              ? "border-accent text-accent"
              : "border-transparent text-muted"
          )}
        >
          Questions
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("answerSheet")}
          className={cn(
            "flex-1 border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
            mobileTab === "answerSheet"
              ? "border-accent text-accent"
              : "border-transparent text-muted"
          )}
        >
          Answer Sheet
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={cn(
            "w-full shrink-0 overflow-y-auto border-r border-border bg-surface md:block md:w-[380px]",
            mobileTab === "questions" ? "block" : "hidden"
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">
              Extracted Questions{" "}
              <span className="font-normal text-muted">(from question paper)</span>
            </h2>
            {questions.length > 0 && (
              <button
                type="button"
                onClick={toggleExpandAll}
                className="shrink-0 text-xs font-semibold text-accent hover:text-accent-hover"
              >
                {allExpanded ? "Collapse All" : "Expand All"}
              </button>
            )}
          </div>

          <ol className="flex flex-col gap-2 p-4">
            {questions.map((question, index) => {
              const isAnswered = Boolean(matchResult?.mapping[question.id]);
              const isSelected = selectedQuestionId === question.id;
              const isExpanded = expandedQuestionIds.has(question.id);
              const grade = grades[question.id];

              return (
                <li
                  key={question.id}
                  className={cn(
                    "overflow-hidden rounded-xl border transition-colors",
                    isSelected
                      ? "border-accent bg-accent-light/30 border-l-4"
                      : "border-border bg-surface"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleQuestionClick(question.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
                      !isSelected && "hover:bg-muted-bg"
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      <span className="mr-1.5 text-xs font-medium text-muted">
                        {question.number}
                      </span>
                      {question.text}
                    </span>
                    {!isAnswered ? (
                      <span className="shrink-0 rounded-full bg-muted-bg px-2 py-0.5 text-[11px] font-semibold text-muted">
                        Unanswered
                      </span>
                    ) : grade ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          grade.isCorrect === true
                            ? "bg-success-bg text-success"
                            : grade.isCorrect === false
                              ? "bg-danger-bg text-danger"
                              : "bg-warning-bg text-warning"
                        )}
                      >
                        {grade.score}/{grade.maxScore}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-muted-bg px-2 py-0.5 text-[11px] font-semibold text-muted">
                        Ungraded
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border/60 px-3 py-3">
                      <p className="text-sm text-ink-soft">{question.text}</p>
                      {question.marks !== null && (
                        <p className="mt-1 text-xs text-muted">{question.marks} marks</p>
                      )}
                      <div className="mt-3">
                        {!isAnswered ? (
                          <p className="text-xs font-medium text-warning">
                            No answer found for this question
                          </p>
                        ) : grade ? (
                          <div className="rounded-lg border-l-2 border-accent bg-accent-light/20 px-3 py-2">
                            <p className="text-xs font-semibold text-ink">AI Feedback</p>
                            <p className="mt-1 text-xs text-ink-soft">{grade.feedback}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted">
                            Grading unavailable for this question.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
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

        <section
          className={cn(
            "flex-1 flex-col overflow-hidden md:flex",
            mobileTab === "answerSheet" ? "flex" : "hidden"
          )}
        >
          <div className="bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
              <h2 className="text-sm font-semibold text-ink">Answer Sheet</h2>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={zoomOut}
                    disabled={zoomIndex === 0}
                    aria-label="Zoom out"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-ink-soft transition-colors hover:bg-muted-bg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-10 text-center text-xs font-medium text-ink-soft">
                    {zoomLevel}%
                  </span>
                  <button
                    type="button"
                    onClick={zoomIn}
                    disabled={zoomIndex === ZOOM_LEVELS.length - 1}
                    aria-label="Zoom in"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-ink-soft transition-colors hover:bg-muted-bg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {pageCount > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={goToPreviousPage}
                      disabled={currentPageIndex === 0}
                      aria-label="Previous page"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-ink-soft transition-colors hover:bg-muted-bg disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="whitespace-nowrap text-xs font-medium text-ink-soft">
                      Page {currentPageIndex + 1} of {pageCount}
                    </span>
                    <button
                      type="button"
                      onClick={goToNextPage}
                      disabled={currentPageIndex === pageCount - 1}
                      aria-label="Next page"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-ink-soft transition-colors hover:bg-muted-bg disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {isSelectedQuestionUnanswered && (
              <div className="flex justify-center border-b border-border px-6 py-3">
                <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-bg px-4 py-2.5 text-sm font-medium text-warning shadow-sm">
                  <AlertCircle className="h-4 w-4" />
                  No answer found for this question
                </div>
              </div>
            )}

            {answerPageIndexes.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-6 py-2.5 text-xs text-muted">
                <span>Answer continues on:</span>
                {answerPageIndexes.map((pageIdx) => (
                  <button
                    key={pageIdx}
                    type="button"
                    onClick={() => setCurrentPageIndex(pageIdx)}
                    className={cn(
                      "rounded-full px-2 py-0.5 font-semibold transition-colors",
                      currentPageIndex === pageIdx
                        ? "bg-accent text-white"
                        : "bg-muted-bg text-ink-soft hover:bg-border/60"
                    )}
                  >
                    Page {pageIdx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-1 justify-center overflow-auto bg-canvas p-6">
            <div style={{ width: `${zoomLevel}%`, maxWidth: MAX_VIEWER_WIDTH }}>
              {currentPage && (
                <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                  <HighlightOverlay
                    page={currentPage}
                    pageIndex={currentPageIndex}
                    segments={segmentsByPage.get(currentPageIndex) ?? []}
                    label={highlightLabel}
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
