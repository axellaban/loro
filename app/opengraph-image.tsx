import { ogHomeImageVertical, ogSizeVertical, ogContentType } from "./lib/og";

export const alt = "Loreado.IA — Metele el Loro a tu próxima entrevista";
export const size = ogSizeVertical;
export const contentType = ogContentType;

export default function Image() {
  return ogHomeImageVertical();
}
