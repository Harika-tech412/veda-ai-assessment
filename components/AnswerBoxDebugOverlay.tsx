import type { Answer, PageImage } from "@/lib/types";

const DISPLAY_WIDTH = 600;

type AnswerBoxDebugOverlayProps = {
  page: PageImage;
  answers: Answer[];
  pageIndex: number;
};

export function AnswerBoxDebugOverlay({
  page,
  answers,
  pageIndex,
}: AnswerBoxDebugOverlayProps) {
  const displayWidth = DISPLAY_WIDTH;
  const displayHeight = (page.height / page.width) * displayWidth;

  const boxes = answers.flatMap((answer) =>
    answer.segments
      .filter((segment) => segment.pageIndex === pageIndex)
      .map((segment) => ({ answerId: answer.id, box_2d: segment.box_2d }))
  );

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-border bg-muted-bg"
      style={{ width: displayWidth, height: displayHeight }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- temporary debug overlay, data URL source */}
      <img
        src={page.dataUrl}
        alt={`Answer sheet page ${pageIndex + 1}`}
        className="block h-full w-full object-contain"
      />
      {boxes.map(({ answerId, box_2d }, index) => {
        const [ymin, xmin, ymax, xmax] = box_2d;
        const left = (xmin / 1000) * displayWidth;
        const top = (ymin / 1000) * displayHeight;
        const width = ((xmax - xmin) / 1000) * displayWidth;
        const height = ((ymax - ymin) / 1000) * displayHeight;
        return (
          <div
            key={`${answerId}-${index}`}
            className="absolute border-2 border-red-500 bg-red-500/10"
            style={{ left, top, width, height }}
            title={answerId}
          />
        );
      })}
    </div>
  );
}
