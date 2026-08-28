import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { GEMINI_MODEL, getGeminiClient, isRateLimitError } from "@/lib/gemini";
import { GradeBatchResponseSchema } from "@/lib/schemas";

// A large batch of answered questions graded in one call can take a while.
export const maxDuration = 60;

type GradeBatchItem = {
  questionId: string;
  questionText: string;
  questionMarks: number | null;
  answerText: string;
};

type GradeBatchRequestBody = {
  items?: GradeBatchItem[];
};

function buildPrompt(items: GradeBatchItem[]): string {
  const questionsBlock = items
    .map(
      (item, index) => `Question ${index + 1} (id: "${item.questionId}"):
Question text: ${item.questionText}
Maximum marks available: ${item.questionMarks ?? "not specified, assume 10"}
Student's answer: ${item.answerText}`
    )
    .join("\n---\n");

  return `You are grading a student's answers to multiple exam questions in one pass.

${questionsBlock}

For EACH question above, evaluate the answer and provide:
1. questionId: copy the exact id given above for that question
2. score: marks awarded, as a number, not exceeding the maximum
3. maxScore: the maximum marks for this question
4. feedback: 1-3 sentences of specific, constructive feedback explaining what was right or wrong
5. isCorrect: true if fully correct, false if fully incorrect, null if partially correct or the question is subjective/open-ended and a binary judgment doesn't apply

Be fair and consistent. For multiple-choice questions, award full or zero marks based on whether the correct option was selected. For descriptive questions, award partial credit for partially correct reasoning.

Return ONLY valid JSON matching the required schema: an object with a "results" array containing exactly one entry per question above, in the same order. No markdown, no commentary.`;
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function POST(request: Request) {
  let body: GradeBatchRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const items = body.items;
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "items must be an array." }, { status: 400 });
  }

  if (items.length === 0) {
    return NextResponse.json({ results: [] }, { status: 200 });
  }

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildPrompt(items),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionId: { type: Type.STRING },
                  score: { type: Type.NUMBER },
                  maxScore: { type: Type.NUMBER },
                  feedback: { type: Type.STRING },
                  isCorrect: { type: Type.BOOLEAN, nullable: true },
                },
                required: ["questionId", "score", "maxScore", "feedback", "isCorrect"],
              },
            },
          },
          required: ["results"],
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

    const result = GradeBatchResponseSchema.safeParse(parsedJson);
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
      { error: "Failed to grade these answers. Please retry." },
      { status: 500 }
    );
  }
}
