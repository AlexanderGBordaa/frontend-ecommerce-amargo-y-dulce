"use client";

import { useState } from "react";
import { useCartStore } from "@/store/cart.store";
import type { ProductCardItem } from "@/components/products/ProductCard";

export function AddToCartButton({ item }: { item: ProductCardItem }) {
  const addItem = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState(false);

  const handleClick = () => {
    addItem(item, 1);
    setAdded(true);

    // vuelve al estado normal
    window.setTimeout(() => setAdded(false), 1500);
  };

  return (
    <button
      onClick={handleClick}
      className={`rounded-full px-4 py-2 text-xs font-semibold text-white transition
        ${added ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
    >
      {added ? "AGREGADO ✅" : "AGREGAR AL CARRITO"}
    </button>
  );
}
