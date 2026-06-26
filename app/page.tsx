import { SiteNav } from "@/components/site-nav";
import { Hero } from "@/components/hero";
import { DeployStats } from "@/components/deploy-stats";
import { LandingRebuilt } from "@/components/landing-rebuilt";
import { AskFramework } from "@/components/ask-framework";
import { RhythmStrip } from "@/components/rhythm-strip";
import { SiteFooter } from "@/components/site-footer";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="max-w-[1280px] w-full mx-auto px-6 py-8 space-y-8 flex-1">
        <Hero />
        <DeployStats />
        <LandingRebuilt />
        <AskFramework />
        <RhythmStrip />
      </main>
      <SiteFooter />
    </>
  );
}
