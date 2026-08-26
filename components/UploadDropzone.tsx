"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { FileText, Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileSet } from "@/lib/types";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const ACCEPT = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isPdfFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".pdf");
}

type UploadDropzoneProps = {
  title: string;
  accentLabel: string;
  fileSet: FileSet;
  errorMessage: string | null;
  onFileAccepted: (file: File) => void;
  onRemove: () => void;
};

export function UploadDropzone({
  title,
  accentLabel,
  fileSet,
  errorMessage,
  onFileAccepted,
  onRemove,
}: UploadDropzoneProps) {
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);

  const isConverting = fileSet.fileName !== null && fileSet.pages.length === 0;
  const isReady = fileSet.fileName !== null && fileSet.pages.length > 0;

  const onDropAccepted = useCallback(
    (files: File[]) => {
      setRejectionMessage(null);
      const file = files[0];
      if (file) onFileAccepted(file);
    },
    [onFileAccepted]
  );

  const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
    const rejection = fileRejections[0];
    const code = rejection?.errors[0]?.code;
    if (code === "file-too-large") {
      setRejectionMessage("File is larger than 10MB.");
    } else if (code === "file-invalid-type") {
      setRejectionMessage("Only PDF, JPG, or PNG files are supported.");
    } else {
      setRejectionMessage("This file couldn't be uploaded.");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPT,
    maxSize: MAX_SIZE_BYTES,
    maxFiles: 1,
    multiple: false,
    disabled: isConverting || isReady,
    onDropAccepted,
    onDropRejected,
  });

  const pdfBadge = fileSet.fileName ? isPdfFileName(fileSet.fileName) : false;
  const combinedError = errorMessage ?? rejectionMessage;

  return (
    <div className="flex flex-1 flex-col gap-2">
      {!isReady && !isConverting && (
        <div
          {...getRootProps()}
          className={cn(
            "flex h-[220px] flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border-dashed bg-surface px-6 text-center transition-colors",
            isDragActive && "border-accent bg-accent-light/40"
          )}
        >
          <input {...getInputProps()} />
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted-bg text-ink-soft">
            <Upload className="h-5 w-5" />
          </span>
          <p className="text-sm font-semibold text-ink">
            Upload <span className="text-accent">{accentLabel}</span>
          </p>
          <p className="text-xs text-muted">Max 10MB</p>
        </div>
      )}

      {isConverting && (
        <div className="flex h-[220px] flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface px-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <p className="text-sm font-semibold text-ink">Processing {title}…</p>
          <p className="max-w-[85%] truncate text-xs text-muted">{fileSet.fileName}</p>
        </div>
      )}

      {isReady && (
        <div className="relative flex h-[220px] flex-1 flex-col justify-center gap-3 rounded-2xl border border-border bg-surface px-5">
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${title}`}
            className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white transition-colors hover:bg-ink-soft"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                pdfBadge ? "bg-danger-bg text-danger" : "bg-muted-bg text-ink-soft"
              )}
            >
              {pdfBadge ? (
                <FileText className="h-5 w-5" />
              ) : (
                <ImageIcon className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {fileSet.fileName}
              </p>
              <p className="text-xs text-muted">
                {formatFileSize(fileSet.fileSize ?? 0)} &bull;{" "}
                {fileSet.pages.length} {fileSet.pages.length === 1 ? "Page" : "Pages"}
              </p>
            </div>
          </div>
        </div>
      )}

      {combinedError && <p className="px-1 text-xs text-danger">{combinedError}</p>}
    </div>
  );
}
