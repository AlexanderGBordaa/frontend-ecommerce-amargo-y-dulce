// src/app/api/mp/webhook/route.ts
import { NextResponse } from "next/server";

// Evita que Next cachee / optimice esta route
export const dynamic = "force-dynamic";

/**
 * Webhook Mercado Pago (Checkout Pro)
 * - Recibe notificación (query o body)
 * - Consulta el pago real en MP
 * - Actualiza la orden en Strapi con mpPaymentId, mpStatus, orderStatus
 *
 * Nota: Respondemos 200 rápido para que MP no reintente infinito.
 */

function pickPaymentInfo(url: URL, body: any) {
  const typeFromQuery = url.searchParams.get("type") || url.searchParams.get("topic");

  const qpId =
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    url.searchParams.get("data[id]") ||
    url.searchParams.get("payment_id");

  // Body (puede variar)
  const bodyType = body?.type || body?.topic;
  const bodyId = body?.data?.id || body?.data?.["id"] || body?.id;

  const type = typeFromQuery || bodyType || undefined;
  const paymentId = qpId || bodyId || null;

  return { type, paymentId: paymentId ? String(paymentId) : null };
}

function mapMpToOrderStatus(mpStatus?: string) {
  switch (mpStatus) {
    case "approved":
      return "paid";
    case "rejected":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);

    // Body (a veces viene vacío o no es JSON)
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      // ok
    }

    const { type, paymentId } = pickPaymentInfo(url, body);

    // Responder rápido para que MP no reintente
    if (!paymentId) return NextResponse.json({ ok: true }, { status: 200 });

    // Solo nos interesa payment
    if (type && type !== "payment") return NextResponse.json({ ok: true }, { status: 200 });

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      console.error("Webhook: falta MP_ACCESS_TOKEN");
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // 1) Consultar el pago real en MP
    const payRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    const payment = await payRes.json().catch(() => null);

    if (!payRes.ok || !payment) {
      const errText = payment ? JSON.stringify(payment) : "";
      console.error("Webhook: MP payment fetch failed", payRes.status, errText);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const mpStatus: string | undefined = payment?.status; // approved / pending / rejected / cancelled
    const externalRef: string | undefined =
      payment?.external_reference ?? payment?.metadata?.orderId;

    if (!externalRef) {
      console.warn("Webhook: payment sin external_reference/metadata.orderId", {
        paymentId,
        mpStatus,
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // 2) Update en Strapi (server-to-server)
    // Preferimos STRAPI_URL (server-only). Caemos a NEXT_PUBLIC_STRAPI_URL solo si no hay otra.
    const strapi =
      process.env.STRAPI_URL ||
      process.env.NEXT_PUBLIC_STRAPI_URL ||
      "http://localhost:1337";

    // Aceptamos ambos nombres para evitar errores de env
    const token = process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN;
    if (!token) {
      console.error("Webhook: falta STRAPI_API_TOKEN / STRAPI_TOKEN (API Token de Strapi)");
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Armamos patch (si externalRef es id numérico, completamos orderNumber)
    const numericId = Number(externalRef);
    const orderNumber =
      Number.isFinite(numericId) && numericId > 0
        ? `AMG-${String(numericId).padStart(4, "0")}`
        : undefined;

    const orderStatus = mapMpToOrderStatus(mpStatus);

    const updatePayload: any = {
      data: {
        orderStatus,
        mpPaymentId: String(paymentId),
        mpStatus: mpStatus ? String(mpStatus) : null,
        // opcional: útil para debug
        mpStatusDetail: payment?.status_detail ?? null,
        mpMerchantOrderId: payment?.order?.id ? String(payment.order.id) : null,
      },
    };

    if (orderNumber) updatePayload.data.orderNumber = orderNumber;

    const updateRes = await fetch(
      `${strapi}/api/orders/${encodeURIComponent(String(externalRef))}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatePayload),
        cache: "no-store",
      }
    );

    if (!updateRes.ok) {
      const text = await updateRes.text().catch(() => "");
      console.error("Webhook: Strapi update failed", updateRes.status, text || "(no body)");
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("Webhook: fatal error", err?.message || err);
    // Igual respondemos 200 para que MP no reintente eternamente
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

// Por compatibilidad (algunas configs viejas envían GET)
export async function GET(req: Request) {
  return POST(req);
}
