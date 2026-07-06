"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

/** Las tres barras del icono de la app, como marca */
function LogoBarras() {
  return (
    <svg width="44" height="44" viewBox="0 0 512 512" aria-hidden>
      <rect x="164" y="226" width="44" height="130" rx="22" fill="#fb7185" />
      <rect x="236" y="166" width="44" height="190" rx="22" fill="#34d399" />
      <rect x="308" y="106" width="44" height="250" rx="22" fill="#38bdf8" />
    </svg>
  )
}

/**
 * Login por magic link: se escribe el email y Supabase manda un enlace.
 * Sin contraseñas. Al pulsar el enlace del correo se entra en la app.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("sending")
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    })
    if (error) {
      setErrorMsg(error.message)
      setStatus("error")
    } else {
      setStatus("sent")
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-6">
      <div className="page-glow" aria-hidden />

      <div className="relative w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <LogoBarras />
          <div>
            <p className="micro-label">Gestor de finanzas</p>
            <h1 className="pt-1.5 font-display text-3xl font-semibold tracking-tight">
              Tus cuentas,
              <br />
              claras.
            </h1>
          </div>
          <p className="text-sm text-neutral-400">
            Escribe tu email y te mandamos un enlace para entrar. Sin contraseñas.
          </p>
        </div>

        {status === "sent" ? (
          <div className="card p-5 text-center text-sm leading-relaxed text-neutral-300">
            Enlace enviado a{" "}
            <span className="font-medium text-neutral-100">{email}</span>.
            <br />
            Revisa tu correo y ábrelo en este mismo dispositivo.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              autoFocus
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 text-base outline-none placeholder:text-neutral-600 focus-visible:ring-2 focus-visible:ring-primary/50"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="h-12 w-full rounded-2xl bg-primary font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {status === "sending" ? "Enviando…" : "Enviar enlace"}
            </button>
            {status === "error" && (
              <p className="text-sm text-rose-400">Error: {errorMsg}</p>
            )}
          </form>
        )}
      </div>
    </main>
  )
}
