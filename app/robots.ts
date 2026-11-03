import type { MetadataRoute } from "next";

// Disallow everything rather than listing the client slug: robots.txt is public, so naming the
// slug here would reveal the "secret" client URL to anyone who requests it.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
