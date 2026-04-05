import React, { useState, useEffect, useCallback } from 'react';
import { AppScreen, EraData, FaceDetectionResult, EraId } from './types';
import { SplashScreen } from './components/SplashScreen';
import { CameraCapture } from './components/CameraCapture';
import { LoadingScreen } from './components/LoadingScreen';
import { ResultScreen } from './components/ResultScreen';
import { transformWithFaceFusion } from './services/faceFusionService';
import { applyEraStamp } from './services/stampService';

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


  /**
   * Handles user selection of an era and transitions to the camera screen.
   * @param era The selected historical era context
   */
  const handleEraSelect = (era: EraData) => {
    setSelectedEra(era);
    setCurrentScreen(AppScreen.CAMERA);
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
        
        if (attempts >= maxAttempts) {
          alert(`Processing Error: ${error.message || error}`);
        } else {
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
      default:
        return <SplashScreen onSelectEra={handleEraSelect} isMuted={isMuted} setIsMuted={setIsMuted} />;
    }
  };

  /**
   * Enables fullscreen mode on first interaction to create a kiosk-like experience.
   */
  const handleGlobalClick = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(`Error attempting to enable fullscreen: ${err.message}`);
      });
    }
  };

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