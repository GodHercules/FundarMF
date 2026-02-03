/** @type {import('next').NextConfig} */
const apiBase = (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(
  /\/$/,
  ""
);

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@fundarmf/shared"],
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
