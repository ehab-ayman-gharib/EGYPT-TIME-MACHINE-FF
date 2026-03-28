/**
 * CAMERA CAPTURE COMPONENT
 * ------------------------
 * Manages the live camera feed, face detection, and the photo capture sequence.
 * 
 * SPECIAL BOOTH SETUP:
 * The physical camera is mounted in Landscape (1280x720) but rotated 90 degrees.
 * This component rotates the feed back and crops it to a 1080x1920 Portrait frame.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, ChevronLeft, Upload } from 'lucide-react';
import { loadFaceApiModels, detectFaces } from '../services/faceService';
import { EraData, FaceDetectionResult, EraId } from '../types';

interface CameraCaptureProps {
  era: EraData | null;
  onCapture: (image: string, faceData: FaceDetectionResult) => void;
  onBack: () => void;
  isProcessing?: boolean;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ era, onCapture, onBack, isProcessing = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);

  /**
   * 1. CAMERA & AI INITIALIZATION
   * Loads Face-API models and requests the camera stream.
   */
  useEffect(() => {
    const init = async () => {
      try {
        const loaded = await loadFaceApiModels();
        setModelsLoaded(loaded);

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        setStream(mediaStream);
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
      } catch (err) {
        setError("Camera access denied. Please check system permissions.");
        console.error(err);
      }
    };
    init();

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  /**
   * 2. CAPTURE LOGIC (The "Shutter")
   * Captures the current video frame, rotates it 90deg, and runs face detection.
   */
  const handleCaptureImmediate = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isDetecting) return;
    setIsDetecting(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // BOOTH OUTPUT SPEC: 1080x1920 Portrait
    const canvasWidth = 1080;
    const canvasHeight = 1920;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.save();
      // Rotation & Mirroring:
      // Translate to center -> Rotate 90deg -> Mirror horizontally (scale -1) -> Draw
      ctx.translate(canvasWidth / 2, canvasHeight / 2);
      ctx.rotate(Math.PI / 2);
      ctx.scale(-1, 1);

      const scale = Math.max(canvasHeight / video.videoWidth, canvasWidth / video.videoHeight);
      const drawWidth = video.videoWidth * scale;
      const drawHeight = video.videoHeight * scale;
      ctx.drawImage(video, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();

      const imageData = canvas.toDataURL('image/jpeg', 0.9);

      /**
       * FACE DETECTION logic
       * Note: If 'Snap a Memory' is selected, we bypass detection for "instant" feel.
       */
      let faceData: FaceDetectionResult = { maleCount: 0, femaleCount: 1, childCount: 0, totalPeople: 1 };
      if (era?.id !== EraId.SNAP_A_MEMORY) {
        console.log('[Capture] Running AI Detection...');
        faceData = await detectFaces(canvas, modelsLoaded);

        if (faceData.totalPeople === 0) {
          setDetectionError("No faces detected! Please stand in front of the camera.");
          setTimeout(() => setDetectionError(null), 3500);
          setIsDetecting(false);
          return;
        }
        if (faceData.totalPeople > 2) {
          setDetectionError("Too many people! This experience is optimized for 1-2 people.");
          setTimeout(() => setDetectionError(null), 3500);
          setIsDetecting(false);
          return;
        }
      }

      onCapture(imageData, faceData);
    }
    setIsDetecting(false);
  }, [era, modelsLoaded, onCapture, isDetecting]);

  /**
   * 3. COUNTDOWN ORCHESTRATION
   * Manages the 3... 2... 1... sequence and the visual flash.
   */
  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(prev => (prev !== null ? prev - 1 : null)), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setShowFlash(true); // Trigger white screen flash
      const captureTimer = setTimeout(() => {
        handleCaptureImmediate();
        setTimeout(() => { setShowFlash(false); setCountdown(null); }, 500);
      }, 50);
      return () => clearTimeout(captureTimer);
    }
  }, [countdown, handleCaptureImmediate]);

  const startCaptureSequence = () => {
    if (countdown !== null || isDetecting) return;
    setCountdown(3);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsDetecting(true);
    // ... file processing logic ...
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-900">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-slate-400">{error}</p>
        <button onClick={onBack} className="mt-8 px-8 py-3 bg-slate-800 text-white rounded-full">Go Back</button>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black relative flex flex-col">
      {/* 1. NATIVE VIDEO FEED (Displayed with CSS Rotation for UI Preview) */}
      <div className="absolute inset-0 z-0 overflow-hidden flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute transform rotate-[90deg] scale-x-[-1] object-cover"
          style={{ width: '100vh', height: '100vw', maxWidth: 'none' }}
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* 2. OVERLAYS (AI Loading, Countdown, Flash, Error Messages) */}
      {!modelsLoaded && !error && era?.id !== EraId.SNAP_A_MEMORY && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm">
          <RefreshCw className="w-12 h-12 text-yellow-500 animate-spin mb-4" />
          <p className="text-white text-lg font-bold brand-font tracking-wider uppercase">Initializing AI</p>
        </div>
      )}

      {countdown !== null && countdown > 0 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="relative w-64 h-64 flex items-center justify-center">
            <img src="./Countdown_Container.png" alt="" className="absolute inset-0 w-full h-full object-contain" />
            <span className="relative z-10 text-[9rem] font-bold text-white countdown-font">{countdown}</span>
          </div>
        </div>
      )}

      {showFlash && <div className="absolute inset-0 z-[100] bg-white animate-flash-out" />}

      {detectionError && (
        <div className="absolute inset-x-0 top-32 z-[150] flex justify-center px-6">
          <div className="bg-red-600/90 backdrop-blur-xl px-8 py-4 rounded-2xl flex items-center gap-4 text-white">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <span className="text-sm font-medium">{detectionError}</span>
          </div>
        </div>
      )}

      {/* 3. HEADER CONTROLS */}
      {!isProcessing && (
        <div className="absolute top-0 left-0 right-0 p-6 z-20 flex items-center">
          <button onClick={onBack} className="w-12 h-12 flex items-center justify-center bg-black/20 backdrop-blur-md rounded-full text-white">
            <ChevronLeft size={24} />
          </button>
        </div>
      )}

      {/* 4. FOOTER CONTROLS (Shutter, Upload) */}
      {!isProcessing && (
        <div className="absolute bottom-0 left-0 right-0 p-10 pb-16 z-20 flex justify-center items-center gap-8 bg-gradient-to-t from-black/80 to-transparent">
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-white/20 backdrop-blur-md rounded-full text-white">
            <Upload size={24} />
          </button>

          <button onClick={startCaptureSequence} disabled={isDetecting || countdown !== null} className="relative w-28 h-28 flex items-center justify-center">
            {!isDetecting && countdown === null && <div className="absolute inset-0 rounded-full border-[6px] border-white/30 animate-pulse-medium" />}
            <div className={`w-20 h-20 rounded-full border-[4px] border-white flex items-center justify-center bg-black/20 backdrop-blur-sm ${isDetecting ? 'opacity-50' : ''}`}>
              {isDetecting ? <RefreshCw className="w-8 h-8 text-white animate-spin" /> : <div className="w-16 h-16 bg-white rounded-full" />}
            </div>
          </button>
          
          <div className="w-[56px]" />
        </div>
      )}
    </div>
  );
};