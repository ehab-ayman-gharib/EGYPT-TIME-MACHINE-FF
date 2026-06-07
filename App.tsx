import React, { useState, useEffect, useCallback } from 'react';
import { AppScreen, EraData, FaceDetectionResult, EraId } from './types';
import { SplashScreen } from './components/SplashScreen';
import { CameraCapture } from './components/CameraCapture';
import { LoadingScreen } from './components/LoadingScreen';
import { ResultScreen } from './components/ResultScreen';
import { transformWithFaceFusion } from './services/faceFusionService';
import { applyEraStamp } from './services/stampService';
import { FeaturedGallery } from './components/FeaturedGallery';

const { ipcRenderer } = window.require('electron');
const CLOUDINARY_CLOUD_NAME = "dniredeim"; // Default based on project context, update if different
const IDLE_TIMEOUT = 30000; // 30 seconds

/**
 * Main Application Component
 * Manages the global state and screen navigation for the Egypt Time Machine Photobooth.
 */
const App: React.FC = () => {
  // Global State Management
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.SCREEN_SAVER); // Tracks the active screen
  const [selectedEra, setSelectedEra] = useState<EraData | null>(null);            // Stores the user's chosen era
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);       // Holds the final processing result image
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');              // Stores the prompt used or generated description
  const [faceDetectionResult, setFaceDetectionResult] = useState<FaceDetectionResult | null>(null); // Details of user's detected face
  const [sessionKey, setSessionKey] = useState(0);                                 // Forces re-mounting of components on restart
  const [isMuted, setIsMuted] = useState(true);                                    // Global audio mute state
  const [isSyncing, setIsSyncing] = useState(false);                               // Tracks background sync status
  const [isKioskMode, setIsKioskMode] = useState<boolean>(true);                   // Tracks if kiosk mode is active


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
        return (
          <FeaturedGallery 
            onDismiss={() => {
              setIsMuted(false);
              setCurrentScreen(AppScreen.SPLASH);
            }} 
          />
        );
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
    localStorage.setItem('last_activity', Date.now().toString());
  }, []);

  useEffect(() => {
    const checkIdle = () => {
      // Only count down for screensaver if on Splash or Camera screens
      if (currentScreen !== AppScreen.SPLASH && currentScreen !== AppScreen.CAMERA) {
        // Keep updating last activity while on other screens to prevent immediate trigger when leaving
        localStorage.setItem('last_activity', Date.now().toString());
        return;
      }

      const lastActivity = parseInt(localStorage.getItem('last_activity') || '0');
      const now = Date.now();

      if (now - lastActivity > IDLE_TIMEOUT) {
        console.log('[Idle] Timeout reached. Starting Screen Saver...');
        setCurrentScreen(AppScreen.SCREEN_SAVER);
      }
    };

    const interval = setInterval(checkIdle, 1000); // Check every 1s for better precision
    return () => clearInterval(interval);
  }, [currentScreen]);

const CLOUDINARY_PROJECT_FOLDER = "kemet-mirror"; // Cloudinary folder name



  // Fetch kiosk status on boot
  useEffect(() => {
    const checkKiosk = async () => {
      try {
        const status = await ipcRenderer.invoke('get-kiosk-status');
        setIsKioskMode(status);
        console.log('[Kiosk] Resolved kiosk state on boot:', status);
      } catch (err) {
        console.error('[Kiosk] Failed to resolve kiosk state:', err);
      }
    };
    checkKiosk();
  }, []);

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      console.log('[Manual Sync] Requesting Cloudinary Sync...');
      
      // 1. Sync Featured Assets
      console.log(`[Manual Sync] Syncing featured assets...`);
      const featuredResponse = await fetch(`https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/list/Featured.json`);
      if (featuredResponse.ok) {
        const data = await featuredResponse.json();
        const allResources = data.resources || [];
        const projectImages = allResources.filter((img: any) => 
          img.public_id.startsWith(`${CLOUDINARY_PROJECT_FOLDER}/`)
        );
        const imageData = projectImages.map((img: any) => ({
          id: img.public_id,
          url: `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/v${img.version}/${img.public_id}.${img.format}`
        }));
        await ipcRenderer.invoke('sync-featured-images', imageData);
      } else {
        throw new Error('Cloudinary Featured.json list endpoint returned non-OK status');
      }

      // 2. Sync Templates
      console.log(`[Manual Sync] Syncing templates...`);
      const folder = `${CLOUDINARY_PROJECT_FOLDER}/Templates`;
      const templatesResult = await ipcRenderer.invoke('list-remote-templates', { folder });
      if (templatesResult.success) {
        const allResources = templatesResult.resources || [];
        const projectTemplates = allResources.map((img: any) => {
          const folder = img.asset_folder || '';
          const rawFilename = img.public_id;
          const filename = rawFilename.replace(/_[a-z0-9]{6}$/i, '');
          const prefix = `${CLOUDINARY_PROJECT_FOLDER}/Templates/`;
          let relativeFolder = folder;
          if (folder.startsWith(prefix)) {
            relativeFolder = folder.substring(prefix.length);
          } else if (folder.includes('/Templates/')) {
            const idx = folder.toLowerCase().indexOf('/templates/');
            relativeFolder = folder.substring(idx + 11);
          }
          return {
            id: img.public_id,
            url: img.secure_url || img.url,
            relativePath: relativeFolder 
              ? `${relativeFolder}/${filename}.${img.format}`
              : `${filename}.${img.format}`
          };
        }).filter(Boolean);
        if (projectTemplates.length > 0) {
          await ipcRenderer.invoke('sync-templates', projectTemplates);
        }
      } else {
        throw new Error(templatesResult.error || 'Failed to fetch remote templates list');
      }

      alert('Sync completed successfully!');
    } catch (err: any) {
      console.error('[Manual Sync] Error occurred:', err);
      alert(`Sync failed: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Initialize idle timer on mount to prevent immediate Featured screen trigger
  useEffect(() => {
    localStorage.setItem('last_activity', Date.now().toString());
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
      className="h-[100dvh] w-screen bg-slate-900 text-slate-100 flex flex-col overflow-hidden relative"
      onClick={handleGlobalClick}
    >
      {!isKioskMode && (
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className="fixed top-4 right-4 z-[99999] px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-400 text-black font-black uppercase tracking-wider rounded-2xl shadow-[0_10px_30px_rgba(245,158,11,0.3)] border border-amber-300/30 flex items-center gap-2 text-sm transition-all active:scale-95"
        >
          {isSyncing ? 'Syncing...' : 'Sync Cloud Images'}
        </button>
      )}
      <main className="flex-grow relative h-full w-full" key={sessionKey}>
        {renderScreen()}
        {/* Render LoadingScreen when currentScreen is PROCESSING */}
        {currentScreen === AppScreen.PROCESSING && <LoadingScreen />}
      </main>
    </div>
  );
};

export default App;