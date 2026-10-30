import type { MetadataRoute } from "next";
import { SITE } from "@/lib/agent/content";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE.url }];
}
