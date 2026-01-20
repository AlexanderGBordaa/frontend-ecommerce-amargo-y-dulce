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
 * - ✅ Dispara email SOLO cuando el estado pasa a paid (anti-duplicados)
 * - ✅ Descuenta stock SOLO una vez cuando pasa a paid (anti-duplicados) usando order.stockAdjusted
 *
 * Strapi v5:
 * - Buscar documentId (NO id)
 * - Actualizar por /api/orders/:documentId
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

async function resolvePaymentIdFromMerchantOrder(
  accessToken: string,
  merchantOrderId: string
) {
  const moRes = await fetch(
    `https://api.mercadopago.com/merchant_orders/${encodeURIComponent(
      merchantOrderId
    )}`,
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
 * Trae documentId + orderStatus + datos para email + stockAdjusted + items
 */
async function findOrderByMpExternalReference(
  strapiBase: string,
  token: string,
  mpExternalReference: string
) {
  const q = new URLSearchParams({
    "filters[mpExternalReference][$eq]": mpExternalReference,
    "pagination[pageSize]": "1",
    "fields[0]": "documentId",
    "fields[1]": "orderStatus",
    "fields[2]": "email",
    "fields[3]": "name",
    "fields[4]": "orderNumber",
    "fields[5]": "total",
    "fields[6]": "items",
    "fields[7]": "phone",
    "fields[8]": "shippingAddress",
    "fields[9]": "stockAdjusted", // ✅ NUEVO
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

  const o = data?.data?.[0];
  if (!o?.documentId) return null;

  return {
    documentId: String(o.documentId),
    orderStatus: (o?.orderStatus ?? o?.attributes?.orderStatus ?? null) as
      | string
      | null,
    email: (o?.email ?? o?.attributes?.email ?? null) as string | null,
    name: (o?.name ?? o?.attributes?.name ?? null) as string | null,
    orderNumber: (o?.orderNumber ?? o?.attributes?.orderNumber ?? null) as
      | string
      | null,
    total: (o?.total ?? o?.attributes?.total ?? null) as number | null,
    items: (o?.items ?? o?.attributes?.items ?? null) as any,
    phone: (o?.phone ?? o?.attributes?.phone ?? null) as string | null,
    shippingAddress: (o?.shippingAddress ?? o?.attributes?.shippingAddress ?? null) as any,
    stockAdjusted: Boolean(o?.stockAdjusted ?? o?.attributes?.stockAdjusted ?? false), // ✅ NUEVO
  };
}

async function updateOrderInStrapi(params: {
  strapiBase: string;
  token: string;
  orderDocumentId: string;
  payload: any;
}) {
  const { strapiBase, token, orderDocumentId, payload } = params;

  const updateUrl = `${strapiBase}/api/orders/${encodeURIComponent(
    orderDocumentId
  )}`;

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
    throw new Error(
      `Strapi update failed (${updateRes.status}) ${text || "(no body)"}`
    );
  }

  const json = await updateRes.json().catch(() => null);
  return json;
}

/**
 * ✅ Helpers Stock (Product.stock integer)
 * Nota: asumo que en items guardás productId (numérico de Strapi) + qty.
 * Si guardás productDocumentId, lo simplificamos todavía más.
 */
async function findProductDocumentIdAndStockByNumericId(params: {
  strapiBase: string;
  token: string;
  productNumericId: string | number;
}) {
  const { strapiBase, token, productNumericId } = params;

  // buscamos por id numérico
  const q = new URLSearchParams({
    "filters[id][$eq]": String(productNumericId),
    "pagination[pageSize]": "1",
    "fields[0]": "documentId",
    "fields[1]": "stock",
  });

  const res = await fetch(`${strapiBase}/api/products?${q.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data) {
    const text = data ? JSON.stringify(data) : "";
    throw new Error(`Strapi product search failed (${res.status}) ${text}`);
  }

  const p = data?.data?.[0];
  if (!p?.documentId) return null;

  const stockRaw = p?.stock ?? p?.attributes?.stock ?? 0;
  const stock = Number(stockRaw);
  return {
    documentId: String(p.documentId),
    stock: Number.isFinite(stock) ? stock : 0,
  };
}

async function updateProductStock(params: {
  strapiBase: string;
  token: string;
  productDocumentId: string;
  newStock: number;
}) {
  const { strapiBase, token, productDocumentId, newStock } = params;

  const res = await fetch(
    `${strapiBase}/api/products/${encodeURIComponent(productDocumentId)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ data: { stock: newStock } }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Strapi product update failed (${res.status}) ${t || "(no body)"}`);
  }
}

async function adjustStockFromOrderItems(params: {
  strapiBase: string;
  token: string;
  items: any;
}) {
  const { strapiBase, token, items } = params;
  if (!Array.isArray(items) || items.length === 0) return;

  for (const it of items) {
    const productId = it?.productId;
    const qty = Number(it?.qty ?? 1);

    if (!productId) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const found = await findProductDocumentIdAndStockByNumericId({
      strapiBase,
      token,
      productNumericId: productId,
    });

    if (!found) {
      console.warn("[Webhook] No encontré product para descontar stock:", { productId });
      continue;
    }

    const nextStock = Math.max(0, found.stock - qty);

    await updateProductStock({
      strapiBase,
      token,
      productDocumentId: found.documentId,
      newStock: nextStock,
    });

    console.log("[Webhook] Stock actualizado:", {
      productId,
      productDocumentId: found.documentId,
      prevStock: found.stock,
      qty,
      nextStock,
    });
  }
}

async function sendOrderConfirmationEmail(params: {
  siteUrl: string;
  email: string;
  name?: string | null;
  orderNumber?: string | null;
  total?: number | null;
  items?: any;
  phone?: string | null;
  shippingAddress?: any;
}) {
  const { siteUrl, ...payload } = params;

  // Llama a tu endpoint que usa Resend
  const res = await fetch(`${siteUrl}/api/email/order-confirmation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Email send failed (${res.status}) ${t || "(no body)"}`);
  }
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
        console.error(
          "[Webhook] no pude resolver paymentId desde merchant_order:",
          e?.message || e
        );
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      if (!paymentId) {
        return NextResponse.json(
          { ok: true, skipped: "no_payment_yet" },
          { status: 200 }
        );
      }
    } else {
      return NextResponse.json(
        { ok: true, skipped: "unsupported_topic" },
        { status: 200 }
      );
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
      console.warn("[Webhook] pago sin external_reference/mpExternalReference", {
        paymentId,
        mpStatus,
      });
      return NextResponse.json(
        { ok: true, skipped: "missing_external_reference" },
        { status: 200 }
      );
    }

    const mpExternalReference = String(mpExternalReferenceRaw);

    const strapiBase = normalizeStrapiBase(
      process.env.STRAPI_URL ||
        process.env.NEXT_PUBLIC_STRAPI_URL ||
        "http://localhost:1337"
    );

    const token = process.env.STRAPI_TOKEN || process.env.STRAPI_API_TOKEN;
    if (!token) {
      console.error("[Webhook] falta STRAPI_API_TOKEN / STRAPI_TOKEN");
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // ✅ Traemos el estado actual + datos para email + stockAdjusted
    let order: Awaited<ReturnType<typeof findOrderByMpExternalReference>> = null;
    try {
      order = await findOrderByMpExternalReference(
        strapiBase,
        token,
        mpExternalReference
      );
    } catch (e: any) {
      console.error(
        "[Webhook] no pude buscar order por mpExternalReference:",
        e?.message || e
      );
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (!order) {
      console.warn(
        "[Webhook] order NO encontrada para mpExternalReference:",
        mpExternalReference
      );
      return NextResponse.json(
        { ok: true, skipped: "order_not_found" },
        { status: 200 }
      );
    }

    const prevStatus = order.orderStatus || "pending";
    const nextStatus = mapMpToOrderStatus(mpStatus);

    const updatePayload = {
      data: {
        orderStatus: nextStatus,
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
    console.log("[Webhook] orderDocumentId:", order.documentId);
    console.log("[Webhook] prevStatus -> nextStatus:", prevStatus, "->", nextStatus);
    console.log("[Webhook] stockAdjusted:", order.stockAdjusted);

    try {
      await updateOrderInStrapi({
        strapiBase,
        token,
        orderDocumentId: order.documentId,
        payload: updatePayload,
      });
    } catch (e: any) {
      console.error("[Webhook] Strapi update failed:", e?.message || e);
      // aunque falle update, devolvemos 200 para evitar reintentos infinitos
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // ✅ Anti-duplicados: SOLO si pasa a paid
    const becamePaid = prevStatus !== "paid" && nextStatus === "paid";

    if (becamePaid) {
      // ✅ 1) Descontar stock SOLO una vez (anti-duplicados extra por stockAdjusted)
      // Nota: order.stockAdjusted es el valor ANTES de actualizar;
      // si ya era true, no repetimos.
      if (!order.stockAdjusted) {
        try {
          await adjustStockFromOrderItems({
            strapiBase,
            token,
            items: order.items,
          });

          // marcamos la orden como ajustada para no volver a descontar
          await updateOrderInStrapi({
            strapiBase,
            token,
            orderDocumentId: order.documentId,
            payload: { data: { stockAdjusted: true } },
          });

          console.log("[Webhook] Stock descontado y stockAdjusted=true");
        } catch (e: any) {
          console.error("[Webhook] Error descontando stock:", e?.message || e);
          // No devolvemos error: el pago está OK. Podés corregir y reintentar manual si hace falta.
        }
      } else {
        console.log("[Webhook] Ya estaba stockAdjusted=true, no descuento stock.");
      }

      // ✅ 2) Email confirmación
      const siteUrl =
        process.env.SITE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        `${url.protocol}//${url.host}`;

      const to = order.email;
      if (!to) {
        console.warn("[Webhook] Orden pagada pero sin email, no envío confirmación.", {
          mpExternalReference,
          orderDocumentId: order.documentId,
        });
      } else {
        try {
          await sendOrderConfirmationEmail({
            siteUrl,
            email: to,
            name: order.name,
            orderNumber: order.orderNumber ?? undefined,
            total: order.total ?? undefined,
            items: order.items,
            phone: order.phone ?? undefined,
            shippingAddress: order.shippingAddress,
          });
          console.log("[Webhook] Email de confirmación enviado:", {
            to,
            orderNumber: order.orderNumber,
          });
        } catch (e: any) {
          console.error("[Webhook] Error enviando email (Resend):", e?.message || e);
        }
      }
    }

    return NextResponse.json(
      { ok: true, becamePaid, stockAdjusted: becamePaid ? !order.stockAdjusted : undefined },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[Webhook] fatal error:", err?.message || err);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
