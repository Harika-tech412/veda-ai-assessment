"use client";

import { useEffect, useRef, useState } from "react";
import type { AnswerSegment, PageImage } from "@/lib/types";

type HighlightOverlayProps = {
  page: PageImage;
  pageIndex: number;
  segments: AnswerSegment[];
  label?: string;
};

export function HighlightOverlay({
  page,
  pageIndex,
  segments,
  label,
}: HighlightOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    updateSize();

    // Re-measures whenever the rendered image box changes size — covers
    // window resizes and pane-width changes, not just the initial layout.
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element -- responsive base64 page image, next/image doesn't handle data URLs well */}
      <img
        src={page.dataUrl}
        alt={`Answer sheet page ${pageIndex + 1}`}
        className="block w-full"
      />
      {size &&
        segments.map((segment, index) => {
          const [ymin, xmin, ymax, xmax] = segment.box_2d;
          const left = (xmin / 1000) * size.width;
          const top = (ymin / 1000) * size.height;
          const width = ((xmax - xmin) / 1000) * size.width;
          const height = ((ymax - ymin) / 1000) * size.height;

          return (
            <div
              key={index}
              className="pointer-events-none absolute rounded-sm border-2 border-success bg-success/20"
              style={{ left, top, width, height }}
            >
              {label && index === 0 && (
                <span className="absolute -top-6 left-0 whitespace-nowrap rounded-md bg-success px-2 py-0.5 text-xs font-semibold text-white">
                  {label}
                </span>
              )}
            </div>
          );
        })}
    </div>
  );
}
