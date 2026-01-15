import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const strapiBase =
    process.env.STRAPI_URL ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    "http://localhost:1337";

  const token = process.env.STRAPI_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Falta STRAPI_TOKEN" }, { status: 500 });
  }

  // ✅ Strapi v4/v5: buscamos por id numérico con filters y traemos el primero
  const url = `${strapiBase}/api/orders?filters[id][$eq]=${encodeURIComponent(
    params.id
  )}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    return NextResponse.json(
      { error: "Strapi error", status: res.status, details: json },
      { status: res.status }
    );
  }

  const row = json?.data?.[0];
  if (!row) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // devolvemos la orden (igual a /api/orders/:id)
  return NextResponse.json({ data: row });
}
