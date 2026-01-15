"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Container } from "@/components/layout/Container";
import { useCartStore } from "@/store/cart.store";

export default function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { orderNumber?: string };
}) {
  const clear = useCartStore((s) => s.clear);

  useEffect(() => {
    // ✅ vaciamos el carrito al entrar al success
    clear();
  }, [clear]);

  return (
    <main>
      <Container>
        <div className="py-16 text-center">
          <h1 className="text-3xl font-extrabold text-neutral-900">
            ¡Pedido confirmado! ✅
          </h1>

          <p className="mt-3 text-sm text-neutral-600">
            Gracias por tu compra.
            {searchParams.orderNumber ? (
              <>
                {" "}
                Orden{" "}
                <span className="font-semibold">{searchParams.orderNumber}</span>
              </>
            ) : null}
          </p>

          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/productos"
              className="rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700"
            >
              Seguir comprando
            </Link>

            <Link
              href="/"
              className="rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
