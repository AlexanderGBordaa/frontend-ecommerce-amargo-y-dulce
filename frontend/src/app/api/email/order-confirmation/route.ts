import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(req: Request) {
  try {
    const {
      email,
      name,
      orderNumber,
      total,
      items,
      phone,
      shippingAddress,
    } = await req.json();

    if (!email || !orderNumber) {
      return NextResponse.json(
        { error: "Faltan email u orderNumber" },
        { status: 400 }
      );
    }

    const addressText =
      shippingAddress?.text ||
      shippingAddress?.address ||
      (shippingAddress ? JSON.stringify(shippingAddress) : "");

    const itemsHtml = Array.isArray(items)
      ? items
          .map((it: any) => {
            const qty = Number(it?.qty ?? 1);
            const title = escapeHtml(it?.title ?? "Item");
            const unit = Number(it?.unit_price ?? it?.price ?? 0);
            return `<li>${qty} x ${title} — ${escapeHtml(formatARS(unit))}</li>`;
          })
          .join("")
      : "";

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>¡Gracias por tu compra${name ? `, ${escapeHtml(name)}` : ""}!</h2>
        <p>Confirmamos tu pedido <b>${escapeHtml(orderNumber)}</b>.</p>

        <h3>Dirección de envío</h3>
        <p>${escapeHtml(addressText || "-")}</p>

        <h3>Teléfono</h3>
        <p>${escapeHtml(phone || "-")}</p>

        <h3>Items</h3>
        <ul>${itemsHtml || "<li>-</li>"}</ul>

        <h3>Total</h3>
        <p><b>${escapeHtml(formatARS(Number(total ?? 0)))}</b></p>

        <p style="margin-top:24px;color:#666">
          Si tenés dudas, respondé este email.
        </p>
      </div>
    `;

    const from = process.env.EMAIL_FROM;
    if (!from) {
      return NextResponse.json({ error: "Falta EMAIL_FROM" }, { status: 500 });
    }

    // ✅ Modo testing (sin dominio): fuerza el destinatario a tu propio email verificado
    // Si TEST_EMAIL_TO NO está seteada, se envía al email real del cliente.
    const to = process.env.TEST_EMAIL_TO || email;

    // (opcional) log mínimo para debug
    console.log("[email] sending confirmation", {
      orderNumber,
      to,
      forced: Boolean(process.env.TEST_EMAIL_TO),
    });

    const result = await resend.emails.send({
      from,
      to,
      subject: `Confirmación de pedido ${orderNumber}`,
      html,
    });

    // si Resend devuelve error, lo propagamos con 502
    if ((result as any)?.error) {
      return NextResponse.json(
        { error: (result as any).error?.message || "Resend error" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, to });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error enviando email" },
      { status: 500 }
    );
  }
}
