import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // En production, on NE masque PAS les erreurs TypeScript.
  // Le build doit échouer si une erreur de type est détectée.
  typescript: {
    ignoreBuildErrors: false,
  },
  // Note: `eslint.ignoreDuringBuilds` was REMOVED from NextConfig in Next.js 16.
  // ESLint is now run separately via `bun run lint` (see package.json).
  // Active le strict mode React (détecte les side-effects involontaires,
  // les double-rendus en dev, et les erreurs de useEffect).
  reactStrictMode: true,
  // Compresse les réponses
  compress: true,
  // Désactive le powered-by header (fingerprinting)
  poweredByHeader: false,
  // Watch the generated Prisma client so HMR picks up schema changes after
  // `bun run db:push` regenerates node_modules/.prisma/client/*.js. Without
  // this, Turbopack keeps the stale PrismaClient in memory and the new fields
  // (e.g. organizationId on Company) are reported as "Unknown argument" at
  // runtime even though the file on disk has been regenerated.
  watchOptions: {
    paths: ["node_modules/.prisma/client/**/*.js"],
  },
  // Headers de sécurité globaux appliqués à TOUTES les routes
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Empêche le MIME-sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // X-Frame-Options: DENY supprimé — bloque l'iframe du preview sandbox.
          // On utilise CSP frame-ancestors (moderne, granulaire) à la place.
          // (voir middleware.ts pour la CSP complète)
          // Politique de référence (ne pas fuiter l'URL complète vers l'extérieur)
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Désactive les fonctionnalités navigateur sensibles
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
          },
          // HSTS : force HTTPS pendant 1 an (+ preload + sous-domaines)
          ...(process.env.NODE_ENV === "production"
            ? [
                { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
              ]
            : []),
          // CSP statique (le middleware applique une version plus complète sur les routes dynamiques)
          // Important : frame-ancestors doit autoriser le preview sandbox space-z.ai
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https: http:",
              "connect-src 'self' https:",
              "frame-ancestors 'self' https://*.space-z.ai",
              "base-uri 'self'",
              "form-action 'self' https:",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
          // CORP : 'cross-origin' pour permettre l'embarquement en iframe cross-origin
          // (preview-chat-*.space-z.ai chargé par le chat UI parent)
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ]
  },
};

export default nextConfig;
