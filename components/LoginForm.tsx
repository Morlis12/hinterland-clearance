"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function Form() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (r.ok) {
      router.push(next);
      router.refresh();
    } else {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? "Échec de connexion.");
      setShake(true);
    }
  };

  return (
    <div
      onAnimationEnd={(e) => {
        if (e.animationName === "shake-x") setShake(false);
      }}
      className={`w-full max-w-[420px] rounded-md bg-white p-7 shadow-[0_18px_45px_-15px_rgba(21,39,67,0.35)] login-card ${
        shake ? "login-shake" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo_agl_bleu.png"
        alt="AGL"
        width={140}
        height={88}
        className="mx-auto h-auto w-[140px] login-card-logo"
      />
      <h1 className="mt-3 text-center text-base font-bold leading-snug text-marine-800">
        HINTERLAND — Overdue Files Monitoring
      </h1>
      <p className="mt-1 text-center text-sm text-slate-500 login-card-tagline">
        Accès réservé — pilotage des dossiers en retard
      </p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block text-sm text-slate-700">
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className="login-input mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-marine-800 focus:ring-2 focus:ring-marine-800/25"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}
        <button
          disabled={loading}
          className="login-button w-full rounded-md bg-marine-800 px-4 py-2.5 font-semibold text-white hover:bg-marine-900 disabled:opacity-50"
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={null}>
      <Form />
    </Suspense>
  );
}
