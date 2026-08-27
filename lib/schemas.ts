import { z } from "zod";

export const QuestionSchema = z.object({
  id: z.string(),
  number: z.string(),
  text: z.string(),
  marks: z.number().nullable(),
});
export const QuestionsResponseSchema = z.object({
  questions: z.array(QuestionSchema),
});
export type Question = z.infer<typeof QuestionSchema>;

export const AnswerSegmentSchema = z.object({
  pageIndex: z.number(),
  box_2d: z.array(z.number()).length(4), // [ymin, xmin, ymax, xmax], normalized 0-1000
});
export const AnswerSchema = z.object({
  id: z.string(),
  rawLabel: z.string(),
  normalizedLabel: z.string(),
  text: z.string(),
  segments: z.array(AnswerSegmentSchema),
});
export const AnswersResponseSchema = z.object({
  answers: z.array(AnswerSchema),
});
export type Answer = z.infer<typeof AnswerSchema>;

export const GradeResultSchema = z.object({
  score: z.number(),
  maxScore: z.number(),
  feedback: z.string(),
  isCorrect: z.boolean().nullable(), // null when partial/ungradeable (e.g. subjective essay answer)
});
export type GradeResult = z.infer<typeof GradeResultSchema>;
