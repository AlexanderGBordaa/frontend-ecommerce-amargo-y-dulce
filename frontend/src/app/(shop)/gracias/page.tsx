"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { useCartStore } from "@/store/cart.store";

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

  const clear = useCartStore((s) => s.clear);

  const urlStatus = normalizeStatus(sp.get("status"));
  const orderId = sp.get("orderId") || "";
  const externalRef = sp.get("external_reference") || "";

  // Estado real según Strapi (orderStatus). Arrancamos usando el status de URL.
  const [status, setStatus] = useState<StatusKind>(urlStatus);
  const [hint, setHint] = useState<string | null>(null);

  // Para evitar clear() duplicado
  const clearedRef = useRef(false);

  useEffect(() => {
    // si cambia la URL, reseteamos el estado visible y el hint
    setStatus(urlStatus);
    setHint(null);
    clearedRef.current = false;
  }, [urlStatus]);

  useEffect(() => {
    if (!orderId) return;

    let alive = true;
    const startedAt = Date.now();

    function mapOrderStatusToUi(orderStatus: string | null | undefined): StatusKind {
      const s = String(orderStatus ?? "").toLowerCase();
      if (s === "paid") return "success";
      if (s === "failed" || s === "cancelled") return "failure";
      return "pending";
    }

    async function tick() {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!alive) return;

        const orderStatus: string | null =
          json?.data?.attributes?.orderStatus ??
          json?.orderStatus ??
          json?.data?.orderStatus ??
          null;

        const nextUi = mapOrderStatusToUi(orderStatus);

        // si está paid, vaciamos carrito una sola vez
        if (nextUi === "success" && !clearedRef.current) {
          clearedRef.current = true;
          clear();
        }

        setStatus(nextUi);

        // timeout de verificación
        if (Date.now() - startedAt > 30_000 && nextUi === "pending") {
          setHint(
            "Todavía no pudimos confirmar el pago. Podés refrescar la página o revisar tu email: el webhook puede tardar unos segundos."
          );
        } else {
          setHint(null);
        }
      } catch {
        if (!alive) return;
        if (Date.now() - startedAt > 30_000) {
          setHint(
            "Tuvimos un problema verificando el estado. Podés refrescar la página o revisar tu email."
          );
        }
      }
    }

    // ✅ Fast start + backoff:
    // - 0–8s: cada 500ms
    // - 8–30s: cada 2500ms
    // - corta a 30s
    tick();

    let delay = 500;
    let timer: any = null;

    const schedule = () => {
      timer = setTimeout(async () => {
        await tick();

        const elapsed = Date.now() - startedAt;

        if (elapsed > 8_000) delay = 2500;
        if (elapsed > 30_000) return;

        // si ya resolvimos (success/failure), no seguimos pegándole a Strapi
        if (!alive) return;
        if (status === "success" || status === "failure") return;

        schedule();
      }, delay);
    };

    schedule();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, clear]);

  const statusLabel =
    status === "success"
      ? "Aprobado"
      : status === "pending"
      ? "Pendiente"
      : status === "failure"
      ? "Rechazado"
      : "—";

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
                <span className="font-semibold text-neutral-900">{statusLabel}</span>
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
                {hint ||
                  "Si el estado no cambia, refrescá la página o revisá tu email. El webhook puede tardar unos segundos."}
              </p>
            )}

            {status === "success" && (
              <p className="mt-4 text-xs text-neutral-500">
                Si no te llega el email de confirmación, revisá Spam/Promociones.
              </p>
            )}
          </div>
        </div>
      </Container>
    </main>
  );
}

