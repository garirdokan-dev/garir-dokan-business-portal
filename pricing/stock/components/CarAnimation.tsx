import React from 'react';
import { motion } from 'motion/react';

interface CarAnimationProps {
  width?: number;
  driving?: boolean;
  color?: string;
  className?: string;
}

/**
 * Side-view car with spinning wheels, scrolling road, headlight glow and speed lines.
 * Brand: deep crimson. Pure presentation — no business logic.
 */
export const CarAnimation: React.FC<CarAnimationProps> = ({
  width = 260,
  driving = false,
  color = '#C1452C',
  className = '',
}) => {
  const light = '#D9694F';
  const dark = '#8E3120';
  const wheelSpin = driving ? 0.5 : 3;
  const height = (width * 130) / 260;

  return (
    <div className={className} style={{ width, height }} aria-hidden="true">
      <svg viewBox="0 0 260 130" width={width} height={height} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="carBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={light} />
            <stop offset="55%" stopColor={color} />
            <stop offset="100%" stopColor={dark} />
          </linearGradient>
          <linearGradient id="carGlass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f3f4f6" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <radialGradient id="headGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff4c2" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#fff4c2" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ---- Road ---- */}
        <line x1="0" y1="115" x2="260" y2="115" stroke="#E2D9C6" strokeWidth="3" strokeLinecap="round" />
        <motion.g
          animate={driving ? { x: [0, -44] } : { x: 0 }}
          transition={driving ? { repeat: Infinity, duration: 0.5, ease: 'linear' } : { duration: 0.4 }}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <rect key={i} x={i * 44} y={113.5} width="22" height="3" rx="1.5" fill="#CDBFA3" />
          ))}
        </motion.g>

        {/* ---- Car (gentle vertical bob) ---- */}
        <motion.g
          animate={{ y: driving ? [0, -1.5, 0] : [0, -2.5, 0] }}
          transition={{ repeat: Infinity, duration: driving ? 0.35 : 2.4, ease: 'easeInOut' }}
        >
          <ellipse cx="130" cy="112" rx="96" ry="7" fill="#14211F" opacity="0.12" />

          {driving && <circle cx="242" cy="86" r="16" fill="url(#headGlow)" />}

          {driving && (
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.6, 0], x: [10, -30] }}
              transition={{ repeat: Infinity, duration: 0.5, ease: 'easeOut' }}
              stroke="#E7A08F"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="6" y1="66" x2="26" y2="66" />
              <line x1="0" y1="80" x2="22" y2="80" />
              <line x1="8" y1="94" x2="24" y2="94" />
            </motion.g>
          )}

          {/* lower body */}
          <path
            d="M20 96 Q18 74 40 72 L66 72 L92 48 Q96 44 104 44 L176 44 Q186 44 192 52 L212 72 L232 76 Q244 78 244 92 L244 96 Q244 100 240 100 L24 100 Q20 100 20 96 Z"
            fill="url(#carBody)"
            stroke={dark}
            strokeWidth="1.5"
          />
          {/* roof shading */}
          <path d="M96 49 Q99 46 105 46 L174 46 Q183 46 189 53 L205 70 L100 70 Z" fill={dark} opacity="0.30" />
          {/* windows */}
          <path d="M104 50 L150 50 L150 68 L110 68 Z" fill="url(#carGlass)" />
          <path d="M156 50 L173 50 Q181 50 186 57 L196 68 L156 68 Z" fill="url(#carGlass)" />
          <rect x="151.5" y="50" width="3" height="18" rx="1" fill={dark} opacity="0.5" />
          {/* door line + handle */}
          <line x1="130" y1="72" x2="130" y2="96" stroke={dark} strokeWidth="1.5" opacity="0.4" />
          <rect x="112" y="80" width="12" height="3" rx="1.5" fill={dark} opacity="0.5" />
          {/* lights */}
          <rect x="236" y="80" width="8" height="8" rx="2" fill="#fff4c2" stroke={dark} strokeWidth="0.75" />
          <rect x="20" y="80" width="6" height="8" rx="2" fill="#ffb3b3" stroke={dark} strokeWidth="0.75" />

          {/* wheels */}
          {[80, 188].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy="100" r="20" fill="#1f2937" />
              <circle cx={cx} cy="100" r="20" fill="none" stroke="#0b0f14" strokeWidth="2" />
              <motion.g
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: wheelSpin, ease: 'linear' }}
              >
                <circle cx={cx} cy="100" r="11" fill="#f3f4f6" />
                <circle cx={cx} cy="100" r="3.2" fill="#9ca3af" />
                {Array.from({ length: 5 }).map((_, i) => {
                  const a = (i * 72 * Math.PI) / 180;
                  return (
                    <line
                      key={i}
                      x1={cx}
                      y1="100"
                      x2={cx + Math.cos(a) * 10}
                      y2={100 + Math.sin(a) * 10}
                      stroke="#cbd5e1"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                  );
                })}
              </motion.g>
            </g>
          ))}
        </motion.g>
      </svg>
    </div>
  );
};
