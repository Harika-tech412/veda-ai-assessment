export type PageImage = {
  dataUrl: string;
  width: number;
  height: number;
};

export type FileSet = {
  fileName: string | null;
  fileSize: number | null;
  pages: PageImage[];
};

export type Question = {
  id: string;
  number: string;
  text: string;
  marks: number | null;
};

export type AnswerSegment = {
  pageIndex: number;
  box_2d: [number, number, number, number];
};

export type Answer = {
  id: string;
  rawLabel: string;
  normalizedLabel: string;
  text: string;
  segments: AnswerSegment[];
};

export type ProcessingStage =
  | "idle"
  | "uploading"
  | "extracting-questions"
  | "extracting-answers"
  | "mapping"
  | "done";
