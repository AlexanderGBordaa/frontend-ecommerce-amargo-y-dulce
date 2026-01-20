import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/:id
 *
 * Soporta:
 * - documentId (Strapi v5)  ✅ recomendado
 * - orderNumber (ej: "AMG-0051")
 * - id numérico (legacy) -> lo buscamos por filters[id][$eq] como fallback (puede no funcionar siempre en v5)
 *
 * Devuelve:
 * { data: { documentId, id, ...fields } }
 */

function isNumeric(v: string) {
  return /^\d+$/.test(v);
}

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

async function fetchStrapi(url: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

function normalizeOrderRow(row: any) {
  // Strapi v5: row.documentId, row.id, row.<fields>
  return {
    data: {
      documentId: row?.documentId ?? null,
      id: row?.id ?? null, // numérico interno (útil solo para mostrar)
      ...row,
    },
  };
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const strapiBase = normalizeStrapiBase(
    process.env.STRAPI_URL ||
      process.env.NEXT_PUBLIC_STRAPI_URL ||
      "http://localhost:1337"
  );

  const token = process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Falta STRAPI_API_TOKEN / STRAPI_TOKEN" },
      { status: 500 }
    );
  }

  const idOrNumber = String(params.id || "").trim();
  if (!idOrNumber) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  // 1) Intento directo por documentId (Strapi v5)
  // Esto funciona si el param es documentId.
  {
    const url = `${strapiBase}/api/orders/${encodeURIComponent(idOrNumber)}?populate=*`;
    const { res, json } = await fetchStrapi(url, token);

    if (res.ok && json?.data) {
      return NextResponse.json(normalizeOrderRow(json.data));
    }

    // Si no es 404, devolvemos error real
    if (!res.ok && res.status !== 404) {
      return NextResponse.json(
        { error: "Strapi error", status: res.status, details: json },
        { status: res.status }
      );
    }
  }

  // 2) Si no fue documentId, buscamos por orderNumber (ej AMG-0051)
  {
    const q = new URLSearchParams();
    q.set("filters[orderNumber][$eq]", idOrNumber);
    q.set("pagination[pageSize]", "1");
    q.set("populate", "*");

    const url = `${strapiBase}/api/orders?${q.toString()}`;
    const { res, json } = await fetchStrapi(url, token);

    if (!res.ok) {
      return NextResponse.json(
        { error: "Strapi error", status: res.status, details: json },
        { status: res.status }
      );
    }

    const row = json?.data?.[0];
    if (row) return NextResponse.json(normalizeOrderRow(row));
  }

  // 3) Fallback legacy: buscar por id numérico interno (puede no funcionar en v5, pero lo intentamos)
  if (isNumeric(idOrNumber)) {
    const q = new URLSearchParams();
    q.set("filters[id][$eq]", idOrNumber);
    q.set("pagination[pageSize]", "1");
    q.set("populate", "*");

    const url = `${strapiBase}/api/orders?${q.toString()}`;
    const { res, json } = await fetchStrapi(url, token);

    if (!res.ok) {
      return NextResponse.json(
        { error: "Strapi error", status: res.status, details: json },
        { status: res.status }
      );
    }

    const row = json?.data?.[0];
    if (row) return NextResponse.json(normalizeOrderRow(row));
  }

  return NextResponse.json(
    { error: "Order not found", id: idOrNumber },
    { status: 404 }
  );
}
