import { featureById, featureJson, json } from "@/lib/agent/content";
import { features } from "@/lib/data";

export const generateStaticParams = () => features.map((f) => ({ id: f.id }));

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const f = featureById((await params).id);
  return f ? json(featureJson(f)) : json({ error: "Not found" }, 404);
}
