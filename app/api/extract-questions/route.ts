import { NextResponse } from "next/server";
import { Type, type Part } from "@google/genai";
import { GEMINI_MODEL, getGeminiClient, stripDataUrlPrefix } from "@/lib/gemini";
import { QuestionsResponseSchema } from "@/lib/schemas";

const PROMPT = `You are analyzing a printed exam question paper spanning one or more pages, provided as images in order.

Extract every question in the exact order they appear. Follow these rules precisely:

1. Preserve numbering exactly as printed on the page — e.g. "1", "2(a)", "11(b)(ii)", "Q3", "Section A - 1". Do not renumber or normalize it.
2. If a question has labelled sub-parts such as (a), (b), (i), (ii) — treat EACH sub-part as its own SEPARATE entry in the output. Do not merge sub-parts into their parent question.
3. Keep entries in the exact order they appear across the page(s), reading top to bottom, left to right within multi-column layouts.
4. "text" should contain the full question text, with the number/label itself excluded.
5. If marks are printed near the question (e.g. "[5]", "(10 marks)"), extract the number into "marks". If no marks are shown, use null.
6. Do not extract generic instructions like "Answer all questions in Section A" as a question — only extract genuine question items that expect an answer.
7. If a single question's text visibly continues onto the next page, still output it as ONE entry with the combined text.
8. Generate "id" as a lowercase slug of the number, e.g. question "11(b)" → id "q-11-b", question "3" → id "q-3". Replace any non-alphanumeric characters with hyphens.

Return ONLY valid JSON matching the required schema. No markdown formatting, no commentary, no code fences.`;

type ExtractQuestionsRequestBody = {
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
  let body: ExtractQuestionsRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const pages = body.pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    return NextResponse.json(
      { error: "No question paper pages were provided." },
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
      { error: "One or more question paper pages were malformed." },
      { status: 400 }
    );
  }

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [PROMPT, ...imageParts],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  number: { type: Type.STRING },
                  text: { type: Type.STRING },
                  marks: { type: Type.NUMBER, nullable: true },
                },
                required: ["id", "number", "text", "marks"],
              },
            },
          },
          required: ["questions"],
        },
      },
    });

    const rawText = response.text ?? "";

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripCodeFences(rawText));
    } catch {
      console.error("[extract-questions] Failed to parse Gemini response as JSON:", rawText);
      return NextResponse.json(
        { error: "The extraction service returned an unreadable response. Please retry." },
        { status: 500 }
      );
    }

    const result = QuestionsResponseSchema.safeParse(parsedJson);
    if (!result.success) {
      console.error(
        "[extract-questions] Gemini response failed schema validation:",
        rawText,
        result.error
      );
      return NextResponse.json(
        { error: "The extraction service returned data in an unexpected shape. Please retry." },
        { status: 500 }
      );
    }

    return NextResponse.json({ questions: result.data.questions }, { status: 200 });
  } catch (error) {
    console.error("[extract-questions] Gemini call failed:", error);
    return NextResponse.json(
      { error: "Failed to extract questions. Please retry." },
      { status: 500 }
    );
  }
}
