import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  if (u.toLowerCase().endsWith("/api")) u = u.slice(0, -4);
  return u;
}

function pickStrapiErrorMessage(details: any) {
  return (
    details?.error?.message ||
    details?.message ||
    details?.error ||
    (typeof details === "string" ? details : null) ||
    "Strapi error"
  );
}

async function fetchWithTimeout(input: string, init: RequestInit, ms = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

async function resolveProductNumericId(params: {
  strapiBase: string;
  token: string;
  productDocumentId: string;
}) {
  const { strapiBase, token, productDocumentId } = params;

  const sp = new URLSearchParams();
  sp.set("pagination[pageSize]", "1");
  sp.set("filters[documentId][$eq]", productDocumentId);

  const res = await fetchWithTimeout(`${strapiBase}/api/products?${sp.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const json = await res.json().catch(() => null);
  const row = json?.data?.[0];
  const idNum = Number(row?.id);

  return Number.isFinite(idNum) && idNum > 0 ? idNum : null;
}

/* ===================== GET ===================== */

export async function GET(req: Request) {
  const url = new URL(req.url);

  const productDocumentId = String(url.searchParams.get("productDocumentId") ?? "").trim();
  const productIdRaw = String(url.searchParams.get("productId") ?? "").trim();
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));

  if (!productDocumentId && !productIdRaw) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  const strapiBase = normalizeStrapiBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337"
  );
  const token = process.env.STRAPI_TOKEN || process.env.STRAPI_API_TOKEN;
  if (!token) return NextResponse.json({ error: "Falta STRAPI_TOKEN" }, { status: 500 });

  // Si viene docId pero no viene productId, intentamos resolverlo (opcional)
  let productId: number | null = null;
  const pid = Number(productIdRaw);
  if (Number.isFinite(pid) && pid > 0) productId = pid;

  if (!productId && productDocumentId) {
    try {
      productId = await resolveProductNumericId({ strapiBase, token, productDocumentId });
    } catch {}
  }

  // ✅ filtro robusto: OR entre product.documentId y product.id
  const sp = new URLSearchParams();
  sp.set("sort[0]", "createdAt:desc");
  sp.set("pagination[pageSize]", String(pageSize));
  sp.set("populate", "product");

  let orIndex = 0;
  if (productDocumentId) {
    sp.set(`filters[$or][${orIndex}][product][documentId][$eq]`, productDocumentId);
    orIndex++;
  }
  if (productId) {
    sp.set(`filters[$or][${orIndex}][product][id][$eq]`, String(productId));
    orIndex++;
  }

  // Si por algún motivo no pudimos armar OR (raro), devolvemos vacío
  if (orIndex === 0) return NextResponse.json({ data: [] }, { status: 200 });

  try {
    const res = await fetchWithTimeout(`${strapiBase}/api/reviews?${sp.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("[api/reviews][GET] Strapi error:", json);
      return NextResponse.json(
        { error: pickStrapiErrorMessage(json), details: json },
        { status: res.status }
      );
    }

    const rows = Array.isArray(json?.data) ? json.data : [];
    const data = rows.map((r: any) => {
      const a = r?.attributes ?? r ?? {};
      const rating = Number(a?.rating ?? r?.rating ?? 0);
      const comment = String(a?.comment ?? r?.comment ?? "").trim();

      return {
        id: r?.id ?? a?.id,
        rating: Number.isFinite(rating) ? rating : 0,
        text: comment || undefined,
        name: String(a?.name ?? r?.name ?? "").trim() || undefined,
        createdAt: String(a?.createdAt ?? r?.createdAt ?? "").trim() || undefined,
      };
    });

    return NextResponse.json({ data }, { status: 200 });
  } catch (e: any) {
    const msg =
      e?.name === "AbortError"
        ? "Timeout hablando con Strapi (¿Render dormido?)"
        : e?.message || "Error";
    console.error("[api/reviews][GET] fatal:", e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/* ===================== POST ===================== */

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const rating = Number(body?.rating ?? 0);
  const comment = String(body?.comment ?? body?.text ?? "").trim();
  const name = String(body?.name ?? "").trim();

  const productIdRaw = Number(body?.productId);
  const productDocumentId = String(body?.productDocumentId ?? "").trim();

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating inválido (1 a 5)" }, { status: 400 });
  }
  if (!comment) return NextResponse.json({ error: "Falta comentario" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Falta nombre" }, { status: 400 });

  const strapiBase = normalizeStrapiBase(
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337"
  );
  const token = process.env.STRAPI_TOKEN || process.env.STRAPI_API_TOKEN;
  if (!token) return NextResponse.json({ error: "Falta STRAPI_TOKEN" }, { status: 500 });

  // Intentamos resolver numericId si hace falta
  let productId: number | null =
    Number.isFinite(productIdRaw) && productIdRaw > 0 ? productIdRaw : null;

  if (!productId && productDocumentId) {
    try {
      productId = await resolveProductNumericId({ strapiBase, token, productDocumentId });
    } catch {}
  }

  if (!productId && !productDocumentId) {
    return NextResponse.json(
      { error: "Falta productId/productDocumentId" },
      { status: 400 }
    );
  }

  // ✅ candidatos: primero por documentId (más estable en v5), luego por id
  const baseData = {
    rating,
    comment,
    name,
    verified: false,
  };

  const candidates: any[] = [];

  if (productDocumentId) {
    candidates.push({ data: { ...baseData, product: { connect: [{ documentId: productDocumentId }] } } });
    candidates.push({ data: { ...baseData, product: { connect: [productDocumentId] } } });
  }

  if (productId) {
    candidates.push({ data: { ...baseData, product: productId } });
    candidates.push({ data: { ...baseData, product: { connect: [{ id: productId }] } } });
    candidates.push({ data: { ...baseData, product: { connect: [productId] } } });
  }

  let lastError: any = null;

  for (const payload of candidates) {
    try {
      const res = await fetchWithTimeout(
        `${strapiBase}/api/reviews`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        25000
      );

      const json = await res.json().catch(() => null);

      if (res.ok) {
        return NextResponse.json({ ok: true, created: json?.data ?? true }, { status: 201 });
      }

      lastError = json;
      console.error("[api/reviews][POST] Strapi rejected payload:", payload, json);
    } catch (e: any) {
      lastError = e;
      console.error("[api/reviews][POST] fatal:", e);
    }
  }

  return NextResponse.json(
    { error: pickStrapiErrorMessage(lastError), details: lastError },
    { status: 500 }
  );
}
