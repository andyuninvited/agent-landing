const links = [
  { label: "nvidia-receipts.vercel.app", href: "https://nvidia-receipts.vercel.app" },
  { label: "GitHub", href: "https://github.com/andyuninvited/agent-landing" },
  { label: "me@andyrosic.com", href: "mailto:me@andyrosic.com" },
];

export function SiteFooter() {
  return (
    <footer className="bg-surface border-t border-border-subtle mt-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center w-full px-6 py-8 max-w-[1280px] mx-auto gap-6">
        <div className="flex flex-col gap-1">
          <span className="font-display text-primary text-xl font-bold">Rosic</span>
          <p className="text-[12px] text-on-surface-variant">
            Built for the Product Strategy &amp; Operations conversation. Andy
            Rosic.
          </p>
          <p className="text-[11px] text-on-surface-variant opacity-60 mt-1">
            Illustrative / synthetic data. Built on Vercel with Claude Code.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary transition-all"
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
