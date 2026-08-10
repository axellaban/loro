"use client";

// La etiqueta de Google Ads.
//
// Vive en su propio componente y no suelta en el layout por dos razones: se
// carga con `next/script` (que la difiere para no pelear con el render inicial)
// y solo si hay ID configurado, así que en un deploy sin la variable la app no
// baja nada de Google.
//
// El ID NO es secreto: viaja en el HTML de cualquier visitante. Se deja
// pisable por variable de entorno para el día que cambie la cuenta.

import Script from "next/script";

export const ADS_ID = (process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "AW-18381874401").trim();

export function GoogleAds() {
  if (!ADS_ID) return null;
  return (
    <>
      <Script
        id="gtag-src"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${ADS_ID}`}
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ADS_ID}');`}
      </Script>
    </>
  );
}
