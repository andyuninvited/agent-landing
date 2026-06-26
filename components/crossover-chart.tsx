// Human vs agent deploy crossover - the undeniable visual. Hand-tuned smooth
// curves (illustrative) in a uniformly-scaled SVG so the labels never distort.

type Pt = { x: number; y: number };

// Catmull-Rom -> cubic bezier for a smooth line through the points.
function smooth(points: Pt[]): string {
  if (points.length < 2) return "";
  const d: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x} ${p2.y}`);
  }
  return d.join(" ");
}

const human: Pt[] = [
  { x: 8, y: 96 },
  { x: 90, y: 88 },
  { x: 165, y: 102 },
  { x: 240, y: 98 },
  { x: 312, y: 96 },
];

const agent: Pt[] = [
  { x: 8, y: 168 },
  { x: 90, y: 152 },
  { x: 170, y: 118 },
  { x: 245, y: 70 },
  { x: 312, y: 34 },
];

export function CrossoverChart({ className = "" }: { className?: string }) {
  const humanLine = smooth(human);
  const agentLine = smooth(agent);
  const agentArea = `${agentLine} L 312 190 L 8 190 Z`;

  return (
    <svg
      viewBox="0 0 320 190"
      className={className}
      role="img"
      aria-label="Illustrative chart: human deploys stay flat while agent deploys ramp up and cross over them."
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="agentFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={agentArea} fill="url(#agentFill)" />

      <path
        d={humanLine}
        fill="none"
        stroke="#9ca3af"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d={agentLine}
        fill="none"
        stroke="#8B5CF6"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* endpoint dot on the agent line */}
      <circle cx="312" cy="34" r="4" fill="#8B5CF6" />

      <text
        x="300"
        y="24"
        textAnchor="end"
        className="fill-electric-purple"
        fontSize="12"
        fontWeight="700"
        letterSpacing="0.12em"
      >
        AGENT
      </text>
      <text
        x="120"
        y="80"
        textAnchor="middle"
        fill="#9ca3af"
        fontSize="11"
        fontWeight="700"
        letterSpacing="0.12em"
      >
        HUMAN
      </text>
    </svg>
  );
}
