import { ogHomeImage, ogSize, ogContentType } from "./lib/og";

export const alt = "Loreado.IA — Metele el Loro a tu próxima entrevista";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogHomeImage();
}
