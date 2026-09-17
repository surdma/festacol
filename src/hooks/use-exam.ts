"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { recordIntegrityAction } from "@/app/actions/exams";

export function useExamTimer(initialRemaining: number, onExpire: () => void, active = true) {
  const [remaining, setRemaining] = useState(initialRemaining);
  const initialRef = useRef(initialRemaining);
  const cbRef = useRef(onExpire);
  cbRef.current = onExpire;

  useEffect(() => {
    if (initialRef.current === initialRemaining) return;
    initialRef.current = initialRemaining;
    setRemaining(Math.max(0, Math.round(initialRemaining)));
  }, [initialRemaining]);

  useEffect(() => {
    if (!active) return;
    if (remaining <= 0) {
      cbRef.current();
      return;
    }
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          queueMicrotask(() => cbRef.current());
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [remaining <= 0, active]);

  const format = useCallback(() => {
    const s = Math.max(0, remaining);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
  }, [remaining]);

  const syncRemaining = useCallback((value: number) => {
    setRemaining(Math.max(0, Math.round(value)));
  }, []);

  return { remaining, format, syncRemaining, isCritical: remaining <= 60, isWarning: remaining <= 300 };
}

interface IntegrityRecorderPolicy {
  focusMonitoring: boolean;
  clipboardGuard: boolean;
}

// Integrity events go through a Server Action: the browser never sees
// candidate hashes, endpoints, or keys — only (sessionId, type, detail).
export function useIntegrityRecorder(
  sessionId: string,
  policy: IntegrityRecorderPolicy = { focusMonitoring: true, clipboardGuard: true },
) {
  const record = useCallback(
    (type: string, detail?: string) => {
      if (!sessionId) return;
      void recordIntegrityAction(sessionId, type, detail).catch(() => undefined);
    },
    [sessionId],
  );

  useEffect(() => {
    if (!sessionId) return;
    const onVis = () => {
      if (document.hidden) record("tab-hidden");
      else record("focus-return");
    };
    const onBlur = () => record("window-blur");
    const onCopy = () => record("clipboard-copy");

    if (policy.focusMonitoring) {
      document.addEventListener("visibilitychange", onVis);
      window.addEventListener("blur", onBlur);
    }
    if (policy.clipboardGuard) document.addEventListener("copy", onCopy);

    return () => {
      if (policy.focusMonitoring) {
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("blur", onBlur);
      }
      if (policy.clipboardGuard) document.removeEventListener("copy", onCopy);
    };
  }, [policy.clipboardGuard, policy.focusMonitoring, record, sessionId]);

  return { record };
}
