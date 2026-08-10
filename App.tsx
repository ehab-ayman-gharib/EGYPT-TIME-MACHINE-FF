import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppScreen, EraData, FaceDetectionResult, EraId } from './types';
import { SplashScreen } from './components/SplashScreen';
import { CameraCapture } from './components/CameraCapture';
import { LoadingScreen } from './components/LoadingScreen';
import { ResultScreen } from './components/ResultScreen';
import { transformWithFaceFusion } from './services/faceFusionService';
import { applyEraStamp } from './services/stampService';
import { FeaturedGallery } from './components/FeaturedGallery';
import { Settings, Lock, Unlock, X, KeyRound, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import Keyboard from 'react-simple-keyboard';
import 'simple-keyboard/build/css/index.css';

import { incrementGeneratedCount } from './services/dashboardService';

const getIpcRenderer = () => {
  if (typeof window !== 'undefined' && (window as any).require) {
    try {
      return (window as any).require('electron').ipcRenderer;
    } catch (e) {
      return null;
    }
  }
  return null;
};

const IDLE_TIMEOUT = 30000; // 30 seconds

const keyboardLayout = {
  default: [
    '` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
    '{tab} q w e r t y u i o p [ ] \\',
    '{lock} a s d f g h j k l ; \' {enter}',
    '{shift} z x c v b n m , . / {shift}',
    '@ {space}'
  ],
  shift: [
    '~ ! @ # $ % ^ & * ( ) _ + {bksp}',
    '{tab} Q W E R T Y U I O P { } |',
    '{lock} A S D F G H J K L : " {enter}',
    '{shift} Z X C V B N M < > ? {shift}',
    '@ {space}'
  ]
};

const keyboardDisplay = {
  '{bksp}': '⌫',
  '{enter}': '↵ enter',
  '{shift}': '⇧ shift',
  '{lock}': 'caps lock',
  '{tab}': 'tab',
  '{space}': 'space'
};

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
  const [isKioskMode, setIsKioskMode] = useState<boolean>(true);                   // Tracks if kiosk mode is active

  // Kiosk Settings Modal State & Keyboard State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardLayoutName, setKeyboardLayoutName] = useState('default');
  const keyboardRef = useRef<any>(null);

  /**
   * Closes the settings modal and resets input & virtual keyboard state.
   */
  const closeSettingsModal = () => {
    setIsSettingsOpen(false);
    setPasswordInput('');
    setPasswordError(null);
    setShowKeyboard(false);
    if (keyboardRef.current) {
      keyboardRef.current.setInput('');
    }
  };

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

        // Increment dashboard analytics counter for all successful app generations (Gemini, FaceFusion, Snap a Memory)
        incrementGeneratedCount();

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
   * Validates admin password and toggles kiosk mode.
   */
  const handleKioskPasswordSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (passwordInput !== 'airport@12345') {
      setPasswordError('Incorrect password. Access denied.');
      return;
    }

    setPasswordError(null);

    const ipc = getIpcRenderer();
    let newKioskState = !isKioskMode;

    if (ipc) {
      try {
        const res = await ipc.invoke('toggle-kiosk');
        if (res && typeof res.isKioskModeActive === 'boolean') {
          newKioskState = res.isKioskModeActive;
        }
      } catch (err) {
        console.error('[Kiosk] Failed to toggle kiosk via IPC:', err);
      }
    }

    setIsKioskMode(newKioskState);
    closeSettingsModal();
  };

  /**
   * Syncs text input changes with virtual keyboard instance.
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPasswordInput(val);
    if (passwordError) setPasswordError(null);
    if (keyboardRef.current) {
      keyboardRef.current.setInput(val);
    }
  };

  /**
   * Updates input state when typing on virtual keyboard.
   */
  const handleKeyboardChange = (input: string) => {
    setPasswordInput(input);
    if (passwordError) setPasswordError(null);
  };

  /**
   * Handles special key presses from virtual keyboard (Shift, Lock, Enter).
   */
  const handleKeyPress = (button: string) => {
    if (button === '{shift}' || button === '{lock}') {
      setKeyboardLayoutName(prev => (prev === 'default' ? 'shift' : 'default'));
    }
    if (button === '{enter}') {
      handleKioskPasswordSubmit();
    }
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

  // Fetch kiosk status on boot
  useEffect(() => {
    const checkKiosk = async () => {
      const ipc = getIpcRenderer();
      if (!ipc) return;
      try {
        const status = await ipc.invoke('get-kiosk-status');
        setIsKioskMode(status);
        console.log('[Kiosk] Resolved kiosk state on boot:', status);
      } catch (err) {
        console.error('[Kiosk] Failed to resolve kiosk state:', err);
      }
    };
    checkKiosk();
  }, []);

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
      {/* SETTINGS GEAR BUTTON (Top-Right on all screens) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsSettingsOpen(true);
          setPasswordInput('');
          setPasswordError(null);
          setShowKeyboard(false);
        }}
        className="fixed top-6 right-6 z-[9999] p-3 rounded-full bg-slate-900/80 hover:bg-amber-600/90 border border-slate-700/80 hover:border-amber-500/60 text-slate-300 hover:text-white backdrop-blur-md shadow-2xl transition-all duration-300 group hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center"
        title="Kiosk Settings"
        aria-label="Kiosk Settings"
      >
        <Settings className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500 text-amber-400 group-hover:text-white" />
      </button>

      {/* PASSWORD MODAL FOR KIOSK LOCK/UNLOCK */}
      {isSettingsOpen && (
        <div 
          className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
            closeSettingsModal();
          }}
        >
          <div 
            className="bg-slate-900 border border-amber-500/30 rounded-3xl p-8 max-w-lg w-full shadow-[0_0_60px_rgba(0,0,0,0.9)] relative text-slate-100 flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeSettingsModal}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-wide">Kiosk Security</h3>
                  <p className="text-xs text-slate-400">Manage application screen lock</p>
                </div>
              </div>

              {/* Status Badge */}
              <div className={`mt-3 px-4 py-2.5 rounded-xl border flex items-center gap-3 text-xs font-semibold ${
                isKioskMode 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>
                {isKioskMode ? <Lock className="w-4 h-4 shrink-0" /> : <Unlock className="w-4 h-4 shrink-0" />}
                <span>Current Status: {isKioskMode ? 'Kiosk Mode LOCKED (Fullscreen Guard)' : 'Kiosk Mode UNLOCKED (Windowed Mode)'}</span>
              </div>
            </div>

            {/* Password Form */}
            <form onSubmit={handleKioskPasswordSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-slate-300 tracking-wide uppercase">
                  Admin Password Required
                </label>
                <div className="relative flex items-center">
                  <KeyRound className="absolute left-4 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={handleInputChange}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowKeyboard(true);
                    }}
                    onFocus={() => setShowKeyboard(true)}
                    placeholder="Click to type password"
                    className="w-full bg-slate-950/90 border border-slate-700 focus:border-amber-500 rounded-xl py-3 pl-11 pr-12 text-white placeholder-slate-500 outline-none transition-all text-sm font-mono cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {passwordError && (
                  <p className="text-xs text-rose-400 font-medium flex items-center gap-1.5 mt-1">
                    <span>⚠️</span> {passwordError}
                  </p>
                )}
              </div>

              {/* On-Screen Virtual Keyboard */}
              {showKeyboard && (
                <div 
                  className="mt-1 animate-in fade-in slide-in-from-bottom-2 duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Keyboard
                    keyboardRef={(r) => (keyboardRef.current = r)}
                    layoutName={keyboardLayoutName}
                    layout={keyboardLayout}
                    display={keyboardDisplay}
                    onChange={handleKeyboardChange}
                    onKeyPress={handleKeyPress}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeSettingsModal}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm text-slate-950 transition-all shadow-lg flex items-center justify-center gap-2 ${
                    isKioskMode 
                      ? 'bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300' 
                      : 'bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300'
                  }`}
                >
                  {isKioskMode ? (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>Unlock Kiosk</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Lock Kiosk</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
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