"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, GraduationCap, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { convertPdfToImages, type PdfConversionProgress } from "@/lib/pdf-to-images";
import { convertImageToPages } from "@/lib/image-to-dataurl";
import { matchAnswersToQuestions } from "@/lib/matching";
import { UploadDropzone } from "@/components/UploadDropzone";
import { ExtractionProgress } from "@/components/ExtractionProgress";
import type { Answer, PageImage, Question } from "@/lib/types";
import type { GradeItemResult, GradeResult } from "@/lib/schemas";

type FileKind = "questionPaper" | "answerSheet";

type GradeBatchItem = {
  questionId: string;
  questionText: string;
  questionMarks: number | null;
  answerText: string;
};

const GRADE_BATCH_SIZE_THRESHOLD = 25;
const GRADE_BATCH_DELAY_MS = 1000;

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

async function convertFileToPages(
  file: File,
  onProgress?: (progress: PdfConversionProgress) => void
): Promise<PageImage[]> {
  return isPdfFile(file)
    ? convertPdfToImages(file, onProgress)
    : convertImageToPages(file);
}

async function gradeBatch(
  items: GradeBatchItem[]
): Promise<{ results: GradeItemResult[]; error: string | null }> {
  const response = await fetch("/api/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to grade these answers.");
  }
  return { results: data.results as GradeItemResult[], error: null };
}

// Grades answered questions in one batched call, splitting into two
// sequential batches (with a short pause between) once the answered count
// gets large, to stay safely within free-tier rate limits without going
// back to one-request-per-question. Never throws — partial results and a
// soft error message are returned so a batch failure can't block the review
// screen from appearing.
async function gradeAnsweredItems(
  items: GradeBatchItem[]
): Promise<{ results: GradeItemResult[]; error: string | null }> {
  if (items.length === 0) return { results: [], error: null };

  const half = Math.ceil(items.length / 2);
  const batches =
    items.length > GRADE_BATCH_SIZE_THRESHOLD
      ? [items.slice(0, half), items.slice(half)]
      : [items];

  const results: GradeItemResult[] = [];
  let error: string | null = null;

  for (let index = 0; index < batches.length; index++) {
    try {
      const batchResult = await gradeBatch(batches[index]);
      results.push(...batchResult.results);
    } catch (batchError) {
      console.error("[grade-batch] batch failed", batchError);
      error =
        batchError instanceof Error
          ? batchError.message
          : "Failed to grade some answers.";
    }

    if (index < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, GRADE_BATCH_DELAY_MS));
    }
  }

  return { results, error };
}

