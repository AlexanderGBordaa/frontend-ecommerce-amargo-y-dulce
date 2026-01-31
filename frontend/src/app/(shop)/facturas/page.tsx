"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Container } from "@/components/layout/Container";

type Invoice = {
  id: string | number | null; // puede ser documentId o id numérico
  number: string | null;
  total: number | string | null;
  issuedAt: string | null;
  pdfUrl: string | null;
  order?: {
    orderNumber?: string | null;
    documentId?: string | null;
  } | null;
};

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

/**
 * (Opcional) helper por si querés mostrar "Ver" con url directa.
 * Para DESCARGA usamos /api/invoices/download/[id] sí o sí.
 */
function normalizePdfUrl(url: string | null) {
  if (!url) return null;

  let out = url;

  if (!out.includes("fl_attachment") && out.includes("/upload/")) {
    out = out.replace("/upload/", "/upload/fl_attachment/");
  }

  return encodeURI(out);
}

export default function FacturasPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const r = await fetch("/api/invoices/my", { cache: "no-store" });
        const j = await r.json().catch(() => null);

        if (!alive) return;

        if (!r.ok) {
          throw new Error(j?.error || "No se pudieron cargar tus facturas.");
        }

        setInvoices(Array.isArray(j?.invoices) ? j.invoices : []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Error cargando facturas.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <main>
      <Container className="py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-neutral-900">
              Mis recibos
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Acá podés descargar tus comprobantes en PDF.
            </p>
          </div>

          <Link href="/mi-perfil" prefetch={false} className="text-sm font-semibold underline">
            Volver a mi perfil
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          {loading ? (
            <p className="text-sm text-neutral-600">Cargando…</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-neutral-600">
              Todavía no tenés facturas. Cuando una compra quede como{" "}
              <b>pagada</b>, vas a ver el comprobante acá.
            </p>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv, idx) => {
                const downloadHref =
                  inv.id != null ? `/api/invoices/download/${encodeURIComponent(String(inv.id))}` : null;

                // si querés mostrar un link directo (no recomendado para descargar):
                // const directHref = normalizePdfUrl(inv.pdfUrl);

                return (
                  <div
                    key={String(inv.id ?? inv.number ?? idx)}
                    className="rounded-xl border border-neutral-200 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-extrabold text-neutral-900">
                          {inv.number ? `Recibo ${inv.number}` : "Factura"}
                        </div>
                        <div className="mt-1 text-sm text-neutral-600">
                          {inv.order?.orderNumber ? `Pedido ${inv.order.orderNumber}` : ""}
                          {inv.issuedAt
                            ? ` • ${new Date(inv.issuedAt).toLocaleString("es-AR")}`
                            : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-sm font-bold text-neutral-900">
                          {typeof inv.total === "number"
                            ? formatARS(inv.total)
                            : inv.total != null
                            ? String(inv.total)
                            : ""}
                        </div>

                        {downloadHref ? (
                          <a
                            href={downloadHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white"
                          >
                            Descargar PDF
                          </a>
                        ) : (
                          <span className="text-xs text-neutral-500">PDF pendiente</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Container>
    </main>
  );
}
