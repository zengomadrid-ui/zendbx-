import { MetadataRoute } from "next";

const PRODUCTION_HOST = "zendbx.in";

export default function robots(): MetadataRoute.Robots {
  // Detect whether we're running on the real production domain.
  // NEXT_PUBLIC_APP_URL is set to https://zendbx.in only in production Vercel env.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const isProduction = appUrl.includes(PRODUCTION_HOST);

  if (!isProduction) {
    // Development / staging / preview — block everything
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/docs/", "/community/"],
        disallow: [
          "/dashboard/",
          "/api/",
          "/login",
          "/signup",
          "/onboarding",
          "/select-project",
          "/callback",
          "/forgot-password",
          "/reset-password",
          "/_next/",
        ],
      },
    ],
    sitemap: `https://${PRODUCTION_HOST}/sitemap.xml`,
  };
}