export function UploadScreen() {
  const questionPaper = useAppStore((state) => state.questionPaper);
  const answerSheet = useAppStore((state) => state.answerSheet);
  const questions = useAppStore((state) => state.questions);
  const setQuestionPaper = useAppStore((state) => state.setQuestionPaper);
  const setAnswerSheet = useAppStore((state) => state.setAnswerSheet);
  const setQuestions = useAppStore((state) => state.setQuestions);
  const setAnswers = useAppStore((state) => state.setAnswers);
  const setMapping = useAppStore((state) => state.setMapping);
  const setMatchResult = useAppStore((state) => state.setMatchResult);
  const setGrades = useAppStore((state) => state.setGrades);
  const setGradingError = useAppStore((state) => state.setGradingError);
  const setProcessingStage = useAppStore((state) => state.setProcessingStage);
  const processingStage = useAppStore((state) => state.processingStage);

  const [questionPaperError, setQuestionPaperError] = useState<string | null>(null);
  const [answerSheetError, setAnswerSheetError] = useState<string | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [answersError, setAnswersError] = useState<string | null>(null);
  const [questionPaperProgress, setQuestionPaperProgress] =
    useState<PdfConversionProgress | null>(null);
  const [answerSheetProgress, setAnswerSheetProgress] =
    useState<PdfConversionProgress | null>(null);

  const isConvertingQuestionPaper =
    questionPaper.fileName !== null && questionPaper.pages.length === 0;
  const isConvertingAnswerSheet =
    answerSheet.fileName !== null && answerSheet.pages.length === 0;

  const bothReady = questionPaper.pages.length > 0 && answerSheet.pages.length > 0;
  const isBusy = isConvertingQuestionPaper || isConvertingAnswerSheet;
  const isProcessingPipeline =
    processingStage === "extracting-questions" ||
    processingStage === "extracting-answers" ||
    processingStage === "mapping";

  useEffect(() => {
    if (!isConvertingQuestionPaper && !isConvertingAnswerSheet) {
      setProcessingStage("idle");
    }
  }, [isConvertingQuestionPaper, isConvertingAnswerSheet, setProcessingStage]);

  const handleFile = useCallback(
    async (kind: FileKind, file: File) => {
      const setFileSet = kind === "questionPaper" ? setQuestionPaper : setAnswerSheet;
      const setFileError =
        kind === "questionPaper" ? setQuestionPaperError : setAnswerSheetError;
      const setProgress =
        kind === "questionPaper" ? setQuestionPaperProgress : setAnswerSheetProgress;

      setFileError(null);
      setProgress(null);
      setFileSet({ fileName: file.name, fileSize: file.size, pages: [] });
      setProcessingStage("uploading");

      try {
        const pages = await convertFileToPages(file, setProgress);
        setFileSet({ fileName: file.name, fileSize: file.size, pages });
      } catch (error) {
        console.error(`[${kind}] conversion failed`, error);
        setFileError(
          error instanceof Error ? error.message : "Failed to process this file."
        );
        setFileSet({ fileName: null, fileSize: null, pages: [] });
      } finally {
        setProgress(null);
      }
    },
    [setQuestionPaper, setAnswerSheet, setProcessingStage]
  );

  const handleRemove = useCallback(
    (kind: FileKind) => {
      const setFileSet = kind === "questionPaper" ? setQuestionPaper : setAnswerSheet;
      const setFileError =
        kind === "questionPaper" ? setQuestionPaperError : setAnswerSheetError;
      const setProgress =
        kind === "questionPaper" ? setQuestionPaperProgress : setAnswerSheetProgress;
      setFileSet({ fileName: null, fileSize: null, pages: [] });
      setFileError(null);
      setProgress(null);
    },
    [setQuestionPaper, setAnswerSheet]
  );

  const handleExtractQuestions = useCallback(async (): Promise<Question[] | null> => {
    setExtractionError(null);
    setProcessingStage("extracting-questions");

    try {
      const response = await fetch("/api/extract-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pages: questionPaper.pages.map((page) => ({ dataUrl: page.dataUrl })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to extract questions.");
      }

      const extractedQuestions = data.questions as Question[];
      if (extractedQuestions.length === 0) {
        throw new Error(
          "No questions could be extracted. Please check your file and try again."
        );
      }

      setQuestions(extractedQuestions);
      return extractedQuestions;
    } catch (error) {
      setExtractionError(
        error instanceof Error ? error.message : "Failed to extract questions."
      );
      return null;
    }
  }, [questionPaper.pages, setProcessingStage, setQuestions]);

  const handleExtractAnswers = useCallback(async (): Promise<Answer[] | null> => {
    setAnswersError(null);
    setProcessingStage("extracting-answers");

    try {
      const response = await fetch("/api/extract-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pages: answerSheet.pages.map((page) => ({ dataUrl: page.dataUrl })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to extract answers.");
      }

      setAnswers(data.answers);
      return data.answers as Answer[];
    } catch (error) {
      setAnswersError(
        error instanceof Error ? error.message : "Failed to extract answers."
      );
      return null;
    }
  }, [answerSheet.pages, setProcessingStage, setAnswers]);

  const runMatchingAndGrade = useCallback(
    async (matchQuestions: Question[], matchAnswers: Answer[]) => {
      setGradingError(null);
      setProcessingStage("mapping");

      const result = matchAnswersToQuestions(matchQuestions, matchAnswers);
      setMapping(result.mapping);
      setMatchResult(result);

      const gradesToSet: Record<string, GradeResult> = {};
      const answeredItems: GradeBatchItem[] = [];

      for (const question of matchQuestions) {
        const answerId = result.mapping[question.id];
        const answer = answerId ? matchAnswers.find((a) => a.id === answerId) : undefined;

        if (!answer) {
          // Unanswered — zero locally, no API call spent on it.
          gradesToSet[question.id] = {
            score: 0,
            maxScore: question.marks ?? 1,
            feedback: "No answer provided.",
            isCorrect: false,
          };
          continue;
        }

        answeredItems.push({
          questionId: question.id,
          questionText: question.text,
          questionMarks: question.marks,
          answerText: answer.text,
        });
      }

      const { results, error } = await gradeAnsweredItems(answeredItems);
      for (const item of results) {
        gradesToSet[item.questionId] = {
          score: item.score,
          maxScore: item.maxScore,
          feedback: item.feedback,
          isCorrect: item.isCorrect,
        };
      }
      if (error) {
        setGradingError(error);
      }

      setGrades(gradesToSet);
      setProcessingStage("done");
    },
    [setProcessingStage, setMapping, setMatchResult, setGrades, setGradingError]
  );

  const handleStartMapping = useCallback(async () => {
    const extractedQuestions = await handleExtractQuestions();
    if (!extractedQuestions) {
      setProcessingStage("idle");
      return;
    }

    // Sequential by design: don't start answer extraction until questions succeed.
    const extractedAnswers = await handleExtractAnswers();
    if (!extractedAnswers) {
      setProcessingStage("idle");
      return;
    }

    await runMatchingAndGrade(extractedQuestions, extractedAnswers);
  }, [handleExtractQuestions, handleExtractAnswers, runMatchingAndGrade, setProcessingStage]);

  const handleRetryAnswers = useCallback(async () => {
    const extractedAnswers = await handleExtractAnswers();
    if (!extractedAnswers) {
      setProcessingStage("idle");
      return;
    }
    await runMatchingAndGrade(questions, extractedAnswers);
  }, [handleExtractAnswers, questions, runMatchingAndGrade, setProcessingStage]);

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-canvas to-canvas-to px-6 py-12">
      <div className="w-full max-w-3xl rounded-3xl bg-surface px-8 py-12 shadow-sm sm:px-14">
        {isProcessingPipeline ? (
          <ExtractionProgress />
        ) : (
          <>
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-2xl font-bold text-ink sm:text-3xl">
                Upload{" "}
                <span className="highlight-accent">
                  Question Paper &amp; Answer Sheets
                </span>
              </h1>
              <p className="text-sm text-muted">Upload both files to get started</p>
            </div>

            <div className="my-8 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-accent-ring bg-accent-light">
                <GraduationCap className="h-9 w-9 text-accent" />
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <UploadDropzone
                title="Question Paper"
                accentLabel="Question Paper"
                fileSet={questionPaper}
                errorMessage={questionPaperError}
                conversionProgress={questionPaperProgress}
                onFileAccepted={(file) => handleFile("questionPaper", file)}
                onRemove={() => handleRemove("questionPaper")}
              />
              <UploadDropzone
                title="Student Answer Sheet"
                accentLabel="Student Answer Sheet"
                fileSet={answerSheet}
                errorMessage={answerSheetError}
                conversionProgress={answerSheetProgress}
                onFileAccepted={(file) => handleFile("answerSheet", file)}
                onRemove={() => handleRemove("answerSheet")}
              />
            </div>

            <div className="mt-8 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handleStartMapping}
                disabled={!bothReady || isBusy}
                className={cn(
                  "flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors",
                  bothReady && !isBusy
                    ? "bg-ink text-white hover:bg-ink-soft"
                    : "cursor-not-allowed bg-muted-bg text-muted"
                )}
              >
                Start Mapping
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="max-w-sm text-center text-xs text-muted">
                Once both files are uploaded, you&apos;ll be able to map answers with
                questions
              </p>
            </div>
          </>
        )}

        {extractionError && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger-bg px-4 py-3 text-sm text-danger">
            <span>{extractionError}</span>
            <button
              type="button"
              onClick={handleStartMapping}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-danger px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90"
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {answersError && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger-bg px-4 py-3 text-sm text-danger">
            <span>{answersError}</span>
            <button
              type="button"
              onClick={handleRetryAnswers}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-danger px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90"
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
