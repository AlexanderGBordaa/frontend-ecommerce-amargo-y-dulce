"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useCartStore } from "@/store/cart.store";
import type { ProductCardItem } from "@/components/products/ProductCard";

export function AddToCartDetail({
  item,
  disabled,
}: {
  item: ProductCardItem;
  disabled?: boolean;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const dec = () => setQty((q) => Math.max(1, q - 1));
  const inc = () => setQty((q) => q + 1);

  const handleAdd = () => {
    addItem(item, qty);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Cantidad */}
      <div className="flex items-center gap-2">
        <button
          onClick={dec}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-50"
          type="button"
          aria-label="Restar"
          disabled={disabled}
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="min-w-[40px] text-center text-sm font-semibold">
          {qty}
        </div>

        <button
          onClick={inc}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-50"
          type="button"
          aria-label="Sumar"
          disabled={disabled}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Botón */}
      <button
        onClick={handleAdd}
        disabled={disabled}
        className={`rounded-full px-6 py-3 text-sm font-semibold text-white transition disabled:opacity-50
          ${added ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
        type="button"
      >
        {disabled ? "SIN STOCK" : added ? "AGREGADO ✅" : "AGREGAR AL CARRITO"}
      </button>
    </div>
  );
}
