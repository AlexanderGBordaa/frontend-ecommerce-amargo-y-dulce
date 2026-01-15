import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { BadgePercent, Gift, ShoppingBag, Info } from "lucide-react";

function PromoCard({
  icon: Icon,
  title,
  subtitle,
  details,
  highlight,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  details: string[];
  highlight: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
          <Icon className="h-5 w-5 text-neutral-800" />
        </div>

        <div className="flex-1">
          <h3 className="text-base font-extrabold text-neutral-900">{title}</h3>
          <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>

          <div className="mt-4 rounded-lg bg-[#FAF7F2] p-4">
            <div className="text-sm font-bold text-neutral-900">{highlight}</div>
            <ul className="mt-2 space-y-1 text-sm text-neutral-700">
              {details.map((d) => (
                <li key={d} className="flex gap-2">
                  <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/productos#listado"
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Ver bombones
            </Link>
            <Link
              href="/carrito"
              className="rounded-full border border-neutral-300 bg-white px-5 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Ir al carrito
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PromocionesPage() {
  return (
    <main>
      <Container>
        {/* Header */}
        <section className="py-10">
          <h1 className="text-3xl font-extrabold text-neutral-900">
            Promociones
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700">
            Nuestras promos aplican a <span className="font-semibold">bombones</span>.
            Aprovechá descuentos por monto de compra o llevando varias cajas.
          </p>

          {/* Mini banda informativa */}
          <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
                <Info className="h-5 w-5 text-neutral-800" />
              </div>
              <div className="text-sm text-neutral-700">
                <div className="font-semibold text-neutral-900">
                  ¿Cómo se aplican?
                </div>
                <div className="mt-1">
                  Los descuentos se calculan en el carrito según el total o la cantidad
                  de cajas. (Más adelante lo conectamos con la lógica real.)
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Promos */}
        <section className="pb-14">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PromoCard
              icon={BadgePercent}
              title="Descuento por monto"
              subtitle="Cuanto más llevás, más ahorrás."
              highlight="10% OFF en compras desde $50.000"
              details={[
                "Válido para bombones.",
                "Se aplica automáticamente en el carrito.",
                "No requiere cupón.",
              ]}
            />

            <PromoCard
              icon={ShoppingBag}
              title="Descuento por cantidad"
              subtitle="Ideal para regalos o eventos."
              highlight="5% OFF llevando 3 cajas o más"
              details={[
                "Válido para bombones.",
                "El descuento aplica por cantidad de cajas.",
                "Combinable con distintos sabores (cuando existan).",
              ]}
            />
          </div>

          {/* Promo destacada (opcional) */}
          <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
                <Gift className="h-5 w-5 text-neutral-800" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-extrabold text-neutral-900">
                  Promo especial (ejemplo)
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Para fechas especiales podemos activar combos (San Valentín, Día de la Madre, etc.).
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href="/productos#listado"
                    className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                  >
                    Armar mi compra
                  </Link>
                  <Link
                    href="/sobre-nosotros"
                    className="rounded-full border border-neutral-300 bg-white px-5 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                  >
                    Consultar envíos
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </Container>
    </main>
  );
}
