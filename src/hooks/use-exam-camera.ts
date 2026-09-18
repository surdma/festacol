"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ExamCameraStatus = "idle" | "requesting" | "active" | "denied" | "unavailable" | "disconnected";

export interface ExamCameraDevice {
  deviceId: string;
  label: string;
}

export function useExamCamera(required: boolean) {
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<ExamCameraStatus>(required ? "idle" : "unavailable");
  const [devices, setDevices] = useState<ExamCameraDevice[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const start = useCallback(async (preferredDeviceId?: string) => {
    if (!required) return false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      setError("This browser cannot provide camera access. Use a supported browser or device.");
      return false;
    }

    setStatus("requesting");
    setError(null);
    stop();

    try {
      let nextStream: MediaStream;
      try {
        nextStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: preferredDeviceId ? { deviceId: { exact: preferredDeviceId } } : { facingMode: "user" },
        });
      } catch (preferredCameraError) {
        const name = preferredCameraError instanceof DOMException ? preferredCameraError.name : "";
        if (name !== "NotFoundError" && name !== "OverconstrainedError") throw preferredCameraError;
        nextStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }

      const track = nextStream.getVideoTracks()[0];
      if (!track) throw new Error("No camera stream was returned.");
      track.addEventListener("ended", () => {
        setStatus("disconnected");
        setError("The camera stream stopped. Reconnect it before continuing the examination.");
      }, { once: true });
      streamRef.current = nextStream;
      setStream(nextStream);
      setStatus("active");

      const settings = track.getSettings();
      let videoDevices: ExamCameraDevice[] = [];
      try {
        const available = await navigator.mediaDevices.enumerateDevices();
        videoDevices = available
          .filter((device) => device.kind === "videoinput")
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${index + 1}`,
          }));
      } catch {
        // A valid live stream must not be discarded just because the browser
        // refuses to enumerate every available camera.
      }
      setDevices(videoDevices);
      setDeviceId(settings.deviceId || preferredDeviceId || videoDevices[0]?.deviceId || "");
      return true;
    } catch (cameraError) {
      const name = cameraError instanceof DOMException ? cameraError.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setStatus("denied");
        setError("Camera permission was denied. Allow camera access in your browser, then retry.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setStatus("unavailable");
        setError("No usable camera was found on this device.");
      } else {
        setStatus("disconnected");
        setError("The camera could not be started. Check the device connection and retry.");
      }
      return false;
    }
  }, [required, stop]);

  const selectDevice = useCallback(async (nextDeviceId: string) => {
    setDeviceId(nextDeviceId);
    return start(nextDeviceId);
  }, [start]);

  useEffect(() => stop, [stop]);

  return {
    status,
    stream,
    devices,
    deviceId,
    error,
    ready: !required || status === "active",
    start,
    stop,
    selectDevice,
  };
}
