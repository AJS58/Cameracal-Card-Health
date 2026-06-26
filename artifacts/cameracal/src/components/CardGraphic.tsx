import React from 'react';
import sdImg from '../assets/card-sd.png';
import microSdImg from '../assets/card-microsd.png';
import cfImg from '../assets/card-cf.png';
import cfastImg from '../assets/card-cfast.png';
import cfexpressImg from '../assets/card-cfexpress.png';
import xqdImg from '../assets/card-xqd.png';

export type CardType = 'SD' | 'microSD' | 'CF' | 'CFast' | 'XQD' | 'CFexpress';

function PhotoCard({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="w-auto max-h-full object-contain drop-shadow-2xl"
      draggable={false}
      style={{ userSelect: 'none' }}
    />
  );
}

/* ── CompactFlash: landscape 42.8×36.4 mm, 50-pin ATA connector ── */
function CFCard() {
  // Real CF: wider than tall. 200×170 matches 42.8:36.4 ratio.
  // Top-right corner has a polarisation notch (chamfer).
  const NOTCH = 16;
  const W = 200;
  const H = 170;
  // Body outline with top-right notch
  const bodyPath = `M 4,0 L ${W - NOTCH},0 L ${W},${NOTCH} L ${W},${H - 4} Q ${W},${H} ${W - 4},${H} L 4,${H} Q 0,${H} 0,${H - 4} L 0,4 Q 0,0 4,0 Z`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.75))' }}>
      <defs>
        <linearGradient id="cf-body" x1="0" y1="0" x2={W} y2={H} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4a4a4e"/>
          <stop offset="50%" stopColor="#38383c"/>
          <stop offset="100%" stopColor="#2a2a2e"/>
        </linearGradient>
        <linearGradient id="cf-sheen" x1="0" y1="0" x2={W} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.12)"/>
          <stop offset="40%" stopColor="rgba(255,255,255,0.03)"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0.05)"/>
        </linearGradient>
        <linearGradient id="cf-label" x1="0" y1="0" x2={W} y2={H * 0.7} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(80,80,86,0.45)"/>
          <stop offset="100%" stopColor="rgba(40,40,44,0.35)"/>
        </linearGradient>
        <clipPath id="cf-clip">
          <path d={bodyPath}/>
        </clipPath>
      </defs>

      {/* Card body */}
      <path d={bodyPath} fill="url(#cf-body)"/>
      <path d={bodyPath} fill="url(#cf-sheen)"/>
      {/* Outer border */}
      <path d={bodyPath} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
      {/* Top-left highlight */}
      <rect x="0" y="0" width={W} height="2" rx="1" fill="rgba(255,255,255,0.13)" clipPath="url(#cf-clip)"/>
      <rect x="0" y="0" width="2" height={H} fill="rgba(255,255,255,0.08)" clipPath="url(#cf-clip)"/>

      {/* Label panel */}
      <rect x="10" y="8" width={W - 20} height={H - 48} rx="3" fill="url(#cf-label)"/>
      <rect x="10" y="8" width={W - 20} height={H - 48} rx="3" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>

      {/* Notch chamfer edge line */}
      <line x1={W - NOTCH} y1="1" x2={W - 1} y2={NOTCH} stroke="rgba(255,255,255,0.10)" strokeWidth="1"/>

      {/* CompactFlash text */}
      <text x={W / 2} y="55" textAnchor="middle"
        fontFamily="Arial, sans-serif" fontWeight="700"
        fontSize="15" letterSpacing="1" fill="white" fillOpacity="0.85">CompactFlash</text>

      {/* CF logo square */}
      <rect x={W / 2 - 22} y="64" width="44" height="26" rx="3" fill="rgba(255,130,0,0.80)"/>
      <text x={W / 2} y="83" textAnchor="middle"
        fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900"
        fontSize="18" fill="white" fillOpacity="0.97">CF</text>

      {/* Capacity */}
      <text x={W / 2} y="106" textAnchor="middle"
        fontFamily="Arial, sans-serif" fontWeight="600"
        fontSize="13" fill="rgba(255,255,255,0.50)">64 GB</text>

      {/* ── 50-pin ATA connector at bottom ── */}
      {/* Connector housing */}
      <rect x="14" y={H - 34} width={W - 28} height="32" rx="2" fill="#141416"/>
      {/* Housing top lip */}
      <rect x="14" y={H - 34} width={W - 28} height="3" rx="1" fill="rgba(255,255,255,0.05)"/>

      {/* Side bumpers */}
      <rect x="6" y={H - 30} width="8" height="24" rx="1.5" fill="#202024"/>
      <rect x={W - 14} y={H - 30} width="8" height="24" rx="1.5" fill="#202024"/>

      {/* 50 pins in 2 rows of 25 — centre gap between pin 13 and 14 for keying */}
      {Array.from({ length: 25 }).map((_, i) => {
        // Each pin pair spaced across available width, with a centre gap
        const totalPins = 25;
        const pinW = 4;
        const pinGap = 2;
        const pinPitch = pinW + pinGap;
        const totalWidth = totalPins * pinPitch - pinGap + 8; // +8 for centre notch
        const startX = (W - totalWidth) / 2;
        const offset = i < 12 ? 0 : 8; // 8px notch after pin 12
        const x = startX + i * pinPitch + offset;
        const y1 = H - 30;
        const y2 = H - 18;
        return (
          <g key={i}>
            <rect x={x} y={y1} width={pinW} height="10" rx="0.5" fill="rgba(195,140,20,0.90)"/>
            <rect x={x} y={y1} width={pinW} height="3.5" rx="0.5" fill="rgba(255,215,80,0.30)"/>
            <rect x={x} y={y2} width={pinW} height="10" rx="0.5" fill="rgba(195,140,20,0.82)"/>
          </g>
        );
      })}

      {/* Centre keying notch block */}
      <rect x={(W / 2) - 4} y={H - 31} width="8" height="28" rx="1" fill="#141416"/>

      {/* Bottom shadow */}
      <rect x="0" y={H - 3} width={W} height="3" rx="1.5" fill="rgba(0,0,0,0.55)" clipPath="url(#cf-clip)"/>
    </svg>
  );
}

