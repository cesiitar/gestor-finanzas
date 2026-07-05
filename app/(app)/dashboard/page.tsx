import { ChartPie } from "lucide-react"

/** Placeholder: se construye en el paso 5 (KPIs + gráficas) */
export default function DashboardPage() {
  return (
    <>
      <header className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-xl font-semibold tracking-tight">Panel</h1>
      </header>
      <main className="px-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-800 px-6 py-16 text-center">
          <ChartPie className="size-8 text-neutral-600" aria-hidden />
          <p className="text-sm text-neutral-400">
            El panel mensual (KPIs, presupuestos y gráficas)
            <br />
            llega en el siguiente paso.
          </p>
        </div>
      </main>
    </>
  )
}
