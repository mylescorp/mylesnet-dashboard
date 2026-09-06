import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    const platformToFlat = [
      { source: "/platform", destination: "/dashboard" },
      { source: "/platform/alerts", destination: "/incidents" },
      { source: "/platform/unauthorized", destination: "/no-access" },
      { source: "/platform/access/:path*", destination: "/access/:path*" },
      { source: "/platform/audit-log/:path*", destination: "/audit-log/:path*" },
      { source: "/platform/commissions/:path*", destination: "/commissions/:path*" },
      { source: "/platform/comms/:path*", destination: "/comms/:path*" },
      { source: "/platform/compliance/:path*", destination: "/compliance/:path*" },
      { source: "/platform/devices/:path*", destination: "/devices/:path*" },
      { source: "/platform/leaderboard/:path*", destination: "/leaderboard/:path*" },
      { source: "/platform/prospects/:path*", destination: "/prospects/:path*" },
      { source: "/platform/tickets/:path*", destination: "/tickets/:path*" },
      { source: "/platform/trash/:path*", destination: "/trash/:path*" },
      { source: "/platform/vouchers/:path*", destination: "/vouchers/:path*" },
      { source: "/platform/agents/:path*", destination: "/agents/:path*" },
      { source: "/platform/markets/:path*", destination: "/markets/:path*" },
    ];
    return platformToFlat.map(({ source, destination }) => ({
      source,
      destination,
      permanent: true,
    }));
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
