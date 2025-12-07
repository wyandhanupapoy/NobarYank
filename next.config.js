/** @type {import('./syncwatch/node_modules/next').NextConfig} */
const nextConfig = {
  async headers() {
    return [];
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

module.exports = nextConfig;