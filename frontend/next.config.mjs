/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['pino', 'pino-pretty'],
  },
  webpack: (config, { isServer }) => {
    // Fixes npm packages that depend on `fs` module
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        module: false,
        perf_hooks: false,
      };
    }

    return config;
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },

  // Proxy to the NestJS backend. `fallback` runs only after Next's own
  // filesystem routes AND its dynamic routes are checked — the default
  // (afterFiles) still beat dynamic segments, so every multi-segment route
  // like /api/media/[...path] was being proxied away and 404ing.
  async rewrites() {
    // Hardcoding localhost here meant a deployed frontend proxied /api to
    // nothing. Same default as the GraphQL client so `pnpm dev` is unchanged.
    const backend =
      process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8080';
    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: `${backend}/api/:path*`,
        },
        // Published pages are served by the backend but linked on the
        // product's own domain — a share link pointing at the Railway host
        // is not one anybody would send.
        {
          source: '/share/:id',
          destination: `${backend}/share/:id`,
        },
      ],
    };
  },
};

export default nextConfig;
