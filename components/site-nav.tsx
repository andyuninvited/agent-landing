import { Database, Bell, Settings } from "lucide-react";

const tabs = ["Dashboard", "Agent", "APIs", "Servers", "Activity"];

export function SiteNav() {
  return (
    <nav className="bg-surface/80 backdrop-blur-md border-b border-border-subtle shadow-sm sticky top-0 z-50">
      <div className="flex justify-between items-center w-full px-6 py-2.5 max-w-[1280px] mx-auto">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" strokeWidth={2.25} />
            <span className="font-display text-[22px] font-bold text-on-surface">
              Rosic
            </span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 p-1 bg-surface-container rounded-xl">
            {tabs.map((tab, i) => (
              <span
                key={tab}
                className={
                  i === 0
                    ? "bg-primary text-on-primary rounded-lg px-3.5 py-1.5 text-[12px] font-semibold tracking-wide"
                    : "text-on-surface-variant hover:text-on-surface px-3.5 py-1.5 text-[12px] font-semibold tracking-wide transition-colors cursor-default"
                }
              >
                {tab}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Settings"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container transition-all text-on-surface-variant"
          >
            <Settings className="w-5 h-5" />
          </button>
          <div className="relative">
            <button
              type="button"
              aria-label="Notifications"
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container transition-all text-on-surface-variant"
            >
              <Bell className="w-5 h-5" />
            </button>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" />
          </div>
          <span className="w-9 h-9 rounded-full border-2 border-surface-white bg-gradient-to-br from-electric-purple to-deep-blue flex items-center justify-center text-on-primary text-[12px] font-bold">
            AR
          </span>
        </div>
      </div>
    </nav>
  );
}
