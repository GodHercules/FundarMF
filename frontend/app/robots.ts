import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/client"],
      disallow: ["/api/", "/apix/", "/master/", "/operator/", "/client/link", "/client/dashboard", "/client/process/", "/client/onboarding", "/client/submitted"]
    },
    sitemap: `${siteUrl.replace(/\/$/, "")}/sitemap.xml`
  };
}
