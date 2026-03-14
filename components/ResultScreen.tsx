import React, { useState, useEffect } from 'react';
import { EraData, FaceDetectionResult } from '../types';
import { Download, RotateCcw, Share2, QrCode, Loader2, Printer, CheckCircle2, XCircle } from 'lucide-react';

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
  // printStatus can be 'idle', 'printing', 'success', or 'error:Reasons'
  const [printStatus, setPrintStatus] = useState<'idle' | 'printing' | 'success' | string>('idle');

  useEffect(() => {
    // Fetch printers if in Electron
    const isElectron = navigator.userAgent.indexOf('Electron') !== -1;
    console.log('[ResultScreen] Checking for Electron:', isElectron);
    console.log('[ResultScreen] window.require available:', !!(window as any).require);

    if (isElectron && (window as any).require) {
      console.log('[ResultScreen] Fetching printers...');
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.invoke('get-printers').then(({ printers: pList, config }: { printers: any[], config: any }) => {
        console.log('[ResultScreen] Printers received:', pList.map((p: any) => p.name));
        console.log('[ResultScreen] Printer config:', config);
        setPrinters(pList);

        // Priority: 
        // 1. Manually saved in LocalStorage from previous session
        // 2. Hardcoded in printer-config.json
        // 3. System Default
        if (!selectedPrinter) {
          if (config.printerName) {
            console.log('[ResultScreen] Using config printer:', config.printerName);
            setSelectedPrinter(config.printerName);
          } else {
            const defaultP = pList.find((p: any) => p.isDefault);
            if (defaultP) {
              console.log('[ResultScreen] Using default printer:', defaultP.name);
              setSelectedPrinter(defaultP.name);
            }
          }
        }
      }).catch((err: any) => {
        console.error('[ResultScreen] Error fetching printers:', err);
      });
    } else {
      console.log('[ResultScreen] Not in Electron or require not available');
    }
  }, []);

  const handlePrinterChange = (name: string) => {
    setSelectedPrinter(name);
    localStorage.setItem('preferredPrinter', name);
  };

  useEffect(() => {
    const uploadImage = async () => {
      if (!imageSrc) return;
      setIsUploading(true);
      try {
        let blob: Blob;
        if (imageSrc.startsWith('data:')) {
          const response = await fetch(imageSrc);
          blob = await response.blob();
        } else {
          const response = await fetch(imageSrc);
          blob = await response.blob();
        }

        const formData = new FormData();
        formData.append('image', blob, 'result.png');
        formData.append('folder', 'kemet-mirror');
        formData.append('metadata', JSON.stringify({
          event: 'Cairo Airport Photobooth',
          photobooth_id: 'egypt_time_machine_1',
          era: era.name,
          prompt: prompt
        }));

        const response = await fetch('https://qr-web-api.vercel.app/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Upload failed');

        const data = await response.json();
        setQrCodeUrl(data.qrCodeUrl);
      } catch (error) {
        console.error('Error uploading image:', error);
      } finally {
        setIsUploading(false);
      }
    };

    uploadImage();
  }, [imageSrc]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `egypt-time-machine-${era.id}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = async () => {
    // Check if running in Electron and have access to node integration
    const isElectron = navigator.userAgent.indexOf('Electron') !== -1;
    console.log('[ResultScreen] handlePrint called');
    console.log('[ResultScreen] isElectron:', isElectron);
    console.log('[ResultScreen] window.require:', !!(window as any).require);
    console.log('[ResultScreen] selectedPrinter:', selectedPrinter);
    console.log('[ResultScreen] imageSrc length:', imageSrc?.length || 0);

    setPrintStatus('printing');

    if (isElectron && (window as any).require) {
      try {
        console.log('[ResultScreen] Invoking print-image IPC...');
        const { ipcRenderer } = (window as any).require('electron');
        console.log('[ResultScreen] ipcRenderer obtained:', !!ipcRenderer);

        const startTime = Date.now();
        console.log('[ResultScreen] Calling ipcRenderer.invoke("print-image")...');
        const result = await ipcRenderer.invoke('print-image', { imageSrc, printerName: selectedPrinter });
        console.log('[ResultScreen] print-image result:', result, 'took', Date.now() - startTime, 'ms');

        if (result.success) {
          console.log('[ResultScreen] Print successful!');
          setPrintStatus('success');
          setTimeout(() => setPrintStatus('idle'), 3000);
        } else {
          console.log('[ResultScreen] Print failed:', result.failureReason);
          // Display the specific failure reason
          setPrintStatus(`error:${result.failureReason}`);
          setTimeout(() => setPrintStatus('idle'), 5000);
        }
      } catch (e) {
        console.error('[ResultScreen] Electron print failed, falling back to browser print', e);
        browserPrint();
        setPrintStatus('idle');
      }
    } else {
      console.log('[ResultScreen] Not in Electron, using browser print');
      browserPrint();
      setPrintStatus('idle');
    }
  };

  const handleTestPrint = async () => {
    const isElectron = navigator.userAgent.indexOf('Electron') !== -1;
    console.log('[ResultScreen] TEST PRINT called');

    if (!isElectron || !(window as any).require) {
      alert('Test print only works in Electron build');
      return;
    }

    setPrintStatus('printing');

    try {
      // Create a simple solid color test image (small red square)
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Fill with white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 400, 600);

        // Draw a red rectangle
        ctx.fillStyle = 'red';
        ctx.fillRect(50, 50, 300, 500);

        // Add text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('TEST PRINT', 200, 300);
      }

      const testImageSrc = canvas.toDataURL('image/png');
      console.log('[ResultScreen] Test image created, length:', testImageSrc.length);

      const { ipcRenderer } = (window as any).require('electron');
      const result = await ipcRenderer.invoke('print-image', {
        imageSrc: testImageSrc,
        printerName: selectedPrinter
      });

      console.log('[ResultScreen] Test print result:', result);

      if (result.success) {
        setPrintStatus('success');
        setTimeout(() => setPrintStatus('idle'), 3000);
      } else {
        setPrintStatus(`error:${result.failureReason}`);
        setTimeout(() => setPrintStatus('idle'), 5000);
      }
    } catch (e) {
      console.error('[ResultScreen] Test print failed:', e);
      setPrintStatus('error:Exception occurred');
      setTimeout(() => setPrintStatus('idle'), 5000);
    }
  };

  const browserPrint = () => {
    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.write(`
        <html>
          <head>
            <style>
              @page { margin: 0; size: 4in 6in; }
              body { margin: 0; display: flex; justify-content: center; align-items: center; background: white; }
              img { max-width: 100%; height: auto; display: block; }
            </style>
          </head>
          <body>
            <img src="${imageSrc}" />
            <script>
              window.onload = () => {
                window.focus();
                window.print();
                setTimeout(() => {
                  window.parent.document.body.removeChild(window.frameElement);
                }, 1000);
              };
            </script>
          </body>
        </html>
      `);
      doc.close();
    }
  };

  return (
    <div className="h-full w-full relative overflow-hidden bg-black flex flex-col items-center justify-center">
      {/* 1. Background Image */}
      <img
        src="./Result-Screen.jpg"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover z-0 blur-sm"
      />
      <div className="absolute inset-0 bg-black/10 z-[1]" />

      {/* Printing Feedback Overlay */}
      {printStatus !== 'idle' && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-[110] flex flex-col items-center justify-center animate-scale-in">
          <div className="bg-black/80 backdrop-blur-xl border border-yellow-500/30 p-12 rounded-full flex flex-col items-center gap-6 shadow-[0_0_100px_rgba(0,0,0,0.9)] min-w-[300px]">
            {printStatus === 'printing' && (
              <>
                <div className="relative">
                  <Printer className="text-yellow-500 animate-bounce" size={64} />
                  <div className="absolute -inset-4 bg-yellow-500/20 blur-2xl rounded-full animate-pulse" />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-2xl font-black text-white uppercase tracking-widest">Printing...</span>
                  <span className="text-xs text-yellow-500/70 font-bold uppercase tracking-widest">Your artifact is being prepared</span>
                </div>
              </>
            )}

            {printStatus === 'success' && (
              <>
                <CheckCircle2 className="text-green-500 animate-in zoom-in-50 duration-500" size={64} />
                <div className="flex flex-col items-center gap-2">
                  <span className="text-2xl font-black text-white uppercase tracking-widest">Completed!</span>
                  <span className="text-xs text-green-500/70 font-bold uppercase tracking-widest">Take your memory with you</span>
                </div>
              </>
            )}

            {typeof printStatus === 'string' && printStatus.startsWith('error') && (
              <>
                <XCircle className="text-red-500" size={64} />
                <div className="flex flex-col items-center gap-2">
                  <span className="text-2xl font-black text-white uppercase tracking-widest">Printer Error</span>
                  <span className="text-xs text-red-500/70 font-bold uppercase tracking-widest text-center max-w-[250px]">
                    {printStatus.split(':')[1] || 'Unknown error occurred'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Printer Settings Overlay */}
      {showPrinterSettings && (
        <div className="absolute inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-yellow-500/30 p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-yellow-500">Printer Settings</h2>
              <button
                onClick={() => setShowPrinterSettings(false)}
                className="text-slate-400 hover:text-white"
              >✕</button>
            </div>

            <div className="space-y-4">
              <label className="block text-xs uppercase tracking-widest text-slate-400">Select Target Printer</label>
              {printers.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {printers.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => handlePrinterChange(p.name)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${selectedPrinter === p.name
                        ? 'border-yellow-500 bg-yellow-500/10 text-white'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium truncate mr-2">{p.name}</span>
                        {p.isDefault && <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded uppercase">Default</span>}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500 italic">No printers found. (Requires Electron)</div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleTestPrint}
                disabled={!selectedPrinter || printStatus === 'printing'}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all"
              >
                {printStatus === 'printing' ? 'Printing...' : 'Test Print'}
              </button>
              <button
                onClick={() => setShowPrinterSettings(false)}
                className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-xl transition-all uppercase tracking-widest text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Content Layer */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-between py-6 px-4">

        {/* Header with Settings */}
        <div className="w-full flex justify-end px-4 pt-2">
          {((window as any).require || navigator.userAgent.indexOf('Electron') !== -1) && (
            <button
              onClick={() => setShowPrinterSettings(true)}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-slate-200 transition-all border border-white/20 active:scale-95 group shadow-xl"
              title="Printer Settings"
            >
              <Printer size={20} className="group-hover:rotate-12 transition-transform" />
            </button>
          )}
        </div>

        {/* Main Generated Image Display */}
        <div className="relative w-[98%] md:w-[85%] lg:w-[65%] h-[78%] flex items-center justify-center animate-scale-in">
          <div className="absolute inset-0 bg-yellow-600/5 blur-1xl rounded-full" />
          <div className="relative w-full h-full border border-yellow-500/10 rounded-xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] bg-black/40">
            <img
              src={imageSrc}
              alt="Generated Portrait"
              draggable="false"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Footer Actions & QR */}
        <div className="w-full flex justify-center pb-2">
          <div className="flex items-end justify-center gap-8 w-full max-w-4xl px-4">

            {/* Download/Share Actions */}
            <div className="flex flex-col gap-3 animate-slide-in-bottom" style={{ animationDelay: '0.4s' }}>
              <div className="flex gap-3">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-5 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-xl transition-all shadow-lg active:scale-95 group"
                >
                  <Download size={18} className="group-hover:animate-bounce" />
                  <span className="text-xs uppercase tracking-wider">Download</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95 group"
                >
                  <Printer size={18} className="group-hover:rotate-12 transition-transform" />
                  <span className="text-xs uppercase tracking-wider">Print Photo</span>
                </button>
              </div>

              <button
                onClick={onRestart}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold rounded-xl hover:bg-white/20 transition-all active:scale-95"
              >
                <RotateCcw size={16} />
                <span className="text-xs uppercase tracking-wider">New Adventure</span>
              </button>
            </div>

            {/* QR Code Section */}
            <div className="flex flex-col items-center gap-2 animate-slide-in-bottom" style={{ animationDelay: '0.6s' }}>
              <div className="w-24 h-24 bg-white rounded-xl shadow-2xl p-1.5 relative group flex items-center justify-center border-2 border-yellow-600/50">
                {isUploading ? (
                  <div className="flex flex-col items-center gap-1">
                    <Loader2 className="animate-spin text-yellow-600" size={24} />
                    <span className="text-[8px] text-slate-600 font-bold uppercase">Uploading</span>
                  </div>
                ) : qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="QR Code" draggable="false" className="w-full h-full object-contain" />
                ) : (
                  <QrCode className="text-slate-400 opacity-20" size={32} />
                )}
              </div>
              <span className="text-[9px] text-yellow-500 font-black tracking-widest uppercase bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-md text-center block">Scan to Share</span>
            </div>

          </div>
        </div>

      </div>

      <style>{`
        @keyframes scale-in {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};