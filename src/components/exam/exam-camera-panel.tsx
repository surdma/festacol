"use client";

import { useEffect, useRef } from "react";
import {
  Camera,
  CameraOff,
  Check,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type {
  ExamCameraDevice,
  ExamCameraStatus,
} from "@/hooks/use-exam-camera";
import { cn } from "@/lib/utils";

interface ExamCameraPanelProps {
  required: boolean;
  status: ExamCameraStatus;
  stream: MediaStream | null;
  devices: ExamCameraDevice[];
  deviceId: string;
  error: string | null;
  onStart: () => void;
  onSelectDevice: (deviceId: string) => void;
  compact?: boolean;
}

function statusLabel(status: ExamCameraStatus) {
  if (status === "active") return "Camera active";
  if (status === "requesting") return "Requesting camera";
  if (status === "denied") return "Camera permission required";
  if (status === "unavailable") return "Camera unavailable";
  if (status === "disconnected") return "Camera disconnected";
  return "Camera permission not requested";
}

function CameraPreview({
  status,
  stream,
  videoRef,
  compact,
}: {
  status: ExamCameraStatus;
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  compact: boolean;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-muted",
        compact
          ? "aspect-[4/3] w-24 rounded-lg"
          : "aspect-video w-full border-y",
      )}
    >
      {status === "active" && stream ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="size-full object-cover [transform:scaleX(-1)]"
            aria-label="Live webcam preview"
          />
          <div
            className="pointer-events-none absolute inset-[12%] rounded-[38%] border border-background/70"
            aria-hidden="true"
          />
          <div
            className={cn(
              "absolute flex items-center gap-1.5 bg-background/90 font-semibold text-foreground shadow-sm",
              compact
                ? "left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px]"
                : "left-3 top-3 rounded-full px-2.5 py-1 text-[11px]",
            )}
          >
            <span
              className="size-1.5 rounded-full bg-success"
              aria-hidden="true"
            />
            Live
          </div>
        </>
      ) : (
        <div className="flex size-full min-h-24 items-center justify-center text-muted-foreground">
          {status === "requesting" ? (
            <Spinner className="size-5" />
          ) : (
            <Camera className="size-5" aria-hidden="true" />
          )}
        </div>
      )}
    </div>
  );
}

export function ExamCameraPanel({
  required,
  status,
  stream,
  devices,
  deviceId,
  error,
  onStart,
  onSelectDevice,
  compact = false,
}: ExamCameraPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    element.srcObject = stream;
    if (stream) void element.play().catch(() => undefined);
  }, [stream]);

  if (!required) return null;

  if (compact) {
    return (
      <section
        className="flex items-center gap-3 rounded-xl border bg-background p-2.5"
        aria-label="Live webcam status"
      >
        <CameraPreview
          status={status}
          stream={stream}
          videoRef={videoRef}
          compact
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                status === "active"
                  ? "bg-success"
                  : status === "requesting"
                    ? "bg-warning"
                    : "bg-destructive",
              )}
              aria-hidden="true"
            />
            <p className="truncate text-xs font-semibold">
              {statusLabel(status)}
            </p>
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
            {status === "active"
              ? "Required camera monitoring is active."
              : error ?? "Restore the required camera before continuing."}
          </p>
        </div>
        {status !== "active" ? (
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={onStart}
            disabled={status === "requesting"}
            aria-label="Retry camera"
          >
            {status === "requesting" ? <Spinner /> : <RefreshCw />}
          </Button>
        ) : (
          <ShieldCheck
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </section>
    );
  }

  const showPreview =
    status === "requesting" ||
    status === "active" ||
    status === "disconnected";

  return (
    <section
      className="border-y border-border/80 bg-muted/10"
      aria-labelledby="camera-ready-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border bg-background">
            {status === "active" ? (
              <Check className="size-4" aria-hidden="true" />
            ) : status === "requesting" ? (
              <Spinner className="size-4" />
            ) : status === "denied" || status === "unavailable" ? (
              <CameraOff className="size-4" aria-hidden="true" />
            ) : status === "disconnected" ? (
              <TriangleAlert className="size-4" aria-hidden="true" />
            ) : (
              <Camera className="size-4" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Camera required
            </p>
            <h3 id="camera-ready-title" className="mt-1 text-sm font-semibold">
              {statusLabel(status)}
            </h3>
            <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
              {status === "active"
                ? "The live camera is ready and must remain active while you write this examination."
                : "This examination requires a live camera. Festacol will ask for webcam permission only when you choose Allow camera. Microphone access is not requested."}
            </p>
          </div>
        </div>

        {status !== "active" ? (
          <Button
            type="button"
            variant="outline"
            onClick={onStart}
            disabled={status === "requesting"}
          >
            {status === "requesting" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Camera data-icon="inline-start" />
            )}
            {status === "requesting"
              ? "Requesting camera…"
              : status === "idle"
                ? "Allow camera"
                : "Retry camera"}
          </Button>
        ) : (
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Camera ready
          </span>
        )}
      </div>

      {showPreview ? (
        <CameraPreview
          status={status}
          stream={stream}
          videoRef={videoRef}
          compact={false}
        />
      ) : null}

      {devices.length > 1 && status === "active" ? (
        <div className="border-t px-4 py-3">
          <Select
            value={deviceId}
            onValueChange={(value) => onSelectDevice(String(value))}
          >
            <SelectTrigger className="w-full" aria-label="Camera source">
              <SelectValue placeholder="Choose camera" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {devices.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {error && status !== "active" ? (
        <div className="border-t py-3">
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Camera needs attention</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}
    </section>
  );
}
