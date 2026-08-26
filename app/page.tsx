"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { convertPdfToImages } from "@/lib/pdf-to-images";
import { convertImageToPages } from "@/lib/image-to-dataurl";
import { UploadDropzone } from "@/components/UploadDropzone";
import { StageIndicator } from "@/components/StageIndicator";
import type { PageImage } from "@/lib/types";

type FileKind = "questionPaper" | "answerSheet";

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

async function convertFileToPages(file: File): Promise<PageImage[]> {
  return isPdfFile(file) ? convertPdfToImages(file) : convertImageToPages(file);
}

export default function Home() {
  const questionPaper = useAppStore((state) => state.questionPaper);
  const answerSheet = useAppStore((state) => state.answerSheet);
  const setQuestionPaper = useAppStore((state) => state.setQuestionPaper);
  const setAnswerSheet = useAppStore((state) => state.setAnswerSheet);
  const setProcessingStage = useAppStore((state) => state.setProcessingStage);
  const processingStage = useAppStore((state) => state.processingStage);

  const [questionPaperError, setQuestionPaperError] = useState<string | null>(null);
  const [answerSheetError, setAnswerSheetError] = useState<string | null>(null);

  const isConvertingQuestionPaper =
    questionPaper.fileName !== null && questionPaper.pages.length === 0;
  const isConvertingAnswerSheet =
    answerSheet.fileName !== null && answerSheet.pages.length === 0;

  const bothReady = questionPaper.pages.length > 0 && answerSheet.pages.length > 0;
  const isBusy = isConvertingQuestionPaper || isConvertingAnswerSheet;

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
        // eslint-disable-next-line no-console
        console.log(`[${kind}] converted`, {
          fileName: file.name,
          pageCount: pages.length,
          dimensions: pages.map((page) => `${page.width}x${page.height}`),
        });
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
      </div>
    </div>
  );
}
