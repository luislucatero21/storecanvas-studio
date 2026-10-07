/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // The dev-mode "N" badge was captured into rendered App Store exports.
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