/* ── CFast 2.0: same landscape body as CF, SATA combined connector ── */
function CFastCard() {
  const W = 200;
  const H = 170;
  // CFast has a small indexing tab notch cut from the TOP edge (centre)
  // and the bottom has a SATA 7+15 combined connector
  const bodyPath = `M 4,0 L ${W - 4},0 Q ${W},0 ${W},4 L ${W},${H - 4} Q ${W},${H} ${W - 4},${H} L 4,${H} Q 0,${H} 0,${H - 4} L 0,4 Q 0,0 4,0 Z`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.75))' }}>
      <defs>
        <linearGradient id="cft-body" x1="0" y1="0" x2={W} y2={H} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3e4a52"/>
          <stop offset="50%" stopColor="#2f3a42"/>
          <stop offset="100%" stopColor="#222d34"/>
        </linearGradient>
        <linearGradient id="cft-sheen" x1="0" y1="0" x2={W} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.11)"/>
          <stop offset="50%" stopColor="rgba(255,255,255,0.02)"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0.04)"/>
        </linearGradient>
        <linearGradient id="cft-label" x1="0" y1="0" x2={W} y2={H * 0.7} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(65,78,88,0.50)"/>
          <stop offset="100%" stopColor="rgba(30,42,50,0.35)"/>
        </linearGradient>
      </defs>

      {/* Card body */}
      <path d={bodyPath} fill="url(#cft-body)"/>
      <path d={bodyPath} fill="url(#cft-sheen)"/>
      <path d={bodyPath} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
      {/* Highlights */}
      <rect x="0" y="0" width={W} height="2" rx="1" fill="rgba(255,255,255,0.12)"/>
      <rect x="0" y="0" width="2" height={H} fill="rgba(255,255,255,0.07)"/>

      {/* Label panel */}
      <rect x="10" y="8" width={W - 20} height={H - 48} rx="3" fill="url(#cft-label)"/>
      <rect x="10" y="8" width={W - 20} height={H - 48} rx="3" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>

      {/* Top-centre indexing tab (small inset notch — characteristic CFast keying) */}
      <rect x={W / 2 - 10} y="0" width="20" height="4" rx="1" fill="rgba(0,0,0,0.35)"/>
      <rect x={W / 2 - 10} y="0" width="20" height="1" fill="rgba(0,0,0,0.6)"/>

      {/* CFast 2.0 text */}
      <text x={W / 2} y="52" textAnchor="middle"
        fontFamily="Arial, sans-serif" fontWeight="700"
        fontSize="15" letterSpacing="1" fill="white" fillOpacity="0.88">CFast 2.0</text>

      {/* Speed tier badge */}
      <rect x={W / 2 - 28} y="60" width="56" height="18" rx="3"
        fill="rgba(0,150,220,0.20)" stroke="rgba(0,180,255,0.30)" strokeWidth="0.8"/>
      <text x={W / 2} y="73" textAnchor="middle"
        fontFamily="Arial, sans-serif" fontWeight="600"
        fontSize="9" letterSpacing="2" fill="rgba(120,210,255,0.85)">SATA III</text>

      {/* Capacity */}
      <text x={W / 2} y="100" textAnchor="middle"
        fontFamily="Arial, sans-serif" fontWeight="600"
        fontSize="13" fill="rgba(255,255,255,0.50)">64 GB</text>

      {/* Speed */}
      <text x={W / 2} y="114" textAnchor="middle"
        fontFamily="Arial, sans-serif" fontWeight="400"
        fontSize="9" fill="rgba(255,255,255,0.28)" letterSpacing="1">560 MB/s</text>

      {/* ── SATA Combined connector (7-pin data + 15-pin power) ── */}
      {/* Connector housing */}
      <rect x="30" y={H - 34} width="140" height="32" rx="2" fill="#0e1014"/>
      <rect x="30" y={H - 34} width="140" height="2.5" fill="rgba(255,255,255,0.04)"/>

      {/* DATA section: 7 pins (left side) */}
      {/* Narrow pins, 1.27mm pitch → visually ~5px pitch */}
      {Array.from({ length: 7 }).map((_, i) => {
        const x = 34 + i * 7;
        return (
          <g key={i}>
            <rect x={x} y={H - 30} width="4" height="12" rx="0.5" fill="rgba(195,140,18,0.92)"/>
            <rect x={x} y={H - 30} width="4" height="4" rx="0.5" fill="rgba(255,215,80,0.30)"/>
            <rect x={x} y={H - 16} width="4" height="12" rx="0.5" fill="rgba(195,140,18,0.82)"/>
          </g>
        );
      })}

      {/* L-shaped key separator between data and power — this is the defining CFast/SATA feature */}
      <rect x="84" y={H - 35} width="8" height="33" rx="1" fill="#0e1014"/>
      <rect x="83" y={H - 35} width="10" height="3" rx="1" fill="rgba(30,40,50,0.8)"/>

      {/* POWER section: 15 pins (right side, wider pitch) */}
      {Array.from({ length: 15 }).map((_, i) => {
        const x = 96 + i * 7;
        return (
          <g key={i}>
            <rect x={x} y={H - 30} width="4" height="12" rx="0.5" fill="rgba(195,140,18,0.88)"/>
            <rect x={x} y={H - 30} width="4" height="4" rx="0.5" fill="rgba(255,215,80,0.28)"/>
            <rect x={x} y={H - 16} width="4" height="12" rx="0.5" fill="rgba(195,140,18,0.80)"/>
          </g>
        );
      })}

      {/* DATA / PWR micro-labels */}
      <text x="57" y={H - 3} textAnchor="middle"
        fontFamily="Arial, sans-serif" fontSize="7" fill="rgba(255,255,255,0.20)">DATA</text>
      <text x="131" y={H - 3} textAnchor="middle"
        fontFamily="Arial, sans-serif" fontSize="7" fill="rgba(255,255,255,0.20)">PWR</text>
    </svg>
  );
}

