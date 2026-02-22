import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 开发环境优化
  reactStrictMode: true,
  

  
  // 优化图片加载（如果有图片的话）
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.githubusercontent.com',
      },
    ],
  },
  
  // 实验性功能：优化包大小
  experimental: {
    optimizePackageImports: ['react-markdown', 'react-syntax-highlighter'],
  },
};

export default nextConfig;
