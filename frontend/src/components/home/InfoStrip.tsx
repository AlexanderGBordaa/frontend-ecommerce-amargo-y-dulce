import { CreditCard, Truck, BadgeDollarSign, UserRound } from "lucide-react";

/**
 * Item de info/beneficio.
 * - icon: icono (lucide)
 * - title: título corto
 * - subtitle: texto chico
 */
function InfoItem({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 bg-white">
        <Icon className="h-5 w-5 text-neutral-700" />
      </div>

      <div className="leading-tight">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-800">
          {title}
        </div>
        <div className="text-xs text-neutral-500">{subtitle}</div>
      </div>
    </div>
  );
}

/**
 * Banda de información debajo del carrusel:
 * - Desktop: 4 columnas
 * - Mobile: 1 columna (o 2x2 si querés)
 */
export function InfoStrip() {
  return (
    <section aria-label="Información de compra" className="bg-white">
      {/* Caja general con borde como en el mockup */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-md">


        <div className="grid grid-cols-1 divide-y divide-neutral-200 md:grid-cols-4 md:divide-x md:divide-y-0">
          <InfoItem
            icon={UserRound}
            title="Cómo comprar"
            subtitle="No es necesario iniciar sesión"
          />
          <InfoItem
            icon={CreditCard}
            title="Método de pago"
            subtitle="Solo mercado pago"
          />
          <InfoItem
            icon={Truck}
            title="Método de envío"
            subtitle="A domicilio o punto de retiro"
          />
          <InfoItem
            icon={BadgeDollarSign}
            title="Envío gratis"
            subtitle="En compras mayores a $50.000"
          />
        </div>
      </div>
    </section>
  );
}
