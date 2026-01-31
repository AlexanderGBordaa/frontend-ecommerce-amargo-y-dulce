// src/app/api/mp/create-preference/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type MPItem = {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: "ARS";
};

function normalizeBaseUrl(url: string) {
  const u = String(url ?? "").trim();
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

function isHttpUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function pickMpErrorMessage(payload: any, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (payload?.message) return payload.message;
  if (payload?.error) return payload.error;
  if (payload?.cause?.[0]?.description) return payload.cause[0].description;
  return fallback;
}

function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
}

/* ===================== AUTH (JWT USER) ===================== */

function readUserJwtFromCookies() {
  const jar = cookies();
  return (
    jar.get("strapi_jwt")?.value ||
    jar.get("jwt")?.value ||
    jar.get("token")?.value ||
    jar.get("access_token")?.value ||
    null
  );
}

/* ===================== STRAPI HELPERS ===================== */

function pickAttr(row: any) {
  return row?.attributes ?? row ?? {};
}

function pickDocumentId(row: any): string | null {
  const attr = pickAttr(row);
  const v =
    row?.documentId ??
    row?.attributes?.documentId ??
    row?.attributes?.document_id ??
    attr?.documentId ??
    attr?.document_id ??
    null;

  const s = v != null ? String(v).trim() : "";
  return s ? s : null;
}

function pickTitle(row: any): string {
  const attr = pickAttr(row);
  return String(attr?.title ?? row?.title ?? "Producto");
}

function pickStock(row: any): number | null {
  const attr = pickAttr(row);
  const raw = attr?.stock ?? row?.stock ?? null;
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

async function fetchStrapiJson(url: string, jwt: string) {
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });
  const json = await r.json().catch(() => null);
  return { r, json };
}

/**
 * ✅ Busca Order por documentId usando filters (porque /orders/:id espera id numérico)
 */
async function getOrderByDocumentId(strapiBase: string, jwt: string, documentId: string) {
  const sp = new URLSearchParams();
  sp.set("populate", "*");
  sp.set("filters[documentId][$eq]", documentId);
  sp.set("pagination[pageSize]", "1");

  const url = `${strapiBase}/api/orders?${sp.toString()}`;
  const { r, json } = await fetchStrapiJson(url, jwt);

  if (!r.ok) return { ok: false as const, status: r.status, json };

  const row = Array.isArray(json?.data) ? json.data[0] : null;
  if (!row) return { ok: false as const, status: 404, json };

  const flat = row?.attributes ? { id: row.id, documentId: row.documentId, ...row.attributes } : row;
  return { ok: true as const, data: flat, raw: row };
}

/* ===================== STOCK VALIDATION ===================== */

async function validateStockOrThrow(strapiBase: string, jwt: string, items: any[]) {
  const need = new Map<string, { requested: number; title?: string }>();

  for (const it of Array.isArray(items) ? items : []) {
    const doc = String(it?.productDocumentId ?? "").trim();
    const qty = Number(it?.qty ?? it?.quantity ?? 0);
    if (!doc || !Number.isFinite(qty) || qty <= 0) continue;

    const prev = need.get(doc);
    need.set(doc, {
      requested: (prev?.requested ?? 0) + qty,
      title: String(it?.title ?? prev?.title ?? "Producto"),
    });
  }

  const docIds = Array.from(need.keys());
  if (!docIds.length) return;

  const sp = new URLSearchParams();
  sp.set("pagination[pageSize]", String(Math.min(docIds.length, 100)));
  sp.set("populate", "*");
  sp.set("filters[publishedAt][$notNull]", "true");
  docIds.forEach((doc, i) => sp.set(`filters[$or][${i}][documentId][$eq]`, doc));

  const url = `${strapiBase}/api/products?${sp.toString()}`;
  const { r, json } = await fetchStrapiJson(url, jwt);

  if (!r.ok) {
    const err: any = new Error("STRAPI_PRODUCTS_FETCH_FAILED");
    err.code = "STRAPI_PRODUCTS_FETCH_FAILED";
    err.status = r.status;
    err.details = json;
    throw err;
  }

  const rows = Array.isArray(json?.data) ? json.data : [];
  const byDoc = new Map<string, any>();
  for (const row of rows) {
    const doc = pickDocumentId(row);
    if (doc) byDoc.set(doc, row);
  }

  const problems: Array<{ productDocumentId: string; title: string; requested: number; available: number }> = [];

  for (const doc of docIds) {
    const requested = need.get(doc)!.requested;
    const row = byDoc.get(doc);

    if (!row) {
      problems.push({ productDocumentId: doc, title: need.get(doc)?.title ?? "Producto", requested, available: 0 });
      continue;
    }

    const stock = pickStock(row);
    if (stock === null) continue;

    if (stock < requested) {
      problems.push({ productDocumentId: doc, title: pickTitle(row), requested, available: stock });
    }
  }

  if (problems.length) {
    const err: any = new Error("OUT_OF_STOCK");
    err.code = "OUT_OF_STOCK";
    err.problems = problems;
    throw err;
  }
}

