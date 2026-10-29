// robots.txt per RFC 9309: groups by user-agent, longest matching rule wins, allow wins ties.

export type RobotsRule = { allow: boolean; pattern: string };
export type RobotsGroup = { agents: string[]; rules: RobotsRule[] };
export type Robots = { groups: RobotsGroup[]; sitemaps: string[] };

export const parseRobots = (text: string): Robots => {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;

  text.split(/\r\n|\r|\n/).forEach((rawLine) => {
    const line = rawLine.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) return;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "sitemap") {
      if (value) sitemaps.push(value);
      return;
    }
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      return;
    }
    lastWasAgent = false;
    if (!current) return;
    if (key === "allow" || key === "disallow") {
      // An empty Disallow allows everything; it adds no rule.
      if (value === "" && key === "disallow") return;
      current.rules.push({ allow: key === "allow", pattern: value });
    }
  });
  return { groups, sitemaps };
};

const groupsFor = (robots: Robots, agent: string): RobotsGroup[] => {
  const token = agent.toLowerCase();
  const named = robots.groups.filter((g) => g.agents.includes(token));
  return named.length > 0 ? named : robots.groups.filter((g) => g.agents.includes("*"));
};

export const hasNamedGroup = (robots: Robots, agent: string): boolean =>
  robots.groups.some((g) => g.agents.includes(agent.toLowerCase()));

const escapeRegex = (s: string): string => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

const patternMatches = (pattern: string, path: string): boolean => {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = new RegExp(`^${body.split("*").map(escapeRegex).join(".*")}${anchored ? "$" : ""}`);
  return re.test(path);
};

export const isAllowed = (robots: Robots, agent: string, path: string): boolean => {
  const rules = groupsFor(robots, agent).flatMap((g) => g.rules);
  const matches = rules.filter((r) => patternMatches(r.pattern, path));
  if (matches.length === 0) return true;
  const best = matches.reduce((a, b) =>
    b.pattern.length > a.pattern.length || (b.pattern.length === a.pattern.length && b.allow) ? b : a,
  );
  return best.allow;
};
