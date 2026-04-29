import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const { ipcRenderer } = window.require('electron');

const CFG = {
  TOTAL_CARDS: 30,
  CARD_W: 160,
  CARD_H: 240,
  CORNER_R: 14,
  FOCUS_HOLD_MS: 5000,
  TRANSITION_MS: 400,
  IDLE_MS: 2000,
  PERSPECTIVE: 1200,
  FOCUS_SCALE: 2.8,
  STAR_COUNT: 200,
};

// 30 scattered positions — densely filling 1080x1920 vertical screen
const CARD_SLOTS = [
  { x: -380, y: -720, z: -200, rx: 1, ry: 2, rz: -1, fs: 0.8, fa: 4 },
  { x: 350, y: -680, z: -280, rx: -1, ry: -2, rz: 1, fs: 1.0, fa: 5 },
  { x: 50, y: -640, z: -100, rx: 1, ry: -1, rz: 1, fs: 1.2, fa: 3 },
  { x: -420, y: -580, z: -180, rx: 2, ry: 2, rz: -2, fs: 1.5, fa: 6 },
  { x: 400, y: -520, z: -150, rx: -2, ry: -2, rz: 1, fs: 0.9, fa: 4 },
  { x: -150, y: -480, z: -250, rx: 1, ry: -2, rz: -1, fs: 1.1, fa: 5 },
  { x: 220, y: -420, z: -320, rx: -1, ry: 2, rz: -1, fs: 1.1, fa: 4 },
  { x: -430, y: -350, z: -120, rx: 1, ry: 2, rz: -1, fs: 0.7, fa: 6 },
  { x: 380, y: -280, z: -220, rx: -1, ry: -2, rz: 2, fs: 1.0, fa: 3 },
  { x: -10, y: -220, z: -50, rx: 0, ry: 1, rz: -1, fs: 1.2, fa: 4 },
  { x: -400, y: -150, z: -300, rx: 2, ry: -1, rz: 1, fs: 0.9, fa: 5 },
  { x: 150, y: -80, z: -180, rx: -1, ry: -2, rz: 1, fs: 1.3, fa: 4 },
  { x: -380, y: 0, z: -260, rx: 1, ry: 2, rz: -2, fs: 1.4, fa: 6 },
  { x: 420, y: 80, z: -210, rx: -1, ry: -1, rz: 1, fs: 1.1, fa: 4 },
  { x: -120, y: 150, z: -320, rx: 2, ry: 2, rz: -1, fs: 0.8, fa: 5 },
  { x: 300, y: 220, z: -150, rx: -1, ry: 2, rz: 1, fs: 1.2, fa: 3 },
  { x: -440, y: 300, z: -200, rx: 2, ry: -2, rz: -1, fs: 1.0, fa: 6 },
  { x: 180, y: 380, z: -280, rx: -1, ry: 2, rz: 2, fs: 1.3, fa: 4 },
  { x: -350, y: 450, z: -240, rx: 1, ry: -1, rz: -2, fs: 1.5, fa: 5 },
  { x: 410, y: 520, z: -180, rx: -1, ry: -2, rz: 1, fs: 0.9, fa: 4 },
  { x: -200, y: 600, z: -220, rx: 1, ry: 1, rz: -1, fs: 1.1, fa: 5 },
  { x: 100, y: 680, z: -120, rx: -1, ry: -1, rz: 1, fs: 1.0, fa: 4 },
  { x: -400, y: 750, z: -180, rx: 1, ry: 2, rz: -2, fs: 1.2, fa: 5 },
  { x: 350, y: -10, z: -350, rx: -1, ry: -1, rz: 1, fs: 1.1, fa: 4 },
  { x: -50, y: 350, z: -280, rx: 1, ry: 1, rz: -1, fs: 1.2, fa: 4 },
  { x: 250, y: -450, z: -200, rx: -1, ry: 1, rz: 1, fs: 1.0, fa: 5 },
  { x: -280, y: -550, z: -150, rx: 1, ry: -1, rz: -1, fs: 1.1, fa: 4 },
  { x: 430, y: 150, z: -300, rx: -1, ry: 2, rz: 1, fs: 0.9, fa: 5 },
  { x: -100, y: -150, z: -220, rx: 1, ry: -1, rz: -1, fs: 1.1, fa: 4 },
  { x: 120, y: 450, z: -180, rx: -1, ry: 1, rz: 1, fs: 1.2, fa: 4 },
];

