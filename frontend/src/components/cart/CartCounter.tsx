"use client";

import { useCartStore } from "@/store/cart.store";

export function CartCounter() {
  const count = useCartStore((s) => s.totalItems());

  if (!count) return null;

  return (
    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white">
      {count}
    </span>
  );
}
