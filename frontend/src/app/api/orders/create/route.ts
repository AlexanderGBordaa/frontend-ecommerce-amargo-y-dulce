// src/app/api/orders/create/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

function isNonEmptyString(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function safeUUID() {
  const fn = (crypto as any)?.randomUUID;
  if (typeof fn === "function") return fn.call(crypto);
  return crypto.randomBytes(16).toString("hex");
}

async function strapiJSON(res: Response) {
  return await res.json().catch(() => null);
}

function badRequest(msg: string, fields?: Record<string, any>) {
  return NextResponse.json({ error: msg, fields }, { status: 400 });
}

function readShipping(obj: any) {
  const s = obj?.shippingAddress ?? null;
  return {
    street: isNonEmptyString(s?.street) ? s.street.trim() : "",
    number: isNonEmptyString(s?.number) ? s.number.trim() : "",
    city: isNonEmptyString(s?.city) ? s.city.trim() : "",
    province: isNonEmptyString(s?.province) ? s.province.trim() : "",
    postalCode: isNonEmptyString(s?.postalCode) ? s.postalCode.trim() : "",
    notes: isNonEmptyString(s?.notes) ? s.notes.trim() : "",
    text: isNonEmptyString(s?.text) ? s.text.trim() : "",
    source: isNonEmptyString(s?.source) ? s.source.trim() : "",
    addressId: isNonEmptyString(s?.addressId) ? s.addressId.trim() : "",
    label: isNonEmptyString(s?.label) ? s.label.trim() : "",
  };
}

/** ✅ Normaliza DNI: solo dígitos */
function normalizeDni(v: any) {
  const raw = String(v ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  return digits.length ? digits : "";
}

type ShippingMethod = "delivery" | "pickup";

function readShippingMethod(v: any): ShippingMethod {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "pickup") return "pickup";
  return "delivery";
}

function readMoney(v: any, def = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : def;
}

/**
 * Lee JWT del usuario desde cookies (probamos varios nombres comunes).
 * Ajustá/limpiá si ya sabés el nombre exacto.
 */
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

export async function POST(req: Request) {
  const strapiBase = normalizeStrapiBase(
    process.env.STRAPI_URL ||
      process.env.NEXT_PUBLIC_STRAPI_URL ||
      "http://localhost:1337"
  );

  // ✅ Ahora el checkout crea órdenes SOLO logueado
  const jwt = readUserJwtFromCookies();
  if (!jwt) {
    return NextResponse.json(
      { error: "No autorizado: iniciá sesión para crear una orden." },
      { status: 401 }
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body inválido (se esperaba JSON)" },
      { status: 400 }
    );
  }

  const incomingData =
    body && typeof body === "object" && "data" in body ? body.data : body;

  if (!incomingData || typeof incomingData !== "object") {
    return NextResponse.json(
      { error: "Body inválido: se esperaba un objeto con datos de la orden" },
      { status: 400 }
    );
  }

  // ===================== VALIDACIONES =====================

  const name = isNonEmptyString(incomingData.name) ? incomingData.name.trim() : "";
  const email = isNonEmptyString(incomingData.email)
    ? incomingData.email.trim().toLowerCase()
    : "";
  const phone = isNonEmptyString(incomingData.phone) ? incomingData.phone.trim() : "";

  const dni = normalizeDni(incomingData.dni);

  if (name.length < 2) return badRequest("Nombre inválido", { name });
  if (!email.includes("@")) return badRequest("Email inválido", { email });
  if (phone.length < 6) return badRequest("Teléfono inválido", { phone });

  if (dni && (dni.length < 7 || dni.length > 10)) {
    return badRequest("DNI inválido (7 a 10 dígitos)", { dni });
  }

  const shippingMethod: ShippingMethod = readShippingMethod(incomingData.shippingMethod);
  const shippingCost = readMoney(incomingData.shippingCost, 0);
  const pickupPoint = isNonEmptyString(incomingData.pickupPoint)
    ? incomingData.pickupPoint.trim()
    : null;

  if (shippingCost < 0) return badRequest("shippingCost inválido", { shippingCost });

  const shipping = readShipping(incomingData);

  if (shippingMethod === "delivery") {
    if (shipping.street.length < 2) return badRequest("Falta street", { street: shipping.street });
    if (shipping.number.length < 1) return badRequest("Falta number", { number: shipping.number });
    if (shipping.city.length < 2) return badRequest("Falta city", { city: shipping.city });
    if (shipping.province.length < 2) return badRequest("Falta province", { province: shipping.province });
    if (shipping.postalCode.length < 4) return badRequest("Falta postalCode", { postalCode: shipping.postalCode });
  } else {
    if (!pickupPoint) {
      return badRequest("Falta pickupPoint para retiro en sucursal", { pickupPoint });
    }
  }

  const items = Array.isArray(incomingData.items) ? incomingData.items : [];
  if (items.length === 0) return badRequest("Tu carrito está vacío (items).");

  const subtotal = readMoney(incomingData.subtotal, 0);
  const discountTotal = readMoney(incomingData.discountTotal, 0);

  const total = Number(incomingData.total);
  if (!Number.isFinite(total) || total <= 0) {
    return badRequest("Total inválido", { total: incomingData.total });
  }

  // ===================== NORMALIZACIONES =====================

  const mpExternalReference = isNonEmptyString(incomingData.mpExternalReference)
    ? incomingData.mpExternalReference.trim()
    : safeUUID();

  const shippingTextDelivery =
    shipping.text ||
    `${shipping.street} ${shipping.number}, ${shipping.city}, ${shipping.province} (${shipping.postalCode})`;

  // 🔒 data “limpio” (whitelist)
  // OJO: NO mandamos user. Lo setea Strapi desde el JWT.
  const data: any = {
    subtotal: subtotal || undefined,
    discountTotal: discountTotal || undefined,
    coupon: incomingData.coupon ?? undefined,
    appliedPromotions: incomingData.appliedPromotions ?? undefined,

    name,
    email,
    phone,
    dni: dni || null,

    shippingMethod,
    shippingCost,
    pickupPoint,

    total: Math.round(Number(total)),
    items,

    shippingAddress:
      shippingMethod === "pickup"
        ? {
            source: "pickup",
            addressId: null,
            label: "Retiro en sucursal",
            street: null,
            number: null,
            city: null,
            province: null,
            postalCode: null,
            notes: null,
            text: pickupPoint ? `Retiro en sucursal: ${pickupPoint}` : "Retiro en sucursal",
          }
        : {
            source: shipping.source || (incomingData?.shippingAddress?.addressId ? "saved_address" : "manual"),
            addressId: shipping.addressId || null,
            label: shipping.label || null,

            street: shipping.street,
            number: shipping.number,
            city: shipping.city,
            province: shipping.province,
            postalCode: shipping.postalCode,
            notes: shipping.notes || null,
            text: shippingTextDelivery,
          },

    mpExternalReference,
  };

  const createPayload = { data };

  // ✅ Crear la orden en Strapi COMO USUARIO (Bearer JWT)
  const createRes = await fetch(`${strapiBase}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(createPayload),
    cache: "no-store",
  });

  const created = await strapiJSON(createRes);

  if (!createRes.ok) {
    return NextResponse.json(
      { error: "Strapi error (create)", details: created },
      { status: createRes.status || 500 }
    );
  }

  // Strapi v5 suele devolver documentId + id
  const documentId = created?.data?.documentId ? String(created.data.documentId) : null;
  const numericId = created?.data?.id != null ? String(created.data.id) : null;
  const orderNumber = created?.data?.orderNumber ?? null; // si lifecycle ya lo seteo

  return NextResponse.json({
    orderId: documentId ?? numericId,
    orderDocumentId: documentId,
    orderNumericId: numericId,
    orderNumber,
    mpExternalReference,
  });
}
