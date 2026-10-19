/** @type {import('next').NextConfig} */
// NOTE: `/api/*` requests are proxied (via rewrites) to the backend service.
// On Vercel, if `NEXT_PUBLIC_API_URL` is accidentally set with a `/api` suffix
// (or points back to the same frontend domain), it can cause loops or uploads
// never reaching the backend. We defensively strip a trailing `/api`.
const rawApiBase = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const apiBase = rawApiBase.replace(/\/api\/?$/, "").replace(/\/$/, "");

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    const scriptSources = process.env.NODE_ENV === "production" ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline' 'unsafe-eval'";
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      {
        key: "Content-Security-Policy",
        value: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src ${scriptSources}; connect-src 'self' https://servicodados.ibge.gov.br`
      }
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
    }
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/client/link", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] }
    ];
  },
  async rewrites() {
    return [
      {
        source: "/apix/:path*",
        destination: `${apiBase}/:path*`
      },
      {
        source: "/api/:path*",
        destination: `${apiBase}/:path*`
      }
    ];
  }
};

export default nextConfig;
