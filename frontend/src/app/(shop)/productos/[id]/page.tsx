import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { fetcher } from "@/lib/fetcher";
import { AddToCartButton } from "@/components/cart/AddToCartButton";

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

function pickImage(attr: any) {
  const img = attr?.images?.[0];
  const f = img?.formats;
  const url = f?.medium?.url || f?.small?.url || f?.thumbnail?.url || img?.url || "";
  return strapiMediaUrl(url);
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const res = await fetcher<any>(
    `/api/products?filters[id][$eq]=${encodeURIComponent(params.id)}&populate=*`
  );

  const row = res?.data?.[0];
  if (!row) return notFound();

  const attr = row?.attributes ?? row;

  const id = (row?.id ?? Number(params.id)) || params.id;
  const slug = (attr?.slug ?? String(id)) as string;

  const title = attr?.title ?? "Producto";
  const description = attr?.description ?? "";
  const category = attr?.category ?? null;

  const price = Number(attr?.price ?? 0);
  const off = typeof attr?.off === "number" ? attr.off : 0;
  const hasOff = off > 0;
  const finalPrice = hasOff ? Math.round(price * (1 - off / 100)) : price;

  // Opcional (si tu modelo lo tiene)
  const stock = typeof attr?.stock === "number" ? attr.stock : null;

  const imageUrl = pickImage(attr);

  return (
    <main>
      <Container>
        {/* Breadcrumb / volver */}
        <div className="pt-8">
          <Link
            href="/productos"
            className="text-sm font-semibold text-neutral-600 hover:text-neutral-900"
          >
            ← Volver a productos
          </Link>
        </div>

        {/* Header */}
        <div className="pt-6 pb-6">
          <h1 className="text-3xl font-extrabold text-neutral-900">{title}</h1>
          {category && (
            <p className="mt-1 text-sm font-semibold text-neutral-500">{String(category)}</p>
          )}
        </div>

        {/* Layout principal */}
        <div className="grid gap-8 pb-14 lg:grid-cols-2">
          {/* Imagen */}
          <section className="overflow-hidden rounded-2xl border bg-white">
            <div className="relative aspect-[4/3] w-full bg-neutral-100">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                  Sin imagen
                </div>
              )}

              {hasOff && (
                <span className="absolute right-4 top-4 rounded-full bg-red-600 px-3 py-1 text-xs font-extrabold text-white shadow-sm">
                  -{off}%
                </span>
              )}
            </div>
          </section>

          {/* Ficha */}
          <aside className="h-fit rounded-2xl border bg-white p-6 lg:p-7">
            {/* Precio */}
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-3">
                  <div className="text-3xl font-extrabold tracking-tight text-neutral-900">
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

              {/* Stock (si existe) */}
              {stock != null && (
                <div
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    stock > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {stock > 0 ? `Stock: ${stock}` : "Sin stock"}
                </div>
              )}
            </div>

            {/* Descripción */}
            {description && (
              <div className="mt-5">
                <h2 className="text-sm font-extrabold text-neutral-900">Descripción</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-700 whitespace-pre-line">
                  {description}
                </p>
              </div>
            )}

            {/* Info extra */}
            <div className="mt-6 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-700">
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>Retiro / Envío coordinado (podés ajustar este texto).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>Pagá con MercadoPago.</span>
                </li>
              </ul>
            </div>

            {/* CTA */}
            <div className="mt-6">
              <AddToCartButton
                item={{
                  id,
                  slug,
                  title,
                  price, // guardamos precio base; tu store ya calcula si hay off, o guardamos off también
                  off: hasOff ? off : undefined,
                  imageUrl,
                }}
              />
              <p className="mt-3 text-center text-xs text-neutral-500">
                Podés revisar tu carrito antes de pagar.
              </p>
            </div>
          </aside>
        </div>
      </Container>
    </main>
  );
}
