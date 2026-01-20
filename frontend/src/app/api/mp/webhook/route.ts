// src/app/api/mp/webhook/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Webhook Mercado Pago (Checkout Pro)
 *
 * Objetivo:
 * - Recibe notificación (payment / merchant_order)
 * - Resuelve paymentId real
 * - Consulta el pago en MP
 * - Toma mpExternalReference desde payment.external_reference (o metadata)
 * - Busca la Order en Strapi por filters[mpExternalReference][$eq]
 * - Actualiza Order: orderStatus + mp* fields
 *
 * ✅ Strapi v5 FIX:
 * - Buscar documentId (NO id)
 * - Actualizar por /api/orders/:documentId (NO /:id)
 */

function pickNotificationInfo(url: URL, body: any) {
  const typeFromQuery =
    url.searchParams.get("type") ||
    url.searchParams.get("topic") ||
    url.searchParams.get("action");

  const qpId =
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    url.searchParams.get("data[id]") ||
    url.searchParams.get("payment_id") ||
    url.searchParams.get("collection_id");

  const bodyType = body?.type || body?.topic || body?.action;
  const bodyId = body?.data?.id || body?.data?.["id"] || body?.id;

  const type = typeFromQuery || bodyType || undefined;
  const id = qpId || bodyId || null;

  return { type: type ? String(type) : undefined, id: id ? String(id) : null };
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

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

async function fetchMpPayment(accessToken: string, paymentId: string) {
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
    throw new Error(`MP payment fetch failed (${payRes.status}) ${errText}`);
  }

  return payment;
}

async function resolvePaymentIdFromMerchantOrder(accessToken: string, merchantOrderId: string) {
  const moRes = await fetch(
    `https://api.mercadopago.com/merchant_orders/${encodeURIComponent(merchantOrderId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  const mo = await moRes.json().catch(() => null);

  if (!moRes.ok || !mo) {
    const errText = mo ? JSON.stringify(mo) : "";
    throw new Error(`MP merchant_order fetch failed (${moRes.status}) ${errText}`);
  }

  const payments: any[] = Array.isArray(mo?.payments) ? mo.payments : [];
  const approved = payments.find((p) => p?.status === "approved" && p?.id);
  const anyPayment = approved || payments.find((p) => p?.id);

  return anyPayment?.id ? String(anyPayment.id) : null;
}

/**
 * ✅ Strapi v5:
 * devolvemos documentId (no id)
 */
async function findOrderDocumentIdByMpExternalReference(
  strapiBase: string,
  token: string,
  mpExternalReference: string
) {
  const q = new URLSearchParams({
    "filters[mpExternalReference][$eq]": mpExternalReference,
    "pagination[pageSize]": "1",
    // pedimos documentId explícitamente
    "fields[0]": "documentId",
  });

  const res = await fetch(`${strapiBase}/api/orders?${q.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data) {
    const text = data ? JSON.stringify(data) : "";
    throw new Error(`Strapi search failed (${res.status}) ${text}`);
  }

  const documentId = data?.data?.[0]?.documentId;
  return documentId ? String(documentId) : null;
}

async function updateOrderInStrapi(params: {
  strapiBase: string;
  token: string;
  orderDocumentId: string;
  payload: any;
}) {
  const { strapiBase, token, orderDocumentId, payload } = params;

  // ✅ Strapi v5 actualiza por documentId
  const updateUrl = `${strapiBase}/api/orders/${encodeURIComponent(orderDocumentId)}`;

  const updateRes = await fetch(updateUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!updateRes.ok) {
    const text = await updateRes.text().catch(() => "");
    throw new Error(`Strapi update failed (${updateRes.status}) ${text || "(no body)"}`);
  }

  return true;
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      // ok
    }

    const { type, id } = pickNotificationInfo(url, body);
    if (!id) return NextResponse.json({ ok: true }, { status: 200 });

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      console.error("[Webhook] falta MP_ACCESS_TOKEN");
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    let paymentId: string | null = null;

    if (!type || type.includes("payment")) {
      paymentId = id;
    } else if (type.includes("merchant_order")) {
      try {
        paymentId = await resolvePaymentIdFromMerchantOrder(accessToken, id);
      } catch (e: any) {
        console.error("[Webhook] no pude resolver paymentId desde merchant_order:", e?.message || e);
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      if (!paymentId) {
        return NextResponse.json({ ok: true, skipped: "no_payment_yet" }, { status: 200 });
      }
    } else {
      return NextResponse.json({ ok: true, skipped: "unsupported_topic" }, { status: 200 });
    }

    let payment: any;
    try {
      payment = await fetchMpPayment(accessToken, paymentId);
    } catch (e: any) {
      console.error("[Webhook] MP payment fetch failed:", e?.message || e);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const mpStatus: string | undefined = payment?.status;
    const mpStatusDetail: string | undefined = payment?.status_detail;

    const mpExternalReferenceRaw =
      payment?.external_reference ??
      payment?.metadata?.mpExternalReference ??
      payment?.metadata?.external_reference;

    if (!mpExternalReferenceRaw) {
      console.warn("[Webhook] pago sin external_reference/mpExternalReference", { paymentId, mpStatus });
      return NextResponse.json({ ok: true, skipped: "missing_external_reference" }, { status: 200 });
    }

    const mpExternalReference = String(mpExternalReferenceRaw);

    const strapiBase = normalizeStrapiBase(
      process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337"
    );

    const token = process.env.STRAPI_TOKEN || process.env.STRAPI_API_TOKEN;
    if (!token) {
      console.error("[Webhook] falta STRAPI_API_TOKEN / STRAPI_TOKEN");
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // ✅ buscar documentId (Strapi v5)
    let orderDocumentId: string | null = null;
    try {
      orderDocumentId = await findOrderDocumentIdByMpExternalReference(
        strapiBase,
        token,
        mpExternalReference
      );
    } catch (e: any) {
      console.error("[Webhook] no pude buscar order por mpExternalReference:", e?.message || e);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (!orderDocumentId) {
      console.warn("[Webhook] order NO encontrada para mpExternalReference:", mpExternalReference);
      return NextResponse.json({ ok: true, skipped: "order_not_found" }, { status: 200 });
    }

    const orderStatus = mapMpToOrderStatus(mpStatus);

    const updatePayload = {
      data: {
        orderStatus,
        mpPaymentId: String(paymentId),
        mpStatus: mpStatus ? String(mpStatus) : null,
        mpStatusDetail: mpStatusDetail ? String(mpStatusDetail) : null,
        mpMerchantOrderId: payment?.order?.id ? String(payment.order.id) : null,
        mpExternalReference,
      },
    };

    console.log("[Webhook] strapiBase:", strapiBase);
    console.log("[Webhook] topic/type:", type);
    console.log("[Webhook] paymentId:", paymentId);
    console.log("[Webhook] mpExternalReference:", mpExternalReference);
    console.log("[Webhook] orderDocumentId:", orderDocumentId);

    try {
      await updateOrderInStrapi({
        strapiBase,
        token,
        orderDocumentId,
        payload: updatePayload,
      });
    } catch (e: any) {
      console.error("[Webhook] Strapi update failed:", e?.message || e);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("[Webhook] fatal error:", err?.message || err);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
