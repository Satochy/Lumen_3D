import type { NextConfig } from "next";

// Host do Supabase derivado do .env (evita erro de digitação)
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    minimumCacheTTL: 2592000,
  },
  experimental: {
    // 6 fotos x 5 MB + campos do formulário (o padrão é 1 MB)
    serverActions: {
      bodySizeLimit: "32mb",
    },
  },
};

export default nextConfig;