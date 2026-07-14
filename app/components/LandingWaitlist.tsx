"use client";

import { useState } from "react";
import { track } from "../lib/track";

// Captura de email en la landing: red de contención para el visitante que no
// hace clic en "Entrá". Mismo backend robusto que el paywall (/api/waitlist).
export default function LandingWaitlist() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const em = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setError("Email inválido.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        setSent(true);
        track("waitlist_submit");
      } else {
        setError(j.error || "No se pudo enviar. Probá de nuevo.");
      }
    } catch {
      setError("Error de red. Probá de nuevo.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return <p className="landing-waitlist-sent">Listo. Te avisamos cuando abramos cupos. 🦜</p>;
  }

  return (
    <div className="landing-waitlist">
      <p className="landing-waitlist-label">¿Sin acceso? Dejá tu email para cuando abramos cupos:</p>
      <div className="landing-waitlist-row">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="tu@email.com"
          className="landing-waitlist-input"
          aria-label="Tu email"
        />
        <button
          onClick={submit}
          disabled={sending || !email.trim()}
          className="landing-waitlist-btn"
        >
          {sending ? "…" : "Anotarme"}
        </button>
      </div>
      {error && <p className="landing-waitlist-error">{error}</p>}
    </div>
  );
}
