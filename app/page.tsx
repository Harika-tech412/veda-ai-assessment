"use client";

import { useAppStore } from "@/lib/store";
import { UploadScreen } from "@/components/UploadScreen";
import { ReviewScreen } from "@/components/ReviewScreen";

export default function Home() {
  const processingStage = useAppStore((state) => state.processingStage);

  if (processingStage === "done") {
    return <ReviewScreen />;
  }

  return <UploadScreen />;
}
