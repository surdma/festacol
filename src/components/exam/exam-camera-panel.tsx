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

  return (
    <section className="overflow-hidden rounded-xl border bg-background" aria-label="Webcam readiness">
      <div className={cn("relative overflow-hidden bg-neutral-950", compact ? "aspect-[16/10]" : "aspect-video") }>
        {status === "active" && stream ? (
          <>
            <video ref={videoRef} autoPlay muted playsInline className="size-full object-cover [transform:scaleX(-1)]" aria-label="Live webcam preview" />
            <div className="pointer-events-none absolute inset-[12%] rounded-[38%] border border-white/65" aria-hidden="true" />
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">
              <span className="size-2 rounded-full bg-emerald-400" aria-hidden="true" />
              Live
            </div>
          </>
        ) : (
          <div className="flex size-full min-h-40 flex-col items-center justify-center gap-3 px-5 text-center text-white">
            {status === "requesting" ? <Spinner className="size-6" /> : <Camera className="size-7" aria-hidden="true" />}
            <div>
              <p className="text-sm font-semibold">{statusLabel(required, status)}</p>
              <p className="mt-1 max-w-xs text-xs leading-5 text-neutral-300">
                {status === "idle" ? "Allow camera access to see your live preview before the exam starts." : error ?? "Keep your face comfortably within the guide."}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full", status === "active" ? "bg-emerald-500" : status === "requesting" ? "bg-amber-500" : "bg-destructive")} aria-hidden="true" />
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
