import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  turbopack: {
    resolveAlias: {
      '@coffee-atlas/shared-types': '../../packages/shared-types/dist/index.js',
    },
  },
};

export default nextConfig;