/* ===================== ROUTE ===================== */

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido (se esperaba JSON)" }, { status: 400 });
  }

  const jwt = readUserJwtFromCookies();
  if (!jwt) {
    return NextResponse.json({ error: "No autorizado: iniciá sesión para pagar." }, { status: 401 });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "Falta MP_ACCESS_TOKEN en el servidor" }, { status: 500 });
  }

  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const siteUrl = normalizeBaseUrl(rawSiteUrl);
  if (!isHttpUrl(siteUrl)) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SITE_URL inválida (http/https requerido)", got: rawSiteUrl },
      { status: 500 }
    );
  }

  const strapiBase = normalizeStrapiBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337"
  );

  const orderId = String(body?.orderId ?? "").trim();
  if (!orderId) {
    return NextResponse.json({ error: "Falta orderId (documentId de la orden)" }, { status: 400 });
  }

  // ✅ Traer orden por documentId (filters)
  const orderRes = await getOrderByDocumentId(strapiBase, jwt, orderId);
  if (!orderRes.ok) {
    return NextResponse.json(
      {
        error: "No se pudo obtener la orden desde Strapi (auth/ownership o no existe)",
        status: orderRes.status,
        details: orderRes.json,
      },
      { status: orderRes.status || 500 }
    );
  }

  const order = orderRes.data;
  const orderNumber = order?.orderNumber ? String(order.orderNumber) : null;

  const mpExternalReference =
    typeof order?.mpExternalReference === "string" && order.mpExternalReference.trim()
      ? order.mpExternalReference.trim()
      : typeof body?.mpExternalReference === "string"
        ? body.mpExternalReference.trim()
        : "";

  if (!mpExternalReference) {
    return NextResponse.json(
      { error: "La orden no tiene mpExternalReference. Re-creá la orden." },
      { status: 400 }
    );
  }

  const items = Array.isArray(order?.items) ? order.items : [];
  if (!items.length) {
    return NextResponse.json({ error: "La orden no tiene items válidos en Strapi" }, { status: 400 });
  }

  const totalNumber = Number(order?.total);
  if (!Number.isFinite(totalNumber) || totalNumber <= 0) {
    return NextResponse.json({ error: "La orden tiene total inválido en Strapi", total: order?.total }, { status: 400 });
  }

  // ✅ Validar stock
  try {
    await validateStockOrThrow(strapiBase, jwt, items);
  } catch (e: any) {
    if (e?.code === "OUT_OF_STOCK") {
      return NextResponse.json({ error: "Sin stock suficiente", code: "OUT_OF_STOCK", problems: e.problems ?? [] }, { status: 409 });
    }
    return NextResponse.json({ error: e?.message || "Error validando stock", code: e?.code, details: e?.details }, { status: 500 });
  }

  // Cobro por 1 ítem = total final
  const chargeItems: MPItem[] = [
    {
      title: orderNumber ? `Pedido ${orderNumber}` : "Compra Amargo y Dulce",
      quantity: 1,
      unit_price: Math.round(totalNumber),
      currency_id: "ARS",
    },
  ];

  const external_reference = mpExternalReference;
  const notification_url = `${siteUrl}/api/mp/webhook`;
  const back_urls = {
    success: `${siteUrl}/gracias?status=success&orderId=${encodeURIComponent(orderId)}`,
    failure: `${siteUrl}/gracias?status=failure&orderId=${encodeURIComponent(orderId)}`,
    pending: `${siteUrl}/gracias?status=pending&orderId=${encodeURIComponent(orderId)}`,
  };

  const preferenceBody = {
    items: chargeItems,
    external_reference,
    back_urls,
    auto_return: "approved",
    notification_url,
    metadata: cleanObject({
      orderId,
      orderNumber: orderNumber ?? undefined,
      mpExternalReference: external_reference,
      shippingMethod: order?.shippingMethod ?? undefined,
      pickupPoint: order?.pickupPoint ?? undefined,
      total: String(Math.round(totalNumber)),
    }),
  };

  try {
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceBody),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { error: pickMpErrorMessage(data, "MercadoPago rechazó la preferencia"), status: res.status, details: data },
        { status: res.status || 500 }
      );
    }

    return NextResponse.json({
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
      mpExternalReference: external_reference,
      orderId,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Error conectando con MercadoPago" }, { status: 500 });
  }
}
