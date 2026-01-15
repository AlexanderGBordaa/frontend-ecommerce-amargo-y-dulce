import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { fetcher } from "@/lib/fetcher";
import { toCardItem } from "@/lib/strapi-mappers";

export const dynamic = "force-dynamic";

type StrapiListResponse<T> = {
  data: Array<{ id: number; attributes: T }>;
  meta?: any;
};

type ProductAttributes = any;

function formatARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

export default async function ProductosPage() {
  let products: any[] = [];
  let errorMsg: string | null = null;

  try {
    const res = await fetcher<StrapiListResponse<ProductAttributes>>(
      "/api/products?populate=*"
    );

    const raw = Array.isArray(res?.data) ? res.data : [];

    // ✅ Importante: el mapper te devuelve imageUrl listo
    products = raw.map(toCardItem);
  } catch (err: any) {
    errorMsg = err?.message || "No se pudieron cargar los productos.";
    products = [];
  }

  return (
    <main>
      <Container>
        <div className="py-10">
          <h1 className="text-3xl font-extrabold text-neutral-900">Productos</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Explorá nuestros productos.
          </p>
        </div>

        {errorMsg ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-neutral-800">
            <div className="font-semibold">No se pudieron cargar los productos</div>
            <p className="mt-2 text-neutral-600">{errorMsg}</p>
            <div className="mt-4">
              <Link className="underline" href="/">
                Volver al inicio
              </Link>
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-neutral-700">
            No hay productos todavía. Cargalos en Strapi y volvé a intentar.
          </div>
        ) : (
          <div className="pb-14">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p: any) => {
                const hasOff = typeof p.off === "number" && p.off > 0;
                const basePrice = typeof p.price === "number" ? p.price : null;
                const finalPrice =
                  basePrice != null && hasOff
                    ? Math.round(basePrice * (1 - p.off / 100))
                    : basePrice;

                return (
                  <Link
                    key={p.slug ?? p.id}
                   href={`/productos/${p.id}`}
                    className="group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
                  >
                    {/* ✅ Imagen desde p.imageUrl (sale del mapper) */}
                    <div className="relative aspect-[4/3] w-full bg-neutral-100">
                      {p.imageUrl ? (
                        <Image
                          src={p.imageUrl}
                          alt={p.title ?? "Producto"}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 92vw, (max-width: 1024px) 45vw, (max-width: 1280px) 30vw, 22vw"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                          Sin imagen
                        </div>
                      )}

                      {hasOff && (
                        <span className="absolute right-3 top-3 rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                          -{p.off}%
                        </span>
                      )}
                    </div>

                    <div className="p-5">
                      <div className="truncate text-base font-extrabold text-neutral-900">
                        {p.title ?? "Producto"}
                      </div>

                      {p.category && (
                        <div className="mt-1 text-xs font-semibold text-neutral-500">
                          {String(p.category)}
                        </div>
                      )}

                      <div className="mt-4">
                        {finalPrice != null ? (
                          <div className="flex items-baseline gap-2">
                            <div className="text-lg font-extrabold text-neutral-900">
                              {formatARS(finalPrice)}
                            </div>
                            {hasOff && basePrice != null && (
                              <div className="text-sm font-semibold text-neutral-400 line-through">
                                {formatARS(basePrice)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-neutral-600">Precio no disponible</div>
                        )}
                      </div>

                      <div className="mt-4 text-sm font-semibold text-red-700 opacity-0 transition group-hover:opacity-100">
                        Ver detalle →
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </Container>
    </main>
  );
}
