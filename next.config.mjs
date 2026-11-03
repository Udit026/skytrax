
/** @type {import("next").NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  output: "standalone",
  serverExternalPackages: ["sharp", "pg"],
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "same-origin" },
      ],
    }];
  },
};
export default nextConfig;
