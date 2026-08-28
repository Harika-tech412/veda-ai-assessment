# VedaAI — Question & Answer Mapper

A teacher uploads a question paper and one student's handwritten answer sheet (PDF or images). The app extracts every question and every handwritten answer with Gemini, matches them up automatically, and lets the teacher click any question to see exactly where on the answer sheet the student answered it — with an optional AI first-pass grade and feedback per question.

**Deployed at:** _[URL] — add after deploying to Vercel_

## How it works (non-technical, 1 minute)

1. Upload the question paper and the student's answer sheet (PDF, JPG, or PNG).
2. Click **Start Mapping**. The app reads every question off the paper, reads every handwritten answer off the sheet, and matches each answer to the question it belongs to — using the label the student wrote (e.g. "Q3", "2a"), not guesswork.
3. You land on a review screen: a list of every question on the left, the scanned answer sheet on the right. Click a question and a green box lights up over exactly where the student wrote that answer. Unanswered questions say so. Stray/unlabeled writing shows up separately so nothing is silently ignored.
4. Optionally, click **Grade** on any question (or **Grade All**) for an AI-generated score and one-to-three-sentence feedback. Treat this as a first-pass suggestion for a human to review, not a final grade.
5. **Start Over** clears everything and returns to the upload screen. Nothing is saved anywhere — refreshing the page starts over too.

## Setup

```bash
git clone <this-repo-url>
cd <repo-directory>
npm install
```

Create `.env.local` in the project root (copy `.env.example`) and add your Gemini API key:

```
GEMINI_API_KEY=your-key-here
```

Then run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

Next.js 16 (App Router, TypeScript, Tailwind v4). All state lives in a Zustand store in the browser — no database, no auth, no server-side persistence.

**Pipeline:**

1. **Upload** — two dropzones (react-dropzone), accepting PDF/JPG/PNG up to 10MB each.
2. **PDF → image, client-side** (`lib/pdf-to-images.ts`) — pdfjs-dist renders each PDF page to a canvas at 2x scale and exports a PNG data URL plus its real pixel dimensions (needed later for positioning highlight boxes accurately). Plain image uploads pass through as-is (`lib/image-to-dataurl.ts`). Multi-page PDFs report per-page progress to the UI ("Converting page 3 of 12…") instead of one opaque spinner.
3. **Question extraction** (`app/api/extract-questions`) — sends all question-paper page images to Gemini with a strict prompt and JSON schema: one entry per printed question, sub-parts like "11(b)" kept as separate entries, in printed order.
4. **Answer extraction** (`app/api/extract-answers`) — sends all answer-sheet page images to Gemini: for each handwritten answer block, the label the student wrote, a transcription, and bounding box(es) (`box_2d`, normalized 0–1000 per page) of the written content — one segment per page for answers that span multiple pages.
5. **Matching** (`lib/matching.ts`) — deterministic, no AI: normalizes both the question numbers and the answer labels (lowercase, strip whitespace/punctuation, strip a leading "Q"/"Ans"/"Answer") and matches on exact string equality. Unlabeled or non-matching answers land in "Unmatched Answers" rather than being guessed at.
6. **Review UI** (`components/ReviewScreen.tsx`, `components/HighlightOverlay.tsx`) — left pane lists every question in printed order with an Answered/Unanswered pill; right pane stacks every answer-sheet page. Selecting a question scrolls to the right page and draws a highlight box over the matched answer's region(s), measured live via `ResizeObserver` so it stays correctly positioned across window resizes and multi-page answers highlight on every page they span.
7. **Grading (optional)** (`app/api/grade`) — per-question or "Grade All" (sequential, with a short pause between real Gemini calls to stay under free-tier rate limits). Unanswered questions are scored 0 locally with no API call.

Every Gemini call happens server-side in a Next.js Route Handler under `app/api/*`; `GEMINI_API_KEY` is read only in `lib/gemini.ts` and never reaches the client bundle.

**AI model:** Gemini 3.6 Flash via the official `@google/genai` SDK, free tier. All three routes use `responseSchema` + `responseMimeType: "application/json"` and validate the result with zod (`lib/schemas.ts`) before trusting it, stripping stray ` ```json ` code fences as a safety net.

## Known assumptions and limitations

- **Single student per run** — this maps one answer sheet against one question paper. No multi-student batch grading.
- **Matching depends on labels** — an answer is only matched to a question if the student wrote a recognizable label next to it. Unlabeled or unrecognizable-label answers are flagged in "Unmatched Answers," not force-matched.
- **Duplicate labels** — if two different answers normalize to the same label, only the first is matched; the rest are flagged unmatched (see the comment in `lib/matching.ts`). A future improvement would add an LLM disambiguation pass for this case.
- **Bounding box accuracy** depends on Gemini's visual grounding and handwriting legibility. Verified accurate against real test sheets during development, but not guaranteed for every handwriting style or scan quality.
- **Multi-page answers** — the highlighting logic supports answers whose handwriting spans multiple pages (one segment per page, all rendered), but this path was not exercised against a real multi-page answer during testing, since the available test data didn't include one. Verify this specifically if it matters for your use case.
- **No persistence** — everything lives in memory (Zustand). Refreshing the page or navigating away loses all state; there's no save/resume.
- **Free-tier Gemini rate limits** apply (roughly 10 requests/minute). "Grade All" paces itself with a short delay between real Gemini calls, and a 429 from Gemini surfaces as an explicit "Rate limit reached, please wait a moment and retry" message rather than a generic error.
- **AI grading is a first-pass suggestion**, not a final grade — it's meant to save a teacher time, not replace their judgment.
- **Desktop-width UI** — the review screen's split-pane layout is designed for desktop/laptop widths (roughly 1024px and up). It isn't optimized for mobile or narrow viewports.
- **Extraction quality** depends on scan/photo quality; very low-resolution, blurry, or heavily skewed images will reduce both transcription and bounding-box accuracy.
