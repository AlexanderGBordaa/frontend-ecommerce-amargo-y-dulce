import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Chrome } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2]">
      <Container>
        <div className="flex min-h-screen items-center justify-center py-12">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
            {/* Logo / Marca */}
            <Link href="/" className="block text-center leading-none">
              <div className="text-3xl font-extrabold tracking-tight text-neutral-900">
                Amargo
              </div>
              <div className="text-3xl font-extrabold tracking-tight text-neutral-900">
                y Dulce
              </div>
            </Link>

            <h1 className="mt-6 text-center text-xl font-extrabold text-neutral-900">
              Iniciar sesión
            </h1>
            <p className="mt-2 text-center text-sm text-neutral-600">
              Para comprar y ver tus pedidos, iniciá sesión con Google.
            </p>

            {/* Botón Google */}
            <div className="mt-6">
              <a
                href="/api/auth/google"
                className="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-neutral-300 bg-white text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                aria-label="Continuar con Google"
              >
                <Chrome className="h-5 w-5" />
                Continuar con Google
              </a>

              <p className="mt-3 text-center text-xs text-neutral-500">
                Solo usamos tu cuenta para autenticarte. No guardamos tu contraseña.
              </p>
            </div>

            {/* Links inferiores */}
            <div className="mt-8 border-t border-neutral-200 pt-5 text-center">
              <Link
                href="/"
                className="text-sm font-semibold text-red-600 hover:text-red-700"
              >
                Volver a la tienda
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}
