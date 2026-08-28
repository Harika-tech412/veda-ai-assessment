import { NextResponse } from "next/server";
import { Type, type Part } from "@google/genai";
import { GEMINI_MODEL, getGeminiClient, isRateLimitError, stripDataUrlPrefix } from "@/lib/gemini";
import { AnswersResponseSchema } from "@/lib/schemas";

// Large multi-page answer sheets (e.g. 30+ page scans) can take Gemini well
// past a default serverless timeout to process in one request.
export const maxDuration = 60;

function buildPrompt(pageCount: number): string {
  return `You are analyzing a student's handwritten answer sheet, provided as one or more page images in order. There are ${pageCount} page(s) total, indexed from 0.

For each answer the student has written, extract the following:

1. rawLabel: the exact question label the student wrote next to their answer, as they wrote it (e.g. "1", "Q1", "2a", "2 a)", "Ans. 3"). If no label is visible for a clearly separate answer block, use an empty string.
2. normalizedLabel: the same label with whitespace, periods, and parentheses removed and lowercased, for matching purposes (e.g. "2 (a)" and "Q2a" both become "2a").
3. text: a transcription of the answer content in that block. Do not include the label itself in the text.
4. segments: the bounding box(es) of ONLY the written answer content region — NOT the question label — as box_2d in the format [ymin, xmin, ymax, xmax], normalized to a 0-1000 scale relative to that page's dimensions. If this single answer's content visibly continues onto another page (e.g. answer starts on page 0 and continues on page 1), return ONE segment per page it appears on, each with the correct pageIndex.

Rules:
- Process pages in order. An answer's segments must list pageIndex values in the order the content appears.
- If handwriting is unclear, still make your best-effort transcription — do not skip an answer just because it's hard to read.
- If a block of writing does not correspond to any question label at all (e.g. stray notes, a crossed-out attempt, an unlabeled diagram), still extract it with rawLabel and normalizedLabel as empty strings so it can be flagged as unmatched later.
- Do not merge two visibly separate answers into one entry even if they are adjacent.
- Generate "id" as "ans-" followed by a short random-looking slug, e.g. "ans-1", "ans-2" in order of appearance.

Return ONLY valid JSON matching the required schema. No markdown formatting, no commentary, no code fences.`;
}

type ExtractAnswersRequestBody = {
  pages?: { dataUrl: string }[];
};

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function POST(request: Request) {
  let body: ExtractAnswersRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const pages = body.pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    return NextResponse.json(
      { error: "No answer sheet pages were provided." },
      { status: 400 }
    );
  }

  let imageParts: Part[];
  try {
    imageParts = pages.map((page) => {
      const { mimeType, base64 } = stripDataUrlPrefix(page.dataUrl);
      return { inlineData: { mimeType, data: base64 } };
    });
  } catch {
    return NextResponse.json(
      { error: "One or more answer sheet pages were malformed." },
      { status: 400 }
    );
  }

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [buildPrompt(pages.length), ...imageParts],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  rawLabel: { type: Type.STRING },
                  normalizedLabel: { type: Type.STRING },
                  text: { type: Type.STRING },
                  segments: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        pageIndex: { type: Type.INTEGER },
                        box_2d: {
                          type: Type.ARRAY,
                          items: { type: Type.NUMBER },
                          minItems: "4",
                          maxItems: "4",
                        },
                      },
                      required: ["pageIndex", "box_2d"],
                    },
                  },
                },
                required: ["id", "rawLabel", "normalizedLabel", "text", "segments"],
              },
            },
          },
          required: ["answers"],
        },
      },
    });

    const rawText = response.text ?? "";

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripCodeFences(rawText));
    } catch {
      console.error("[extract-answers] Failed to parse Gemini response as JSON:", rawText);
      return NextResponse.json(
        { error: "The extraction service returned an unreadable response. Please retry." },
        { status: 500 }
      );
    }

    const result = AnswersResponseSchema.safeParse(parsedJson);
    if (!result.success) {
      console.error(
        "[extract-answers] Gemini response failed schema validation:",
        rawText,
        result.error
      );
      return NextResponse.json(
        { error: "The extraction service returned data in an unexpected shape. Please retry." },
        { status: 500 }
      );
    }

    return NextResponse.json({ answers: result.data.answers }, { status: 200 });
  } catch (error) {
    console.error("[extract-answers] Gemini call failed:", error);
    if (isRateLimitError(error)) {
      return NextResponse.json(
        { error: "Rate limit reached, please wait a moment and retry." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "Failed to extract answers. Please retry." },
      { status: 500 }
    );
  }
}
