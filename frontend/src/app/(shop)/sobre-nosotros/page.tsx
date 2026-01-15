import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { HeartHandshake, Leaf, ShieldCheck, Truck } from "lucide-react";

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
          <Icon className="h-5 w-5 text-neutral-800" />
        </div>
        <div>
          <h3 className="text-base font-bold text-neutral-900">{title}</h3>
          <div className="mt-2 text-sm leading-6 text-neutral-600">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SobreNosotrosPage() {
  return (
    <main>
      <Container>
        {/* HERO */}
        <section className="py-10">
          <h1 className="text-3xl font-extrabold text-neutral-900">
            Sobre nosotros
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700">
            En <span className="font-semibold">Amargo y Dulce</span> creemos que
            un buen chocolate (y un buen café) no es solo un producto: es un
            momento. Por eso cuidamos cada detalle, desde la selección de
            ingredientes hasta el empaque, para que regalar —o regalarte— sea
            una experiencia.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/productos"
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Ver productos
            </Link>
            <Link
              href="/promociones"
              className="rounded-full border border-neutral-300 bg-white px-5 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Ver promociones
            </Link>
          </div>
        </section>

        {/* BLOQUE PRINCIPAL */}
        <section className="pb-12">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <InfoCard icon={HeartHandshake} title="Nuestra historia">
              Nacimos como un emprendimiento familiar, inspirado en los sabores
              clásicos y en la idea de crear regalos simples pero memorables.
              Con el tiempo, sumamos nuevas líneas y combinaciones, manteniendo
              siempre la misma pasión artesanal.
            </InfoCard>

            <InfoCard icon={Leaf} title="Ingredientes y calidad">
              Elegimos materias primas de primera calidad y buscamos el balance
              perfecto entre intensidad y dulzura. Queremos que cada bocado sea
              consistente: rico hoy, rico mañana, rico siempre.
            </InfoCard>

            <InfoCard icon={ShieldCheck} title="Confianza y atención">
              Nos importa que compres con tranquilidad. Si tenés dudas sobre un
              producto, un envío o una promoción, estamos para ayudarte y
              resolverlo rápido.
            </InfoCard>
          </div>
        </section>

        {/* ENVÍOS / BENEFICIOS */}
        <section className="pb-14">
          <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
                <Truck className="h-5 w-5 text-neutral-800" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-neutral-900">
                  Envíos y experiencia de compra
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Queremos que sea fácil elegir, pagar y recibir.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-neutral-50 p-4">
                <div className="text-sm font-bold text-neutral-900">
                  Pagos seguros
                </div>
                <div className="mt-1 text-sm text-neutral-600">
                  Mercado Pago y métodos confiables.
                </div>
              </div>

              <div className="rounded-lg bg-neutral-50 p-4">
                <div className="text-sm font-bold text-neutral-900">
                  Envío a domicilio
                </div>
                <div className="mt-1 text-sm text-neutral-600">
                  Coordinamos la entrega según tu zona.
                </div>
              </div>

              <div className="rounded-lg bg-neutral-50 p-4">
                <div className="text-sm font-bold text-neutral-900">
                  Atención rápida
                </div>
                <div className="mt-1 text-sm text-neutral-600">
                  Resolvemos consultas y pedidos.
                </div>
              </div>
            </div>

            <div className="mt-6 text-sm text-neutral-600">
              ¿Tenés una consulta?{" "}
              <span className="font-semibold text-neutral-900">
                Escribinos desde el footer
              </span>{" "}
              o por redes.
            </div>
          </div>
        </section>
      </Container>
    </main>
  );
}
