/** @type {import('next').NextConfig} */
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3000";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@spruvex-r/ui", "@spruvex-r/types"],
  // `pnpm lint` runs our shared flat-config (packages/config/eslint.base.mjs)
  // across all apps; Next's own build-time ESLint step would need its
  // separate `eslint-config-next` plugin wired in, which we don't use here.
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${API_ORIGIN}/api/v1/:path*` }];
  },
};

export default nextConfig;
