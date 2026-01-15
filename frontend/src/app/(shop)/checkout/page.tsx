"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { useCartStore } from "@/store/cart.store";

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function priceWithOff(price: number, off?: number) {
  const hasOff = typeof off === "number" && off > 0;
  return hasOff ? Math.round(price * (1 - off / 100)) : price;
}

function makeOrderNumber(id: number | string) {
  const n = Number(id);
  const padded = String(isNaN(n) ? id : n).padStart(4, "0");
  return `AMG-${padded}`;
}

// Intenta extraer un mensaje útil de errores de Strapi/MP
function pickErrorMessage(payload: any, fallback: string) {
  if (!payload) return fallback;

  // Tu route.ts puede devolver { error: "..." }
  if (typeof payload.error === "string") return payload.error;

  // Cuando devolvemos { mp: {...} }
  const mp = payload.mp ?? payload.error ?? payload;

  // Errores típicos MP
  if (typeof mp?.message === "string") return mp.message;
  if (typeof mp?.error === "string") return mp.error;
  if (typeof mp?.cause?.[0]?.description === "string") return mp.cause[0].description;
  if (typeof mp?.cause?.[0]?.message === "string") return mp.cause[0].message;

  // Strapi
  if (typeof payload?.error?.message === "string") return payload.error.message;

  try {
    return JSON.stringify(payload);
  } catch {
    return fallback;
  }
}

type UiState =
  | { kind: "form" }
  | { kind: "checking"; orderId: string; status?: string }
  | { kind: "paid"; orderId: string }
  | { kind: "failed"; orderId: string; reason: string }
  | { kind: "timeout"; orderId: string };

export default function CheckoutPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const cartItems = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ====== Post-redirect params (MP back_urls)
  const redirectedStatus = sp.get("status") || "";
  const redirectedOrderId = sp.get("orderId") || "";

  // Si venimos del redirect con orderId, entramos a modo "checking"
  const [ui, setUi] = useState<UiState>(() => {
    if (redirectedOrderId) return { kind: "checking", orderId: redirectedOrderId, status: redirectedStatus };
    return { kind: "form" };
  });

  // Si cambia el query (navegación), actualizamos UI
  useEffect(() => {
    if (redirectedOrderId) {
      setUi({ kind: "checking", orderId: redirectedOrderId, status: redirectedStatus });
    } else {
      setUi({ kind: "form" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirectedOrderId, redirectedStatus]);

  // ====== Totales (para mostrar en resumen cuando hay carrito)
  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, it) => {
      const unit = priceWithOff(it.price, it.off);
      return acc + unit * it.qty;
    }, 0);
  }, [cartItems]);

  const cajas = useMemo(() => cartItems.reduce((acc, it) => acc + it.qty, 0), [cartItems]);

  const promoMontoOk = subtotal >= 50000;
  const promoCajasOk = cajas >= 3;
  const discountRate = Math.max(promoMontoOk ? 0.1 : 0, promoCajasOk ? 0.05 : 0);

  const discount = Math.round(subtotal * discountRate);
  const total = subtotal - discount;

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();

  const canSubmit =
    cartItems.length > 0 &&
    trimmedName.length >= 2 &&
    trimmedEmail.includes("@") &&
    !loading;

  // ====== Polling post-redirect: consulta /api/orders/:id hasta paid (o failed/cancelled) o timeout
  useEffect(() => {
    if (ui.kind !== "checking") return;

    let alive = true;
    let intervalId: any = null;
    const startedAt = Date.now();
    const orderId = ui.orderId;

    async function tick() {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json().catch(() => null);
        if (!alive) return;

        const orderStatus =
          data?.orderStatus ??
          data?.order?.attributes?.orderStatus ??
          data?.data?.attributes?.orderStatus ??
          null;

        if (orderStatus === "paid") {
          setUi({ kind: "paid", orderId });
          // si querés, podés vaciar el carrito acá:
          // clear();
          clearInterval(intervalId);
          return;
        }

        if (orderStatus === "failed" || orderStatus === "cancelled") {
          setUi({ kind: "failed", orderId, reason: String(orderStatus) });
          clearInterval(intervalId);
          return;
        }

        if (Date.now() - startedAt > 30_000) {
          setUi({ kind: "timeout", orderId });
          clearInterval(intervalId);
        }
      } catch {
        if (!alive) return;
        if (Date.now() - startedAt > 30_000) {
          setUi({ kind: "timeout", orderId });
          clearInterval(intervalId);
        }
      }
    }

    // primer tick inmediato + polling
    tick();
    intervalId = setInterval(tick, 2500);

    return () => {
      alive = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [ui.kind, ui.kind === "checking" ? ui.orderId : ""]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (cartItems.length === 0) {
      setError("Tu carrito está vacío.");
      return;
    }
    if (trimmedName.length < 2) {
      setError("Ingresá un nombre válido.");
      return;
    }
    if (!trimmedEmail.includes("@")) {
      setError("Ingresá un email válido.");
      return;
    }

    try {
      setLoading(true);

      // 1) Crear orden en Strapi vía Next API (pending)
      // OJO: /api/orders/create espera un body "plano" (name/email/items/total)
      const createRes = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          total,
          items: cartItems.map((it) => ({
            productId: it.id ?? undefined,
            slug: it.slug,
            title: it.title,
            qty: it.qty,
            unit_price: priceWithOff(it.price, it.off),
            // opcional trazabilidad
            price: it.price,
            off: it.off,
          })),
        }),
      });

      const created = await createRes.json().catch(async () => {
        const text = await createRes.text().catch(() => "");
        throw new Error(text || "Respuesta inválida creando la orden");
      });

      if (!createRes.ok) {
        throw new Error(pickErrorMessage(created, "No se pudo crear la orden"));
      }

      // Tu /api/orders/create corregido devuelve { ok, order, orderId }
      const id: string | number | undefined = created?.orderId ?? created?.order?.id ?? created?.data?.id;
      if (!id) {
        throw new Error("La orden se creó pero no se recibió orderId.");
      }

      // 2) Generar orderNumber (opcional: el webhook también lo setea)
      const orderNumber = makeOrderNumber(id);

      // 3) Crear preferencia de MercadoPago (Next API)
      const mpItems = cartItems
        .map((it) => ({
          title: it.title,
          qty: Number(it.qty ?? 1),
          unit_price: Number(priceWithOff(it.price, it.off)),
        }))
        .filter((x) => x.qty > 0 && Number.isFinite(x.unit_price) && x.unit_price > 0);

      if (mpItems.length === 0) {
        throw new Error("No hay items válidos para MercadoPago (precio/cantidad).");
      }

      const prefRes = await fetch("/api/mp/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: id, // external_reference para el webhook
          orderNumber,
          items: mpItems,
        }),
      });

      const pref = await prefRes.json().catch(async () => {
        const text = await prefRes.text().catch(() => "");
        throw new Error(text || "Respuesta inválida de /api/mp/create-preference");
      });

      if (!prefRes.ok) {
        throw new Error(pickErrorMessage(pref, "No se pudo crear la preferencia de MercadoPago"));
      }

      // 4) Redirección
      const checkoutUrl: string | undefined = pref?.sandbox_init_point || pref?.init_point;
      if (!checkoutUrl) {
        throw new Error("MercadoPago no devolvió init_point / sandbox_init_point.");
      }

      window.location.href = checkoutUrl;
    } catch (err: any) {
      setError(err?.message || "Error iniciando el pago");
    } finally {
      setLoading(false);
    }
  }

  // ====== UI
  return (
    <main>
      <Container>
        <div className="py-10">
          <h1 className="text-3xl font-extrabold text-neutral-900">Checkout</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Confirmá tus datos y continuá al pago con MercadoPago.
          </p>
        </div>

        {/* ====== POST-REDIRECT STATES ====== */}
        {ui.kind !== "form" && (
          <div className="pb-14">
            <div className="rounded-xl border bg-white p-6">
              <h2 className="text-lg font-extrabold text-neutral-900">
                {ui.kind === "checking" && "Confirmando pago…"}
                {ui.kind === "paid" && "✅ Pago aprobado"}
                {ui.kind === "failed" && "❌ Pago rechazado"}
                {ui.kind === "timeout" && "⏳ Aún sin confirmación"}
              </h2>

              <p className="mt-2 text-sm text-neutral-700">
                <span className="font-semibold">Orden:</span>{" "}
                {"orderId" in ui ? ui.orderId : ""}
              </p>

              {ui.kind === "checking" && (
                <>
                  <p className="mt-3 text-sm text-neutral-600">
                    Estamos esperando la confirmación del webhook de Mercado Pago. Esto puede tardar unos segundos.
                  </p>
                  <p className="mt-2 text-xs text-neutral-500">
                    (Redirect status: {redirectedStatus || "—"})
                  </p>
                </>
              )}

              {ui.kind === "paid" && (
                <>
                  <p className="mt-3 text-sm text-neutral-600">
                    ¡Gracias por tu compra! Te vamos a contactar por email.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/"
                      className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                      onClick={() => clear()}
                    >
                      Volver al inicio
                    </Link>
                    <button
                      className="rounded-full border px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                      onClick={() => {
                        // limpia query params y vuelve a modo form
                        router.replace("/checkout");
                        clear();
                      }}
                    >
                      Finalizar
                    </button>
                  </div>
                </>
              )}

              {ui.kind === "failed" && (
                <>
                  <p className="mt-3 text-sm text-neutral-600">
                    El pago no se aprobó ({ui.reason}). Podés intentar nuevamente.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/carrito"
                      className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Volver al carrito
                    </Link>
                    <button
                      className="rounded-full border px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                      onClick={() => router.replace("/checkout")}
                    >
                      Intentar otra vez
                    </button>
                  </div>
                </>
              )}

              {ui.kind === "timeout" && (
                <>
                  <p className="mt-3 text-sm text-neutral-600">
                    Todavía no recibimos confirmación. Puede tardar un poco más.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                      onClick={() => window.location.reload()}
                    >
                      Reintentar
                    </button>
                    <Link
                      href="/carrito"
                      className="rounded-full border px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
                    >
                      Volver al carrito
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ====== FORM (NORMAL CHECKOUT) ====== */}
        {ui.kind === "form" && (
          <>
            {cartItems.length === 0 ? (
              <div className="rounded-xl border bg-white p-6 text-sm text-neutral-700">
                Tu carrito está vacío. Volvé a{" "}
                <Link className="underline" href="/productos">
                  productos
                </Link>
                .
              </div>
            ) : (
              <div className="grid gap-8 pb-14 lg:grid-cols-[1fr_380px]">
                {/* Form */}
                <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-6">
                  <h2 className="text-lg font-extrabold text-neutral-900">Tus datos</h2>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-sm font-semibold text-neutral-800">Nombre</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 h-11 w-full rounded-md border border-neutral-300 px-3 text-sm"
                        placeholder="Tu nombre"
                        autoComplete="name"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-neutral-800">Email</label>
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 h-11 w-full rounded-md border border-neutral-300 px-3 text-sm"
                        placeholder="tu@email.com"
                        type="email"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="mt-6 w-full rounded-full bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? "Redirigiendo..." : "Ir a pagar con MercadoPago"}
                  </button>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <Link
                      href="/carrito"
                      className="text-sm font-semibold text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
                    >
                      Volver al carrito
                    </Link>

                    <button
                      type="button"
                      onClick={() => clear()}
                      className="text-sm font-semibold text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
                    >
                      Vaciar carrito
                    </button>
                  </div>

                  <p className="mt-3 text-center text-xs text-neutral-500">
                    MercadoPago Sandbox (pruebas). No se cobra dinero real.
                  </p>
                </form>

                {/* Resumen */}
                <aside className="h-fit rounded-xl border bg-white p-6">
                  <h2 className="text-lg font-extrabold text-neutral-900">Resumen</h2>

                  <div className="mt-4 space-y-3">
                    {cartItems.map((it) => {
                      const unit = priceWithOff(it.price, it.off);
                      return (
                        <div key={it.slug} className="flex justify-between gap-4 text-sm">
                          <div className="text-neutral-700">
                            <div className="font-semibold text-neutral-900">{it.title}</div>
                            <div className="text-xs text-neutral-500">
                              {it.qty} × {formatARS(unit)}
                            </div>
                          </div>
                          <div className="font-semibold text-neutral-900">
                            {formatARS(unit * it.qty)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="my-5 h-px bg-neutral-200" />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-neutral-700">
                      <span>Subtotal</span>
                      <span className="font-semibold text-neutral-900">
                        {formatARS(subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-700">
                      <span>Descuento</span>
                      <span className="font-semibold text-neutral-900">
                        -{formatARS(discount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-base">
                      <span className="font-extrabold text-neutral-900">Total</span>
                      <span className="font-extrabold text-neutral-900">
                        {formatARS(total)}
                      </span>
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </>
        )}
      </Container>
    </main>
  );
}

