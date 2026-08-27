import type { Answer, Question } from "./types";

/**
 * Hand-written sample data for sanity-checking matchAnswersToQuestions before
 * relying on real Gemini output. Not a real test file — just exported fixtures.
 *
 * Covers: q-5 has no matching answer (unanswered), ans-5 has no label
 * (unmatched), and ans-3's label ("Q3.") is formatted differently from
 * question "3" but should still match after normalization.
 */
export const mockQuestions: Question[] = [
  { id: "q-1", number: "1", text: "What is photosynthesis?", marks: 5 },
  { id: "q-2", number: "2", text: "Explain the water cycle.", marks: 5 },
  { id: "q-3", number: "3", text: "Define osmosis.", marks: 5 },
  { id: "q-4", number: "4", text: "List two types of rocks.", marks: 5 },
  { id: "q-5", number: "5", text: "Describe the food chain.", marks: 5 },
];

export const mockAnswers: Answer[] = [
  {
    id: "ans-1",
    rawLabel: "1",
    normalizedLabel: "1",
    text: "Photosynthesis is the process plants use to convert light into energy.",
    segments: [{ pageIndex: 0, box_2d: [100, 50, 200, 900] }],
  },
  {
    id: "ans-2",
    rawLabel: "2",
    normalizedLabel: "2",
    text: "The water cycle involves evaporation, condensation, and precipitation.",
    segments: [{ pageIndex: 0, box_2d: [210, 50, 300, 900] }],
  },
  {
    id: "ans-3",
    rawLabel: "Q3.",
    // Deliberately left with a leftover "q" prefix, as if upstream
    // normalization from Gemini were imperfect, to prove normalizeLabel()
    // fixes it on our end too.
    normalizedLabel: "q3",
    text: "Osmosis is the movement of water across a semi-permeable membrane.",
    segments: [{ pageIndex: 0, box_2d: [310, 50, 400, 900] }],
  },
  {
    id: "ans-4",
    rawLabel: "4",
    normalizedLabel: "4",
    text: "Igneous and sedimentary rocks.",
    segments: [{ pageIndex: 0, box_2d: [410, 50, 500, 900] }],
  },
  {
    id: "ans-5",
    rawLabel: "",
    normalizedLabel: "",
    text: "Some stray unlabeled notes in the margin.",
    segments: [{ pageIndex: 0, box_2d: [510, 50, 560, 300] }],
  },
];
