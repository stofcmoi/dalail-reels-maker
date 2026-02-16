/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow fetching remote images for preview background (optional)
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
};
export default nextConfig;