/* ── XQD: dark navy rectangle, correct proportions, PCIe connector ── */
function XQDCard() {
  return (
    <svg width="154" height="200" viewBox="0 0 154 200" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.7))' }}>
      <defs>
        <linearGradient id="xqd-body" x1="0" y1="0" x2="154" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e2a42"/>
          <stop offset="45%" stopColor="#162035"/>
          <stop offset="100%" stopColor="#0e1525"/>
        </linearGradient>
        <linearGradient id="xqd-sheen" x1="0" y1="0" x2="154" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.11)"/>
          <stop offset="40%" stopColor="rgba(255,255,255,0.03)"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0.06)"/>
        </linearGradient>
        <linearGradient id="xqd-panel" x1="0" y1="0" x2="154" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(30,50,90,0.8)"/>
          <stop offset="100%" stopColor="rgba(10,20,50,0.6)"/>
        </linearGradient>
        <linearGradient id="xqd-gold" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#e8c060"/>
          <stop offset="50%" stopColor="#f5d070"/>
          <stop offset="100%" stopColor="#a07018"/>
        </linearGradient>
        <linearGradient id="xqd-rim" x1="0" y1="0" x2="0" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2a3a5a"/>
          <stop offset="100%" stopColor="#0a1020"/>
        </linearGradient>
      </defs>

      {/* Card body — clean rectangle, no notch */}
      <rect x="0" y="0" width="154" height="200" rx="6" fill="url(#xqd-body)"/>
      <rect x="0" y="0" width="154" height="200" rx="6" fill="url(#xqd-sheen)"/>

      {/* Inner rim border */}
      <rect x="1" y="1" width="152" height="198" rx="5.5" fill="none" stroke="url(#xqd-rim)" strokeWidth="1"/>

      {/* Edge highlight — top */}
      <rect x="0" y="0" width="154" height="1.5" rx="1" fill="rgba(255,255,255,0.16)"/>
      {/* Edge highlight — left */}
      <rect x="0" y="0" width="1.5" height="200" rx="1" fill="rgba(255,255,255,0.10)"/>

      {/* Glossy label panel */}
      <rect x="8" y="8" width="138" height="130" rx="4" fill="url(#xqd-panel)"/>
      <rect x="8" y="8" width="138" height="130" rx="4" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>

      {/* Gloss highlight on panel */}
      <rect x="9" y="9" width="136" height="40" rx="3"
        fill="rgba(255,255,255,0.06)"/>

      {/* SONY text */}
      <text x="77" y="52" textAnchor="middle"
        fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900"
        fontSize="22" letterSpacing="4" fill="white" fillOpacity="0.92">SONY</text>

      {/* XQD text */}
      <text x="77" y="98" textAnchor="middle"
        fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900"
        fontSize="34" letterSpacing="3" fill="#c8a840" fillOpacity="0.95">XQD</text>

      {/* Sub-label */}
      <text x="77" y="118" textAnchor="middle"
        fontFamily="Arial, sans-serif" fontWeight="400"
        fontSize="10" fill="rgba(255,255,255,0.35)" letterSpacing="2">440 MB/s</text>

      {/* Capacity label */}
      <text x="77" y="154" textAnchor="middle"
        fontFamily="Arial, sans-serif" fontWeight="600"
        fontSize="14" fill="rgba(255,255,255,0.55)">64 GB</text>

      {/* Connector recess */}
      <rect x="14" y="170" width="126" height="28" rx="2" fill="#080c14"/>
      <rect x="14" y="170" width="126" height="2" fill="rgba(255,255,255,0.04)"/>

      {/* PCIe connector pins — two rows */}
      {Array.from({length: 20}).map((_, i) => (
        <g key={i}>
          <rect x={17 + i * 6} y={172} width={4} height={11} rx="0.6" fill="rgba(200,140,20,0.9)"/>
          <rect x={17 + i * 6} y={172} width={4} height={4} rx="0.6" fill="rgba(255,230,100,0.35)"/>
          <rect x={17 + i * 6} y={185} width={4} height={11} rx="0.6" fill="rgba(200,140,20,0.82)"/>
        </g>
      ))}

      {/* Bottom edge */}
      <rect x="0" y="197" width="154" height="3" rx="1.5" fill="rgba(0,0,0,0.5)"/>
    </svg>
  );
}

