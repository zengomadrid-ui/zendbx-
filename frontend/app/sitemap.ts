import { MetadataRoute } from "next";

const BASE = "https://zendbx.in";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date("2026-06-19");

  return [
    { url: `${BASE}/`,                          lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/docs`,                      lastModified: now, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${BASE}/docs/database`,             lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/docs/auth`,                 lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/docs/storage`,              lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/docs/realtime`,             lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/docs/rest`,                 lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/docs/sdk`,                  lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/docs/architecture`,         lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/docs/migrate/supabase`,     lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/docs/storage/signed-urls`,  lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/community`,                 lastModified: now, changeFrequency: "weekly",  priority: 0.6 },
  ];
}
