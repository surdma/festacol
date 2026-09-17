"use client";

import { useEffect, useState } from "react";
import { ExamPreflight } from "@/components/exam/exam-preflight";
import { ExamWorkspace } from "@/components/exam/exam-workspace";
import { useExamCamera } from "@/hooks/use-exam-camera";
import type { ExamExperienceContext } from "@/types/exam";

export function ExamWorkspaceEntry({
  context,
}: {
  context: ExamExperienceContext;
}) {
  const gateActiveResume = Boolean(
    context.access.activeAttemptId && !context.cameraRequired,
  );
  const [openWorkspace, setOpenWorkspace] = useState(!gateActiveResume);
  const [online, setOnline] = useState(true);
  const [fullscreenSupported, setFullscreenSupported] = useState(true);
  const [opening, setOpening] = useState(false);
  const camera = useExamCamera(false);

  useEffect(() => {
    const sync = () => {
      setOnline(navigator.onLine);
      setFullscreenSupported(Boolean(document.fullscreenEnabled));
    };
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    sync();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (openWorkspace) {
    return <ExamWorkspace context={context} />;
  }

  async function resume() {
    if (!online) return;

    setOpening(true);
    try {
      if (
        context.session.integrityPolicy.fullscreenPrompt &&
        document.fullscreenEnabled &&
        !document.fullscreenElement
      ) {
        await document.documentElement.requestFullscreen().catch(() => undefined);
      }
      setOpenWorkspace(true);
    } finally {
      setOpening(false);
    }
  }

  return (
    <ExamPreflight
      context={context}
      stage="final"
      onStageChange={() => undefined}
      camera={camera}
      online={online}
      cameraSupported={false}
      fullscreenSupported={fullscreenSupported}
      onStart={() => void resume()}
      starting={opening}
      error={null}
    />
  );
}
