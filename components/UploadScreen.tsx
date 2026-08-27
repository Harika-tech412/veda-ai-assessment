"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, GraduationCap, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { convertPdfToImages } from "@/lib/pdf-to-images";
import { convertImageToPages } from "@/lib/image-to-dataurl";
import { matchAnswersToQuestions } from "@/lib/matching";
import { UploadDropzone } from "@/components/UploadDropzone";
import { StageIndicator } from "@/components/StageIndicator";
import type { Answer, PageImage, Question } from "@/lib/types";

type FileKind = "questionPaper" | "answerSheet";

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

async function convertFileToPages(file: File): Promise<PageImage[]> {
  return isPdfFile(file) ? convertPdfToImages(file) : convertImageToPages(file);
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
  const setProcessingStage = useAppStore((state) => state.setProcessingStage);
  const processingStage = useAppStore((state) => state.processingStage);

  const [questionPaperError, setQuestionPaperError] = useState<string | null>(null);
  const [answerSheetError, setAnswerSheetError] = useState<string | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [answersError, setAnswersError] = useState<string | null>(null);

  const isConvertingQuestionPaper =
    questionPaper.fileName !== null && questionPaper.pages.length === 0;
  const isConvertingAnswerSheet =
    answerSheet.fileName !== null && answerSheet.pages.length === 0;

  const bothReady = questionPaper.pages.length > 0 && answerSheet.pages.length > 0;
  const isBusy = isConvertingQuestionPaper || isConvertingAnswerSheet;
  const isExtractingQuestions = processingStage === "extracting-questions";
  const isExtractingAnswers = processingStage === "extracting-answers";
  const isExtracting = isExtractingQuestions || isExtractingAnswers;

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

      setFileError(null);
      setFileSet({ fileName: file.name, fileSize: file.size, pages: [] });
      setProcessingStage("uploading");

      try {
        const pages = await convertFileToPages(file);
        setFileSet({ fileName: file.name, fileSize: file.size, pages });
      } catch (error) {
        console.error(`[${kind}] conversion failed`, error);
        setFileError(
          error instanceof Error ? error.message : "Failed to process this file."
        );
        setFileSet({ fileName: null, fileSize: null, pages: [] });
      }
    },
    [setQuestionPaper, setAnswerSheet, setProcessingStage]
  );

  const handleRemove = useCallback(
    (kind: FileKind) => {
      const setFileSet = kind === "questionPaper" ? setQuestionPaper : setAnswerSheet;
      const setFileError =
        kind === "questionPaper" ? setQuestionPaperError : setAnswerSheetError;
      setFileSet({ fileName: null, fileSize: null, pages: [] });
      setFileError(null);
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

      setQuestions(data.questions);
      return data.questions as Question[];
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

  const runMatching = useCallback(
    (matchQuestions: Question[], matchAnswers: Answer[]) => {
      setProcessingStage("mapping");
      const result = matchAnswersToQuestions(matchQuestions, matchAnswers);
      setMapping(result.mapping);
      setMatchResult(result);
      setProcessingStage("done");
    },
    [setProcessingStage, setMapping, setMatchResult]
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

    runMatching(extractedQuestions, extractedAnswers);
  }, [handleExtractQuestions, handleExtractAnswers, runMatching, setProcessingStage]);

  const handleRetryAnswers = useCallback(async () => {
    const extractedAnswers = await handleExtractAnswers();
    if (!extractedAnswers) {
      setProcessingStage("idle");
      return;
    }
    runMatching(questions, extractedAnswers);
  }, [handleExtractAnswers, questions, runMatching, setProcessingStage]);

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-canvas to-canvas-to px-6 py-12">
      <div className="w-full max-w-3xl rounded-3xl bg-surface px-8 py-12 shadow-sm sm:px-14">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">
            Upload <span className="highlight-accent">Question Paper &amp; Answer Sheets</span>
          </h1>
          <p className="text-sm text-muted">Upload both files to get started</p>
        </div>

        <div className="my-8 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-accent-ring bg-accent-light">
            <GraduationCap className="h-9 w-9 text-accent" />
          </div>
        </div>

        {processingStage !== "idle" && (
          <div className="mb-8">
            <StageIndicator />
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row">
          <UploadDropzone
            title="Question Paper"
            accentLabel="Question Paper"
            fileSet={questionPaper}
            errorMessage={questionPaperError}
            onFileAccepted={(file) => handleFile("questionPaper", file)}
            onRemove={() => handleRemove("questionPaper")}
          />
          <UploadDropzone
            title="Student Answer Sheet"
            accentLabel="Student Answer Sheet"
            fileSet={answerSheet}
            errorMessage={answerSheetError}
            onFileAccepted={(file) => handleFile("answerSheet", file)}
            onRemove={() => handleRemove("answerSheet")}
          />
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleStartMapping}
            disabled={!bothReady || isBusy || isExtracting}
            className={cn(
              "flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors",
              bothReady && !isBusy && !isExtracting
                ? "bg-ink text-white hover:bg-ink-soft"
                : "cursor-not-allowed bg-muted-bg text-muted"
            )}
          >
            {isExtractingQuestions ? (
              <>
                Extracting Questions…
                <Loader2 className="h-4 w-4 animate-spin" />
              </>
            ) : isExtractingAnswers ? (
              <>
                Extracting Answers…
                <Loader2 className="h-4 w-4 animate-spin" />
              </>
            ) : (
              <>
                Start Mapping
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
          <p className="max-w-sm text-center text-xs text-muted">
            Once both files are uploaded, you&apos;ll be able to map answers with
            questions
          </p>
        </div>

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
