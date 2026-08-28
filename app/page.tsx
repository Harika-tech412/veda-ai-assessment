"use client";

import { useAppStore } from "@/lib/store";
import { AppShell } from "@/components/AppShell";
import { UploadScreen } from "@/components/UploadScreen";
import { ReviewScreen } from "@/components/ReviewScreen";

export default function Home() {
  const processingStage = useAppStore((state) => state.processingStage);

  return (
    <AppShell>{processingStage === "done" ? <ReviewScreen /> : <UploadScreen />}</AppShell>
  );
}
