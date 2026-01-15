"use client";

import { useEffect, useRef } from "react";
import { Chrome } from "lucide-react";

export function LoginModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar si clickea fuera
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }

    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-3 w-[340px] rounded-xl border border-neutral-200 bg-white p-5 shadow-xl"
    >
      <h3 className="text-sm font-bold text-neutral-900">Iniciar sesión</h3>
      <p className="mt-1 text-sm text-neutral-600">
        Accedé con tu cuenta de Google para continuar.
      </p>

      <a
        href="/api/auth/google"
        className="mt-4 flex h-10 w-full items-center justify-center gap-3 rounded-full border border-neutral-300 bg-white text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold">
          G
        </span>
        Continuar con Google
      </a>

      <p className="mt-3 text-xs text-neutral-500">
        Usamos Google solo para autenticarte.
      </p>
    </div>
  );
}