/* ── Starfield ── */
const Starfield: React.FC = () => {
  const stars = useMemo(() =>
    Array.from({ length: CFG.STAR_COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * 100, y: Math.random() * 100,
      size: 0.5 + Math.random() * 2,
      opacity: 0.2 + Math.random() * 0.6,
      dur: 2 + Math.random() * 4,
      delay: Math.random() * 5,
    })), []);

  return (
    <div className="absolute inset-0 pointer-events-none">
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: var(--bo); }
          50% { opacity: 0.05; }
        }
      `}</style>
      {stars.map((s) => (
        <div key={s.id} style={{
          position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size, borderRadius: '50%', background: '#fff',
          '--bo': s.opacity, opacity: s.opacity,
          animation: `twinkle ${s.dur}s ${s.delay}s infinite ease-in-out`,
        } as React.CSSProperties} />
      ))}
    </div>
  );
};

/* ── Corner burst particles ── */
const CORNER_COLORS = ['#d4a853', '#53d4d4', '#d453a8', '#53d477', '#d4c953'];
const CORNERS = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }];

const CornerParticles: React.FC = () => {
  const particles = useMemo(() => {
    const items: Array<{
      id: number; corner: number; size: number; duration: number;
      delay: number; dx: number; dy: number; color: string;
    }> = [];
    for (let i = 0; i < 80; i++) {
      const corner = i % 4;
      const sx = CORNERS[corner].x === 0 ? 1 : -1;
      const sy = CORNERS[corner].y === 0 ? 1 : -1;
      items.push({
        id: i, corner, size: 2 + Math.random() * 5,
        duration: 4 + Math.random() * 6, delay: Math.random() * 10,
        dx: sx * (20 + Math.random() * 30), dy: sy * (20 + Math.random() * 30),
        color: CORNER_COLORS[Math.floor(Math.random() * CORNER_COLORS.length)],
      });
    }
    return items;
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <style>{`
        @keyframes corner-burst {
          0% { transform: translate(0, 0) scale(0); opacity: 0; }
          15% { opacity: 0.8; transform: translate(calc(var(--dx) * 0.15), calc(var(--dy) * 0.15)) scale(1); }
          85% { opacity: 0.3; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
        }
        @keyframes color-shift {
          0% { background: #d4a853; } 25% { background: #53d4d4; }
          50% { background: #d453a8; } 75% { background: #53d477; } 100% { background: #d4a853; }
        }
      `}</style>
      {particles.map((p) => (
        <div key={p.id} style={{
          position: 'absolute', left: `${CORNERS[p.corner].x}%`, top: `${CORNERS[p.corner].y}%`,
          width: p.size, height: p.size, borderRadius: '50%', background: p.color,
          '--dx': `${p.dx}vw`, '--dy': `${p.dy}vh`,
          animation: `corner-burst ${p.duration}s ${p.delay}s infinite ease-out, color-shift ${p.duration * 2}s ${p.delay}s infinite linear`,
          boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
        } as React.CSSProperties} />
      ))}
    </div>
  );
};

/* ── Main ScreenSaver ── */
export const ScreenSaver: React.FC<{ onDismiss: () => void }> = ({ onDismiss }) => {
  const [images, setImages] = useState<string[]>([]);
  const [batch, setBatch] = useState<number[]>([]);
  const [focusedSlot, setFocusedSlot] = useState(-1);
  const [isReshuffling, setIsReshuffling] = useState(false);
  const shownRef = useRef<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refreshGallery = useCallback(async () => {
    try {
      const { files } = await ipcRenderer.invoke('get-screensaver-info');
      if (!files || files.length === 0) return;

      setImages(files);

      const indices = Array.from({ length: files.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      const nextBatch = indices.slice(0, Math.min(CFG.TOTAL_CARDS, indices.length));
      setBatch(nextBatch);
      shownRef.current = new Set();
      setFocusedSlot(-1);
    } catch (err) {
      console.error('Failed to refresh gallery:', err);
    }
  }, []);

  useEffect(() => {
    refreshGallery();
    const dismiss = () => onDismiss();
    window.addEventListener('mousedown', dismiss);
    window.addEventListener('keydown', dismiss);
    window.addEventListener('touchstart', dismiss);
    return () => {
      window.removeEventListener('mousedown', dismiss);
      window.removeEventListener('keydown', dismiss);
      window.removeEventListener('touchstart', dismiss);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDismiss, refreshGallery]);

  // Removed redundant shuffle effect

  useEffect(() => {
    if (batch.length === 0) return;
    const cycle = () => {
      if (isReshuffling) return;
      const available = Array.from({ length: Math.min(batch.length, CARD_SLOTS.length) }, (_, i) => i)
        .filter(i => !shownRef.current.has(i));

      if (available.length === 0) {
        // Reshuffle sequence
        setIsReshuffling(true);
        timerRef.current = setTimeout(() => {
          refreshGallery();
        }, CFG.TRANSITION_MS);
        return;
      }

      const next = available[Math.floor(Math.random() * available.length)];
      shownRef.current.add(next);
      setFocusedSlot(next);
      timerRef.current = setTimeout(() => {
        setFocusedSlot(-1);
        timerRef.current = setTimeout(cycle, CFG.IDLE_MS);
      }, CFG.FOCUS_HOLD_MS + CFG.TRANSITION_MS);
    };
    timerRef.current = setTimeout(cycle, CFG.IDLE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [batch, refreshGallery, isReshuffling]);

  // Handle fly-in after reshuffle
  useEffect(() => {
    if (!isReshuffling) return;
    // Wait for the fly-out + a small buffer for batch update, then fly back in
    const t = setTimeout(() => {
      setIsReshuffling(false);
    }, CFG.TRANSITION_MS + 200);
    return () => clearTimeout(t);
  }, [isReshuffling]);

  const getStyle = (slotIdx: number) => {
    const slot = CARD_SLOTS[slotIdx];
    const isFocused = slotIdx === focusedSlot;

    if (isReshuffling) {
      return {
        // Fly towards camera and away from center
        transform: `translate3d(${slot.x * 4}px, ${slot.y * 4}px, 600px) rotateX(${slot.rx * 3}deg) rotateY(${slot.ry * 3}deg) scale(2)`,
        filter: 'blur(4px)',
        opacity: 0,
        zIndex: 1,
        animation: 'none',
      };
    }

    if (isFocused) {
      return {
        transform: `translate3d(0px, 0px, 200px) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(${CFG.FOCUS_SCALE})`,
        filter: 'blur(0px)',
        opacity: 1,
        zIndex: 10,
        animation: 'none',
      };
    }

    // Lighter blur
    const depthBlur = focusedSlot >= 0
      ? Math.max(1.5, Math.abs(slot.z) / 160 + 1)
      : Math.max(0.3, Math.abs(slot.z) / 250);

    return {
      transform: `translate3d(${slot.x}px, ${slot.y}px, ${slot.z}px) rotateX(${slot.rx}deg) rotateY(${slot.ry}deg) rotateZ(${slot.rz}deg) scale(1)`,
      filter: `blur(${depthBlur}px)`,
      opacity: focusedSlot >= 0 ? 0.65 : 0.9,
      zIndex: 1,
      animation: `card-float-${slotIdx} ${slot.fs * 3}s ease-in-out infinite`,
    };
  };

  const floatKeyframes = useMemo(() =>
    CARD_SLOTS.map((slot, i) => `
      @keyframes card-float-${i} {
        0%, 100% { margin-top: ${-CFG.CARD_H / 2}px; }
        50% { margin-top: ${-CFG.CARD_H / 2 - slot.fa}px; }
      }
    `).join('\n'), []);

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden cursor-none" style={{
      backgroundImage: "url('Result-Screen.jpg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
      <Starfield />
      <style>{floatKeyframes}</style>
      <style>{`
        @keyframes title-glow {
          0%, 100% { text-shadow: 0 0 20px rgba(212,168,83,0.4), 0 0 60px rgba(212,168,83,0.15); }
          50% { text-shadow: 0 0 30px rgba(212,168,83,0.7), 0 0 80px rgba(212,168,83,0.3), 0 0 120px rgba(212,168,83,0.1); }
        }
        @keyframes tap-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(234,179,8,0.2), inset 0 0 20px rgba(234,179,8,0.05); }
          50% { box-shadow: 0 0 40px rgba(234,179,8,0.4), inset 0 0 30px rgba(234,179,8,0.1); }
        }
      `}</style>

      {/* Title at top */}
      <div className="absolute top-0 left-0 right-0 z-20 flex flex-col items-center pt-12 pointer-events-none">
        <h1
          className="text-5xl font-serif italic tracking-wider"
          style={{
            color: '#d4a853',
            animation: 'title-glow 3s ease-in-out infinite',
            fontFamily: 'Georgia, serif',
          }}
        >
          Egypt Time Machine
        </h1>
        <div className="mt-3 h-[1px] w-48 bg-gradient-to-r from-transparent via-yellow-600/50 to-transparent" />
      </div>

      {/* 3D Viewport */}
      <div style={{
        position: 'absolute', inset: 0,
        perspective: `${CFG.PERSPECTIVE}px`,
        perspectiveOrigin: '50% 50%',
      }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', transformStyle: 'preserve-3d' }}>
          {batch.map((imgIndex, slotIdx) => {
            if (slotIdx >= CARD_SLOTS.length) return null;
            const safePath = images[imgIndex]?.startsWith('http')
              ? images[imgIndex]
              : `file:///${images[imgIndex]?.replace(/\\/g, '/')}`;
            const style = getStyle(slotIdx);

            return (
              <div
                key={slotIdx}
                style={{
                  position: 'absolute',
                  width: CFG.CARD_W, height: CFG.CARD_H,
                  marginLeft: -CFG.CARD_W / 2,
                  marginTop: -CFG.CARD_H / 2,
                  borderRadius: CFG.CORNER_R,
                  overflow: 'hidden',
                  transformStyle: 'preserve-3d',
                  transform: style.transform,
                  filter: style.filter,
                  opacity: style.opacity,
                  zIndex: style.zIndex,
                  animation: style.animation,
                  transition: `
                    transform ${CFG.TRANSITION_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1),
                    filter ${CFG.TRANSITION_MS * 0.4}ms ease,
                    opacity ${CFG.TRANSITION_MS}ms ease
                  `,
                  boxShadow: slotIdx === focusedSlot
                    ? '0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(212,168,83,0.25)'
                    : '0 8px 30px rgba(0,0,0,0.4)',
                }}
              >
                <img
                  src={safePath} alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <CornerParticles />

      {/* "Tap to Start" matching SplashScreen style */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center pb-10 pointer-events-none">
        <div className="flex flex-col items-center gap-6 animate-pulse">
          <div className="relative">
            <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
            <div
              className="relative border-2 border-yellow-500/50 py-4 px-12 rounded-full bg-black/40 backdrop-blur-md"
              style={{ animation: 'tap-pulse 2s ease-in-out infinite' }}
            >
              <span className="text-yellow-500 text-3xl font-bold uppercase tracking-[0.5em] whitespace-nowrap">
                Tap to Start
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
