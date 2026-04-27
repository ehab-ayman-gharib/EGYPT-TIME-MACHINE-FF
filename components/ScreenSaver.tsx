import React, { useState, useEffect } from 'react';

interface ScreenSaverProps {
  onDismiss: () => void;
}

const { ipcRenderer } = window.require('electron');

export const ScreenSaver: React.FC<ScreenSaverProps> = ({ onDismiss }) => {
  const [images, setImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const loadImages = async () => {
      const { files } = await ipcRenderer.invoke('get-screensaver-info');
      if (files && files.length > 0) {
        // Shuffle images
        const shuffled = [...files].sort(() => Math.random() - 0.5);
        // We need to convert absolute paths to something the browser can load.
        // In Electron, we can use file:// protocol if webSecurity is disabled, 
        // or just read the file as base64. 
        // For simplicity, let's assume they can be loaded if we provide the right path.
        // Actually, the best way in Electron is to use a custom protocol or convert to data URL.
        // Since we want random photos, let's just pick one and convert to data URL if needed.
        setImages(shuffled);
      }
    };

    loadImages();

    // Global listeners to dismiss
    const handleInteraction = () => onDismiss();
    window.addEventListener('mousedown', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);

    return () => {
      window.removeEventListener('mousedown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [onDismiss]);

  useEffect(() => {
    if (images.length === 0) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 10000); // Change image every 10 seconds

    return () => clearInterval(interval);
  }, [images]);

  if (images.length === 0) {
    return (
      <div 
        className="fixed inset-0 z-[9999] bg-black flex items-center justify-center cursor-none"
        onClick={onDismiss}
      >
        <div className="text-white/20 text-4xl font-light tracking-widest uppercase">
          Egypt Time Machine
        </div>
      </div>
    );
  }

  const currentImagePath = images[currentImageIndex];
  // In Electron, absolute paths need 'file://' or conversion
  // Note: windows paths need careful handling
  const safePath = currentImagePath.startsWith('http') 
    ? currentImagePath 
    : `file:///${currentImagePath.replace(/\\/g, '/')}`;

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden cursor-none"
      onClick={onDismiss}
    >
      <img 
        key={safePath}
        src={safePath} 
        alt="Screen Saver" 
        className="w-full h-full object-cover animate-fade-in"
        onError={(e) => {
          console.error("Failed to load screensaver image:", safePath);
          // Try to skip to next image
          setCurrentImageIndex((prev) => (prev + 1) % images.length);
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
      <div className="absolute bottom-12 left-12 right-12 flex justify-between items-end pointer-events-none">
        <div className="text-white/40 text-xl font-light tracking-[0.2em] uppercase">
          Touch to Start
        </div>
        <div className="text-white/20 text-4xl font-serif italic">
          Egypt Time Machine
        </div>
      </div>
    </div>
  );
};
