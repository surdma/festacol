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
  variant?: "default" | "booklet" | "capsule";
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
  presentation,
}: {
  status: ExamCameraStatus;
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  presentation: "compact" | "default" | "booklet" | "capsule";
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-muted",
        presentation === "compact" && "aspect-[4/3] w-24 rounded-lg",
        presentation === "default" && "aspect-video w-full border-y",
        presentation === "booklet" && "aspect-[4/3] w-32 border border-border bg-background sm:w-36",
        presentation === "capsule" && "aspect-[4/3] w-16 rounded-xl border border-border bg-background sm:w-20 xl:w-full",
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
              presentation === "compact"
                ? "left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px]"
                : presentation === "capsule"
                  ? "left-1 top-1 rounded-full px-1.5 py-0.5 text-[8px]"
                  : "left-3 top-3 rounded-full px-2.5 py-1 text-[11px]",
            )}
          >
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
            Live
          </div>
        </>
      ) : (
        <div className={cn("flex size-full items-center justify-center text-muted-foreground", presentation === "capsule" ? "min-h-12" : "min-h-24")}>
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
  variant = "default",
}: ExamCameraPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    element.srcObject = stream;
    if (stream) void element.play().catch(() => undefined);
  }, [stream]);

  if (!required) return null;

  if (variant === "capsule") {
    return (
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-label="Required webcam">
        <div className="flex items-center gap-2 p-1.5 xl:flex-col xl:items-stretch xl:p-2">
          <CameraPreview status={status} stream={stream} videoRef={videoRef} presentation="capsule" />
          <div className="min-w-0 flex-1 xl:px-1 xl:pb-1">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  status === "active" ? "bg-success" : status === "requesting" ? "bg-warning" : "bg-destructive",
                )}
                aria-hidden="true"
              />
              <p className="truncate text-[9px] font-semibold sm:text-[10px]">{status === "active" ? "Camera live" : statusLabel(status)}</p>
            </div>
            <p className="mt-0.5 hidden text-[9px] leading-4 text-muted-foreground xl:block">
              Required monitoring · no microphone
            </p>
          </div>
          {status !== "active" ? (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              onClick={onStart}
              disabled={status === "requesting"}
              aria-label="Retry required camera"
              className="shrink-0"
            >
              {status === "requesting" ? <Spinner /> : <RefreshCw />}
            </Button>
          ) : null}
        </div>
        {error && status !== "active" ? (
          <p className="border-t px-2 py-1.5 text-[9px] leading-4 text-destructive xl:text-[10px]">{error}</p>
        ) : null}
      </section>
    );
  }

  if (variant === "booklet") {
    return (
      <section className="border-t border-dashed border-border pt-4" aria-labelledby="booklet-camera-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-md">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Camera required</p>
            <h3 id="booklet-camera-title" className="mt-1 text-sm font-semibold">{statusLabel(status)}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {status === "active"
                ? "The live camera is ready. Keep it active while you write."
                : "Allow the camera when you are ready to begin. Festacol does not request microphone access."}
            </p>
          </div>

          {status !== "active" ? (
            <Button type="button" size="sm" variant="outline" onClick={onStart} disabled={status === "requesting"}>
              {status === "requesting" ? <Spinner data-icon="inline-start" /> : <Camera data-icon="inline-start" />}
              {status === "requesting" ? "Starting camera…" : status === "idle" ? "Allow camera" : "Retry camera"}
            </Button>
          ) : (
            <span className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Check className="size-4" aria-hidden="true" />
              Ready
            </span>
          )}
        </div>

        {status === "active" && stream ? (
          <div className="mt-4 flex flex-wrap items-start gap-4">
            <CameraPreview status={status} stream={stream} videoRef={videoRef} presentation="booklet" />
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-5 text-muted-foreground">This small preview is the camera view used for this examination.</p>
              {devices.length > 1 ? (
                <Select value={deviceId} onValueChange={(value) => onSelectDevice(String(value))}>
                  <SelectTrigger className="mt-3 w-full" size="sm" aria-label="Camera source">
                    <SelectValue placeholder="Choose camera" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {devices.map((device) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>{device.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          </div>
        ) : null}

        {error && status !== "active" ? (
          <Alert variant="destructive" className="mt-4">
            <TriangleAlert />
            <AlertTitle>Camera needs attention</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </section>
    );
  }

  if (compact) {
    return (
      <section className="flex items-center gap-3 rounded-xl border bg-background p-2.5" aria-label="Live webcam status">
        <CameraPreview status={status} stream={stream} videoRef={videoRef} presentation="compact" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                status === "active" ? "bg-success" : status === "requesting" ? "bg-warning" : "bg-destructive",
              )}
              aria-hidden="true"
            />
            <p className="truncate text-xs font-semibold">{statusLabel(status)}</p>
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
            {status === "active" ? "Required camera monitoring is active." : error ?? "Restore the required camera before continuing."}
          </p>
        </div>
        {status !== "active" ? (
          <Button type="button" size="icon-sm" variant="outline" onClick={onStart} disabled={status === "requesting"} aria-label="Retry camera">
            {status === "requesting" ? <Spinner /> : <RefreshCw />}
          </Button>
        ) : (
          <ShieldCheck className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </section>
    );
  }

  const showPreview = status === "requesting" || status === "active" || status === "disconnected";

  return (
    <section className="border-y border-border/80 bg-muted/10" aria-labelledby="camera-ready-title">
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Camera required</p>
            <h3 id="camera-ready-title" className="mt-1 text-sm font-semibold">{statusLabel(status)}</h3>
            <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
              {status === "active"
                ? "The live camera is ready and must remain active while you write this examination."
                : "This examination requires a live camera. Festacol will ask for webcam permission only when you choose Allow camera. Microphone access is not requested."}
            </p>
          </div>
        </div>

        {status !== "active" ? (
          <Button type="button" variant="outline" onClick={onStart} disabled={status === "requesting"}>
            {status === "requesting" ? <Spinner data-icon="inline-start" /> : <Camera data-icon="inline-start" />}
            {status === "requesting" ? "Requesting camera…" : status === "idle" ? "Allow camera" : "Retry camera"}
          </Button>
        ) : (
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Camera ready
          </span>
        )}
      </div>

      {showPreview ? (
        <CameraPreview status={status} stream={stream} videoRef={videoRef} presentation="default" />
      ) : null}

      {devices.length > 1 && status === "active" ? (
        <div className="border-t px-4 py-3">
          <Select value={deviceId} onValueChange={(value) => onSelectDevice(String(value))}>
            <SelectTrigger className="w-full" aria-label="Camera source">
              <SelectValue placeholder="Choose camera" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {devices.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>{device.label}</SelectItem>
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
