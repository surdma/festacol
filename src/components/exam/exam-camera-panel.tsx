"use client";

import { useEffect, useRef } from "react";
import { Camera, CameraOff, RefreshCw, ShieldCheck } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { ExamCameraDevice, ExamCameraStatus } from "@/hooks/use-exam-camera";

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

function statusLabel(required: boolean, status: ExamCameraStatus) {
  if (!required) return "Camera not required";
  if (status === "active") return "Camera active";
  if (status === "requesting") return "Starting camera";
  if (status === "denied") return "Permission required";
  if (status === "unavailable") return "Camera unavailable";
  if (status === "disconnected") return "Camera disconnected";
  return "Camera check required";
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
    <div className={cn("relative shrink-0 overflow-hidden bg-muted", compact ? "aspect-[4/3] w-24 rounded-lg" : "aspect-video w-full")}>
      {status === "active" && stream ? (
        <>
          <video ref={videoRef} autoPlay muted playsInline className="size-full object-cover [transform:scaleX(-1)]" aria-label="Live webcam preview" />
          <div className="pointer-events-none absolute inset-[12%] rounded-[38%] border border-background/70" aria-hidden="true" />
          <div className={cn("absolute flex items-center gap-1.5 rounded-full bg-background/85 font-semibold text-foreground shadow-sm", compact ? "left-1.5 top-1.5 px-1.5 py-0.5 text-[9px]" : "left-3 top-3 px-2.5 py-1 text-[11px]")}>
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
            Live
          </div>
        </>
      ) : (
        <div className="flex size-full min-h-20 items-center justify-center text-muted-foreground">
          {status === "requesting" ? <Spinner className="size-5" /> : <Camera className="size-5" aria-hidden="true" />}
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

  if (!required) {
    return (
      <section className="rounded-xl border bg-muted/20 p-4" aria-label="Camera status">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background"><CameraOff className="size-4" aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Camera not required</p>
            <p className="text-xs leading-5 text-muted-foreground">This examination does not request webcam access.</p>
          </div>
        </div>
      </section>
    );
  }

  if (compact) {
    return (
      <section className="flex items-center gap-3 rounded-xl border bg-background p-2.5" aria-label="Live webcam status">
        <CameraPreview status={status} stream={stream} videoRef={videoRef} compact />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", status === "active" ? "bg-success" : status === "requesting" ? "bg-warning" : "bg-destructive")} aria-hidden="true" />
            <p className="truncate text-xs font-semibold">{statusLabel(required, status)}</p>
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
            {status === "active" ? "Preview stays active during the exam." : error ?? "Camera access is required before continuing."}
          </p>
        </div>
        {status !== "active" ? (
          <Button type="button" size="icon-sm" variant="outline" onClick={onStart} disabled={status === "requesting"} aria-label="Retry camera">
            {status === "requesting" ? <Spinner /> : <RefreshCw />}
          </Button>
        ) : <ShieldCheck className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-background" aria-label="Webcam readiness">
      <CameraPreview status={status} stream={stream} videoRef={videoRef} compact={false} />

      <div className="flex flex-col gap-3 border-t p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full", status === "active" ? "bg-success" : status === "requesting" ? "bg-warning" : "bg-destructive")} aria-hidden="true" />
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{statusLabel(required, status)}</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {status === "active" ? "Your live preview stays active while you take this examination." : "Festacol does not request microphone access for this exam."}
            </p>
          </div>
          {status === "active" ? <ShieldCheck className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
        </div>

        {devices.length > 1 && status === "active" ? (
          <Select value={deviceId} onValueChange={(value) => onSelectDevice(String(value))}>
            <SelectTrigger className="w-full" aria-label="Camera source">
              <SelectValue placeholder="Choose camera" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {devices.map((device) => <SelectItem key={device.deviceId} value={device.deviceId}>{device.label}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}

        {status !== "active" ? (
          <Button type="button" variant="outline" onClick={onStart} disabled={status === "requesting"}>
            {status === "requesting" ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
            {status === "requesting" ? "Starting camera…" : status === "idle" ? "Allow camera" : "Retry camera"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
