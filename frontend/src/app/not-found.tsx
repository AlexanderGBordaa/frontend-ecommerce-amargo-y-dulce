import Link from "next/link";
import { Container } from "@/components/layout/Container";

export default function NotFound() {
  return (
    <Container>
      <div className="py-16">
        <h1 className="text-2xl font-bold">Página no encontrada</h1>
        <p className="mt-2 text-neutral-600">La URL no existe.</p>
        <Link className="mt-6 inline-block rounded-md bg-red-600 px-4 py-2 text-white" href="/">
          Volver al inicio
        </Link>
      </div>
    </Container>
  );
}
