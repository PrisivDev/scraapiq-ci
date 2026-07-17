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
  // Headers de sécurité globaux appliqués à TOUTES les routes
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Empêche le MIME-sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Empêche le clickjacking
          { key: "X-Frame-Options", value: "DENY" },
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
          // CSP — voir middleware.ts pour la version dynamique avec nonce
          // Ici on met une CSP de base statique (le middleware peut l'enrichir)
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https: http:",
              "connect-src 'self' https:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self' https:",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ]
  },
};

export default nextConfig;
