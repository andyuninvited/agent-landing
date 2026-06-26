type SparklineProps = {
  // normalized points in [0,1], 1 = top of the box
  points: number[];
  stroke: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  fill?: string;
};

// Builds a smooth-ish polyline path from normalized points over a 100x40 box.
function toPath(points: number[]): string {
  if (points.length < 2) return "";
  const stepX = 100 / (points.length - 1);
  return points
    .map((v, i) => {
      const x = i * stepX;
      const y = 40 - v * 40;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function Sparkline({
  points,
  stroke,
  width = 64,
  height = 32,
  strokeWidth = 2.5,
  fill,
}: SparklineProps) {
  const line = toPath(points);
  const area = fill ? `${line} L100,40 L0,40 Z` : "";
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      {fill && <path d={area} fill={fill} stroke="none" />}
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
