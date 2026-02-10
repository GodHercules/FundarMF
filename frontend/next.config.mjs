/** @type {import('next').NextConfig} */
// NOTE: `/api/*` requests are proxied (via rewrites) to the backend service.
// On Vercel, if `NEXT_PUBLIC_API_URL` is accidentally set with a `/api` suffix
// (or points back to the same frontend domain), it can cause loops or uploads
// never reaching the backend. We defensively strip a trailing `/api`.
const rawApiBase = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const apiBase = rawApiBase.replace(/\/api\/?$/, "").replace(/\/$/, "");

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/:path*`
      }
    ];
  }
};

export default nextConfig;
