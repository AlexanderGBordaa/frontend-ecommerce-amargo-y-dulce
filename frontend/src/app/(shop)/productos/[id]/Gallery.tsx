"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

type StrapiImage = {
  url?: string;
  alternativeText?: string | null;
  formats?: {
    thumbnail?: { url?: string };
    small?: { url?: string };
    medium?: { url?: string };
    large?: { url?: string };
  };
};

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337";

function absUrl(url?: string) {
  if (!url) return undefined;
  return url.startsWith("http") ? url : `${STRAPI_URL}${url}`;
}

export function Gallery({
  images,
  title,
}: {
  images: StrapiImage[];
  title: string;
}) {
  const normalized = useMemo(() => {
    return (images ?? [])
      .map((img) => {
        const main =
          img.formats?.large?.url ||
          img.formats?.medium?.url ||
          img.formats?.small?.url ||
          img.url;

        const thumb = img.formats?.thumbnail?.url || img.url;

        return {
          main: absUrl(main),
          thumb: absUrl(thumb),
          alt: img.alternativeText || title,
        };
      })
      .filter((x) => Boolean(x.main));
  }, [images, title]);

  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  // Ajuste: si cambia la cantidad de imágenes, evitamos índice fuera de rango
  useEffect(() => {
    if (active >= normalized.length) setActive(0);
  }, [active, normalized.length]);

  const prev = useCallback(() => {
    setActive((i) =>
      normalized.length ? (i - 1 + normalized.length) % normalized.length : 0
    );
  }, [normalized.length]);

  const next = useCallback(() => {
    setActive((i) =>
      normalized.length ? (i + 1) % normalized.length : 0
    );
  }, [normalized.length]);

  const activeImg = normalized[active];

  // Teclas: ESC para cerrar, flechas para navegar (cuando está abierto)
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, prev, next]);

  return (
    <section>
      {/* Imagen principal (clic para abrir lightbox) */}
      <div
        className={`relative aspect-[4/3] overflow-hidden rounded-xl bg-neutral-100 ${
          activeImg?.main ? "cursor-zoom-in" : ""
        }`}
        role="button"
        tabIndex={0}
        onClick={() => activeImg?.main && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && activeImg?.main) setOpen(true);
        }}
        aria-label="Abrir imagen"
      >
        {activeImg?.main ? (
          <>
            <Image
              src={activeImg.main}
              alt={activeImg.alt}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />

            {/* Flechas desktop */}
            {normalized.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prev();
                  }}
                  className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-white/80 ring-1 ring-neutral-200 hover:bg-white"
                  aria-label="Imagen anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    next();
                  }}
                  className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-white/80 ring-1 ring-neutral-200 hover:bg-white"
                  aria-label="Imagen siguiente"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-neutral-500">
            Imagen próximamente
          </div>
        )}
      </div>

      {/* Miniaturas */}
      {normalized.length > 1 && (
        <div className="mt-4 grid grid-cols-4 gap-3">
          {normalized.slice(0, 8).map((img, idx) => {
            const isActive = idx === active;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActive(idx)}
                className={`relative aspect-square overflow-hidden rounded-lg bg-neutral-100 ring-1 transition
                  ${
                    isActive
                      ? "ring-red-600 shadow-md"
                      : "ring-neutral-200 hover:ring-neutral-300 hover:shadow-sm"
                  }`}
                aria-label={`Ver imagen ${idx + 1}`}
              >
                {img.thumb ? (
                  <Image
                    src={img.thumb}
                    alt={img.alt}
                    fill
                    className="object-cover"
                    sizes="120px"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {open && activeImg?.main && (
        <div
          className="fixed inset-0 z-50 bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada"
          onClick={() => setOpen(false)}
        >
          {/* Cerrar */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-2 text-sm font-semibold hover:bg-white"
            aria-label="Cerrar"
          >
            ✕
          </button>

          {/* Imagen */}
          <div
            className="relative mx-auto mt-10 h-[80vh] max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={activeImg.main}
              alt={activeImg.alt}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />

            {/* Flechas dentro del lightbox */}
            {normalized.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/90 ring-1 ring-neutral-200 hover:bg-white"
                  aria-label="Imagen anterior"
                >
                  <ChevronLeft className="mx-auto h-6 w-6" />
                </button>

                <button
                  type="button"
                  onClick={next}
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/90 ring-1 ring-neutral-200 hover:bg-white"
                  aria-label="Imagen siguiente"
                >
                  <ChevronRight className="mx-auto h-6 w-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
