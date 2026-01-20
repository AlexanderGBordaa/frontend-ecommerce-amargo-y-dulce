"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/layout/Container";

type StatusKind = "success" | "pending" | "failure" | "unknown";

function normalizeStatus(s?: string | null): StatusKind {
  const v = String(s || "").toLowerCase();
  if (v === "success" || v === "approved") return "success";
  if (v === "pending" || v === "in_process") return "pending";
  if (v === "failure" || v === "rejected") return "failure";
  return "unknown";
}

function StatusBadge({ status }: { status: StatusKind }) {
  const cfg = useMemo(() => {
    switch (status) {
      case "success":
        return {
          title: "Compra realizada",
          subtitle: "Tu pago fue aprobado. ¡Gracias por tu compra!",
          ring: "ring-emerald-200",
          bg: "bg-emerald-50",
          iconBg: "bg-emerald-600",
          icon: "✓",
        };
      case "pending":
        return {
          title: "Pago pendiente",
          subtitle: "Estamos esperando confirmación. Podría tardar unos segundos.",
          ring: "ring-amber-200",
          bg: "bg-amber-50",
          iconBg: "bg-amber-600",
          icon: "⏳",
        };
      case "failure":
        return {
          title: "Pago rechazado",
          subtitle: "El pago no se aprobó. Podés intentar nuevamente.",
          ring: "ring-red-200",
          bg: "bg-red-50",
          iconBg: "bg-red-600",
          icon: "✕",
        };
      default:
        return {
          title: "Estado de compra",
          subtitle: "Recibimos tu retorno de pago.",
          ring: "ring-neutral-200",
          bg: "bg-neutral-50",
          iconBg: "bg-neutral-700",
          icon: "ℹ",
        };
    }
  }, [status]);

  return (
    <div className={`rounded-2xl ${cfg.bg} ring-1 ${cfg.ring} p-6`}>
      <div className="flex items-start gap-4">
        <div
          className={`grid h-12 w-12 place-items-center rounded-xl ${cfg.iconBg} text-white text-xl font-black`}
          aria-hidden
        >
          {cfg.icon}
        </div>

        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-neutral-900">{cfg.title}</h1>
          <p className="mt-1 text-sm text-neutral-700">{cfg.subtitle}</p>
        </div>
      </div>
    </div>
  );
}

export default function GraciasPage() {
  const sp = useSearchParams();

  const status = normalizeStatus(sp.get("status"));
  const orderId = sp.get("orderId") || "";
  const externalRef = sp.get("external_reference") || "";

  return (
    <main>
      <Container>
        <div className="py-10">
          {/* Header */}
          <StatusBadge status={status} />

          {/* Card */}
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-neutral-900">Detalle del pedido</h2>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-neutral-600">Pedido</span>
                <span className="font-semibold text-neutral-900 break-all">
                  {orderId || "—"}
                </span>
              </div>

              {externalRef && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-neutral-600">Referencia</span>
                  <span className="font-semibold text-neutral-900 break-all">
                    {externalRef}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-neutral-600">Estado</span>
                <span className="font-semibold text-neutral-900">
                  {status === "success"
                    ? "Aprobado"
                    : status === "pending"
                    ? "Pendiente"
                    : status === "failure"
                    ? "Rechazado"
                    : "—"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                Volver a la tienda
              </Link>

              <Link
                href="/productos"
                className="rounded-full border px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                Ver productos
              </Link>

              <Link
                href="/promociones"
                className="rounded-full border px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                Seguir comprando
              </Link>
            </div>

            {/* Hint */}
            {status === "pending" && (
              <p className="mt-4 text-xs text-neutral-500">
                Si el estado no cambia, refrescá la página o revisá tu email. El webhook puede tardar unos segundos.
              </p>
            )}
          </div>
        </div>
      </Container>
    </main>
  );
}
