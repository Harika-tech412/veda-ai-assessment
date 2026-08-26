import { create } from "zustand";
import type {
  Answer,
  FileSet,
  ProcessingStage,
  Question,
} from "./types";

type AppState = {
  questionPaper: FileSet;
  answerSheet: FileSet;
  questions: Question[];
  answers: Answer[];
  mapping: Record<string, string>;
  processingStage: ProcessingStage;
  selectedQuestionId: string | null;
  error: string | null;

  setQuestionPaper: (fileSet: FileSet) => void;
  setAnswerSheet: (fileSet: FileSet) => void;
  setQuestions: (questions: Question[]) => void;
  setAnswers: (answers: Answer[]) => void;
  setMapping: (mapping: Record<string, string>) => void;
  setProcessingStage: (stage: ProcessingStage) => void;
  setSelectedQuestionId: (id: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
};

const emptyFileSet: FileSet = {
  fileName: null,
  fileSize: null,
  pages: [],
};

const initialState = {
  questionPaper: emptyFileSet,
  answerSheet: emptyFileSet,
  questions: [],
  answers: [],
  mapping: {},
  processingStage: "idle" as ProcessingStage,
  selectedQuestionId: null,
  error: null,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setQuestionPaper: (fileSet) => set({ questionPaper: fileSet }),
  setAnswerSheet: (fileSet) => set({ answerSheet: fileSet }),
  setQuestions: (questions) => set({ questions }),
  setAnswers: (answers) => set({ answers }),
  setMapping: (mapping) => set({ mapping }),
  setProcessingStage: (processingStage) => set({ processingStage }),
  setSelectedQuestionId: (selectedQuestionId) => set({ selectedQuestionId }),
  setError: (error) => set({ error }),
  reset: () => set({ ...initialState }),
}));
