/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // Required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,

  // Next NO le pone Cache-Control a lo que vive en public/: sale con max-age=0.
  // Con ~15 MB de clips (una sesión de simulador en desktop baja ~7,8 MB y rota
  // tres videos de habla), eso es revalidar o volver a bajar en cada rotación y
  // en cada visita. 30 días con `immutable`: no revalida dentro de la ventana, y
  // si alguna vez se reemplaza un clip sin renombrarlo se corrige solo en un mes
  // en vez de quedar clavado. La convención del repo igual es versionar por
  // nombre (lora-idle-wide-v8.mp4) — conviene seguir haciéndolo.
  async headers() {
    return [
      {
        source: "/:path*.(mp4|gif|png|jpg|jpeg|webp|svg|ico)",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
