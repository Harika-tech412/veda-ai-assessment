# VedaAI — Question & Answer Mapper

A teacher uploads a question paper and one student's handwritten answer sheet (PDF or images). The app extracts every question and every handwritten answer with Gemini, matches them up automatically, grades every answered question, and lets the teacher click any question to see exactly where on the answer sheet the student answered it — with an AI first-pass score and feedback shown inline.

**Deployed at:** _https://veda-ai-assessment-theta.vercel.app/_

## How it works (non-technical, 1 minute)

1. Upload the question paper and the student's answer sheet (PDF, JPG, or PNG).
2. Click **Start Mapping**. The app reads every question off the paper, reads every handwritten answer off the sheet, matches each answer to the question it belongs to — using the label the student wrote (e.g. "Q3", "2a"), not guesswork — and then automatically grades every answered question, all in one pass ("Extracting..." shows what's happening at each stage).
3. You land on a review screen: an accordion list of every question on the left (each showing a score badge, expandable to the full question text and AI feedback), the scanned answer sheet on the right with zoom and page controls. Click a question and a green box lights up over exactly where the student wrote that answer, jumping to the right page automatically. Unanswered questions say so. Stray/unlabeled writing shows up separately so nothing is silently ignored.
4. AI scores and feedback are a first-pass suggestion for a human to review, not a final grade.
5. **Start Over** clears everything and returns to the upload screen. Nothing is saved anywhere — refreshing the page starts over too.

On narrow/mobile screens, the split view becomes two tabs ("Questions" / "Answer Sheet"); selecting a question automatically switches to the Answer Sheet tab.

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

1. **Upload** — two dropzones (react-dropzone), accepting PDF/JPG/PNG up to 25MB each.
2. **PDF/photo → image, client-side** — PDFs (`lib/pdf-to-images.ts`) render each page to a canvas at 2x scale and export a PNG data URL plus real pixel dimensions (needed later for positioning highlight boxes accurately); multi-page PDFs report per-page progress to the UI ("Converting page 3 of 12…") instead of one opaque spinner. Photo uploads (`lib/image-to-dataurl.ts`) are drawn through a canvas rather than passed through raw: this bakes in EXIF orientation (phones tag rotated photos with metadata rather than physically rotating pixels, so this guarantees Gemini sees them right-side-up) and downscales anything over 2400px on the long side, re-encoding as JPEG — which also keeps a full-resolution phone photo from blowing well past the upload limit.
3. **Question extraction** (`app/api/extract-questions`) — sends all question-paper page images to Gemini with a strict prompt and JSON schema: one entry per printed question, sub-parts like "11(b)" kept as separate entries, in printed order.
4. **Answer extraction** (`app/api/extract-answers`) — sends all answer-sheet page images to Gemini: for each handwritten answer block, the label the student wrote, a transcription, and bounding box(es) (`box_2d`, normalized 0–1000 per page) of the written content — one segment per page for answers that span multiple pages.
5. **Matching** (`lib/matching.ts`) — deterministic, no AI: normalizes both the question numbers and the answer labels (lowercase, strip whitespace/punctuation, strip a leading "Q"/"Ans"/"Answer") and matches on exact string equality. Unlabeled or non-matching answers land in "Unmatched Answers" rather than being guessed at.
6. **Grading** (`app/api/grade`) — automatic, part of the pipeline (no button to click): every answered question is graded in one batched Gemini call (split into two sequential batches with a short pause between, only once the answered count exceeds ~25, to stay within free-tier rate limits without going back to one-request-per-question). Unanswered questions are scored 0 locally with no API call.
7. **Review UI** (`components/ReviewScreen.tsx`, `components/HighlightOverlay.tsx`) — left pane is an accordion list of every question in printed order (a score badge — green/red/amber by correctness, or a muted "Unanswered" badge); expanding a row shows the full question text and AI feedback. Right pane shows one answer-sheet page at a time with zoom (75–150%) and page navigation. Selecting a question jumps to the right page and draws a highlight box over the matched answer's region(s), measured live via `ResizeObserver` so it stays correctly positioned at any zoom level or window size; a multi-page answer shows page-jump chips for every page it spans. Below `md` width, the split pane becomes two tabs instead of side-by-side panes.

Every Gemini call happens server-side in a Next.js Route Handler under `app/api/*`; `GEMINI_API_KEY` is read only in `lib/gemini.ts` and never reaches the client bundle. Each route sets `maxDuration = 60` since a large multi-page document sent as a single Gemini request can run well past a default serverless timeout.

**AI model:** Gemini 3.6 Flash via the official `@google/genai` SDK, free tier. All three routes use `responseSchema` + `responseMimeType: "application/json"` and validate the result with zod (`lib/schemas.ts`) before trusting it, stripping stray ` ```json ` code fences as a safety net.

## Known assumptions and limitations

- **Single student per run** — this maps one answer sheet against one question paper. No multi-student batch grading.
- **Matching depends on labels** — an answer is only matched to a question if the student wrote a recognizable label next to it. Unlabeled or unrecognizable-label answers are flagged in "Unmatched Answers," not force-matched.
- **Duplicate labels** — if two different answers normalize to the same label, only the first is matched; the rest are flagged unmatched (see the comment in `lib/matching.ts`). A future improvement would add an LLM disambiguation pass for this case.
- **Bounding box accuracy** depends on Gemini's visual grounding and handwriting legibility. Verified accurate against real test sheets during development, but not guaranteed for every handwriting style or scan quality.
- **Multi-page answers** — the highlighting logic supports answers whose handwriting spans multiple pages (one segment per page, all rendered), but this path was not exercised against a real multi-page answer during testing, since the available test data didn't include one. Verify this specifically if it matters for your use case.
- **No persistence** — everything lives in memory (Zustand). Refreshing the page or navigating away loses all state; there's no save/resume.
- **Free-tier Gemini rate limits** apply (roughly 10 requests/minute). Grading paces itself with a short delay between real Gemini calls when batching is needed, and a 429 from Gemini surfaces as an explicit "Rate limit reached, please wait a moment and retry" message rather than a generic error. If grading fails outright (e.g. a persistent rate limit), the review screen still loads — you'll see a dismissible banner and "Ungraded" badges instead of scores, rather than the whole flow being blocked.
- **AI grading is a first-pass suggestion**, not a final grade — it's meant to save a teacher time, not replace their judgment.
- **Large documents in one request** — question/answer extraction sends every page of a document to Gemini in a single request (not chunked). A very large scan (30+ pages) means a larger, slower request; `maxDuration` is raised to mitigate serverless timeouts, but very large documents haven't been validated end-to-end yet — if the answer extraction step times out or returns truncated JSON on a large file, the next fix would be chunking pages across multiple calls and merging results. Photo uploads are downscaled/re-encoded client-side (see above) specifically to keep this payload smaller; PDF pages are not. Note also that Vercel's Node serverless functions cap request bodies at roughly 4.5MB regardless of the app's own 25MB upload limit — a large multi-page PDF's rendered pages could still exceed that once deployed, even though it works locally where no such cap applies.
- **Mobile/narrow viewports** get a tab-switcher fallback (Questions / Answer Sheet) instead of the side-by-side layout, but the app is primarily designed and tested for desktop/laptop widths.
- **Extraction quality** depends on scan/photo quality; very low-resolution, blurry, or heavily skewed images will reduce both transcription and bounding-box accuracy.
