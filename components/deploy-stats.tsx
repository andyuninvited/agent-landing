"use client";

import { useState } from "react";
import { Bot, Rocket, Hexagon, TrendingUp } from "lucide-react";
import {
  deployMixMonthly,
  deployMixWeekly,
  headlineStats,
  type DeployPoint,
} from "@/lib/data";

type Range = "monthly" | "weekly";

function normalize(series: DeployPoint[]) {
  const max = Math.max(...series.map((p) => p.human + p.agent));
  return {
    human: series.map((p) => p.human / max),
    agent: series.map((p) => p.agent / max),
  };
}

function areaPath(points: number[]): string {
  if (points.length < 2) return "";
  const stepX = 100 / (points.length - 1);
  const line = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)},${(40 - v * 38).toFixed(1)}`)
    .join(" ");
  return `${line} L100,40 L0,40 Z`;
}

function linePath(points: number[]): string {
  const stepX = 100 / (points.length - 1);
  return points
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)},${(40 - v * 38).toFixed(1)}`)
    .join(" ");
}

export function DeployStats() {
  const [range, setRange] = useState<Range>("monthly");
  const series = range === "monthly" ? deployMixMonthly : deployMixWeekly;
  const norm = normalize(series);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[22px] font-semibold text-on-surface">
          Who&apos;s actually deploying
        </h2>
        <div className="flex bg-surface-container rounded-lg p-0.5 gap-0.5">
          {(["monthly", "weekly"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={
                "px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all " +
                (range === r
                  ? "bg-surface-white shadow-sm text-primary"
                  : "text-on-surface-variant hover:text-on-surface")
              }
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Agent Deploys"
          icon={<Bot className="w-5 h-5 text-electric-purple" />}
          value={`~${headlineStats.agentDeploySharePct}%`}
          footer={
            <span className="text-success-green text-[11px] font-bold flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> +{headlineStats.agentShareDeltaPct}%
            </span>
          }
        />
        <StatCard
          label="Growth Rate"
          icon={<Rocket className="w-5 h-5 text-on-surface" />}
          value={headlineStats.growthRateLabel}
          footer={
            <span className="text-on-surface-variant text-[11px] font-medium">
              {headlineStats.growthWindow}
            </span>
          }
        />
        <StatCard
          label="Dominant Agent"
          icon={<Hexagon className="w-5 h-5 text-deep-blue" />}
          value={`${headlineStats.dominantAgentPct}%`}
          footer={
            <span className="text-on-surface-variant text-[11px] font-medium">
              {headlineStats.dominantAgent}
            </span>
          }
        />

        {/* Chart card: human vs agent deploy mix */}
        <div className="bg-surface-white border border-border-subtle rounded-2xl p-4 shadow-sm relative overflow-hidden min-h-[132px] flex flex-col">
          <div className="flex justify-between items-center mb-1 relative z-10">
            <span className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-wider">
              Deploy mix
            </span>
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase">
              <span className="flex items-center gap-1 text-electric-purple">
                <span className="w-1.5 h-1.5 rounded-full bg-electric-purple" />
                Agent
              </span>
              <span className="flex items-center gap-1 text-outline">
                <span className="w-1.5 h-1.5 rounded-full bg-outline/50" />
                Human
              </span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-16">
            <svg
              className="w-full h-full"
              viewBox="0 0 100 40"
              preserveAspectRatio="none"
            >
              <path d={areaPath(norm.human)} fill="rgba(116,120,120,0.08)" />
              <path
                d={linePath(norm.human)}
                fill="none"
                stroke="#747878"
                strokeOpacity={0.5}
                strokeWidth={1.25}
              />
              <path d={areaPath(norm.agent)} fill="rgba(139,92,246,0.12)" />
              <path
                d={linePath(norm.agent)}
                fill="none"
                stroke="#8B5CF6"
                strokeWidth={1.75}
              />
            </svg>
          </div>
          <div className="relative z-10 mt-auto">
            <span className="text-xl font-bold text-on-surface">
              +{headlineStats.executionsPeakPct}%
            </span>
            <p className="text-[9px] text-on-surface-variant uppercase font-bold tracking-tight">
              Agent executions peak
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  icon,
  value,
  footer,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  footer: React.ReactNode;
}) {
  return (
    <div className="bg-surface-white border border-border-subtle rounded-2xl p-4 shadow-sm flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <span className="text-on-surface-variant text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
        {icon}
      </div>
      <div>
        <span className="font-display text-3xl font-bold text-on-surface">
          {value}
        </span>
        <div className="mt-1">{footer}</div>
      </div>
    </div>
  );
}
