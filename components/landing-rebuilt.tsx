import { X } from "lucide-react";
import { Sparkline } from "./sparkline";
import { legacyMetrics, agentMetrics } from "@/lib/data";

export function LandingRebuilt() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-8 py-2">
      {/* Legacy - blind to agents */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-8 h-1 bg-outline rounded-full" />
          <h3 className="font-display text-lg font-semibold text-on-surface">
            Landing, the old way
          </h3>
        </div>
        <div className="space-y-3 opacity-70">
          <span className="text-[10px] font-bold text-on-error-container uppercase bg-error-container/40 px-2 py-0.5 rounded inline-block line-through">
            Blind to agents
          </span>
          <div className="bg-surface-container rounded-xl p-4 border border-border-subtle space-y-2">
            <h4 className="text-sm font-bold text-on-surface line-through">
              Legacy metrics
            </h4>
            <ul className="space-y-2">
              {legacyMetrics.map((m) => (
                <li
                  key={m}
                  className="flex items-center gap-2 text-[12px] text-on-surface-variant italic"
                >
                  <X className="w-3.5 h-3.5 shrink-0" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Agent-native replacements */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-8 h-1 bg-electric-purple rounded-full" />
          <h3 className="font-display text-lg font-semibold text-on-surface">
            Agent-native metrics
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-2.5">
          {agentMetrics.map((m) => (
            <div
              key={m.key}
              className="bg-surface-white border border-border-subtle rounded-xl p-3.5 shadow-sm flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <span className="text-on-surface-variant text-[9px] font-semibold uppercase tracking-wider">
                  {m.label}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-on-surface">
                    {m.value}
                  </span>
                  <span
                    className={
                      "text-[10px] font-bold " +
                      (m.deltaTone === "good"
                        ? "text-success-green"
                        : "text-on-surface-variant")
                    }
                  >
                    {m.delta}
                  </span>
                </div>
              </div>
              <Sparkline
                points={m.spark}
                stroke={m.accent === "green" ? "#10B981" : "#0051d5"}
              />
            </div>
          ))}
          <p className="text-[11px] text-on-surface-variant leading-relaxed pt-1">
            Plus agent retry / success rate and downstream reuse of the shipped
            surface. The signal a human-click metric cannot capture.
          </p>
        </div>
      </div>
    </section>
  );
}
