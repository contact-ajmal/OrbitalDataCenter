// Original AI1 logo mark (no third-party artwork): an orbital ellipse tilted at
// the real 97.6° inclination, a satellite diamond on the ring, and an Earth core
// split by a terminator line. Themed via currentColor + design tokens.

const INC_DEG = 97.6;

// satellite diamond position: a point on the (un-rotated) ellipse, then rotated
// by the inclination, expressed in the 36×36 viewBox.
const RX = 15;
const RY = 5.5;
const CX = 18;
const CY = 18;
const tParam = (-50 * Math.PI) / 180; // where the satellite sits on the ring
const incRad = (INC_DEG * Math.PI) / 180;
const ex = RX * Math.cos(tParam);
const ey = RY * Math.sin(tParam);
const SAT_X = CX + ex * Math.cos(incRad) - ey * Math.sin(incRad);
const SAT_Y = CY + ex * Math.sin(incRad) + ey * Math.cos(incRad);

export function Logo({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <clipPath id="ai1-core">
          <circle cx={CX} cy={CY} r="8" />
        </clipPath>
      </defs>

      {/* Earth core: dark sphere with a lit half + terminator line */}
      <circle cx={CX} cy={CY} r="8" fill="#0e1d33" />
      <g clipPath="url(#ai1-core)">
        <rect x={CX} y={CY - 8} width="8" height="16" fill="#1b3b63" />
        <line x1={CX} y1={CY - 8} x2={CX} y2={CY + 8} stroke="var(--color-solar)" strokeWidth="0.6" />
      </g>
      <circle cx={CX} cy={CY} r="8" stroke="var(--color-dim)" strokeWidth="0.5" />

      {/* Orbital ellipse tilted to the real inclination */}
      <ellipse
        cx={CX}
        cy={CY}
        rx={RX}
        ry={RY}
        stroke="var(--color-laser)"
        strokeWidth="1.2"
        transform={`rotate(${INC_DEG} ${CX} ${CY})`}
      />

      {/* Satellite diamond on the ring */}
      <rect
        x={SAT_X - 2}
        y={SAT_Y - 2}
        width="4"
        height="4"
        fill="var(--color-solar)"
        transform={`rotate(45 ${SAT_X} ${SAT_Y})`}
      />
    </svg>
  );
}
