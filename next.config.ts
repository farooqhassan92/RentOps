import type { NextConfig } from "next";
const config: NextConfig = {
  // Preserve the origin used by Clerk's internal rewrite. Normalizing 127.0.0.1
  // to localhost makes Next treat it as an external proxy to this same server.
  skipProxyUrlNormalize: true,
  serverExternalPackages: ["pg"],
  outputFileTracingIncludes: { "/api/documents/*": ["./assets/*.woff"] },
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    ] }];
  },
};
export default config;
