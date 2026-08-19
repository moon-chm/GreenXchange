"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, RefreshCw, Check, AlertCircle, SwitchCamera, ShieldCheck, Sparkles, Zap } from "lucide-react";

interface LiveCameraCaptureProps {
  onCapture: (file: File, previewUrl: string) => void;
  initialPreview?: string | null;
  onClear?: () => void;
  label?: string;
  sublabel?: string;
  aspectRatio?: "square" | "video" | "auto";
}

export default function LiveCameraCapture({
  onCapture,
  initialPreview,
  onClear,
  label = "Live Plant Camera",
  sublabel = "Strictly live camera capture enforced. Gallery uploads are disabled.",
  aspectRatio = "video",
}: LiveCameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [preview, setPreview] = useState<string | null>(initialPreview || null);
  const [flash, setFlash] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);

  // Stop active video stream
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Start WebRTC live camera stream
  const startCamera = useCallback(async (mode: "environment" | "user" = facingMode) => {
    setIsInitializing(true);
    setCameraError(null);

    // Stop existing stream first
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Live camera API not supported by browser. Using native camera trigger.");
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }
      setIsInitializing(false);
    } catch (err: any) {
      console.warn("WebRTC camera stream error:", err);
      setIsInitializing(false);
      
      const isDenied = err.name === "NotAllowedError" || err.name === "PermissionDeniedError";
      if (isDenied) {
        setCameraError("Camera permission denied. Please allow camera access in your browser settings.");
      } else {
        setCameraError("Live camera stream unavailable. Tap below to launch your device camera.");
      }
    }
  }, [facingMode, stream]);

  // Initial camera startup if no preview exists
  useEffect(() => {
    if (!preview) {
      startCamera(facingMode);
    }
    return () => {
      stopStream();
    };
  }, [preview, facingMode]);

  // Handle camera switch
  const handleToggleFacingMode = () => {
    const newMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newMode);
    startCamera(newMode);
  };

  // Capture frame from live video feed
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Flash animation
    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `live_capture_${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          const url = URL.createObjectURL(blob);
          setPreview(url);
          stopStream();
          onCapture(file, url);
        }
      },
      "image/jpeg",
      0.92
    );
  }, [onCapture, stopStream]);

  // Timed capture
  const handleTimedCapture = () => {
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          captureFrame();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Fallback native camera file input handler (strictly capture="environment")
  const handleNativeCameraFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      stopStream();
      onCapture(file, url);
    }
  };

  // Retake photo
  const handleRetake = () => {
    setPreview(null);
    if (onClear) onClear();
    startCamera(facingMode);
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-canopy uppercase tracking-wider">
            <Camera className="w-3.5 h-3.5 text-fern" />
            <span>{label}</span>
          </div>
          <p className="text-[11px] text-canopy/60 mt-0.5">{sublabel}</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-medium bg-fern/10 text-fern px-2 py-0.5 rounded-full border border-fern/20">
          <ShieldCheck className="w-3 h-3" />
          <span>Strict Live Mode</span>
        </div>
      </div>

      {/* Viewfinder Card */}
      <div
        className={`relative w-full rounded-2xl overflow-hidden bg-canopy/95 border-2 ${
          preview ? "border-fern/60" : "border-sage/40"
        } shadow-lg flex flex-col items-center justify-center min-h-[280px] max-h-[400px] select-none`}
      >
        {/* Hidden Canvas for Frame Capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Hidden Native Camera-Only Input (Strict fallback for mobile) */}
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleNativeCameraFile}
          className="hidden"
        />

        {/* Flash Effect */}
        <AnimatePresence>
          {flash && (
            <motion.div
              initial={{ opacity: 0.9 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-white z-40 pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Preview Mode */}
        {preview ? (
          <div className="relative w-full h-full min-h-[280px] flex items-center justify-center bg-black">
            <img
              src={preview}
              alt="Live captured plant"
              className="w-full h-full max-h-[380px] object-cover"
            />
            {/* Live Stamp Badge */}
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 text-[11px] text-white">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Captured</span>
            </div>

            {/* Retake Control Overlay */}
            <div className="absolute bottom-3 inset-x-3 flex gap-2">
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 py-2.5 bg-white/90 hover:bg-white text-canopy text-xs font-semibold rounded-xl backdrop-blur-md shadow-md flex items-center justify-center gap-1.5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retake Live Photo
              </button>
              <div className="py-2.5 px-4 bg-fern text-white text-xs font-semibold rounded-xl shadow-md flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                Confirmed
              </div>
            </div>
          </div>
        ) : (
          /* Live Camera Stream Viewfinder */
          <div className="relative w-full h-full min-h-[280px] flex items-center justify-center">
            {/* Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full min-h-[280px] max-h-[380px] object-cover"
            />

            {/* Viewfinder HUD Target Reticle */}
            <div className="absolute inset-6 border border-fern/30 rounded-xl pointer-events-none flex flex-col justify-between p-2">
              <div className="flex justify-between">
                <div className="w-4 h-4 border-t-2 border-l-2 border-fern" />
                <div className="w-4 h-4 border-t-2 border-r-2 border-fern" />
              </div>
              {/* Plant Positioning Guide Icon */}
              <div className="flex flex-col items-center justify-center opacity-60">
                <div className="w-12 h-12 rounded-full border border-dashed border-fern/40 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-fern animate-pulse" />
                </div>
                <p className="text-[10px] text-emerald-200 mt-1 font-mono tracking-wider">
                  ALIGN PLANT / LEAF HERE
                </p>
              </div>
              <div className="flex justify-between">
                <div className="w-4 h-4 border-b-2 border-l-2 border-fern" />
                <div className="w-4 h-4 border-b-2 border-r-2 border-fern" />
              </div>
            </div>

            {/* Countdown Overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-30">
                <motion.span
                  key={countdown}
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="font-display text-6xl font-bold text-emerald-400 drop-shadow-lg"
                >
                  {countdown}
                </motion.span>
              </div>
            )}

            {/* Top Bar Indicators */}
            <div className="absolute top-3 inset-x-3 flex items-center justify-between z-20 pointer-events-auto">
              <div className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 text-[10px] text-white">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="font-semibold tracking-wider">LIVE FEED</span>
              </div>

              {/* Camera Switch Button */}
              <button
                type="button"
                onClick={handleToggleFacingMode}
                className="p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-lg border border-white/10 text-white hover:text-fern transition-all"
                title="Switch Camera (Front/Rear)"
              >
                <SwitchCamera className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-3 inset-x-3 flex items-center justify-center gap-4 z-20">
              {/* Shutter Button */}
              <motion.button
                type="button"
                onClick={captureFrame}
                whileTap={{ scale: 0.92 }}
                className="w-14 h-14 rounded-full border-4 border-white/80 bg-fern hover:bg-forest text-white flex items-center justify-center shadow-xl hover:scale-105 transition-transform"
                aria-label="Capture Live Photo"
              >
                <div className="w-10 h-10 rounded-full border-2 border-white/40 bg-white/20 flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
              </motion.button>
            </div>

            {/* Camera Error / Fallback Card */}
            {cameraError && (
              <div className="absolute inset-0 bg-canopy/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Camera Access Notice</p>
                  <p className="text-[11px] text-white/70 mt-1 max-w-xs">{cameraError}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-1 w-full max-w-xs">
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="flex-1 py-2 px-3 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Retry Live Stream
                  </button>
                  <button
                    type="button"
                    onClick={() => nativeCameraInputRef.current?.click()}
                    className="flex-1 py-2 px-3 bg-fern hover:bg-forest text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Open Camera App
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Anti-Fraud Disclaimer */}
      <div className="flex items-center gap-1.5 text-[10px] text-canopy/50 justify-center">
        <ShieldCheck className="w-3 h-3 text-fern" />
        <span>Verified with ResNet18 Tree & Health AI Models. Live capture strictly required.</span>
      </div>
    </div>
  );
}
