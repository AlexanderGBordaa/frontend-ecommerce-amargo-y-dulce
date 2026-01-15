import type { ProductCardItem } from "@/components/products/ProductCard";

const STRAPI_URL =
  (process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337").replace(/\/$/, "");

function withBase(url?: string) {
  if (!url) return undefined;
  return url.startsWith("http") ? url : `${STRAPI_URL}${url}`;
}

/**
 * Elige la mejor imagen disponible para cards:
 * medium → small → thumbnail → original
 */
export function getStrapiImageUrlFromAttributes(attributes: any): string | undefined {
  const image = attributes?.images?.[0];
  if (!image) return undefined;

  const formats = image.formats;

  const url =
    formats?.medium?.url ||
    formats?.small?.url ||
    formats?.thumbnail?.url ||
    image.url;

  return withBase(url);
}

/**
 * Mapper para cards de producto
 * Recibe el item de Strapi (id + attributes)
 */
export function toCardItem(product: any): ProductCardItem {
  const attr = product?.attributes ?? product ?? {};

  return {
    id: Number(product?.id), // ✅
    slug: attr.slug ?? String(product?.id ?? ""),
    title: attr.title ?? "Producto",
    description: attr.description ?? "",
    price: Number(attr.price ?? 0),
    off: typeof attr.off === "number" ? attr.off : undefined,
    category: attr.category,
    imageUrl: getStrapiImageUrlFromAttributes(attr),
  };
}

