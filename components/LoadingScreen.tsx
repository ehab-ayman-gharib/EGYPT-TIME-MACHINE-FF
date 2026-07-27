import React, { useEffect, useRef, useState } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  spin: number;
  isStar?: boolean;
}

export const LoadingScreen: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Interactive mouse 3D tilt state
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [tapRotation, setTapRotation] = useState(0);
  const emitBurstRef = useRef<((x: number, y: number, angle: number, count: number, speedMult?: number) => void) | null>(null);

  // Automatic rotation flip every 3.5 seconds
  useEffect(() => {
    const autoFlipInterval = setInterval(() => {
      setTapRotation((prev) => prev + 180);
    }, 3500);
    return () => clearInterval(autoFlipInterval);
  }, []);

  // Handle pointer hover / tilt on central hourglass card
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * 14;
    const rotateX = -((e.clientY - centerY) / (rect.height / 2)) * 14;
    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  };

  // Interactive tap / click rotates the sand watch and triggers a golden burst
  const handleHourglassClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTapRotation((prev) => prev + 180);

    if (emitBurstRef.current && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      // Subtle burst of golden particles from click point
      for (let i = 0; i < 20; i++) {
        const angle = (i * Math.PI * 2) / 20 + (Math.random() - 0.5) * 0.2;
        emitBurstRef.current(clickX, clickY, angle, 1, 1.4);
      }
    }
  };

  const handleScreenClick = (e: React.MouseEvent) => {
    if (emitBurstRef.current && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI * 2) / 12;
        emitBurstRef.current(clickX, clickY, angle, 1, 1.2);
      }
    }
  };

  // Canvas particle system for subtle 4-corner bursts & sparkles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const goldColors = [
      '#FFE066', '#FFD700', '#FFC107', '#FFB000', '#FFF8DC', '#E6A100', '#FFFFFF'
    ];

    const emitBurst = (originX: number, originY: number, targetAngle: number, count: number, speedMultiplier = 1) => {
      for (let i = 0; i < count; i++) {
        const angle = targetAngle + (Math.random() - 0.5) * 1.1;
        const speed = (0.8 + Math.random() * 2.8) * speedMultiplier;
        particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 2.5 + 1.0,
          color: goldColors[Math.floor(Math.random() * goldColors.length)],
          alpha: 0.75 + Math.random() * 0.2,
          decay: 0.008 + Math.random() * 0.012,
          spin: (Math.random() - 0.5) * 0.08,
          isStar: Math.random() > 0.7,
        });
      }
    };

    emitBurstRef.current = emitBurst;

    // Subtle initial burst from all 4 corners
    const triggerInitialBursts = () => {
      const w = canvas.width;
      const h = canvas.height;
      emitBurst(0, 0, Math.PI / 4, 8, 1.0);
      emitBurst(w, 0, (3 * Math.PI) / 4, 8, 1.0);
      emitBurst(0, h, -Math.PI / 4, 8, 1.0);
      emitBurst(w, h, (-3 * Math.PI) / 4, 8, 1.0);
    };

    triggerInitialBursts();

    let frameCount = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;

      frameCount++;

      // Subtle, low-density emission from 4 corners (1 particle per corner every 16 frames)
      if (frameCount % 16 === 0) {
        emitBurst(0, 0, Math.PI / 4, 1, 0.7);
        emitBurst(w, 0, (3 * Math.PI) / 4, 1, 0.7);
        emitBurst(0, h, -Math.PI / 4, 1, 0.7);
        emitBurst(w, h, (-3 * Math.PI) / 4, 1, 0.7);
      }

      // Draw particle trails and sparkles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        p.vx *= 0.985;
        p.vy *= 0.985;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = p.size * 2;
        ctx.fillStyle = p.color;

        if (p.isStar) {
          ctx.beginPath();
          const r = p.size * 1.3;
          ctx.moveTo(p.x, p.y - r);
          ctx.quadraticCurveTo(p.x, p.y, p.x + r, p.y);
          ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + r);
          ctx.quadraticCurveTo(p.x, p.y, p.x - r, p.y);
          ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - r);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      onClick={handleScreenClick}
      className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/50 backdrop-blur-xl text-center p-6 select-none overflow-hidden"
    >
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/15 via-black/40 to-black/80 pointer-events-none" />

      {/* Particle Canvas for subtle 4-Corner Bursts & Sparkles */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10"
      />

      {/* Main Interactive Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        onClick={handleHourglassClick}
        className="relative z-30 cursor-pointer group flex flex-col items-center justify-center p-8 transition-transform duration-200 ease-out mb-4"
        style={{
          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${isHovered ? 1.05 : 1})`,
        }}
      >
        {/* Ambient Pulsing Glow Behind Hourglass */}
        <div className="absolute w-80 h-80 bg-amber-500/20 rounded-full blur-3xl opacity-75 animate-pulse pointer-events-none" />

        {/* Pharaonic Hourglass Centerpiece (Enlarged & Auto-Rotating / Tap-Rotating) */}
        <div className="relative flex items-center justify-center">
          <div
            className="relative z-10 transition-transform duration-700 ease-in-out transform drop-shadow-[0_0_24px_rgba(245,158,11,0.8)]"
            style={{ transform: `rotate(${tapRotation}deg)` }}
          >
            <svg
              width="150"
              height="150"
              viewBox="0 0 96 96"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="filter drop-shadow-[0_0_16px_rgba(251,191,36,0.85)]"
            >
              {/* Metallic Cap Top & Bottom */}
              <path d="M18 12H78V18C78 18 64 20 48 20C32 20 18 18 18 18V12Z" fill="url(#goldGrad)" />
              <path d="M18 84H78V78C78 78 64 76 48 76C32 76 18 78 18 78V84Z" fill="url(#goldGrad)" />

              {/* Decorative Cap Rims */}
              <rect x="14" y="8" width="68" height="5" rx="2.5" fill="url(#goldCapGrad)" stroke="#fbbf24" strokeWidth="0.8" />
              <rect x="14" y="83" width="68" height="5" rx="2.5" fill="url(#goldCapGrad)" stroke="#fbbf24" strokeWidth="0.8" />

              {/* Hourglass Glass Body Outline */}
              <path
                d="M24 18C24 34 38 42 45 47C46.5 48 46.5 48 45 49C38 54 24 62 24 78H72C72 62 58 54 51 49C49.5 48 49.5 48 51 47C58 42 72 34 72 18H24Z"
                fill="rgba(245, 158, 11, 0.08)"
                stroke="url(#glassBorder)"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />

              {/* Glass Highlights */}
              <path
                d="M28 22C30 32 38 38 42 42"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.4"
              />

              {/* Top Bulb Sand Level (Decreasing) */}
              <path
                d="M27 28C32 36 40 38 48 38C56 38 64 36 69 28H27Z"
                fill="url(#sandGrad)"
                className="animate-pulse"
              />

              {/* Bottom Bulb Sand Heap (Accumulating) */}
              <path
                d="M26 76C32 68 40 64 48 64C56 64 64 68 70 76H26Z"
                fill="url(#sandGrad)"
              />

              {/* Trickling Sand Flow Center Stream */}
              <line
                x1="48"
                y1="38"
                x2="48"
                y2="66"
                stroke="url(#sandStream)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="4 3"
                className="animate-pulse"
              />

              {/* Center Neck Glowing Core Gem */}
              <circle cx="48" cy="48" r="4" fill="#ffffff" className="animate-ping" opacity="0.7" />
              <circle cx="48" cy="48" r="2.5" fill="#fbbf24" />

              {/* Gradients */}
              <defs>
                <linearGradient id="goldGrad" x1="18" y1="12" x2="78" y2="20" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#f59e0b" />
                  <stop offset="0.5" stopColor="#fef08a" />
                  <stop offset="1" stopColor="#d97706" />
                </linearGradient>

                <linearGradient id="goldCapGrad" x1="14" y1="8" x2="82" y2="13" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#fbbf24" />
                  <stop offset="0.5" stopColor="#ffffff" />
                  <stop offset="1" stopColor="#b45309" />
                </linearGradient>

                <linearGradient id="glassBorder" x1="24" y1="18" x2="72" y2="78" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#fbbf24" />
                  <stop offset="0.5" stopColor="#fef08a" />
                  <stop offset="1" stopColor="#d97706" />
                </linearGradient>

                <linearGradient id="sandGrad" x1="48" y1="20" x2="48" y2="78" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#fef08a" />
                  <stop offset="0.6" stopColor="#f59e0b" />
                  <stop offset="1" stopColor="#b45309" />
                </linearGradient>

                <linearGradient id="sandStream" x1="48" y1="38" x2="48" y2="66" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#ffffff" />
                  <stop offset="0.5" stopColor="#fbbf24" />
                  <stop offset="1" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      {/* Atmospheric Text Header Only */}
      <div className="relative z-30 max-w-lg mx-auto">
        <h3 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-yellow-500 brand-font tracking-wider drop-shadow-[0_0_16px_rgba(245,158,11,0.5)]">
          TRAVELING THROUGH TIME...
        </h3>
      </div>
    </div>
  );
};
