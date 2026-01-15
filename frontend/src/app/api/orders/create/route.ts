import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const strapi =
    (process.env.STRAPI_URL ||
      process.env.NEXT_PUBLIC_STRAPI_URL ||
      "http://localhost:1337").replace(/\/$/, "");

  const token = process.env.STRAPI_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Falta STRAPI_TOKEN en .env.local (Next)" },
      { status: 500 }
    );
  }

  const body = await req.json();

  // ✅ Strapi requiere { data: {...} }
  const payload =
    body && typeof body === "object" && "data" in body ? body : { data: body };

  console.log("[orders/create] sending to Strapi:", JSON.stringify(payload, null, 2));

  const res = await fetch(`${strapi}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    console.error("[orders/create] Strapi returned", res.status, data);
    return NextResponse.json(
      { error: "Strapi error", details: data },
      { status: res.status }
    );
  }

  return NextResponse.json(data);
}
