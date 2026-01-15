"use client";

import { useEffect, useMemo, useState } from "react";
import { useCartStore } from "@/store/cart.store";

export function CartBadge() {
  const count = useCartStore((s) => s.items.reduce((acc, it) => acc + it.qty, 0));

  // Evita mismatch: en SSR no mostramos nada; recién en cliente aparece
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  if (count <= 0) return null;

  return (
    <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-extrabold leading-none text-white">
      {count}
    </span>
  );
}
