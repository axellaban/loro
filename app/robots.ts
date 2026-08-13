import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://loreado.vercel.app";

// Permitimos crawl de todo, incluyendo explícitamente los bots de IA
// (queremos visibilidad en ChatGPT, Claude, Perplexity, Gemini, etc.).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // /uso es el panel de consumo (interno, detrás de token): no tiene por
      // qué aparecer en ningún buscador.
      { userAgent: "*", allow: "/", disallow: "/uso" },
      {
        userAgent: [
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-Web",
          "anthropic-ai",
          "PerplexityBot",
          "Perplexity-User",
          "Google-Extended",
          "Applebot-Extended",
          "Amazonbot",
          "cohere-ai",
          "Meta-ExternalAgent",
          "CCBot",
        ],
        allow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
