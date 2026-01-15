"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Container } from "./Container";
import { Search, ShoppingCart, User, Menu, X } from "lucide-react";
import { LoginModal } from "@/components/auth/LoginModal";
import { CartBadge } from "@/components/cart/CartBadge";

function NavLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="text-[15px] font-medium text-neutral-800 hover:text-neutral-950 transition"
    >
      {children}
    </Link>
  );
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ESC cierra menú mobile y dropdown login
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setLoginOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header
      className={[
        "sticky top-0 z-50 border-b bg-white/95 backdrop-blur transition-shadow",
        scrolled ? "shadow-sm" : "shadow-none",
      ].join(" ")}
    >
      <Container>
        <div className="grid h-[72px] grid-cols-[auto_1fr_auto] items-center gap-6">
          {/* IZQUIERDA: logo + menú */}
          <div className="flex items-center gap-6">
            <Link href="/" className="leading-none">
              <div className="text-[22px] font-extrabold tracking-tight text-neutral-900">
                Amargo
              </div>
              <div className="text-[22px] font-extrabold tracking-tight text-neutral-900">
                y Dulce
              </div>
            </Link>

            <nav className="hidden items-center gap-4 md:flex">
              <span className="text-neutral-300">|</span>
              <NavLink href="/productos">Productos</NavLink>
              <span className="text-neutral-300">|</span>
              <NavLink href="/promociones">Promociones</NavLink>
              <span className="text-neutral-300">|</span>
              <NavLink href="/sobre-nosotros">Sobre nosotros</NavLink>
            </nav>
          </div>

          {/* CENTRO: buscador */}
          <div className="hidden lg:flex justify-center">
            <div className="relative w-full max-w-[760px]">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                placeholder="Buscá tu producto"
                className="h-11 w-full rounded-full border border-neutral-300 bg-white pl-12 pr-4 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
              />
            </div>
          </div>

          {/* DERECHA: acciones desktop */}
          <div className="hidden items-center gap-4 md:flex">
            <div className="h-6 w-px bg-neutral-200" />

            {/* Dropdown login */}
            <div className="relative">
              <button
                onClick={() => setLoginOpen((v) => !v)}
                className="flex items-center gap-2 text-[15px] font-medium text-neutral-800 hover:text-neutral-950"
                type="button"
                aria-expanded={loginOpen}
              >
                <User className="h-5 w-5" />
                Iniciar sesión
              </button>

              <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
            </div>

            <div className="h-6 w-px bg-neutral-200" />

            {/* Carrito + badge */}
            <Link
              href="/carrito"
              className="relative flex items-center gap-2 text-[15px] font-medium text-neutral-800 hover:text-neutral-950"
            >
              <span className="relative inline-flex">
                <ShoppingCart className="h-5 w-5" />
                <CartBadge />
              </span>
              Carrito
            </Link>
          </div>

          {/* MOBILE: carrito + hamburguesa */}
          <div className="flex items-center justify-end gap-2 md:hidden">
            <Link
              href="/carrito"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-md border border-neutral-200 bg-white"
              aria-label="Carrito"
            >
              <ShoppingCart className="h-5 w-5" />
              <CartBadge />
            </Link>

            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-neutral-200 bg-white"
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileOpen}
              type="button"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* PANEL MOBILE */}
        {mobileOpen && (
          <div className="border-t bg-white md:hidden">
            <div className="py-4">
              {/* Search mobile */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  placeholder="Buscá tu producto"
                  className="h-11 w-full rounded-full border border-neutral-300 bg-white pl-12 pr-4 text-[15px] focus:outline-none"
                />
              </div>

              {/* Links */}
              <nav className="mt-4 flex flex-col gap-3">
                <NavLink href="/productos" onClick={() => setMobileOpen(false)}>
                  Productos
                </NavLink>
                <NavLink href="/promociones" onClick={() => setMobileOpen(false)}>
                  Promociones
                </NavLink>
                <NavLink href="/sobre-nosotros" onClick={() => setMobileOpen(false)}>
                  Sobre nosotros
                </NavLink>
              </nav>

              {/* Acciones mobile */}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    setLoginOpen(true);
                  }}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white text-[15px] font-medium"
                  type="button"
                >
                  <User className="h-5 w-5" />
                  Iniciar sesión
                </button>

                <Link
                  href="/carrito"
                  onClick={() => setMobileOpen(false)}
                  className="relative flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white text-[15px] font-medium"
                >
                  <span className="relative inline-flex">
                    <ShoppingCart className="h-5 w-5" />
                    <CartBadge />
                  </span>
                  Carrito
                </Link>
              </div>
            </div>
          </div>
        )}
      </Container>
    </header>
  );
}
