import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const { ipcRenderer } = window.require('electron');

const CFG = {
  CARDS: 20,
  RADIUS: 0.75,
  CARD_W: 0.22,
  CARD_H: 0.33,
  X_OFFSET: -1,
  Y_OFFSET: 0.5,
  CORNER_R: 0.015,
  SPIN_SPEED: 0.5,
  FOCUS_Z_BOOST: 4.5,
  FOCUS_SCALE: 4.5, // High multiplier to compensate for small base size
  FOCUS_HOLD_MS: 3000,
  FOCUS_ANIM_SPEED: 2.0, // 0.5s zoom
  SNAP_THRESHOLD: 0.06,
  IDLE_SPIN_MS: 1500,
};

const VIDEO_URL = 'https://res.cloudinary.com/dniredeim/video/upload/v1778078092/Intro_rz8mvx.mp4';


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


/* ── Card Glow & Particles ── */
// Create a beautiful soft bloom/flare texture procedurally
const radialGlowTexture = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(252, 211, 77, 1)'); // Solid gold core
    gradient.addColorStop(0.4, 'rgba(252, 211, 77, 0.6)');
    gradient.addColorStop(1, 'rgba(252, 211, 77, 0)'); // Fade to transparent
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
})();

const particleTexture = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(252, 211, 77, 1)');
    gradient.addColorStop(0.4, 'rgba(252, 211, 77, 0.8)');
    gradient.addColorStop(1, 'rgba(252, 211, 77, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
})();

const CardGlow: React.FC<{ opacity: number }> = ({ opacity }) => {
  if (opacity <= 0.01) return null;

  return (
    <mesh position={[0, 0, -0.01]}>
      {/* Use a plane slightly larger than the card to act as a soft light source behind it */}
      <planeGeometry args={[CFG.CARD_W * 1.8, CFG.CARD_H * 1.5]} />
      <meshBasicMaterial
        map={radialGlowTexture}
        transparent
        opacity={opacity * 0.8}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};

const CardParticles: React.FC<{ active: boolean }> = ({ active }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 30;

  const [geo, mat] = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * CFG.CARD_W * 1.5;
      positions[i * 3 + 1] = (Math.random() - 0.5) * CFG.CARD_H * 1.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const m = new THREE.PointsMaterial({
      color: '#fcd34d',
      size: 0.03, // Slightly larger to accommodate the soft edge
      map: particleTexture,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    return [g, m];
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.getElapsedTime();
    const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      const y = pos.getY(i);
      pos.setY(i, y + Math.sin(t + i) * 0.001);
    }
    pos.needsUpdate = true;
    if (pointsRef.current.material instanceof THREE.PointsMaterial) {
      pointsRef.current.material.opacity = active ? 0.6 : 0.2;
    }
  });

  return <points ref={pointsRef} geometry={geo} material={mat} />;
};

/* ── Single Card with rounded corners ── */
const Card: React.FC<{
  url: string; slotIndex: number; totalCards: number;
  angleRef: React.MutableRefObject<number>;
  lockedAngleRef: React.MutableRefObject<number>;
  fpRef: React.MutableRefObject<number>;
  focusSlotRef: React.MutableRefObject<number>;
}> = ({ url, slotIndex, totalCards, angleRef, lockedAngleRef, fpRef, focusSlotRef }) => {
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
    const isFocused = focusSlotRef.current === slotIndex;
    const fp = isFocused ? fpRef.current : 0;

    // Lock the angle during focus to prevent extra spinning
    const activeAngle = (isFocused && fp > 0) ? lockedAngleRef.current : angleRef.current;
    const angle = slotAngle + activeAngle;

    const posFp = Math.min(1, fp * 1.1);
    const zoomFp = fp;

    // Vertical Cylinder: circle in XZ plane, shifted by X and Y offsets
    ref.current.position.x = (Math.sin(angle) * CFG.RADIUS + CFG.X_OFFSET) * (1 - posFp);
    ref.current.position.y = CFG.Y_OFFSET * (1 - posFp);
    ref.current.position.z = (Math.cos(angle) * CFG.RADIUS) * (1 - posFp) + zoomFp * CFG.FOCUS_Z_BOOST;

    // Normalize angle to [-PI, PI] to prevent full 360 spins when interpolating to 0
    let rotAngle = angle % (Math.PI * 2);
    if (rotAngle > Math.PI) rotAngle -= Math.PI * 2;
    if (rotAngle < -Math.PI) rotAngle += Math.PI * 2;

    // Face the center while spinning, face camera when focused
    ref.current.rotation.y = rotAngle * (1 - zoomFp);
    ref.current.rotation.x = 0;
    ref.current.rotation.z = 0;

    ref.current.scale.setScalar(1 + zoomFp * (CFG.FOCUS_SCALE - 1));
  });

  if (!texture) return null;

  return (
    <group ref={ref}>
      {/* Image - Render first for depth */}
      <mesh geometry={imageGeo}>
        <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} depthWrite={true} />
      </mesh>

      {/* Glow - Render behind with no depth write */}
      <CardGlow opacity={focusSlotRef.current === slotIndex ? 1 : 0.4} />

      {/* Particles */}
      <CardParticles active={focusSlotRef.current === slotIndex} />
    </group>
  );
};

/* ── 3D Scene ── */
const Scene: React.FC<{ images: string[] }> = ({ images }) => {
  const [batch, setBatch] = useState<number[]>([]);
  const angleRef = useRef(0);
  const lockedAngleRef = useRef(0);
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
    lockedAngleRef.current = 0;
  }, [images]);

  useEffect(() => {
    if (images.length > 0) shuffleBatch(true);
  }, [images, shuffleBatch]);

  useFrame((_, rawDelta) => {
    if (batch.length === 0) return;
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
              lockedAngleRef.current = angleRef.current; // Store angle to stop spin for this card
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
          lockedAngleRef={lockedAngleRef}
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
  const [videoSrc, setVideoSrc] = useState<string>(VIDEO_URL);

  useEffect(() => {
    const loadAssets = async () => {
      // Load Images
      const { files } = await ipcRenderer.invoke('get-screensaver-info');
      if (files && files.length > 0) setImages(files);

      // Cache and Load Video
      const cachedPath = await ipcRenderer.invoke('get-cached-video', VIDEO_URL);
      if (cachedPath) {
        const safePath = cachedPath.startsWith('http') ? cachedPath : `file:///${cachedPath.replace(/\\/g, '/')}`;
        setVideoSrc(safePath);
      }
    };
    loadAssets();
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
    >
      {/* BACKGROUND VIDEO LAYER */}
      <video
        key={videoSrc}
        autoPlay
        loop
        muted={true}
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
        src={videoSrc}
      />

      {/* TOP LOGO/TITLE */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 w-[450px] pointer-events-none">
        <img 
          src="./Photobooth-Title.png" 
          alt="Photobooth" 
          className="w-full h-auto drop-shadow-[0_0_30px_rgba(0,0,0,0.6)]" 
        />
      </div>

      <div className="absolute inset-0 z-10">
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
    </div>
  );
};
