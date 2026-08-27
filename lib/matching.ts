import type { Answer, Question } from "./types";

export interface MatchResult {
  mapping: Record<string, string>; // questionId -> answerId
  unansweredQuestionIds: string[];
  unmatchedAnswerIds: string[];
}

/**
 * Normalizes a question/answer label for exact-match comparison: lowercases,
 * strips whitespace/periods/parentheses, then strips a single leading
 * "answer"/"ans"/"q" prefix. "answer" must be checked before "ans" in the
 * alternation, otherwise "answer11" would only strip "ans" and leave "wer11".
 *
 * "11(b)", "11 (b)", "Q11b", "Ans 11 b)", and "11.b" all collapse to "11b".
 * This operates on the whole string only (no substring/fuzzy matching), so
 * "1" and "11" never collide.
 */
export function normalizeLabel(raw: string): string {
  const stripped = raw.toLowerCase().replace(/\s+/g, "").replace(/[.()]/g, "");
  return stripped.replace(/^(answer|ans|q)/, "");
}

/**
 * Deterministic, non-AI matching of extracted answers to extracted questions.
 * A future enhancement could add an LLM-based fuzzy resolution pass for
 * labels that don't match anything here, but that's out of scope for now —
 * this stays fast and predictable.
 */
export function matchAnswersToQuestions(
  questions: Question[],
  answers: Answer[]
): MatchResult {
  const mapping: Record<string, string> = {};
  const unmatchedAnswerIds: string[] = [];
  const matchedQuestionIds = new Set<string>();

  // First question with a given normalized number wins that slot; real exam
  // papers shouldn't have duplicate numbering, so this is just a safety net.
  const questionIdByNormalizedNumber = new Map<string, string>();
  for (const question of questions) {
    const normalizedNumber = normalizeLabel(question.number);
    if (!questionIdByNormalizedNumber.has(normalizedNumber)) {
      questionIdByNormalizedNumber.set(normalizedNumber, question.id);
    }
  }

  // Pass 1 — exact match on normalized labels.
  for (const answer of answers) {
    if (!answer.rawLabel && !answer.normalizedLabel) {
      // Pass 2 — no label at all, straight to unmatched.
      unmatchedAnswerIds.push(answer.id);
      continue;
    }

    const normalizedAnswerLabel = normalizeLabel(answer.normalizedLabel);
    const questionId = questionIdByNormalizedNumber.get(normalizedAnswerLabel);

    if (!questionId) {
      // Pass 2 — label present but didn't match any question.
      unmatchedAnswerIds.push(answer.id);
      continue;
    }

    if (questionId in mapping) {
      // Known simplification: if two different answers normalize to the same
      // label, the first one encountered wins the mapping slot and every
      // later answer for that same label is flagged as unmatched instead of
      // being merged or resolved via an LLM disambiguation pass.
      unmatchedAnswerIds.push(answer.id);
      continue;
    }

    mapping[questionId] = answer.id;
    matchedQuestionIds.add(questionId);
  }

  const unansweredQuestionIds = questions
    .filter((question) => !matchedQuestionIds.has(question.id))
    .map((question) => question.id);

  return { mapping, unansweredQuestionIds, unmatchedAnswerIds };
}
