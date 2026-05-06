/**
 * SPLASH SCREEN COMPONENT
 * -----------------------
 * The entry point for users. It features:
 * 1. An "Idle State" (Atraction Loop) to draw people in.
 * 2. An "Interaction Trigger" (Tap to Start).
 * 3. A "Welcome Phase" with an introduction video.
 * 4. An "Era Selection" menu to choose the historical context.
 * 5. A Three.js particle system for magical visual effects.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EraData, EraId } from '../types';
import { ERAS } from '../constants';
import { Camera } from 'lucide-react';

const { ipcRenderer } = window.require('electron');
const WELCOME_VIDEO_URL = 'https://res.cloudinary.com/dniredeim/video/upload/v1778078166/isis_talk_2_emjmhw.mp4';


interface SplashScreenProps {
  onSelectEra: (era: EraData) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onSelectEra, isMuted, setIsMuted }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isExiting, setIsExiting] = useState(false);     // Triggers the wash-out animation
  const [hasStarted, setHasStarted] = useState(true);   // Starts directly in welcome phase
  const [videoSrc, setVideoSrc] = useState(WELCOME_VIDEO_URL);
  const [pendingVideoSrc, setPendingVideoSrc] = useState<string | null>(null);




  const isExitingRef = useRef(false);

  /**
   * AUDIO & FULLSCREEN UNLOCK
   * Browsers block autoplay with sound. This function is called on the first user tap
   * to unlock audio and ensure the app is in kiosk-style fullscreen.
   */
  const unmuteVideo = () => {
    if (videoRef.current && isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(`[Fullscreen] Error: ${err.message}`);
      });
    }
  };

  const handleStartInteraction = () => {
    if (!hasStarted) {
      setHasStarted(true);
      unmuteVideo();
    }
  };

  const handleEraClick = (era: EraData) => {
    if (isExiting) return;
    unmuteVideo();

    setIsExiting(true);
    isExitingRef.current = true;
    
    // Allow time for the CSS transition (1.8s) before moving to the next component
    setTimeout(() => {
      onSelectEra(era);
    }, 1800);
  };

  /**
   * Handle the end of a video loop.
   * If a cached version is pending, we swap it now to avoid glitches.
   */
  const handleVideoEnded = () => {
    if (pendingVideoSrc) {
      console.log("[SplashScreen] Swapping to cached video source");
      setVideoSrc(pendingVideoSrc);
      setPendingVideoSrc(null);
    }
  };


  /**
   * CACHE REMOTE ASSETS
   */
  useEffect(() => {
    const cacheAssets = async () => {
      try {
        const cachedPath = await ipcRenderer.invoke('get-cached-video', WELCOME_VIDEO_URL);
        if (cachedPath) {
          const safePath = cachedPath.startsWith('http') ? cachedPath : `file:///${cachedPath.replace(/\\/g, '/')}`;
          
          // Only queue if it's actually a different source (e.g. switching from remote to local)
          if (safePath !== videoSrc) {
            setPendingVideoSrc(safePath);
          }
        }
      } catch (err) {
        console.error("[SplashScreen] Caching error:", err);
      }
    };
    cacheAssets();
  }, []);


  /**
   * THREE.JS BACKGROUND EFFECTS

   * Renders a 3D particle field that reacts to the exit state.
   */
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Particle Generation
    const particlesGeo = new THREE.BufferGeometry();
    const particleCount = 400; 
    const posArray = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 30;
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    // Dynamic Glow Texture for bits
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255, 215, 0, 1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
    }
    const particleTexture = new THREE.Texture(canvas);
    particleTexture.needsUpdate = true;

    const particlesMat = new THREE.PointsMaterial({
      size: 0.1,
      map: particleTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: 0xffd700
    });

    const particleSystem = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particleSystem);

    let animationId: number;
    let time = 0;

    /**
     * MAIN RENDERING LOOP
     * Animates particle rotation and exit zoom.
     */
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      time += 0.01;

      const isExitingNow = isExitingRef.current;
      particleSystem.rotation.y = time * 0.05;
      particleSystem.rotation.x = time * 0.02;

      if (isExitingNow) {
        // Zoom into the light on transition
        particlesMat.opacity -= 0.02;
        camera.position.z -= 0.1;
      } else {
        // Subtle drift for idle state
        camera.position.x = Math.sin(time * 0.2) * 0.5;
        camera.position.y = Math.cos(time * 0.1) * 0.5;
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (mountRef.current) mountRef.current.innerHTML = '';
      renderer.dispose();
      particlesGeo.dispose();
      particlesMat.dispose();
    };
  }, []);

  return (
    <div
      className="h-full w-full relative overflow-hidden bg-black"
      onClick={handleStartInteraction}
    >
      {/* 1. BACKGROUND VIDEO LAYER - Switches between Idle Loop and Welcome Greeting */}
      <div
        className={`absolute inset-0 transition-all duration-[1800ms] ease-in-out ${isExiting ? 'opacity-0 scale-110 blur-2xl' : 'opacity-100 scale-100'}`}
      >
        <video
          key={videoSrc}
          ref={videoRef}
          autoPlay
          // If we have a pending cached video, disable native loop so we can catch 'onEnded' and swap
          loop={!pendingVideoSrc}
          onEnded={handleVideoEnded}
          muted={isMuted}
          playsInline
          className="w-full h-full object-cover"
          src={videoSrc}
        />

      </div>

      {/* TOP LOGO/TITLE */}
      <div 
        className={`absolute top-12 left-1/2 -translate-x-1/2 z-50 w-[450px] pointer-events-none transition-all duration-[1000ms] ease-in-out ${
          isExiting ? 'opacity-0 -translate-y-10' : 'opacity-100'
        }`}
      >
        <img 
          src="./Photobooth-Title.png" 
          alt="Photobooth" 
          className="w-full h-auto drop-shadow-[0_0_30px_rgba(0,0,0,0.6)]" 
        />
      </div>

      {/* 2. OVERLAY HINTS - "Tap to Start" visible only in Idle State */}
      {!hasStarted && !isExiting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 pointer-events-none">
          <div className="flex flex-col items-center gap-6 animate-pulse">
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
              <div className="relative border-2 border-yellow-500/50 py-4 px-12 rounded-full bg-black/40 backdrop-blur-md">
                <span className="text-yellow-500 text-3xl font-bold uppercase tracking-[0.5em] whitespace-nowrap">
                  Tap to Start
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ERA SELECTION FOOTER - Appears after "Tap to Start" */}
      <div
        className={`absolute bottom-0 left-0 w-full z-10 transition-all duration-[2200ms] ease-in-out ${isExiting
          ? 'opacity-0 translate-y-10'
          : hasStarted
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-20 pointer-events-none'
          }`}
      >
        <div className="relative flex flex-col items-center justify-end w-full pb-8">
          <div className="flex justify-center items-end gap-1 md:gap-4 mb-6 px-2 w-full max-w-7xl">
            {ERAS.map((era) => (
              <div
                key={era.id}
                className="flex flex-col items-center gap-1 group cursor-pointer transition-transform hover:scale-105 active:scale-95"
                onClick={() => handleEraClick(era)}
              >
                <div className="relative w-[18.5vw] h-[31vw] md:w-40 md:h-64 flex items-center justify-center">
                  <div className="w-full h-full flex items-center justify-center relative">
                    <img
                      src={era.previewImage}
                      alt={era.name}
                      className="w-full h-full object-contain group-hover:scale-110 transition-all duration-700 ease-in-out"
                    />
                    {era.id === EraId.SNAP_A_MEMORY && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <Camera className="w-8 h-8 md:w-12 md:h-12 text-yellow-500" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Branding Overlay */}
          <div className="absolute bottom-0 left-0 w-full pointer-events-none -z-10">
            <img src="./Splash-Screen/Splash-Footer.png" alt="" className="w-full h-auto object-contain" />
          </div>

          <div className="mb-4">
            <span className="text-white text-sm uppercase tracking-[0.4em] font-light animate-pulse">Choose your era</span>
          </div>
        </div>
      </div>

      {/* 4. THREE.JS PARTICLES LAYER */}
      <div ref={mountRef} className="absolute inset-0 z-[5] pointer-events-none" />
    </div>
  );
};