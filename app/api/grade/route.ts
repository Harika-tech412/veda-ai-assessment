import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { GEMINI_MODEL, getGeminiClient, isRateLimitError } from "@/lib/gemini";
import { GradeResultSchema } from "@/lib/schemas";

type GradeRequestBody = {
  questionText?: string;
  questionMarks?: number | null;
  answerText?: string;
};

function buildPrompt(questionText: string, questionMarks: number | null, answerText: string): string {
  return `You are grading a student's answer to an exam question.

Question: ${questionText}
Maximum marks available: ${questionMarks ?? "not specified, assume 10"}
Student's answer: ${answerText}

Evaluate the answer and provide:
1. score: marks awarded, as a number, not exceeding the maximum
2. maxScore: the maximum marks for this question
3. feedback: 1-3 sentences of specific, constructive feedback explaining what was right or wrong
4. isCorrect: true if fully correct, false if fully incorrect, null if partially correct or the question is subjective/open-ended and a binary judgment doesn't apply

Be fair and consistent. For multiple-choice questions, award full or zero marks based on whether the correct option was selected. For descriptive questions, award partial credit for partially correct reasoning.

Return ONLY valid JSON matching the required schema. No markdown, no commentary.`;
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function POST(request: Request) {
  let body: GradeRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const questionText = body.questionText;
  const questionMarks = body.questionMarks ?? null;
  const answerText = body.answerText;

  if (!questionText) {
    return NextResponse.json({ error: "questionText is required." }, { status: 400 });
  }

  if (!answerText || !answerText.trim()) {
    return NextResponse.json(
      {
        score: 0,
        maxScore: questionMarks ?? 1,
        feedback: "No answer provided.",
        isCorrect: false,
      },
      { status: 200 }
    );
  }

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildPrompt(questionText, questionMarks, answerText),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            maxScore: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
            isCorrect: { type: Type.BOOLEAN, nullable: true },
          },
          required: ["score", "maxScore", "feedback", "isCorrect"],
        },
      },
    });

    const rawText = response.text ?? "";

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripCodeFences(rawText));
    } catch {
      console.error("[grade] Failed to parse Gemini response as JSON:", rawText);
      return NextResponse.json(
        { error: "The grading service returned an unreadable response. Please retry." },
        { status: 500 }
      );
    }

    const result = GradeResultSchema.safeParse(parsedJson);
    if (!result.success) {
      console.error(
        "[grade] Gemini response failed schema validation:",
        rawText,
        result.error
      );
      return NextResponse.json(
        { error: "The grading service returned data in an unexpected shape. Please retry." },
        { status: 500 }
      );
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (error) {
    console.error("[grade] Gemini call failed:", error);
    if (isRateLimitError(error)) {
      return NextResponse.json(
        { error: "Rate limit reached, please wait a moment and retry." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "Failed to grade this answer. Please retry." },
      { status: 500 }
    );
  }
}
