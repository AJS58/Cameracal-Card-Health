import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import logoUrl from '/cameracal-logo.png';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const HOLD_MS = 2200;
    const TICK_MS = 20;
    const steps = HOLD_MS / TICK_MS;
    let step = 0;

    const inTimer = setTimeout(() => {
      setPhase('hold');
      const interval = setInterval(() => {
        step++;
        setProgress(Math.min(100, Math.round((step / steps) * 100)));
        if (step >= steps) {
          clearInterval(interval);
          setPhase('out');
          setTimeout(onComplete, 700);
        }
      }, TICK_MS);
      return () => clearInterval(interval);
    }, 500);

    return () => clearTimeout(inTimer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase !== 'out' && (
        <motion.div
          key="splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.55, ease: 'easeInOut' }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center select-none overflow-hidden"
          style={{ background: 'hsl(222 38% 6%)' }}
        >
          {/* Background grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(hsl(226 60% 40% / 0.04) 1px, transparent 1px),
                linear-gradient(90deg, hsl(226 60% 40% / 0.04) 1px, transparent 1px)
              `,
              backgroundSize: '48px 48px',
            }}
          />

          {/* Radial vignette over grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, hsl(222 38% 6%) 100%)',
            }}
          />

          {/* Content stack */}
          <div className="relative flex flex-col items-center gap-0">

            {/* Logo — no rounded square, just the icon floating */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'relative' }}
            >
              {/* Soft halo */}
              <div
                style={{
                  position: 'absolute',
                  inset: -24,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, hsl(220 80% 55% / 0.22) 0%, transparent 70%)',
                  filter: 'blur(24px)',
                  pointerEvents: 'none',
                }}
              />
              <img
                src={logoUrl}
                alt="Cameracal Services"
                style={{
                  display: 'block',
                  width: 200,
                  height: 'auto',
                }}
                draggable={false}
              />
            </motion.div>

            {/* Wordmark */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mt-7 text-center"
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.28em',
                  textTransform: 'uppercase',
                  color: 'hsl(226 60% 65%)',
                  marginBottom: 6,
                }}
              >
                Cameracal Services
              </div>
              <h1
                style={{
                  fontSize: 34,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  background: 'linear-gradient(160deg, #ffffff 0%, hsl(220 70% 82%) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Card Health
              </h1>
            </motion.div>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.48, duration: 0.45 }}
              style={{
                marginTop: 10,
                fontSize: 12,
                color: 'hsl(226 20% 42%)',
                letterSpacing: '0.04em',
                fontWeight: 400,
              }}
            >
              Memory card integrity &amp; file health analysis
            </motion.p>

            {/* Divider */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5, ease: 'easeOut' }}
              style={{
                marginTop: 32,
                width: 240,
                height: 1,
                background: 'linear-gradient(90deg, transparent, hsl(226 60% 40% / 0.6), transparent)',
                transformOrigin: 'center',
              }}
            />

            {/* Progress track */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
              style={{ marginTop: 20, width: 240 }}
            >
              <div
                style={{
                  height: 2,
                  borderRadius: 99,
                  background: 'hsl(226 30% 14%)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    borderRadius: 99,
                    background: 'linear-gradient(90deg, hsl(220 80% 55%), hsl(240 70% 68%))',
                    boxShadow: '0 0 10px hsl(220 80% 60% / 0.7)',
                    transition: 'width 20ms linear',
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  color: 'hsl(226 20% 36%)',
                  letterSpacing: '0.06em',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                }}
              >
                <span>Initialising</span>
                <span>{progress}%</span>
              </div>
            </motion.div>

          </div>

          {/* Bottom badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.75 }}
            style={{
              position: 'absolute',
              bottom: 32,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10,
              color: 'hsl(226 20% 32%)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 500,
            }}
          >
            <span style={{
              display: 'inline-block',
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'hsl(142 60% 45%)',
              boxShadow: '0 0 6px hsl(142 60% 45% / 0.8)',
            }} />
            Privacy-first · All analysis runs locally
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
