import type { NextConfig } from "next";

const competitionDemo =
  process.env.NEXT_PUBLIC_COMPETITION_DEMO === "true" ||
  process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_COMPETITION_DEMO: competitionDemo ? "true" : "false",
  },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // Staged builds must not infer the private parent workspace as their root.
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...(competitionDemo
            ? [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }]
            : []),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'${process.env.NODE_ENV === "development" && !competitionDemo ? " ws://127.0.0.1:*" : ""}; frame-ancestors 'none'; base-uri 'self'; form-action 'none'; object-src 'none'`,
          },
        ],
      },
    ];
  },
};
export default nextConfig;
