import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { fetcher } from "@/lib/fetcher";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import CommentsSection from "@/components/comments/CommentsSection";

export const dynamic = "force-dynamic";

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function strapiMediaUrl(path?: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const base = (process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

function pickAttr(row: any) {
  return row?.attributes ?? row ?? {};
}

function pickImage(rowOrAttr: any) {
  const attr = pickAttr(rowOrAttr);
  const img = attr?.images?.[0];
  const f = img?.formats;
  const url =
    f?.medium?.url ||
    f?.small?.url ||
    f?.thumbnail?.url ||
    img?.url ||
    "";
  return strapiMediaUrl(url);
}

function asNum(v: any, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const pid = String(params.id || "").trim();
  if (!pid) return notFound();

  const isNumeric = /^\d+$/.test(pid);
  let row: any | null = null;

  try {
    const sp = new URLSearchParams();
    sp.set("populate", "*");
    sp.set("pagination[pageSize]", "1");

    if (isNumeric) {
      sp.set("filters[id][$eq]", pid);
    } else {
      sp.set("filters[$or][0][documentId][$eq]", pid);
      sp.set("filters[$or][1][slug][$eq]", pid);
    }

    const list = await fetcher<any>(`/api/products?${sp.toString()}`, { auth: true });
    row = list?.data?.[0] ?? null;
  } catch {
    return notFound();
  }

  if (!row) return notFound();

  const attr = pickAttr(row);

  const id = asNum(row?.id ?? attr?.id, NaN);
  if (!Number.isFinite(id)) return notFound();

  const documentId =
    row?.documentId ??
    attr?.documentId ??
    attr?.document_id ??
    undefined;

  const title = attr?.title ?? "Producto";
  const description = attr?.description ?? "";
  const category = attr?.category ?? null;
  const price = asNum(attr?.price, 0);
  const off = asNum(attr?.off, 0);
  const hasOff = off > 0;
  const finalPrice = hasOff ? Math.round(price * (1 - off / 100)) : price;
  const stock = attr?.stock != null ? asNum(attr.stock, 0) : null;
  const imageUrl = pickImage(row);
  const slug = String(attr?.slug ?? id);

  return (
    <main>
      <Container>
        <div className="pt-8">
          <Link href="/productos" className="text-sm font-semibold text-neutral-600 hover:text-neutral-900">
            ← Volver a productos
          </Link>
        </div>

        <div className="pt-6 pb-6">
          <h1 className="text-3xl font-extrabold text-neutral-900">{title}</h1>
          {category && (
            <p className="mt-1 text-sm font-semibold text-neutral-500">{String(category)}</p>
          )}
        </div>

        <div className="grid gap-8 pb-20 lg:grid-cols-2">
          {/* IMAGEN */}
          <section className="overflow-hidden rounded-2xl border bg-white">
            <div className="relative aspect-[4/3] w-full bg-neutral-100">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={title}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                  Sin imagen
                </div>
              )}

              {hasOff && (
                <span className="absolute right-4 top-4 rounded-full bg-red-600 px-3 py-1 text-xs font-extrabold text-white">
                  -{off}%
                </span>
              )}
            </div>
          </section>

          {/* CARD DETALLE + COMENTARIOS */}
          <aside className="rounded-2xl border bg-white p-6 lg:p-7 space-y-8">
            {/* Precio */}
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-3">
                  <div className="text-3xl font-extrabold text-neutral-900">
                    {formatARS(finalPrice)}
                  </div>
                  {hasOff && (
                    <div className="text-base font-semibold text-neutral-400 line-through">
                      {formatARS(price)}
                    </div>
                  )}
                </div>
                {hasOff && (
                  <div className="mt-1 text-xs font-semibold text-red-600">
                    Ahorrás {formatARS(price - finalPrice)}
                  </div>
                )}
              </div>

              {stock != null && (
                <div
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    stock > 0
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {stock > 0 ? `Stock: ${stock}` : "Sin stock"}
                </div>
              )}
            </div>

            {/* Descripción */}
            {description && (
              <div>
                <h2 className="text-sm font-extrabold text-neutral-900">Descripción</h2>
                <p className="mt-2 text-sm text-neutral-700 whitespace-pre-line">
                  {description}
                </p>
              </div>
            )}

            {/* Info */}
            <div className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-700">
              <ul className="space-y-2">
                <li>• Retiro / Envío coordinado</li>
                <li>• Pagá con MercadoPago</li>
              </ul>
            </div>

            {/* Comprar */}
            <div>
              <AddToCartButton
                item={{
                  id,
                  documentId,
                  slug,
                  title,
                  price,
                  off: hasOff ? off : undefined,
                  imageUrl,
                }}
              />
              <p className="mt-3 text-center text-xs text-neutral-500">
                Podés revisar tu carrito antes de pagar.
              </p>
            </div>

            {/* 💬 Opiniones */}
            <div className="border-t pt-6">
              <CommentsSection productId={String(id)} />
            </div>
          </aside>
        </div>
      </Container>
    </main>
  );
}
