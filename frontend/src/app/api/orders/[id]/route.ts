import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/orders/:id
 *
 * Soporta:
 * - documentId (string)
 * - orderNumber (ej: "AMG-0051")
 * - id numérico
 *
 * Requiere login (JWT en cookie).
 * Implementación segura: consulta /api/orders/my (Strapi) y busca ahí.
 */

function isNumeric(v: string) {
  return /^\d+$/.test(v);
}

function isOrderNumber(v: string) {
  return /^AMG-\d{1,}$/i.test(v.trim());
}

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

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

async function fetchStrapi(url: string, bearer: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearer}` },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

function flattenRow(row: any) {
  if (!row) return row;
  if (row?.attributes) {
    return {
      id: row.id ?? null,
      documentId: row.documentId ?? row?.attributes?.documentId ?? null,
      ...row.attributes,
    };
  }
  return row;
}

function normalizeOrderRow(row: any) {
  const flat = flattenRow(row);
  return {
    documentId: flat?.documentId ?? null,
    id: flat?.id ?? null,
    ...flat,
  };
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const strapiBase = normalizeStrapiBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337"
  );

  const idOrNumber = String(params.id || "").trim();
  if (!idOrNumber) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  const jwt = readUserJwtFromCookies();
  if (!jwt) {
    return NextResponse.json(
      { error: "No autorizado: iniciá sesión para ver tus pedidos." },
      { status: 401 }
    );
  }

  // ✅ Traemos SOLO las órdenes del usuario autenticado
  const url = `${strapiBase}/api/orders/my`;
  const { res, json } = await fetchStrapi(url, jwt);

  if (!res.ok) {
    return NextResponse.json(
      { error: "Strapi error (orders/my)", status: res.status, details: json },
      { status: res.status || 500 }
    );
  }

  const list = Array.isArray(json?.data) ? json.data : [];

  const wanted = idOrNumber;
  const wantedLower = wanted.toLowerCase();

  const found = list.find((row: any) => {
    const flat = normalizeOrderRow(row);

    // match por orderNumber
    const on = String(flat?.orderNumber ?? "").trim().toLowerCase();
    if (isOrderNumber(wanted) && on && on === wantedLower) return true;

    // match por id numérico
    if (isNumeric(wanted)) {
      const rid = flat?.id != null ? String(flat.id) : "";
      if (rid === wanted) return true;
    }

    // match por documentId
    const doc = String(flat?.documentId ?? "").trim();
    if (doc && doc === wanted) return true;

    return false;
  });

  if (!found) {
    return NextResponse.json({ error: "Order not found", id: idOrNumber }, { status: 404 });
  }

  // Devolvemos en formato simple
  return NextResponse.json({ data: normalizeOrderRow(found) }, { status: 200 });
}
