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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const loaded = await loadFaceApiModels();
        setModelsLoaded(loaded);

        // Booth setup: Camera is physically rotated 90 degrees.
        // We request landscape resolution and rotate it in code.
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        setError("Camera access denied or unavailable.");
        console.error(err);
      }
    };
    init();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCaptureImmediate = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isDetecting) return;
    setIsDetecting(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Final Booth Output: 1080x1920 Portrait
    const canvasWidth = 1080;
    const canvasHeight = 1920;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();

      // Booth setup: Camera is landscape and rotated 90 deg (Clockwise)
      // 1. Center the coordinate system
      ctx.translate(canvasWidth / 2, canvasHeight / 2);

      // 2. Rotate 90 degree and Mirror
      // Based on feedback, 90 deg is upright. We scale horizontally to mirror.
      ctx.rotate(Math.PI / 2);
      ctx.scale(-1, 1);

      // 3. Calculate scale to cover 1080x1920
      // Since rotated, video.width maps to canvas height (1920)
      const scale = Math.max(canvasHeight / video.videoWidth, canvasWidth / video.videoHeight);
      const drawWidth = video.videoWidth * scale;
      const drawHeight = video.videoHeight * scale;

      // 4. DrawCentered
      ctx.drawImage(video, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

      ctx.restore();

      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      
      // STRICT BYPASS: No detection for Snap a Memory
      let faceData: FaceDetectionResult = { maleCount: 0, femaleCount: 1, childCount: 0, totalPeople: 1 };
      if (era?.id !== EraId.SNAP_A_MEMORY) {
        console.log('[Capture] Detection triggered for historical era');
        faceData = await detectFaces(canvas, modelsLoaded);

        // UI Feedback: No faces detected
        if (faceData.totalPeople === 0) {
          setDetectionError("No faces detected! Please ensure you are clearly visible.");
          setTimeout(() => setDetectionError(null), 3500);
          setIsDetecting(false);
          return;
        }

        // UI Feedback: Too many people (Limit to 2)
        if (faceData.totalPeople > 2) {
          setDetectionError("Too many faces! Maximum 2 people allowed for this era.");
          setTimeout(() => setDetectionError(null), 3500);
          setIsDetecting(false);
          return;
        }
      } else {
        console.log('[Capture] STRICT BYPASS: Skipping detection for Snap a Memory');
      }

      onCapture(imageData, faceData);
    }
    setIsDetecting(false);
  }, [era, modelsLoaded, onCapture, isDetecting]);

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsDetecting(true);

    // Create an image element to read the file
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = async () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;

      // Only apply 9:16 cropping for Snap a Memory mode
      // For AI modes, keep original aspect ratio (Gemini will output 9:16 anyway)
      const shouldCropTo916 = era?.id === EraId.SNAP_A_MEMORY;

      if (shouldCropTo916) {
        // Force 9:16 aspect ratio for Snap a Memory mode
        const targetAspectRatio = 9 / 16; // Portrait (width/height)
        const imgAspectRatio = img.width / img.height;

        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = img.width;
        let sourceHeight = img.height;

        // Crop to 9:16 if needed
        if (imgAspectRatio > targetAspectRatio) {
          // Image is wider than 9:16, crop the sides
          sourceWidth = img.height * targetAspectRatio;
          sourceX = (img.width - sourceWidth) / 2;
        } else if (imgAspectRatio < targetAspectRatio) {
          // Image is taller than 9:16, crop top/bottom
          sourceHeight = img.width / targetAspectRatio;
          sourceY = (img.height - sourceHeight) / 2;
        }

        // Set canvas to 9:16 aspect ratio (1080x1920)
        const canvasWidth = 1080;
        const canvasHeight = 1920;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          // Draw the cropped image to canvas at 9:16 ratio
          ctx.drawImage(
            img,
            sourceX, sourceY, sourceWidth, sourceHeight,  // Source crop
            0, 0, canvasWidth, canvasHeight               // Destination
          );
          const imageData = canvas.toDataURL('image/jpeg', 0.9);
          
          // STRICT BYPASS: No detection for Snap a Memory file uploads
          let faceData: FaceDetectionResult = { maleCount: 0, femaleCount: 1, childCount: 0, totalPeople: 1 };
          if (era?.id !== EraId.SNAP_A_MEMORY) {
            faceData = await detectFaces(img, modelsLoaded);

            if (faceData.totalPeople === 0) {
              setDetectionError("No faces detected in file!");
              setTimeout(() => setDetectionError(null), 3500);
              setIsDetecting(false);
              return;
            }
            if (faceData.totalPeople > 2) {
              setDetectionError("Too many faces in file! Max 2 allowed.");
              setTimeout(() => setDetectionError(null), 3500);
              setIsDetecting(false);
              return;
            }
          }
          
          onCapture(imageData, faceData);
        }
      } else {
        // For AI modes: Keep original aspect ratio, but limit size
        const MAX_DIMENSION = 1500;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const imageData = canvas.toDataURL('image/jpeg', 0.9);
          const faceData = await detectFaces(img, modelsLoaded);
          
          if (faceData.totalPeople === 0) {
            setDetectionError("No faces detected in file!");
            setTimeout(() => setDetectionError(null), 3500);
            setIsDetecting(false);
            return;
          }
          if (faceData.totalPeople > 2) {
            setDetectionError("Too many faces in file! Max 2 allowed.");
            setTimeout(() => setDetectionError(null), 3500);
            setIsDetecting(false);
            return;
          }

          onCapture(imageData, faceData);
        }
      }
      setIsDetecting(false);
      if (event.target) event.target.value = ''; // Reset input
    };
  };

  // Store capture handler in ref to avoid effect dependency issues
  const captureRef = useRef(handleCaptureImmediate);
  useEffect(() => {
    captureRef.current = handleCaptureImmediate;
  }, [handleCaptureImmediate]);

  // Handle countdown logic
  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => (prev !== null ? prev - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      // Trigger Flash
      setShowFlash(true);

      const captureTimer = setTimeout(() => {
        captureRef.current?.();

        // Cleanup flash and countdown
        setTimeout(() => {
          setShowFlash(false);
          setCountdown(null);
        }, 500);
      }, 50);
      return () => clearTimeout(captureTimer);
    }
  }, [countdown]);

  const startCaptureSequence = () => {
    if (countdown !== null || isDetecting) return;
    setCountdown(3);
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
      {/* Video Feed - Full Screen Portrait with Booth Rotation */}
      <div className="absolute inset-0 z-0 overflow-hidden flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute transform rotate-[90deg] scale-x-[-1] object-cover"
          style={{
            width: '100vh',
            height: '100vw',
            maxWidth: 'none'
          }}
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>



      {/* Model Loading Overlay - Only if detection is needed */}
      {!modelsLoaded && !error && era?.id !== EraId.SNAP_A_MEMORY && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <RefreshCw className="w-12 h-12 text-yellow-500 animate-spin mb-4" />
          <p className="text-white text-lg font-bold brand-font tracking-wider">INITIALIZING AI</p>
          <p className="text-slate-300 text-xs mt-2 font-mono">Loading neural networks...</p>
        </div>
      )}

      {/* Countdown Overlay - Using Custom Container */}
      {countdown !== null && countdown > 0 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 pointer-events-none">
          <div className="relative w-48 h-48 md:w-64 md:h-64 flex items-center justify-center animate-pulse-slow">
            {/* Background Container Image */}
            <img
              src="./Countdown_Container.png"
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
            />

            {/* Countdown Text with Custom Font */}
            <span className="relative z-10 text-7xl md:text-[9rem] font-bold text-white countdown-font drop-shadow-[0_0_20px_rgba(234,179,8,0.4)]">
              {countdown}
            </span>
          </div>
        </div>
      )}

      {/* Flash Effect */}
      {showFlash && (
        <div className="absolute inset-0 z-[100] bg-white animate-flash-out pointer-events-none" />
      )}

      {/* Detection Error UI Message */}
      {detectionError && (
        <div className="absolute inset-x-0 top-32 z-[150] flex justify-center px-6 animate-slide-up">
          <div className="bg-red-600/90 backdrop-blur-xl border border-red-400/50 px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 text-white">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <div className="flex flex-col">
              <span className="font-bold brand-font tracking-widest text-sm uppercase">Notice</span>
              <span className="text-white/90 text-sm font-medium">{detectionError}</span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      {!isProcessing && (
        <div className="absolute top-0 left-0 right-0 p-6 z-20 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
          <button
            onClick={onBack}
            className="w-12 h-12 flex items-center justify-center bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>

          {/* Empty spacer for flex alignment */}
          <div className="w-12" />
        </div>
      )}

      {/* Footer Controls */}
      {!isProcessing && (
        <div className="absolute bottom-0 left-0 right-0 p-10 pb-16 z-20 flex justify-center items-center gap-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          {/* Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={handleFileUpload}
            disabled={isDetecting || countdown !== null}
            className="p-4 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-colors disabled:opacity-50"
          >
            <Upload size={24} />
          </button>

          {/* Capture Button */}
          <button
            onClick={startCaptureSequence}
            disabled={isDetecting || countdown !== null}
            className="group relative w-28 h-28 flex items-center justify-center focus:outline-none"
          >
            {/* Idle Pulse Ring - Only visible when idle */}
            {!isDetecting && countdown === null && (
              <div className="absolute inset-0 rounded-full border-[6px] border-white/30 animate-pulse-medium"></div>
            )}

            {/* Main Button Construction */}
            <div className={`
            relative w-20 h-20 rounded-full border-[4px] flex items-center justify-center transition-all duration-300 z-10 bg-black/20 backdrop-blur-sm
            ${isDetecting
                ? 'border-slate-500 scale-95'
                : countdown !== null
                  ? 'border-white scale-100' // Static during countdown
                  : 'border-white group-hover:scale-105 group-active:scale-95' // Interactive idle
              }
          `}>
              {/* Inner Shutter Circle */}
              <div className={`
               rounded-full transition-all duration-300 shadow-sm
               ${isDetecting
                  ? 'w-2 h-2 bg-slate-500 opacity-0'
                  : 'w-16 h-16 bg-white' // Simple white circle always
                }
             `}></div>

              {/* Spinner Overlay */}
              {isDetecting && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>
          </button>

          {/* Placeholder for symmetry */}
          <div className="w-[56px]"></div>
        </div>
      )}
    </div>
  );
};