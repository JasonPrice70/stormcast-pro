import React from 'react';

interface CycloTrakIconProps {
  size?: number;
  className?: string;
}

/**
 * CycloTrak brand icon — a white cyclone spiral on a navy-to-teal gradient circle.
 * The spiral shape is derived from the NHC-standard hurricane symbol.
 */
const CycloTrakIcon: React.FC<CycloTrakIconProps> = ({ size = 32, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="CycloTrak logo"
    role="img"
  >
    <defs>
      <linearGradient id="ct-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6b1a1a" />
        <stop offset="100%" stopColor="#8b1a1a" />
      </linearGradient>
      <linearGradient id="ct-spiral" x1="0" y1="0" x2="455" y2="640" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
        <stop offset="100%" stopColor="#a8d8f0" stopOpacity="0.85" />
      </linearGradient>
    </defs>

    {/* Background circle */}
    <circle cx="20" cy="20" r="19.5" fill="url(#ct-bg)" />

    {/* Subtle outer ring */}
    <circle
      cx="20"
      cy="20"
      r="18.5"
      fill="none"
      stroke="rgba(255,255,255,0.15)"
      strokeWidth="0.75"
    />

    {/* Inner radius accent ring */}
    <circle
      cx="20"
      cy="20"
      r="6"
      fill="none"
      stroke="rgba(255,255,255,0.18)"
      strokeWidth="0.5"
    />

    {/*
      Cyclone spiral — spins counter-clockwise via native SVG animateTransform.
      Rotates around the path's center (227.5, 320) in the 455×640 coordinate space.
    */}
    <g transform="translate(11, 8) scale(0.038)">
      <path
        fill="url(#ct-spiral)"
        d="M404.75,422.16C344.9,540.18,188.17,639.96.11,639.78c-5.6-.02,200.47-113.65,132.59-152.82
           C40.8,433.89,6.14,314.27,52.78,218.95,108.63,104.8,263.52-5.63,454.97.22
           c6.5.2-194.96,116.53-130.14,153.95,91.89,53.05,127.92,173.36,79.92,267.99Z"
      >
        <animateTransform
          attributeName="transform"
          attributeType="XML"
          type="rotate"
          from="0 227.5 320"
          to="-360 227.5 320"
          dur="6s"
          repeatCount="indefinite"
        />
      </path>
    </g>
  </svg>
);

export default CycloTrakIcon;
