import { CrossoverChart } from "./crossover-chart";

export function Hero() {
  return (
    <section className="relative bg-surface-white border border-border-subtle rounded-3xl p-8 overflow-hidden shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
        <div className="relative z-10">
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="bg-primary text-on-primary px-2.5 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase">
              Illustrative / Synthetic
            </span>
            <span className="bg-success-green/10 text-success-green px-2.5 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-success-green rounded-full agent-pulse" />
              Live Agent Feed
            </span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-on-surface mb-3 leading-[1.05] font-bold">
            Vercel&apos;s fastest-growing user
            <br />
            <span className="text-on-primary-container">isn&apos;t human.</span>
          </h1>
          <p className="text-[15px] leading-relaxed text-on-surface-variant mb-6 max-w-xl">
            Agents now account for ~30% of deploys, most of them Claude Code. As
            a human-adoption framework goes blind to that user, the operating
            rhythm and the landing measurement have to be rebuilt for the
            agent-as-user era. This is what that looks like.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-outline">
            <div className="flex items-center gap-2 bg-surface-container rounded-full pl-1.5 pr-3 py-1.5 border border-border-subtle">
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-electric-purple to-deep-blue flex items-center justify-center text-on-primary text-[9px] font-bold">
                AR
              </span>
              <span className="text-on-surface-variant font-medium">
                Andy Rosic / me@andyrosic.com
              </span>
            </div>
            <span className="italic text-[12px]">
              Illustrative data. Built on Vercel, with Claude Code, in an
              afternoon.
            </span>
          </div>
        </div>

        <div className="relative z-10 w-full">
          <CrossoverChart className="w-full h-[180px] md:h-[210px]" />
        </div>
      </div>
    </section>
  );
}
