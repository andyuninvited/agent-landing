import { CheckCircle2, RefreshCw } from "lucide-react";
import { rhythmStrip } from "@/lib/data";

export function RhythmStrip() {
  return (
    <section className="py-2">
      <h3 className="text-[10px] text-on-surface-variant font-semibold uppercase mb-4 tracking-widest">
        ShipOps rhythm strip
      </h3>
      <div className="flex overflow-x-auto gap-3 no-scrollbar pb-2">
        {rhythmStrip.map((d) => {
          if (d.state === "active") {
            return (
              <div
                key={d.day}
                className="min-w-[180px] shrink-0 bg-surface-white p-3.5 rounded-xl border-2 border-electric-purple/30 ring-2 ring-electric-purple/5"
              >
                <span className="text-[9px] font-bold text-electric-purple uppercase">
                  {d.day}
                </span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-display text-xl font-semibold text-on-surface">
                    {d.deploys}
                  </span>
                  <RefreshCw className="w-4 h-4 text-electric-purple agent-pulse" />
                </div>
                <p className="text-[11px] text-on-surface-variant mt-1">
                  {d.feature}
                </p>
              </div>
            );
          }
          if (d.state === "done") {
            return (
              <div
                key={d.day}
                className="min-w-[180px] shrink-0 bg-surface-white border border-border-subtle p-3.5 rounded-xl flex flex-col gap-1"
              >
                <span className="text-[9px] font-bold text-outline uppercase">
                  {d.day}
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-display text-xl font-semibold text-on-surface">
                    {d.deploys}
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-success-green" />
                </div>
                <p className="text-[11px] text-on-surface-variant">{d.feature}</p>
              </div>
            );
          }
          return (
            <div
              key={d.day}
              className="min-w-[180px] shrink-0 bg-surface-container/50 border border-border-subtle p-3.5 rounded-xl opacity-60"
            >
              <span className="text-[9px] font-bold text-outline uppercase">
                {d.day}
              </span>
              <span className="font-display text-xl font-semibold text-on-surface block mt-1">
                {d.feature ?? "--"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
