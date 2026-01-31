// src/app/api/mp/webhook/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

/* ======================= STRAPI HELPERS ======================= */

function flattenStrapiRow(row: any) {
  if (!row) return null;
  if (row?.attributes) {
    // v4-like: { id, documentId?, attributes:{...} }
    return {
      id: row?.id ?? null,
      documentId: row?.documentId ?? row?.attributes?.documentId ?? row?.attributes?.document_id ?? null,
      ...row.attributes,
    };
  }
  // v5 sometimes flat
  return row;
}

/* ======================= ORDER ======================= */

async function findOrderByMpExternalReference(
  strapiBase: string,
  token: string,
  mpExternalReference: string
) {
  // 👇 IMPORTANTE: no usamos fields[] porque puede esconder attributes/documentId según versión
  const q = new URLSearchParams({
    "filters[mpExternalReference][$eq]": mpExternalReference,
    "pagination[pageSize]": "1",
    "populate": "*",
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

  const raw = data?.data?.[0];
  const flat = flattenStrapiRow(raw);

  if (!flat) return null;

  const documentId =
    flat?.documentId != null ? String(flat.documentId).trim() : "";

  if (!documentId) {
    console.error("[Webhook] Order encontrada pero sin documentId. raw:", raw);
    return null;
  }

  return {
    // ✅ claves para operar
    documentId,
    numericId: flat?.id ?? raw?.id ?? null, // solo debug

    // ✅ campos del pedido
    orderStatus: (flat?.orderStatus ?? null) as string | null,
    email: (flat?.email ?? null) as string | null,
    name: (flat?.name ?? null) as string | null,
    orderNumber: (flat?.orderNumber ?? null) as string | null,
    total: (flat?.total ?? null) as number | null,
    items: (flat?.items ?? null) as any,
    phone: (flat?.phone ?? null) as string | null,
    shippingAddress: (flat?.shippingAddress ?? null) as any,
    stockAdjusted: Boolean(flat?.stockAdjusted ?? false),
  };
}

async function updateOrderInStrapi(params: {
  strapiBase: string;
  token: string;
  orderDocumentId: string;
  payload: any;
}) {
  const { strapiBase, token, orderDocumentId, payload } = params;

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

  const json = await updateRes.json().catch(() => null);
  return json;
}

/* ======================= STOCK ROBUSTO ======================= */

type ProductStockRow = {
  documentId: string;
  stock: number | null; // null => ilimitado
};

async function findProductByDocumentId(params: {
  strapiBase: string;
  token: string;
  productDocumentId: string;
}) {
  const { strapiBase, token, productDocumentId } = params;

  const sp = new URLSearchParams();
  sp.set("pagination[pageSize]", "1");
  sp.set("filters[documentId][$eq]", String(productDocumentId));
  sp.set("populate", "*");

  const res = await fetch(`${strapiBase}/api/products?${sp.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data) {
    const text = data ? JSON.stringify(data) : "";
    throw new Error(`Strapi product search failed (${res.status}) ${text}`);
  }

  const pRaw = data?.data?.[0];
  const p = flattenStrapiRow(pRaw);

  const doc =
    p?.documentId != null ? String(p.documentId).trim() : "";

  if (!doc) return null;

  const stockRaw = p?.stock ?? null;

  if (stockRaw === null || stockRaw === undefined) {
    return { documentId: doc, stock: null } as ProductStockRow;
  }

  const stockNum = Number(stockRaw);
  return {
    documentId: doc,
    stock: Number.isFinite(stockNum) ? stockNum : 0,
  } as ProductStockRow;
}

async function updateProductStock(params: {
  strapiBase: string;
  token: string;
  productDocumentId: string;
  newStock: number;
}) {
  const { strapiBase, token, productDocumentId, newStock } = params;

  const res = await fetch(`${strapiBase}/api/products/${encodeURIComponent(productDocumentId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data: { stock: newStock } }),
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Strapi product update failed (${res.status}) ${t || "(no body)"}`);
  }
}

async function validateStockOrThrow(params: {
  strapiBase: string;
  token: string;
  items: any[];
}) {
  const { strapiBase, token, items } = params;

  const need = new Map<string, number>();

  for (const it of Array.isArray(items) ? items : []) {
    const doc = String(it?.productDocumentId ?? "").trim();
    const qty = Number(it?.qty ?? 0);
    if (!doc || !Number.isFinite(qty) || qty <= 0) continue;
    need.set(doc, (need.get(doc) ?? 0) + qty);
  }

  const docIds = Array.from(need.keys());
  if (!docIds.length) return;

  const problems: Array<{ doc: string; requested: number; available: number }> = [];

  for (const doc of docIds) {
    const requested = need.get(doc)!;

    const p = await findProductByDocumentId({ strapiBase, token, productDocumentId: doc });

    if (!p) {
      problems.push({ doc, requested, available: 0 });
      continue;
    }

    if (p.stock === null) continue;

    if (p.stock < requested) {
      problems.push({ doc, requested, available: p.stock });
    }
  }

  if (problems.length) {
    const err: any = new Error("OUT_OF_STOCK");
    err.code = "OUT_OF_STOCK";
    err.problems = problems;
    throw err;
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
    const qty = Number(it?.qty ?? 1);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const docFromItem = String(it?.productDocumentId ?? "").trim();
    if (!docFromItem) continue;

    const p = await findProductByDocumentId({ strapiBase, token, productDocumentId: docFromItem });
    if (!p) continue;
    if (p.stock === null) continue;

    const nextStock = Math.max(0, p.stock - qty);

    await updateProductStock({
      strapiBase,
      token,
      productDocumentId: p.documentId,
      newStock: nextStock,
    });
  }
}

/* ======================= EMAIL ======================= */

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

/* ======================= INVOICE ======================= */

async function tryGenerateInvoice(params: { siteUrl: string; orderId: string }) {
  const { siteUrl, orderId } = params;

  try {
    const r = await fetch(`${siteUrl}/api/invoices/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
      cache: "no-store",
    });

    const j = await r.json().catch(() => null);

    if (!r.ok) {
      console.error("[Webhook] invoice generate failed:", r.status, j);
      return { ok: false as const, status: r.status, details: j };
    }

    console.log("[Webhook] invoice generate ok:", j?.alreadyExists ? "alreadyExists" : "created");
    return { ok: true as const, data: j };
  } catch (e: any) {
    console.error("[Webhook] invoice generate fetch error:", e?.message || e);
    return { ok: false as const, status: 0, details: e?.message || String(e) };
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

    let order: Awaited<ReturnType<typeof findOrderByMpExternalReference>> = null;
    try {
      order = await findOrderByMpExternalReference(strapiBase, token, mpExternalReference);
    } catch (e: any) {
      console.error("[Webhook] no pude buscar order por mpExternalReference:", e?.message || e);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (!order) {
      console.warn("[Webhook] order NO encontrada para mpExternalReference:", mpExternalReference);
      return NextResponse.json({ ok: true, skipped: "order_not_found" }, { status: 200 });
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

    console.log("[Webhook] order ids:", { documentId: order.documentId, numericId: order.numericId });
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
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const becamePaid = prevStatus !== "paid" && nextStatus === "paid";

    if (becamePaid) {
      const items = Array.isArray(order.items) ? order.items : [];

      try {
        await validateStockOrThrow({ strapiBase, token, items });
      } catch (e: any) {
        console.error("[Webhook] OUT_OF_STOCK:", e?.problems || e?.message || e);

        try {
          await updateOrderInStrapi({
            strapiBase,
            token,
            orderDocumentId: order.documentId,
            payload: {
              data: {
                orderStatus: "failed",
                stockAdjusted: false,
                mpPaymentId: String(paymentId),
                mpExternalReference,
              },
            },
          });
        } catch (err2: any) {
          console.error("[Webhook] No pude marcar failed:", err2?.message || err2);
        }

        return NextResponse.json({ ok: true, reason: "OUT_OF_STOCK" }, { status: 200 });
      }

      if (!order.stockAdjusted) {
        try {
          await adjustStockFromOrderItems({ strapiBase, token, items });

          await updateOrderInStrapi({
            strapiBase,
            token,
            orderDocumentId: order.documentId,
            payload: { data: { stockAdjusted: true } },
          });

          console.log("[Webhook] Stock descontado y stockAdjusted=true");
        } catch (e: any) {
          console.error("[Webhook] Error descontando stock:", e?.message || e);
        }
      }
    }

    if (nextStatus === "paid") {
      const siteUrl =
        process.env.SITE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        `${url.protocol}//${url.host}`;

      await tryGenerateInvoice({ siteUrl, orderId: order.documentId });
    }

    if (becamePaid) {
      const siteUrl =
        process.env.SITE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        `${url.protocol}//${url.host}`;

      const to = order.email;
      if (to) {
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
          console.log("[Webhook] Email de confirmación enviado:", { to, orderNumber: order.orderNumber });
        } catch (e: any) {
          console.error("[Webhook] Error enviando email:", e?.message || e);
        }
      } else {
        console.warn("[Webhook] Order paid pero sin email en order:", { documentId: order.documentId });
      }
    }

    return NextResponse.json({ ok: true, becamePaid }, { status: 200 });
  } catch (err: any) {
    console.error("[Webhook] fatal error:", err?.message || err);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
