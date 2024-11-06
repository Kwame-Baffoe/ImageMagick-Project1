/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverActions: true,
      },
      images: {
        domains: ['localhost'],
        remotePatterns: [
          {
            protocol: 'http',
            hostname: 'localhost',
            port: '3000',
            pathname: '/uploads/**',
          },
        ],
      }
};

export default nextConfig;
