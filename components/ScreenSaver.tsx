import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const { ipcRenderer } = window.require('electron');

const CFG = {
  CARDS: 5,
  RADIUS: 0.7,
  CARD_W: 0.6,
  CARD_H: 0.9,
  X_OFFSET: -0.8,
  Y_OFFSET: 0.8,
  CORNER_R: 0.04,
  SPIN_SPEED: 0.3,
  FOCUS_Z_BOOST: 3.5,
  FOCUS_SCALE: 2.2,
  FOCUS_HOLD_MS: 5000,
  FOCUS_ANIM_SPEED: 0.9,
  SNAP_THRESHOLD: 0.05,
  IDLE_SPIN_MS: 3000,
};

type Phase = 'spinning' | 'zoom-in' | 'hold' | 'zoom-out';

function makeRoundedRectGeo(w: number, h: number, r: number) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ShapeGeometry(shape, 12);
  const pos = geo.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2] = (pos.getX(i) + w / 2) / w;
    uvs[i * 2 + 1] = (pos.getY(i) + h / 2) / h;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
}


/* ── Single Card with rounded corners ── */
const Card: React.FC<{
  url: string; slotIndex: number; totalCards: number;
  angleRef: React.MutableRefObject<number>;
  fpRef: React.MutableRefObject<number>;
  focusSlotRef: React.MutableRefObject<number>;
}> = ({ url, slotIndex, totalCards, angleRef, fpRef, focusSlotRef }) => {
  const ref = useRef<THREE.Group>(null);
  const safePath = url.startsWith('http') ? url : `file:///${url.replace(/\\/g, '/')}`;
  const slotAngle = (slotIndex / totalCards) * Math.PI * 2;

  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    new THREE.TextureLoader().load(safePath, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      setTexture(tex);
    });
  }, [safePath]);

  const imageGeo = useMemo(() => makeRoundedRectGeo(CFG.CARD_W, CFG.CARD_H, CFG.CORNER_R), []);

  useFrame(() => {
    if (!ref.current) return;
    const angle = slotAngle + angleRef.current;
    const isFocused = focusSlotRef.current === slotIndex;
    const fp = isFocused ? fpRef.current : 0;

    // Use a slightly faster curve for position than for scale
    const posFp = Math.min(1, fp * 1.1);
    const zoomFp = fp;

    ref.current.position.x = (Math.sin(angle) * CFG.RADIUS + CFG.X_OFFSET) * (1 - posFp);
    ref.current.position.y = CFG.Y_OFFSET * (1 - posFp);
    ref.current.position.z = Math.cos(angle) * CFG.RADIUS + zoomFp * CFG.FOCUS_Z_BOOST;

    // Intensify spin: 2 full turns (4*PI) during zoom
    ref.current.rotation.y = (angle * (1 - zoomFp)) + (zoomFp * Math.PI * 4);

    ref.current.scale.setScalar(1 + zoomFp * (CFG.FOCUS_SCALE - 1));
  });

  if (!texture) return null;

  return (
    <group ref={ref}>
      {/* Image */}
      <mesh geometry={imageGeo}>
        <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

/* ── 3D Scene ── */
const Scene: React.FC<{ images: string[] }> = ({ images }) => {
  const [batch, setBatch] = useState<number[]>([]);
  const angleRef = useRef(0);
  const phaseRef = useRef<Phase>('spinning');
  const timerRef = useRef(0);
  const focusSlotRef = useRef(-1);
  const fpRef = useRef(0);
  const shownRef = useRef<Set<number>>(new Set());

  const shuffleBatch = useCallback((isInitial = false) => {
    const indices = Array.from({ length: images.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setBatch(indices.slice(0, Math.min(CFG.CARDS, indices.length)));
    shownRef.current = new Set();
    if (isInitial) {
      // Offset so no card starts at the front on first load
      angleRef.current = Math.PI / CFG.CARDS;
    } else {
      // Nudge angle past any card at the front to prevent immediate re-snap
      angleRef.current += (Math.PI * 2 / CFG.CARDS) * 0.5;
    }
    phaseRef.current = 'spinning';
    timerRef.current = 0;
    focusSlotRef.current = -1;
    fpRef.current = 0;
  }, [images]);

  useEffect(() => {
    if (images.length > 0) shuffleBatch(true);
  }, [images, shuffleBatch]);

  useFrame((_, rawDelta) => {
    if (batch.length === 0) return;
    // Clamp delta to prevent over-spin from background tabs or long frames
    const delta = Math.min(rawDelta, 0.05);
    const total = batch.length;
    const TWO_PI = Math.PI * 2;

    // Normalize angle to prevent floating-point drift over time
    angleRef.current = ((angleRef.current % TWO_PI) + TWO_PI) % TWO_PI;

    switch (phaseRef.current) {
      case 'spinning': {
        angleRef.current += delta * CFG.SPIN_SPEED;
        timerRef.current += delta * 1000;

        if (timerRef.current > CFG.IDLE_SPIN_MS) {
          for (let i = 0; i < total; i++) {
            if (shownRef.current.has(i)) continue;
            const sa = (i / total) * Math.PI * 2;
            const eff = ((sa + angleRef.current) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
            const dist = Math.min(eff, Math.PI * 2 - eff);
            if (dist < CFG.SNAP_THRESHOLD) {
              const snap = eff < Math.PI ? -eff : Math.PI * 2 - eff;
              angleRef.current += snap;
              shownRef.current.add(i);
              focusSlotRef.current = i;
              phaseRef.current = 'zoom-in';
              timerRef.current = 0;
              return;
            }
          }
        }

        if (shownRef.current.size >= total) {
          // All cards shown — wait a bit then reshuffle new images seamlessly
          if (timerRef.current > CFG.IDLE_SPIN_MS) {
            shuffleBatch(false);
          }
        }
        break;
      }
      case 'zoom-in': {
        fpRef.current = Math.min(1, fpRef.current + delta * CFG.FOCUS_ANIM_SPEED);
        if (fpRef.current >= 0.99) {
          fpRef.current = 1;
          phaseRef.current = 'hold';
          timerRef.current = 0;
        }
        break;
      }
      case 'hold': {
        timerRef.current += delta * 1000;
        if (timerRef.current > CFG.FOCUS_HOLD_MS) {
          phaseRef.current = 'zoom-out';
          timerRef.current = 0;
        }
        break;
      }
      case 'zoom-out': {
        fpRef.current = Math.max(0, fpRef.current - delta * CFG.FOCUS_ANIM_SPEED);
        if (fpRef.current <= 0.01) {
          fpRef.current = 0;
          focusSlotRef.current = -1;
          phaseRef.current = 'spinning';
          timerRef.current = 0;
        }
        break;
      }
    }
  });

  return (
    <>
      <ambientLight intensity={0.7} />
      <pointLight position={[0, 5, 8]} intensity={0.6} color="#f5e6c8" />
      <pointLight position={[-3, -2, 5]} intensity={0.3} color="#8b7355" />
      {batch.map((imgIndex, slotIndex) => (
        <Card
          key={slotIndex}
          url={images[imgIndex]}
          slotIndex={slotIndex}
          totalCards={batch.length}
          angleRef={angleRef}
          fpRef={fpRef}
          focusSlotRef={focusSlotRef}
        />
      ))}
    </>
  );
};

/* ── Corner Burst Particles (CSS-based overlay) ── */
const CORNER_COLORS = ['#d4a853', '#53d4d4', '#d453a8', '#53d477', '#d4c953'];
const CORNERS = [
  { x: 0, y: 0 },      // top-left
  { x: 100, y: 0 },    // top-right
  { x: 0, y: 100 },    // bottom-left
  { x: 100, y: 100 },  // bottom-right
];

const CornerParticles: React.FC = () => {
  const particles = useMemo(() => {
    const items: Array<{
      id: number; corner: number; size: number; duration: number;
      delay: number; dx: number; dy: number; color: string;
    }> = [];
    for (let i = 0; i < 80; i++) {
      const corner = i % 4;
      const signX = CORNERS[corner].x === 0 ? 1 : -1;
      const signY = CORNERS[corner].y === 0 ? 1 : -1;
      items.push({
        id: i,
        corner,
        size: 2 + Math.random() * 5,
        duration: 4 + Math.random() * 6,
        delay: Math.random() * 10,
        dx: signX * (20 + Math.random() * 30),
        dy: signY * (20 + Math.random() * 30),
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
          0% { background: #d4a853; }
          25% { background: #53d4d4; }
          50% { background: #d453a8; }
          75% { background: #53d477; }
          100% { background: #d4a853; }
        }
      `}</style>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${CORNERS[p.corner].x}%`,
            top: `${CORNERS[p.corner].y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: p.color,
            '--dx': `${p.dx}vw`,
            '--dy': `${p.dy}vh`,
            animation: `corner-burst ${p.duration}s ${p.delay}s infinite ease-out, color-shift ${p.duration * 2}s ${p.delay}s infinite linear`,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

/* ── Exported ScreenSaver ── */
export const ScreenSaver: React.FC<{ onDismiss: () => void }> = ({ onDismiss }) => {
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    const loadImages = async () => {
      const { files } = await ipcRenderer.invoke('get-screensaver-info');
      if (files && files.length > 0) setImages(files);
    };
    loadImages();
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

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-900 overflow-hidden cursor-none"
      style={{
        backgroundImage: `url('Isis-ScreenSaver.jpeg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 7], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        {images.length > 0 && <Scene images={images} />}
      </Canvas>

      {/* Corner burst particles */}
      <CornerParticles />

      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none">
        <div className="text-amber-200/30 text-lg tracking-[0.5em] uppercase font-light">
          Touch to Start
        </div>
        <div className="text-white/15 text-3xl font-serif italic tracking-wider">
          Egypt Time Machine
        </div>
      </div>
    </div>
  );
};
