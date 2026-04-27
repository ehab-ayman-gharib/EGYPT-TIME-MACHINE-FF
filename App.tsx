import React, { useState, useEffect, useCallback } from 'react';
import { AppScreen, EraData, FaceDetectionResult, EraId } from './types';
import { SplashScreen } from './components/SplashScreen';
import { CameraCapture } from './components/CameraCapture';
import { LoadingScreen } from './components/LoadingScreen';
import { ResultScreen } from './components/ResultScreen';
import { transformWithFaceFusion } from './services/faceFusionService';
import { applyEraStamp } from './services/stampService';
import { ScreenSaver } from './components/ScreenSaver';

const { ipcRenderer } = window.require('electron');
const CLOUDINARY_CLOUD_NAME = "dniredeim"; // Default based on project context, update if different
const IDLE_TIMEOUT = 120000; // 2 minutes

/**
 * Main Application Component
 * Manages the global state and screen navigation for the Egypt Time Machine Photobooth.
 */
const App: React.FC = () => {
  // Global State Management
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.SPLASH); // Tracks the active screen
  const [selectedEra, setSelectedEra] = useState<EraData | null>(null);            // Stores the user's chosen era
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);       // Holds the final processing result image
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');              // Stores the prompt used or generated description
  const [faceDetectionResult, setFaceDetectionResult] = useState<FaceDetectionResult | null>(null); // Details of user's detected face
  const [sessionKey, setSessionKey] = useState(0);                                 // Forces re-mounting of components on restart
  const [isMuted, setIsMuted] = useState(true);                                    // Global audio mute state
  const [isSyncing, setIsSyncing] = useState(false);                               // Tracks background sync status


  /**
   * Handles user selection of an era and transitions to the camera screen.
   * @param era The selected historical era context
   */
  const handleEraSelect = (era: EraData) => {
    setSelectedEra(era);
    setCurrentScreen(AppScreen.CAMERA);
    resetIdleTimer();
  };

  /**
   * Core logic for processing a captured photo.
   * Handles both "Snap a Memory" bypass and FaceFusion historical transformations.
   * @param imageSrc Base64 string of the captured frame
   * @param faceData Detection result containing face bounding box and landmarks
   */
  const handleCapture = useCallback(async (imageSrc: string, faceData: FaceDetectionResult) => {
    if (!selectedEra) return;

    setFaceDetectionResult(faceData);
    setCurrentScreen(AppScreen.PROCESSING);

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        console.log(`[Processing] Attempt ${attempts} / ${maxAttempts}...`);

        let resultImage: string;

        if (selectedEra.id === EraId.SNAP_A_MEMORY) {
          resultImage = imageSrc;
          setGeneratedPrompt('Snap a Memory (Instant)');
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          // Face Fusion 
          const result = await transformWithFaceFusion(imageSrc, selectedEra, faceData);
          resultImage = result.image;
          setGeneratedPrompt(result.prompt);
        }

        const stampedImage = await applyEraStamp(resultImage, selectedEra);

        setGeneratedImage(stampedImage);
        setCurrentScreen(AppScreen.RESULT);
        return;
      } catch (error: any) {
        console.error(`Attempt ${attempts} failed:`, error);

        // FATAL ERROR HANDLING: If genders mismatch or too many attempts fail, return to splash
        const isGenderMismatch = error.message?.includes('GENDER_MISMATCH');

        if (isGenderMismatch || attempts >= maxAttempts) {
          const errorMsg = isGenderMismatch
            ? "Mismatched characters detected in historical templates. Returning to start."
            : `AI engine encountered a persistent error: ${error.message || error}`;

          alert(errorMsg);
          handleRestart();
          return;
        } else {
          // Graceful retry for transient errors (connection, GPU fluke)
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
  }, [selectedEra]);

  /**
   * Resets the application state to start a new session.
   * Clears images, selections, and increments sessionKey to remount components.
   */
  const handleRestart = () => {
    setGeneratedImage(null);
    setGeneratedPrompt('');
    setSelectedEra(null);
    setFaceDetectionResult(null);
    setSessionKey(prev => prev + 1);
    setCurrentScreen(AppScreen.SPLASH);
  };

  /**
   * Allows the ResultScreen to update the generated image (e.g., if re-processed or modified).
   */
  const handleUpdateImage = (newImage: string) => {
    setGeneratedImage(newImage);
  };

  /**
   * Renders the appropriate component based on the currentScreen state value.
   */
  const renderScreen = () => {
    switch (currentScreen) {
      case AppScreen.SPLASH:
        return <SplashScreen onSelectEra={handleEraSelect} isMuted={isMuted} setIsMuted={setIsMuted} />;
      case AppScreen.CAMERA:
        return <CameraCapture era={selectedEra} onCapture={handleCapture} onBack={() => setCurrentScreen(AppScreen.SPLASH)} />;
      case AppScreen.PROCESSING:
        /**
         * While processing, we render the CameraCapture component again with isProcessing={true}.
         * This ensures the user continues to see their "frozen" capture rather than a blank screen.
         */
        return <CameraCapture era={selectedEra} onCapture={handleCapture} onBack={() => setCurrentScreen(AppScreen.SPLASH)} isProcessing={true} />;
      case AppScreen.RESULT:
        return (
          selectedEra && generatedImage ? (
            <ResultScreen
              imageSrc={generatedImage}
              prompt={generatedPrompt}
              era={selectedEra}
              faceData={faceDetectionResult}
              onRestart={handleRestart}
              onUpdateImage={handleUpdateImage}
            />
          ) : <LoadingScreen />
        );
      case AppScreen.SCREEN_SAVER:
        return <ScreenSaver onDismiss={() => setCurrentScreen(AppScreen.SPLASH)} />;
      default:
        return <SplashScreen onSelectEra={handleEraSelect} isMuted={isMuted} setIsMuted={setIsMuted} />;
    }
  };

  /**
   * Enables fullscreen mode on first interaction to create a kiosk-like experience.
   */
  const handleGlobalClick = () => {
    resetIdleTimer();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(`Error attempting to enable fullscreen: ${err.message}`);
      });
    }
  };

  /**
   * SCREEN SAVER & IDLE LOGIC
   */
  const resetIdleTimer = useCallback(() => {
    // Only reset if we are not in the screen saver
    if (currentScreen !== AppScreen.SCREEN_SAVER) {
      localStorage.setItem('last_activity', Date.now().toString());
    }
  }, [currentScreen]);

  useEffect(() => {
    const checkIdle = () => {
      if (currentScreen === AppScreen.SCREEN_SAVER) return;

      const lastActivity = parseInt(localStorage.getItem('last_activity') || '0');
      const now = Date.now();

      if (now - lastActivity > IDLE_TIMEOUT) {
        console.log('[Idle] Timeout reached. Starting Screen Saver...');
        setCurrentScreen(AppScreen.SCREEN_SAVER);
      }
    };

    const interval = setInterval(checkIdle, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [currentScreen]);

  /**
   * CLOUDINARY SYNC LOGIC
   * Syncs the local Screen-Saver folder with tagged images from Cloudinary.
   */
  useEffect(() => {
    const syncScreenSaver = async () => {
      try {
        console.log('[Cloudinary] Checking for screen saver updates...');

        // 1. Fetch tagged images list from Cloudinary
        // Note: The client-side list API must be enabled in Cloudinary settings
        const response = await fetch(`https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/list/Screen-Saver.json`);
        
        if (response.status === 401) {
          throw new Error('Unauthorized: Please enable "Resource List" in your Cloudinary Security settings.');
        }

        if (!response.ok) {
          throw new Error(`Cloudinary list API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const cloudinaryImages = data.resources || [];
        const cloudinaryCount = cloudinaryImages.length;

        // 2. Check local folder count
        const { count: localCount } = await ipcRenderer.invoke('get-screensaver-info');

        if (cloudinaryCount > 0) {
          setIsSyncing(true);
          
          const imageData = cloudinaryImages.map((img: any) => ({
            id: img.public_id,
            url: `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/v${img.version}/${img.public_id}.${img.format}`
          }));

          const result = await ipcRenderer.invoke('sync-screensaver-images', imageData);
          if (result.success) {
            console.log(`[Cloudinary] Differential sync complete. Total images: ${result.count}`);
          } else {
            console.warn('[Cloudinary] Sync completed with errors.');
          }
          setIsSyncing(false);
        } else {
          console.log('[Cloudinary] No images found with tag "Screen-Saver".');
        }
      } catch (err: any) {
        console.warn('[Cloudinary] Sync skipped:', err.message || err);
        // If it's a 401, we want the user to see it in the console clearly
        if (err.message && err.message.includes('Unauthorized')) {
          console.error('CRITICAL: Cloudinary "Resource List" is disabled. Images cannot sync automatically.');
        }
      }
    };

    syncScreenSaver();
  }, []);

  // Monitor all interactions to reset idle timer
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const handler = () => resetIdleTimer();

    events.forEach(event => window.addEventListener(event, handler));
    return () => events.forEach(event => window.removeEventListener(event, handler));
  }, [resetIdleTimer]);


  return (
    // Main Wrapper container ensuring full screen dimensions and dark mode defaults
    <div
      className="h-[100dvh] w-screen bg-slate-900 text-slate-100 flex flex-col overflow-hidden"
      onClick={handleGlobalClick}
    >
      <main className="flex-grow relative h-full w-full" key={sessionKey}>
        {renderScreen()}
        {/* Render LoadingScreen when currentScreen is PROCESSING */}
        {currentScreen === AppScreen.PROCESSING && <LoadingScreen />}
      </main>
    </div>
  );
};

export default App;