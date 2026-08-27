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
