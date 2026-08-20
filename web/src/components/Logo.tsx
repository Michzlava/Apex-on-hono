// components/Logo.tsx
interface LogoProps {
  width?: number | string;
  height?: number | string;
  className?: string;
}

export default function Logo({ width = 240, height = 40, className }: LogoProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 380 60" 
      width={width} 
      height={height} 
      className={className}
    >
      <defs>
        {/* Sleek, vibrant gradient for the primary peak leg */}
        <linearGradient id="apexPeakGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2E7A9C" />
          <stop offset="100%" stopColor="#4FA3C4" />
        </linearGradient>
      </defs>

      {/* Simplified, Modern Stroke-Based "A" Mark */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Outer Minimal Peak / A-Frame */}
        <path 
          d="M 14 46 L 32 14 L 50 46" 
          stroke="url(#apexPeakGrad)" 
          strokeWidth="6.5" 
        />
        {/* Sharp, vibrant execution engine crossbar */}
        <path 
          d="M 22 34 L 42 34" 
          stroke="#00D68A" 
          strokeWidth="4.5" 
        />
      </g>

      {/* Single Line Typographic Layout with Resilient tspan Spacing */}
      <text 
        x="72" 
        y="41" 
        fontFamily="'Barlow Condensed', 'DM Sans', system-ui, sans-serif" 
        fontSize="30" 
        fontWeight="800" 
        fill="var(--ink)" 
        letterSpacing="3"
      >
        APEX
        <tspan 
          fontWeight="400" 
          fill="var(--ink-dim)" 
          letterSpacing="6" 
          dx="10"
        >
          MARKETS
        </tspan>
      </text>
    </svg>
  );
}
