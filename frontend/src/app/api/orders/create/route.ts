// src/app/api/orders/create/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function normalizeStrapiBase(url: string) {
  let u = String(url ?? "").trim();
  u = u.endsWith("/") ? u.slice(0, -1) : u;
  // evita /api/api
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

function makeOrderNumber(numericId: string | number) {
  const n = Number(numericId);
  const padded = String(isNaN(n) ? numericId : n).padStart(4, "0");
  return `AMG-${padded}`;
}

async function strapiJSON(res: Response) {
  const data = await res.json().catch(() => null);
  return data;
}

export async function POST(req: Request) {
  const strapiBase = normalizeStrapiBase(
    process.env.STRAPI_URL ||
      process.env.NEXT_PUBLIC_STRAPI_URL ||
      "http://localhost:1337"
  );

  const token = process.env.STRAPI_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Falta STRAPI_TOKEN en .env.local (Next)" },
      { status: 500 }
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

  // Acepta {data:{...}} o {...}
  const incomingData =
    body && typeof body === "object" && "data" in body ? body.data : body;

  if (!incomingData || typeof incomingData !== "object") {
    return NextResponse.json(
      { error: "Body inválido: se esperaba un objeto con datos de la orden" },
      { status: 400 }
    );
  }

  // mpExternalReference server-side (si no viene)
  const mpExternalReference = isNonEmptyString(incomingData.mpExternalReference)
    ? incomingData.mpExternalReference.trim()
    : safeUUID();

  // 1) CREATE en Strapi
  const createPayload = {
    data: {
      ...incomingData,
      mpExternalReference,
      // NO ponemos orderNumber acá porque todavía no tenemos numericId con certeza
    },
  };

  console.log("[orders/create] → Strapi CREATE payload:", JSON.stringify(createPayload, null, 2));

  const createRes = await fetch(`${strapiBase}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(createPayload),
    cache: "no-store",
  });

  const created = await strapiJSON(createRes);

  if (!createRes.ok) {
    console.error("[orders/create] Strapi CREATE returned", createRes.status, created);
    return NextResponse.json(
      { error: "Strapi error (create)", details: created },
      { status: createRes.status || 500 }
    );
  }

  // Strapi v5: para PUT /api/orders/:id usamos documentId
  const documentId = created?.data?.documentId ? String(created.data.documentId) : null;
  const numericId = created?.data?.id ? String(created.data.id) : null;

  if (!documentId) {
    // raro, pero por las dudas
    return NextResponse.json(
      {
        error: "Strapi no devolvió documentId al crear la orden",
        strapi: created,
      },
      { status: 500 }
    );
  }

  const orderNumber = numericId ? makeOrderNumber(numericId) : null;

  // 2) UPDATE en Strapi para setear orderNumber (si pudimos calcularlo)
  //    Si numericId no viene, igual devolvemos ok (solo no seteamos orderNumber)
  if (orderNumber) {
    const updatePayload = {
      data: {
        orderNumber,
        // opcional: reforzamos mpExternalReference
        mpExternalReference,
      },
    };

    const updateUrl = `${strapiBase}/api/orders/${encodeURIComponent(documentId)}`;
    console.log("[orders/create] → Strapi UPDATE url:", updateUrl);
    console.log("[orders/create] → Strapi UPDATE payload:", JSON.stringify(updatePayload, null, 2));

    const updateRes = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updatePayload),
      cache: "no-store",
    });

    if (!updateRes.ok) {
      const upd = await updateRes.text().catch(() => "");
      console.warn("[orders/create] Strapi UPDATE failed (no bloqueo):", updateRes.status, upd);
      // No bloqueamos: la orden ya existe y el pago puede seguir.
    }
  } else {
    console.warn("[orders/create] Strapi no devolvió numericId; no pude calcular orderNumber.");
  }

  // 3) Respuesta útil al front
  return NextResponse.json({
    orderId: documentId, // <-- ESTE es el que vas a usar luego en /api/orders/[id] y en back_urls
    orderDocumentId: documentId,
    orderNumericId: numericId,
    orderNumber,
    mpExternalReference,
    strapi: created,
  });
}
