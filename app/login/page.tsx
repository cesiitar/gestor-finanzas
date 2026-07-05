"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

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
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Gestor de finanzas</h1>
          <p className="text-sm text-muted-foreground">
            Escribe tu email y te mandamos un enlace para entrar.
          </p>
        </div>

        {status === "sent" ? (
          <div className="rounded-lg border border-border bg-card p-4 text-center text-sm">
            📬 Enlace enviado a <span className="font-medium">{email}</span>.
            <br />
            Revisa tu correo y pulsa el enlace en este mismo dispositivo.
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
              className="h-11 w-full rounded-lg border border-input bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="h-11 w-full rounded-lg bg-primary font-medium text-primary-foreground transition-opacity disabled:opacity-50"
            >
              {status === "sending" ? "Enviando…" : "Enviar enlace"}
            </button>
            {status === "error" && (
              <p className="text-sm text-destructive">Error: {errorMsg}</p>
            )}
          </form>
        )}
      </div>
    </main>
  )
}
