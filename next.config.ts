import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['xlsx'],
  turbopack: {},
};

export default nextConfig;
