import Link from "next/link";
import {
  ProductCard,
  type ProductCardItem,
} from "@/components/products/ProductCard";

type HomeBestSellersProps = {
  products: (ProductCardItem & { off?: number })[];
};

/**
 * Sección del home: "PRODUCTOS MÁS COMPRADOS"
 * - Recibe productos desde la Home (Strapi)
 * - Renderiza ProductCard sin mocks
 */
export function HomeBestSellers({ products }: HomeBestSellersProps) {
  if (!products || products.length === 0) return null;

  return (
    <section className="py-10 md:py-14">
      {/* ✅ más ancho y con padding lateral como el carrusel/hero */}
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center">
          <h2 className="text-xs font-extrabold tracking-[0.35em] text-neutral-900">
            PRODUCTOS MÁS COMPRADOS
          </h2>
        </div>

        {/* ✅ grid más “grande” (más gap + mismo ancho del hero) */}
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p: any) => (
            <div
              key={String(p.documentId ?? p.id)}
              className="w-full h-full"
            >
              <ProductCard item={p} />
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/productos"
            className="rounded-full bg-orange-600 px-6 py-2 text-sm font-bold text-white hover:bg-orange-700 transition-colors"
          >
            Más productos
          </Link>
        </div>
      </div>
    </section>
  );
}
