import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@neuravolt/shared-types', '@neuravolt/shared-prisma', '@neuravolt/shared-config', '@neuravolt/shared-utils'],
  // Local dev only: production serves this app behind an nginx reverse proxy that routes
  // `/api` to the NestJS API on its own host (see README's "Services & Port Mappings" /
  // deploy-script section) — that proxy doesn't exist when running `next dev` standalone, so
  // every client-side fetch to `/api/...` (src/lib/api.ts's baseURL, which deliberately always
  // resolves to `/api` in the browser and refuses a hardcoded localhost:3001) 404s against
  // Next.js's own dev server instead. Gated on NODE_ENV so a production build/start never adds
  // this rewrite — nginx already owns `/api` there, this changes nothing in that path.
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    return [{ source: '/api/:path*', destination: 'http://localhost:3001/:path*' }];
  },
  async redirects() {
    return [
      {
        source: '/security',
        destination: '/guardian/overview',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