/* ── CFexpress Type B: matte black rectangle, PCIe M.2 keyed connector ── */
function CFexpressCard() {
  return (
    <svg width="148" height="196" viewBox="0 0 148 196" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.7))' }}>
      <defs>
        <linearGradient id="cfe-body" x1="0" y1="0" x2="148" y2="196" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2a2a2e"/>
          <stop offset="50%" stopColor="#1c1c20"/>
          <stop offset="100%" stopColor="#121214"/>
        </linearGradient>
        <linearGradient id="cfe-sheen" x1="0" y1="0" x2="148" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.09)"/>
          <stop offset="50%" stopColor="rgba(255,255,255,0.02)"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0.04)"/>
        </linearGradient>
        <linearGradient id="cfe-panel" x1="0" y1="0" x2="0" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(50,50,55,0.5)"/>
          <stop offset="100%" stopColor="rgba(20,20,22,0.4)"/>
        </linearGradient>
      </defs>

      {/* Card body — clean rectangle */}
      <rect x="0" y="0" width="148" height="196" rx="6" fill="url(#cfe-body)"/>
      <rect x="0" y="0" width="148" height="196" rx="6" fill="url(#cfe-sheen)"/>

      {/* Border */}
      <rect x="0.5" y="0.5" width="147" height="195" rx="5.5" fill="none"
        stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>

      {/* Edge highlights */}
      <rect x="0" y="0" width="148" height="1.5" rx="1" fill="rgba(255,255,255,0.14)"/>
      <rect x="0" y="0" width="1.5" height="196" rx="1" fill="rgba(255,255,255,0.08)"/>

      {/* Matte label panel with subtle texture */}
      <rect x="10" y="10" width="128" height="125" rx="4" fill="url(#cfe-panel)"/>
      {Array.from({length: 8}).map((_, i) => (
        <line key={i} x1="12" y1={18 + i * 14} x2="136" y2={18 + i * 14}
          stroke="rgba(255,255,255,0.02)" strokeWidth="1"/>
      ))}

      {/* CFexpress logotype */}
      <text x="74" y="57" textAnchor="middle"
        fontFamily="Arial, sans-serif" fontWeight="800"
        fontSize="18" letterSpacing="0.5" fill="white" fillOpacity="0.90">CFexpress</text>

      {/* Type badge */}
      <rect x="52" y="65" width="44" height="16" rx="3"
        fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8"/>
      <text x="74" y="77" textAnchor="middle"
        fontFamily="Arial, sans-serif" fontWeight="600"
        fontSize="9" letterSpacing="2" fill="rgba(255,255,255,0.6)">TYPE B</text>

      {/* Capacity */}
      <text x="74" y="108" textAnchor="middle"
        fontFamily="Arial, sans-serif" fontWeight="700"
        fontSize="22" fill="white" fillOpacity="0.82">64 GB</text>

      {/* Speed */}
      <text x="74" y="125" textAnchor="middle"
        fontFamily="Arial, sans-serif" fontWeight="400"
        fontSize="10" fill="rgba(255,255,255,0.35)" letterSpacing="1">1700 MB/s</text>

      {/* Capacity marker text */}
      <text x="74" y="153" textAnchor="middle"
        fontFamily="Arial, sans-serif" fontWeight="400"
        fontSize="9" fill="rgba(255,255,255,0.22)" letterSpacing="2">PCIe 3.0 × 2  NVMe</text>

      {/* Connector recess */}
      <rect x="12" y="166" width="124" height="28" rx="2" fill="#080808"/>
      <rect x="12" y="166" width="124" height="2" fill="rgba(255,255,255,0.04)"/>

      {/* Left pin group (before keying notch) */}
      {Array.from({length: 8}).map((_, i) => (
        <g key={i}>
          <rect x={15 + i * 6} y={168} width={4} height={11} rx="0.6" fill="rgba(200,140,20,0.88)"/>
          <rect x={15 + i * 6} y={168} width={4} height={3.5} rx="0.6" fill="rgba(255,230,100,0.3)"/>
          <rect x={15 + i * 6} y={181} width={4} height={11} rx="0.6" fill="rgba(200,140,20,0.80)"/>
        </g>
      ))}

      {/* Keying notch gap */}
      <rect x="63" y="165" width="10" height="30" rx="1" fill="url(#cfe-body)"/>
      <rect x="63" y="165" width="10" height="30" rx="1" fill="rgba(0,0,0,0.3)"/>

      {/* Right pin group (after keying notch) */}
      {Array.from({length: 11}).map((_, i) => (
        <g key={i}>
          <rect x={76 + i * 6} y={168} width={4} height={11} rx="0.6" fill="rgba(200,140,20,0.88)"/>
          <rect x={76 + i * 6} y={168} width={4} height={3.5} rx="0.6" fill="rgba(255,230,100,0.3)"/>
          <rect x={76 + i * 6} y={181} width={4} height={11} rx="0.6" fill="rgba(200,140,20,0.80)"/>
        </g>
      ))}

      {/* Bottom edge shadow */}
      <rect x="0" y="193" width="148" height="3" rx="1.5" fill="rgba(0,0,0,0.5)"/>
    </svg>
  );
}

export function CardGraphic({ type, className, style }: { type: CardType; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...style }}>
      {type === 'SD'         && <PhotoCard src={sdImg}      alt="SD / SDXC memory card"/>}
      {type === 'microSD'    && <PhotoCard src={microSdImg} alt="microSD memory card"/>}
      {type === 'CF'         && <PhotoCard src={cfImg}         alt="CompactFlash memory card"/>}
      {type === 'CFast'      && <PhotoCard src={cfastImg}     alt="CFast 2.0 memory card"/>}
      {type === 'XQD'        && <PhotoCard src={xqdImg}        alt="XQD memory card"/>}
      {type === 'CFexpress'  && <PhotoCard src={cfexpressImg}  alt="CFexpress Type B memory card"/>}
    </div>
  );
}
