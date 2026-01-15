import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductCardItem } from "@/components/products/ProductCard";

export type CartItem = ProductCardItem & {
  qty: number;
};

type CartState = {
  items: CartItem[];

  addItem: (product: ProductCardItem, qty?: number) => void;
  removeItem: (slug: string) => void;
  inc: (slug: string) => void;
  dec: (slug: string) => void;
  clear: () => void;

  totalItems: () => number;
  totalPrice: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, qty = 1) => {
        set((state) => {
          const existing = state.items.find(
            (i) => i.slug === product.slug
          );

          if (existing) {
            return {
              items: state.items.map((i) =>
                i.slug === product.slug
                  ? { ...i, qty: i.qty + qty }
                  : i
              ),
            };
          }

          return {
            items: [...state.items, { ...product, qty }],
          };
        });
      },

      removeItem: (slug) =>
        set((state) => ({
          items: state.items.filter((i) => i.slug !== slug),
        })),

      inc: (slug) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.slug === slug ? { ...i, qty: i.qty + 1 } : i
          ),
        })),

      dec: (slug) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.slug === slug ? { ...i, qty: i.qty - 1 } : i
            )
            .filter((i) => i.qty > 0),
        })),

      clear: () => set({ items: [] }),

      totalItems: () =>
        get().items.reduce((acc, i) => acc + i.qty, 0),

      totalPrice: () =>
        get().items.reduce((acc, i) => {
          const hasOff =
            typeof i.off === "number" && i.off > 0;
          const finalPrice = hasOff
            ? Math.round(i.price * (1 - i.off! / 100))
            : i.price;

          return acc + finalPrice * i.qty;
        }, 0),
    }),
    {
      name: "amargo-dulce-cart",
    }
  )
);

