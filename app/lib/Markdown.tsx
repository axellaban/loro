import { Fragment, type ReactNode } from "react";

// Markdown mínimo para lo que de verdad escriben los modelos en esta app:
// títulos, viñetas, listas numeradas, negritas y `código`. No se suma una
// librería porque el subconjunto es chico y el bundle de /app se carga en
// medio de una entrevista.
//
// Todo se arma con elementos de React (nunca dangerouslySetInnerHTML), así el
// texto del modelo no puede inyectar HTML.

// Parte una línea en negritas (**x** o __x__) y código (`x`).
function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*|__)(.+?)\1|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[3] !== undefined) {
      out.push(<code key={`${keyPrefix}-c${i}`}>{m[3]}</code>);
    } else {
      out.push(<strong key={`${keyPrefix}-b${i}`}>{m[2]}</strong>);
    }
    last = re.lastIndex;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: "h"; level: 2 | 3; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

function parse(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "p", text: para.join(" ") });
      para = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushPara();
      continue;
    }
    const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      // Todo lo que sea h1/h2 se dibuja igual: dentro de un panel no hay
      // jerarquía suficiente para justificar más de dos niveles.
      blocks.push({ kind: "h", level: h[1].length <= 2 ? 2 : 3, text: h[2] });
      continue;
    }
    const ul = trimmed.match(/^[-*•]\s+(.*)$/);
    if (ul) {
      flushPara();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.kind === "ul") prev.items.push(ul[1]);
      else blocks.push({ kind: "ul", items: [ul[1]] });
      continue;
    }
    const ol = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      flushPara();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.kind === "ol") prev.items.push(ol[1]);
      else blocks.push({ kind: "ol", items: [ol[1]] });
      continue;
    }
    para.push(trimmed);
  }
  flushPara();
  return blocks;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = parse(text || "");
  return (
    <div className={`md ${className || ""}`}>
      {blocks.map((b, i) => {
        if (b.kind === "h") {
          return b.level === 2 ? (
            <h3 key={i} className="md-h2">{inline(b.text, `h${i}`)}</h3>
          ) : (
            <h4 key={i} className="md-h3">{inline(b.text, `h${i}`)}</h4>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={i} className="md-ul">
              {b.items.map((it, j) => (
                <li key={j}>{inline(it, `u${i}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        if (b.kind === "ol") {
          return (
            <ol key={i} className="md-ol">
              {b.items.map((it, j) => (
                <li key={j}>{inline(it, `o${i}-${j}`)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="md-p">
            <Fragment>{inline(b.text, `p${i}`)}</Fragment>
          </p>
        );
      })}
    </div>
  );
}
