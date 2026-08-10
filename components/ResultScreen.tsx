/**
 * RESULT SCREEN COMPONENT
 * -----------------------
 * Displays the final transformed image and provides fulfillment options:
 * 1. Printing (Native via Electron/DNP or Browser fallback).
 * 2. Sharing (Uploading to a remote server and generating a QR code).
 * 3. Downloading (Local file saving).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { EraData, FaceDetectionResult } from '../types';
import { RotateCcw, Share2, QrCode, Loader2, Printer, CheckCircle2, XCircle } from 'lucide-react';
import QRCode from 'qrcode';

interface ResultScreenProps {
  imageSrc: string;
  prompt: string;
  era: EraData;
  faceData: FaceDetectionResult | null;
  onRestart: () => void;
  onUpdateImage: (newImage: string) => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({ imageSrc, prompt, era, faceData, onRestart, onUpdateImage }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [printers, setPrinters] = useState<any[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>(localStorage.getItem('preferredPrinter') || '');
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [printStatus, setPrintStatus] = useState<'idle' | 'printing' | 'success' | string>('idle');

  /**
   * RESTART & CLEAR PRINTER QUEUE
   * Clears the current selected printer queue before returning to the splash screen.
   */
  const handleRestart = useCallback(() => {
    const isElectron = navigator.userAgent.indexOf('Electron') !== -1;
    if (isElectron && (window as any).require) {
      const { ipcRenderer } = (window as any).require('electron');
      const printerToClear = selectedPrinter || localStorage.getItem('preferredPrinter') || '';
      console.log('[ResultScreen] Invoking clear-printer-queue for printer:', printerToClear || 'Default/Config Printer');
      // Execute in the background without blocking the UI transition
      ipcRenderer.invoke('clear-printer-queue', { printerName: printerToClear }).catch((err: any) => {
        console.error('[ResultScreen] Failed to clear printer queue:', err);
      });
    }
    onRestart();
  }, [onRestart, selectedPrinter]);

  /**
   * 0. INACTIVITY TIMEOUT
   * Auto-restarts the booth and goes back to splash if the user is inactive for 5 minutes.
   */
  useEffect(() => {
    const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log('[Inactivity] 5 minutes passed without interaction, restarting...');
        handleRestart();
      }, INACTIVITY_LIMIT);
    };

    // User interactions to listen for
    const interactionEvents = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll', 'click'];

    interactionEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Initialize timer
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      interactionEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [handleRestart]);

  /**
   * 1. PRINTER DISCOVERY
   * Communicates with Electron to get a list of installed system printers.
   * Prioritizes the 'booth-config.json' setting.
   */
  useEffect(() => {
    const isElectron = navigator.userAgent.indexOf('Electron') !== -1;
    if (isElectron && (window as any).require) {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.invoke('get-printers').then(({ printers: pList, config }: { printers: any[], config: any }) => {
        setPrinters(pList);

        // Selection Logic: Config -> System Default -> Manual Override
        if (!selectedPrinter) {
          if (config.printerName) {
            setSelectedPrinter(config.printerName);
          } else {
            const defaultP = pList.find((p: any) => p.isDefault);
            if (defaultP) setSelectedPrinter(defaultP.name);
          }
        }
      });
    }
  }, []);

  const handlePrinterChange = (name: string) => {
    setSelectedPrinter(name);
    localStorage.setItem('preferredPrinter', name);
  };

  /**
   * 2. SHARING (UPLOAD & QR)
   * Automatically uploads the generated image directly to Cloudinary and generates a shareable QR code locally.
   */
  useEffect(() => {
    const uploadAndGenerateQr = async () => {
      if (!imageSrc) return;
      setIsUploading(true);
      try {
        const isElectron = navigator.userAgent.indexOf('Electron') !== -1;
        if (isElectron && (window as any).require) {
          const { ipcRenderer } = (window as any).require('electron');
          console.log('[Sharing] Uploading directly to Cloudinary...');

          const result = await ipcRenderer.invoke('upload-to-cloudinary', {
            imageSrc,
            folder: 'cairo-airport-photobooth',
            metadata: {
              event: 'Cairo Airport Photobooth',
              era: era.name,
              prompt: prompt
            }
          });

          if (result.success && result.secure_url) {
            const shareUrl = `https://cairo-airport-photobooth-qr.vercel.app/?url=${encodeURIComponent(result.secure_url)}`;
            console.log('[Sharing] Direct upload succeeded. Generating QR code for:', shareUrl);
            const qrDataUrl = await QRCode.toDataURL(shareUrl, {
              width: 384,
              margin: 2
            });
            setQrCodeUrl(qrDataUrl);
          } else {
            throw new Error(result.error || 'Upload failed');
          }
        } else {
          // Non-Electron / browser fallback
          console.warn('[Sharing] Running in browser. Cloudinary credentials not exposed directly.');
          const qrDataUrl = await QRCode.toDataURL(
            imageSrc.length < 2000 ? imageSrc : 'https://github.com/ehab-ayman-gharib/EGYPT-TIME-MACHINE-FF',
            { width: 384, margin: 2 }
          );
          setQrCodeUrl(qrDataUrl);
        }
      } catch (err) {
        console.error('[Sharing] Upload or QR generation failed:', err);
      } finally {
        setIsUploading(false);
      }
    };
    uploadAndGenerateQr();
  }, [imageSrc, era.name, prompt]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `egypt-time-machine-${era.id}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [hasPrinted, setHasPrinted] = useState(false);

  /**
   * 3. PRINTING EXECUTION
   * Sends the image data to the Electron main process for high-quality native printing.
   * Restricted to 1 print execution per result session. Subsequent clicks are clickable but perform no action.
   */
  const handlePrint = async () => {
    if (hasPrinted) {
      console.log('[ResultScreen] Print button already used in this session. Click ignored.');
      return;
    }
    setHasPrinted(true);

    const isElectron = navigator.userAgent.indexOf('Electron') !== -1;
    setPrintStatus('printing');

    if (isElectron && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        const result = await ipcRenderer.invoke('print-image', { imageSrc, printerName: selectedPrinter });

        if (result.success) {
          setPrintStatus('success');
          setTimeout(() => setPrintStatus('idle'), 3000);
        } else {
          setPrintStatus(`error:${result.failureReason}`);
          console.warn('[ResultScreen] Print failed. Clearing printer queue...');
          ipcRenderer.invoke('clear-printer-queue', { printerName: selectedPrinter }).catch((err: any) => {
            console.error('[ResultScreen] Error clearing queue after print failure:', err);
          });
          setTimeout(() => setPrintStatus('idle'), 5000);
        }
      } catch (e: any) {
        setPrintStatus('error:Communication Error');
        try {
          const { ipcRenderer } = (window as any).require('electron');
          ipcRenderer.invoke('clear-printer-queue', { printerName: selectedPrinter }).catch(() => { });
        } catch (_) { }
        setTimeout(() => setPrintStatus('idle'), 5000);
      }
    } else {
      window.print(); // Fallback for standard browser
      setPrintStatus('idle');
    }
  };

  const handleTestPrint = async () => {
    const isElectron = navigator.userAgent.indexOf('Electron') !== -1;
    if (!isElectron || !(window as any).require) return;

    setPrintStatus('printing');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200; canvas.height = 1800;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1200, 1800);
        ctx.fillStyle = 'red'; ctx.fillRect(150, 150, 900, 1500);
        ctx.fillStyle = 'white'; ctx.font = 'bold 144px Arial'; ctx.textAlign = 'center';
        ctx.fillText('TEST PRINT', 600, 900);
      }
      const testImageSrc = canvas.toDataURL('image/png');
      const { ipcRenderer } = (window as any).require('electron');
      const result = await ipcRenderer.invoke('print-image', { imageSrc: testImageSrc, printerName: selectedPrinter });
      if (result.success) {
        setPrintStatus('success');
        setTimeout(() => setPrintStatus('idle'), 3000);
      } else {
        setPrintStatus(`error:${result.failureReason}`);
        setTimeout(() => setPrintStatus('idle'), 5000);
      }
    } catch (e) {
      setPrintStatus('error:Exception');
      setTimeout(() => setPrintStatus('idle'), 5000);
    }
  };

  return (
    <div className="h-full w-full relative overflow-hidden bg-black flex flex-col items-center justify-center">
      {/* BACKGROUND & OVERLAYS */}
      <img src="./Result-Screen.jpg" alt="" className="absolute inset-0 w-full h-full object-cover blur-sm" />

      {/* Status Notifications */}
      {printStatus !== 'idle' && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-[110] flex flex-col items-center">
          <div className="bg-black/80 backdrop-blur-xl p-12 rounded-full border border-yellow-500/20 shadow-2xl">
            {printStatus === 'printing' && <Printer className="text-yellow-500 animate-bounce" size={64} />}
            {printStatus === 'success' && <CheckCircle2 className="text-green-500" size={64} />}
            {printStatus.startsWith('error') && <XCircle className="text-red-500" size={64} />}
            <p className="text-white mt-4 font-bold uppercase tracking-widest">{printStatus === 'printing' ? 'Printing artifact...' : 'Status Updated'}</p>
          </div>
        </div>
      )}

      {/* Printer Settings Overlay */}
      {showPrinterSettings && (
        <div className="absolute inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-yellow-500/30 p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-yellow-500 mb-6">Printer Settings</h2>
            <div className="space-y-4 max-h-60 overflow-y-auto mb-6">
              {printers.map((p) => (
                <button
                  key={p.name}
                  onClick={() => handlePrinterChange(p.name)}
                  className={`w-full text-left px-4 py-3 rounded-xl border ${selectedPrinter === p.name ? 'border-yellow-500 bg-yellow-500/10' : 'border-white/10'}`}
                >
                  <span className="text-white">{p.name}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={handleTestPrint} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold uppercase text-sm">Test Print</button>
              <button onClick={() => setShowPrinterSettings(false)} className="flex-1 py-3 bg-yellow-600 text-black font-bold rounded-xl uppercase text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-between py-6">
        {/* Header Actions */}
        <div className="w-full flex justify-end px-8">
          <button onClick={() => setShowPrinterSettings(true)} className="p-3 bg-white/10 rounded-full text-white border border-white/20">
            <Printer size={20} />
          </button>
        </div>

        {/* Generated Image Preview */}
        <div className="relative w-[90%] md:w-[65%] h-[75%] shadow-2xl rounded-xl overflow-hidden border border-white/10">
          <img src={imageSrc} alt="Result" className="w-full h-full object-contain" />
        </div>

        {/* Footer fulfillment methods */}
        <div className="w-full flex justify-center gap-12 pb-8">
          <div className="flex flex-col gap-4">
            <button onClick={handlePrint} className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl">
              <Printer size={18} /> PRINT PHOTO
            </button>
            <button onClick={handleRestart} className="py-3 bg-white/10 text-white font-bold rounded-xl border border-white/20">
              <RotateCcw size={16} className="inline mr-2" /> NEW ADVENTURE
            </button>
          </div>

          {/* QR Code fulfillment */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-36 h-36 bg-white rounded-xl p-2 border-2 border-yellow-600 shadow-xl flex items-center justify-center">
              {isUploading ? <Loader2 className="animate-spin text-yellow-600" size={32} /> : <img src={qrCodeUrl || ''} className="w-full h-full" />}
            </div>
            <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest">Scan to share</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultScreen;