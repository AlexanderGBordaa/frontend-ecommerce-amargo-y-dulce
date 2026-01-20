"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { useCartStore } from "@/store/cart.store";

/* ================= helpers ================= */

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function priceWithOff(price: number, off?: number) {
  return typeof off === "number" && off > 0
    ? Math.round(price * (1 - off / 100))
    : price;
}

function makeOrderNumber(numericId: number | string) {
  const n = Number(numericId);
  if (!Number.isFinite(n)) return "AMG-XXXX";
  return `AMG-${String(n).padStart(4, "0")}`;
}

function pickErrorMessage(payload: any, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload.error === "string") return payload.error;

  const mp = payload.mp ?? payload.error ?? payload;
  if (typeof mp?.message === "string") return mp.message;
  if (typeof mp?.error === "string") return mp.error;

  return fallback;
}

function safeUUID() {
  const c: any = typeof window !== "undefined" ? window.crypto : null;
  if (c?.randomUUID) return c.randomUUID();
  return `ref_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/* ================= types ================= */

type UiState =
  | { kind: "form" }
  | { kind: "checking"; orderId: string; status?: string }
  | { kind: "paid"; orderId: string }
  | { kind: "failed"; orderId: string; reason: string }
  | { kind: "timeout"; orderId: string };

/* ================= page ================= */

export default function CheckoutPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const cartItems = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // ✅ obligatorios
  const [phone, setPhone] = useState("");

  // ✅ shippingAddress estructurado (obligatorios salvo notes)
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedPhone = phone.trim();

  const trimmedStreet = street.trim();
  const trimmedNumber = number.trim();
  const trimmedCity = city.trim();
  const trimmedProvince = province.trim();
  const trimmedPostalCode = postalCode.trim();
  const trimmedNotes = notes.trim();

  const redirectedStatus = sp.get("status") || "";
  const redirectedOrderId = sp.get("orderId") || "";

  // ✅ Redirigir a /gracias si vuelve con query (evita duplicación de lógica)
  useEffect(() => {
    const status = sp.get("status");
    const orderId = sp.get("orderId");
    if (orderId && status) {
      router.replace(
        `/gracias?status=${encodeURIComponent(status)}&orderId=${encodeURIComponent(
          orderId
        )}`
      );
    }
  }, [sp, router]);

  const [ui, setUi] = useState<UiState>(() =>
    redirectedOrderId
      ? { kind: "checking", orderId: redirectedOrderId, status: redirectedStatus }
      : { kind: "form" }
  );

  useEffect(() => {
    if (redirectedOrderId) {
      setUi({
        kind: "checking",
        orderId: redirectedOrderId,
        status: redirectedStatus,
      });
    } else {
      setUi({ kind: "form" });
    }
  }, [redirectedOrderId, redirectedStatus]);

  const subtotal = useMemo(
    () =>
      cartItems.reduce((acc, it) => {
        const unit = priceWithOff(it.price, it.off);
        return acc + unit * it.qty;
      }, 0),
    [cartItems]
  );

  const total = subtotal;

  /* ================= polling ================= */

  useEffect(() => {
    if (ui.kind !== "checking") return;

    let alive = true;
    const startedAt = Date.now();

    async function tick() {
      try {
        const res = await fetch(`/api/orders/${ui.orderId}`, { cache: "no-store" });
        const json = await res.json();

        if (!alive) return;

        // soporta v4 y v5
        const orderStatus =
          json?.data?.attributes?.orderStatus ?? json?.orderStatus ?? null;

        if (orderStatus === "paid") {
          setUi({ kind: "paid", orderId: ui.orderId });
          clear();
          return;
        }

        if (orderStatus === "failed" || orderStatus === "cancelled") {
          setUi({ kind: "failed", orderId: ui.orderId, reason: orderStatus });
          return;
        }

        if (Date.now() - startedAt > 30_000) {
          setUi({ kind: "timeout", orderId: ui.orderId });
        }
      } catch {
        if (Date.now() - startedAt > 30_000) {
          setUi({ kind: "timeout", orderId: ui.orderId });
        }
      }
    }

    tick();
    const id = setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui, clear]);

  /* ================= submit ================= */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!cartItems.length) return setError("Tu carrito está vacío.");
    if (trimmedName.length < 2) return setError("Ingresá un nombre válido.");
    if (!trimmedEmail.includes("@")) return setError("Ingresá un email válido.");

    // ✅ obligatorios
    if (trimmedPhone.length < 6) return setError("Ingresá un teléfono válido.");
    if (trimmedStreet.length < 2) return setError("Ingresá la calle.");
    if (trimmedNumber.length < 1) return setError("Ingresá el número/altura.");
    if (trimmedCity.length < 2) return setError("Ingresá la ciudad.");
    if (trimmedProvince.length < 2) return setError("Ingresá la provincia.");
    if (trimmedPostalCode.length < 4)
      return setError("Ingresá un código postal válido.");

    try {
      setLoading(true);

      const mpExternalReference = safeUUID();

      /* 1️⃣ Crear orden */
      const createRes = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,

          phone: trimmedPhone,

          shippingAddress: {
            street: trimmedStreet,
            number: trimmedNumber,
            city: trimmedCity,
            province: trimmedProvince,
            postalCode: trimmedPostalCode,
            notes: trimmedNotes || null,

            // ✅ legible
            text: `${trimmedStreet} ${trimmedNumber}, ${trimmedCity}, ${trimmedProvince} (${trimmedPostalCode})`,
          },

          total,
          mpExternalReference,
          items: cartItems.map((it) => ({
            productId: it.id,
            slug: it.slug,
            title: it.title,
            qty: it.qty,
            unit_price: priceWithOff(it.price, it.off),
            price: it.price,
            off: it.off,
          })),
        }),
      });

      const created = await createRes.json().catch(() => null);
      if (!createRes.ok) {
        throw new Error(pickErrorMessage(created, "No se pudo crear la orden"));
      }

      // ✅ Strapi v5: el ID real para operar por /api/orders/:id es documentId
      const orderId: string | undefined = created?.orderDocumentId || created?.orderId;
      const orderNumericId: string | undefined = created?.orderNumericId;
      const mpExtFromServer: string | undefined = created?.mpExternalReference;

      if (!orderId) {
        throw new Error("No se recibió orderDocumentId/orderId desde /api/orders/create");
      }

      const mpExternalReferenceFinal = mpExtFromServer || mpExternalReference;
      const orderNumber = makeOrderNumber(orderNumericId || orderId);

      /* 2️⃣ Preferencia MP */
      const mpItems = cartItems
        .map((it) => ({
          title: it.title,
          qty: Number(it.qty ?? 1),
          unit_price: Number(priceWithOff(it.price, it.off)),
        }))
        .filter(
          (x) => x.qty > 0 && Number.isFinite(x.unit_price) && x.unit_price > 0
        );

      if (mpItems.length === 0) {
        throw new Error("No hay items válidos para MercadoPago (precio/cantidad).");
      }

      const prefRes = await fetch("/api/mp/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId, // ✅ documentId
          orderNumber,
          mpExternalReference: mpExternalReferenceFinal,
          items: mpItems,
        }),
      });

      const pref = await prefRes.json().catch(() => null);
      if (!prefRes.ok) {
        throw new Error(pickErrorMessage(pref, "No se pudo crear la preferencia MP"));
      }

      const checkoutUrl: string | undefined =
        pref?.sandbox_init_point || pref?.init_point;

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

  /* ================= UI ================= */

  return (
    <main>
      <Container>
        <h1 className="text-3xl font-extrabold py-8">Checkout</h1>

        {error && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {ui.kind === "form" && (
          <form onSubmit={handleSubmit} className="max-w-md space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre"
              className="w-full border p-2"
              required
            />

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="w-full border p-2"
              required
            />

            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Teléfono"
              type="tel"
              className="w-full border p-2"
              required
            />

            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="Calle"
              className="w-full border p-2"
              required
            />

            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Número / Altura"
              className="w-full border p-2"
              required
            />

            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ciudad"
              className="w-full border p-2"
              required
            />

            <input
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="Provincia"
              className="w-full border p-2"
              required
            />

            <input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="Código postal"
              className="w-full border p-2"
              inputMode="numeric"
              required
            />

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas (piso, depto, referencia, timbre...) (opcional)"
              className="w-full border p-2"
              rows={2}
            />

            <div className="rounded border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>{formatARS(subtotal)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>{formatARS(total)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-red-600 py-3 text-white disabled:opacity-60"
            >
              {loading ? "Redirigiendo…" : "Pagar con MercadoPago"}
            </button>

            <Link href="/carrito" className="block text-sm underline">
              Volver al carrito
            </Link>
          </form>
        )}

        {ui.kind === "checking" && (
          <div className="max-w-md rounded border p-4">
            <p className="font-semibold">Estamos verificando tu pago…</p>
            <p className="text-sm opacity-80">Orden: {ui.orderId}</p>
          </div>
        )}

        {ui.kind === "paid" && (
          <div className="max-w-md rounded border p-4">
            <p className="font-semibold">¡Pago aprobado!</p>
            <p className="text-sm opacity-80">Orden: {ui.orderId}</p>
            <Link href="/" className="mt-3 inline-block underline">
              Volver a la tienda
            </Link>
          </div>
        )}

        {ui.kind === "failed" && (
          <div className="max-w-md rounded border p-4">
            <p className="font-semibold">El pago no se pudo completar.</p>
            <p className="text-sm opacity-80">Motivo: {ui.reason}</p>
            <Link href="/carrito" className="mt-3 inline-block underline">
              Volver al carrito
            </Link>
          </div>
        )}

        {ui.kind === "timeout" && (
          <div className="max-w-md rounded border p-4">
            <p className="font-semibold">No pudimos confirmar el pago todavía.</p>
            <p className="text-sm opacity-80">
              Podés refrescar en unos segundos o revisar el estado más tarde.
            </p>
            <Link href="/" className="mt-3 inline-block underline">
              Volver a la tienda
            </Link>
          </div>
        )}
      </Container>
    </main>
  );
}
