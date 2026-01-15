import Link from "next/link";
import { ProductCard, type ProductCardItem } from "@/components/products/ProductCard";

type HomeBestSellersProps = {
  products: (ProductCardItem & { off?: number })[];
};

/**
 * Sección del home: "PRODUCTOS MÁS COMPRADOS"
 * - Recibe productos desde la Home (Strapi)
 * - Renderiza ProductCard sin mocks
 */
export function HomeBestSellers({ products }: HomeBestSellersProps) {
  if (!products || products.length === 0) {
    return null; // o un placeholder si preferís
  }

  return (
    <section aria-label="Productos más comprados" className="py-10">
      {/* Título centrado con líneas suaves */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-neutral-200" />
        <h2 className="text-sm font-extrabold tracking-widest text-neutral-800">
          PRODUCTOS MAS COMPRADOS
        </h2>
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      {/* Grid de productos */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {products.map((item) => (
          <div key={item.slug} className="flex justify-center">
            <div className="w-full max-w-sm">
              <ProductCard item={item} />
            </div>
          </div>
        ))}
      </div>

      {/* Botón "Más productos" */}
      <div className="mt-8 flex justify-center">
        <Link
          href="/productos"
          className="rounded-full bg-orange-600 px-6 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          Mas productos
        </Link>
      </div>
    </section>
  );
}
