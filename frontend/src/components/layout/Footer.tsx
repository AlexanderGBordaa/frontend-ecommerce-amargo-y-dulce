import Link from "next/link";
import { Facebook, Instagram, Phone, Mail, MapPin, Download } from "lucide-react";

/**
 * Footer del ecommerce:
 * - Izquierda: marca (logo grande + frase)
 * - Centro: navegación extra (categorías / ayuda / legal)
 * - Derecha: contacto + redes
 *
 * Responsive:
 * - Mobile: se apila en columnas
 * - Desktop: 3 columnas (marca | links | contacto)
 */
export function Footer() {
  return (
    <footer className="bg-red-600 text-white">
      <div className="w-full px-6 lg:px-12 py-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* =========================
              IZQUIERDA — MARCA
          ========================== */}
          <div>
            <div className="text-4xl font-extrabold leading-none">
              Amargo <br /> y Dulce
            </div>

            <p className="mt-4 max-w-sm text-sm text-red-100">
              Sabores para elegir, recuerdos para guardar. Chocolates
              pensados para regalar (o regalarte).
            </p>
          </div>

          {/* =========================
              CENTRO — LINKS / INFO
          ========================== */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {/* Categorías */}
            <div>
              <h4 className="text-sm font-bold tracking-wide uppercase">
                Categorías
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-red-100">
                <li>
                  <Link className="hover:text-white" href="/productos">
                    Chocolates
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/productos">
                    Bombones
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/productos">
                    Caramelos
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/productos">
                    Cereales
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/productos">
                    Ver todo
                  </Link>
                </li>
              </ul>
            </div>

            {/* Ayuda */}
            <div>
              <h4 className="text-sm font-bold tracking-wide uppercase">Ayuda</h4>
              <ul className="mt-3 space-y-2 text-sm text-red-100">
                <li>
                  <Link className="hover:text-white" href="/sobre-nosotros">
                    Envíos
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/sobre-nosotros">
                    Preguntas frecuentes
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/sobre-nosotros">
                    Sobre nosotros
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-white" href="/promociones">
                    Promociones
                  </Link>
                </li>

                {/* “Catálogos” (placeholder) */}
                <li>
                  <a
                    className="inline-flex items-center gap-2 hover:text-white"
                    href="#"
                    aria-label="Catálogo de productos"
                  >
                    Catálogo <Download className="h-4 w-4" />
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-bold tracking-wide uppercase">Legal</h4>
              <ul className="mt-3 space-y-2 text-sm text-red-100">
                <li>
                  <a className="hover:text-white" href="#" aria-label="Términos">
                    Términos y condiciones
                  </a>
                </li>
                <li>
                  <a
                    className="hover:text-white"
                    href="#"
                    aria-label="Privacidad"
                  >
                    Política de privacidad
                  </a>
                </li>
                <li>
                  <a
                    className="hover:text-white"
                    href="#"
                    aria-label="Arrepentimiento"
                  >
                    Arrepentimiento de compra
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* =========================
              DERECHA — CONTACTO / REDES
          ========================== */}
          <div className="lg:text-right">
            <h4 className="text-sm font-bold tracking-wide uppercase">
              Contactos
            </h4>

            <div className="mt-4 space-y-3 text-sm text-red-100">
              <div className="flex items-start gap-3 lg:justify-end">
                <Mail className="h-5 w-5 flex-shrink-0 text-white" />
                <span>contacto@amargoydulce.com</span>
              </div>

              <div className="flex items-center gap-3 lg:justify-end">
                <Phone className="h-5 w-5 text-white" />
                <span>+54 9 11 3558-2177</span>
              </div>

              <div className="flex items-center gap-3 lg:justify-end">
                <Facebook className="h-5 w-5 text-white" />
                <span>Amargo y Dulce</span>
              </div>

              <div className="flex items-center gap-3 lg:justify-end">
                <Instagram className="h-5 w-5 text-white" />
                <span>@AmargoDulce</span>
              </div>
            </div>
          </div>
        </div>

        {/* Línea inferior (copyright + links) */}
        <div className="mt-10 border-t border-white/20 pt-6 text-xs text-red-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} Amargo y Dulce. Todos los derechos reservados.</span>

            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <a className="hover:text-white" href="#">
                Términos
              </a>
              <span className="opacity-50">|</span>
              <a className="hover:text-white" href="#">
                Privacidad
              </a>
              <span className="opacity-50">|</span>
              <a className="hover:text-white" href="#">
                Arrepentimiento
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
