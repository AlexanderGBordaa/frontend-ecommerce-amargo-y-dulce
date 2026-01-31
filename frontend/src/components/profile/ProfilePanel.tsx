"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type MeResponse =
  | { user: null; ok?: boolean; error?: string }
  | {
      user: {
        id: number;
        username?: string;
        email?: string;
        name?: string;
        dni?: string | null; // ✅
      };
    };

type Address = {
  id: number | string;
  label?: string | null;
  fullName?: string | null;
  phone?: string | null;
  street?: string | null;
  number?: string | null;
  floor?: string | null;
  apartment?: string | null;
  city?: string | null;
  province?: string | null;
  zip?: string | null;
  notes?: string | null;
  isDefault?: boolean | null;
};

type AddressPayload = Omit<Address, "id">;

const EMPTY_FORM: AddressPayload = {
  label: "Casa",
  fullName: "",
  phone: "",
  street: "",
  number: "",
  floor: "",
  apartment: "",
  city: "",
  province: "",
  zip: "",
  notes: "",
  isDefault: false,
};

function safeText(v: any) {
  return String(v ?? "").trim();
}

type ProfilePanelProps = {
  variant?: "dropdown" | "page";
  onClose?: () => void;
  /** ✅ Para que el Header controle el logout (recomendado) */
  onLogout?: () => void | Promise<void>;
};

export function ProfilePanel({
  variant = "dropdown",
  onClose,
  onLogout,
}: ProfilePanelProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse>({ user: null });

  const [showAddressForm, setShowAddressForm] = useState(false);

  const [addrLoading, setAddrLoading] = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);

  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [form, setForm] = useState<AddressPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // ✅ DNI state (debajo del email)
  const [dni, setDni] = useState("");
  const [dniSaving, setDniSaving] = useState(false);
  const [dniError, setDniError] = useState<string | null>(null);
  const [dniSavedMsg, setDniSavedMsg] = useState<string | null>(null);

  async function refreshMe() {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as MeResponse;
      setMe(data);
    } catch {
      setMe({ user: null, error: "No se pudo cargar tu perfil." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!alive) return;
      setLoading(true);
      await refreshMe();
    };

    run();

    const onFocus = () => refreshMe();
    window.addEventListener("focus", onFocus);

    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const user = "user" in me ? me.user : null;

  // ✅ precargar DNI cuando llega el user
  useEffect(() => {
    if (!user) return;
    setDni(String((user as any)?.dni ?? ""));
  }, [user?.id]);

  async function handleLogout() {
    try {
      // ✅ Si el Header nos pasa onLogout, usamos eso (desaparece el nombre al instante)
      if (onLogout) {
        await onLogout();
      } else {
        // Fallback: si se usa en /mi-perfil como página sin Header
        await fetch("/api/auth/logout", { method: "POST" });
        router.refresh();
      }
    } finally {
      onClose?.();
      if (variant === "page") router.push("/");
    }
  }

  // ✅ guardar DNI en Strapi via Next API
  async function saveDni() {
    const clean = safeText(dni);
    setDniError(null);
    setDniSavedMsg(null);

    if (!user) {
      setDniError("Tenés que iniciar sesión para guardar tu DNI.");
      return;
    }

    // validación mínima (ARG: 7 u 8 dígitos) — ajustá si querés
    if (clean.length > 0 && !/^\d{7,8}$/.test(clean)) {
      setDniError("Ingresá un DNI válido (7 u 8 dígitos).");
      return;
    }

    try {
      setDniSaving(true);

      // OJO: esto requiere que tengas implementado PUT /api/auth/me
      const r = await fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dni: clean || null }),
      });

      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || "No se pudo guardar el DNI.");

      setDniSavedMsg("DNI guardado.");
      await refreshMe();
      setTimeout(() => setDniSavedMsg(null), 2000);
    } catch (e: any) {
      setDniError(e?.message || "Error guardando DNI.");
    } finally {
      setDniSaving(false);
    }
  }

  async function loadAddresses() {
    setAddrLoading(true);
    setAddrError(null);
    try {
      const r = await fetch("/api/addresses", { cache: "no-store" });

      if (r.status === 401) {
        setAddresses([]);
        return;
      }

      const j = await r.json().catch(() => null);
      const list: Address[] = Array.isArray(j?.data)
        ? j.data
        : Array.isArray(j)
        ? j
        : [];
      setAddresses(list);
    } catch {
      setAddrError("No se pudieron cargar tus direcciones.");
      setAddresses([]);
    } finally {
      setAddrLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const sortedAddresses = useMemo(() => {
    const list = [...addresses];
    list.sort(
      (a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault))
    );
    return list;
  }, [addresses]);

  function resetForm(close = true) {
    setEditingId(null);
    setForm(EMPTY_FORM);
    if (close) setShowAddressForm(false);
  }

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowAddressForm(true);
  }

  function startEdit(a: Address) {
    setEditingId(a.id);
    setForm({
      label: a.label ?? "Casa",
      fullName: a.fullName ?? "",
      phone: a.phone ?? "",
      street: a.street ?? "",
      number: a.number ?? "",
      floor: a.floor ?? "",
      apartment: a.apartment ?? "",
      city: a.city ?? "",
      province: a.province ?? "",
      zip: a.zip ?? "",
      notes: a.notes ?? "",
      isDefault: Boolean(a.isDefault),
    });
    setShowAddressForm(true);
  }

  async function saveAddress() {
    setSaving(true);
    setAddrError(null);

    try {
      const isEdit = editingId !== null;

      const payload: AddressPayload = {
        ...form,
        label: safeText(form.label) || "Casa",
        fullName: safeText(form.fullName),
        phone: safeText(form.phone),
        street: safeText(form.street),
        number: safeText(form.number),
        floor: safeText(form.floor),
        apartment: safeText(form.apartment),
        city: safeText(form.city),
        province: safeText(form.province),
        zip: safeText(form.zip),
        notes: safeText(form.notes),
        isDefault: Boolean(form.isDefault),
      };

      if (payload.street.length < 2) throw new Error("Ingresá la calle.");
      if (payload.number.length < 1)
        throw new Error("Ingresá el número/altura.");
      if (payload.city.length < 2) throw new Error("Ingresá la ciudad.");
      if (payload.province.length < 2)
        throw new Error("Ingresá la provincia.");
      if (payload.zip.length < 3)
        throw new Error("Ingresá el código postal.");

      const url = isEdit ? `/api/addresses/${editingId}` : `/api/addresses`;
      const method = isEdit ? "PUT" : "POST";

      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await r.json().catch(() => null);

      if (!r.ok) throw new Error(j?.error || "Error al guardar la dirección.");

      await loadAddresses();
      resetForm(true);
    } catch (e: any) {
      setAddrError(e?.message || "No se pudo guardar la dirección.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAddress(id: number | string) {
    if (!confirm("¿Eliminar esta dirección?")) return;
    setSaving(true);
    setAddrError(null);

    try {
      const r = await fetch(`/api/addresses/${id}`, { method: "DELETE" });
      const j = await r.json().catch(() => null);

      if (!r.ok) throw new Error(j?.error || "Error al eliminar.");

      await loadAddresses();
      if (editingId === id) resetForm(true);
    } catch (e: any) {
      setAddrError(e?.message || "No se pudo eliminar la dirección.");
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(id: number | string) {
    setSaving(true);
    setAddrError(null);

    try {
      const r = await fetch(`/api/addresses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });

      const j = await r.json().catch(() => null);

      if (!r.ok)
        throw new Error(j?.error || "Error al marcar como predeterminada.");

      await loadAddresses();
    } catch (e: any) {
      setAddrError(e?.message || "No se pudo marcar como predeterminada.");
    } finally {
      setSaving(false);
    }
  }

  const rootClass =
    variant === "dropdown"
      ? "w-[min(92vw,760px)] rounded-2xl border border-neutral-200 bg-white shadow-xl"
      : "mx-auto max-w-3xl";

  const padClass = variant === "dropdown" ? "p-5" : "py-10";

  const scrollClass =
    variant === "dropdown" ? "max-h-[min(75vh,720px)] overflow-auto" : "";

  return (
    <div className={rootClass}>
      <div className={`${padClass} ${scrollClass}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-neutral-900">Mi perfil</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Tus datos y accesos rápidos.
            </p>
          </div>

          {variant === "dropdown" && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Cerrar
            </button>
          ) : null}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* PERFIL */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            {loading ? (
              <div className="text-sm text-neutral-600">Cargando…</div>
            ) : !user ? (
              <div className="space-y-3">
                <p className="text-sm text-neutral-700">
                  No estás logueado. Iniciá sesión para ver tu perfil y tus
                  pedidos.
                </p>

                <div className="flex gap-2">
                  <Link
                    href="/login"
                    onClick={() => onClose?.()}
                    className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white"
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    href="/productos"
                    onClick={() => onClose?.()}
                    className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-900"
                  >
                    Seguir comprando
                  </Link>
                </div>

                {"error" in me && me.error ? (
                  <p className="text-xs text-red-600">{me.error}</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-neutral-500">Nombre</div>
                  <div className="text-base font-bold text-neutral-900">
                    {user.name || user.username || "—"}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-neutral-500">Email</div>
                  <div className="text-base font-semibold text-neutral-900">
                    {user.email || "—"}
                  </div>
                </div>

                {/* ✅ DNI debajo del mail */}
                <div>
                  <div className="text-sm text-neutral-500">DNI</div>
                  <input
                    value={dni}
                    onChange={(e) => {
                      setDni(e.target.value);
                      setDniError(null);
                      setDniSavedMsg(null);
                    }}
                    placeholder="DNI (7 u 8 dígitos)"
                    inputMode="numeric"
                    className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400"
                  />

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={saveDni}
                      disabled={dniSaving}
                      className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {dniSaving ? "Guardando…" : "Guardar DNI"}
                    </button>

                    <span className="text-xs text-neutral-500">
                      Se guarda en tus datos personales.
                    </span>
                  </div>

                  {dniError ? (
                    <p className="mt-1 text-xs text-red-600">{dniError}</p>
                  ) : null}
                  {dniSavedMsg ? (
                    <p className="mt-1 text-xs text-green-600">{dniSavedMsg}</p>
                  ) : null}
                </div>

                <div className="h-px bg-neutral-200" />

                <div className="flex flex-wrap gap-2">
                  <Link
                  href="/facturas"
                  onClick={() => onClose?.()}
                  className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white"
                  >
                    Mis recibos
                  </Link>

                  <Link
                    href="/mis-pedidos"
                    onClick={() => onClose?.()}
                    className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white"
                  >
                    Ver mis pedidos
                  </Link>

                  <Link
                    href="/productos"
                    onClick={() => onClose?.()}
                    className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white"
                  >
                    Seguir comprando
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white"
                    type="button"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* DIRECCIONES */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-extrabold text-neutral-900">
                  Direcciones guardadas
                </div>
                <p className="mt-1 text-sm text-neutral-600">
                  Elegí una en el checkout para completar más rápido.
                </p>
              </div>

              <button
                type="button"
                onClick={() => (showAddressForm ? resetForm(true) : startCreate())}
                className="shrink-0 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
                disabled={!user}
              >
                {showAddressForm ? "Cerrar" : "+ Agregar"}
              </button>
            </div>

            {addrError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {addrError}
              </div>
            ) : null}

            <div className="mt-5">
              {!user ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                  Iniciá sesión para guardar direcciones.
                </div>
              ) : addrLoading ? (
                <p className="text-sm text-neutral-600">Cargando direcciones…</p>
              ) : sortedAddresses.length === 0 ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                  Todavía no tenés direcciones guardadas.
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedAddresses.map((a) => (
                    <div
                      key={String(a.id)}
                      className="rounded-xl border border-neutral-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-extrabold text-neutral-900">
                              {a.label || "Dirección"}
                            </div>
                            {a.isDefault ? (
                              <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-bold text-white">
                                Predeterminada
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-1 text-sm text-neutral-700">
                            {(a.street || "") + (a.number ? ` ${a.number}` : "")}
                            {a.floor ? `, Piso ${a.floor}` : ""}
                            {a.apartment ? `, Dpto ${a.apartment}` : ""}
                          </div>

                          <div className="text-sm text-neutral-700">
                            {(a.city || "") +
                              (a.province ? `, ${a.province}` : "")}
                            {a.zip ? ` (${a.zip})` : ""}
                          </div>

                          {(a.fullName || a.phone) && (
                            <div className="mt-1 text-xs text-neutral-500">
                              {a.fullName ? a.fullName : ""}
                              {a.fullName && a.phone ? " • " : ""}
                              {a.phone ? a.phone : ""}
                            </div>
                          )}

                          {a.notes ? (
                            <div className="mt-1 text-xs text-neutral-500">
                              Nota: {a.notes}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          {!a.isDefault && (
                            <button
                              onClick={() => setDefault(a.id)}
                              type="button"
                              className="text-xs font-semibold text-neutral-900 underline hover:text-neutral-700 disabled:opacity-60"
                              disabled={saving}
                            >
                              Hacer predeterminada
                            </button>
                          )}

                          <div className="flex gap-2">
                            <button
                              onClick={() => startEdit(a)}
                              type="button"
                              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50 disabled:opacity-60"
                              disabled={saving}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => deleteAddress(a.id)}
                              type="button"
                              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50 disabled:opacity-60"
                              disabled={saving}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FORM */}
            {user && showAddressForm && (
              <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-neutral-900">
                    {editingId ? "Editar dirección" : "Nueva dirección"}
                  </h3>

                  <button
                    type="button"
                    onClick={() => resetForm(true)}
                    className="text-xs font-semibold text-neutral-700 underline hover:text-neutral-900 disabled:opacity-60"
                    disabled={saving}
                  >
                    Limpiar
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold">Etiqueta</label>
                    <input
                      value={form.label ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, label: e.target.value }))
                      }
                      className="mt-1 w-full rounded border px-3 py-2"
                      placeholder="Casa / Trabajo"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold">Nombre completo</label>
                    <input
                      value={form.fullName ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, fullName: e.target.value }))
                      }
                      className="mt-1 w-full rounded border px-3 py-2"
                      placeholder="Como figura para el envío"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold">Teléfono</label>
                    <input
                      value={form.phone ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, phone: e.target.value }))
                      }
                      className="mt-1 w-full rounded border px-3 py-2"
                      placeholder="Ej: 351 555-555"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold">Calle</label>
                    <input
                      value={form.street ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, street: e.target.value }))
                      }
                      className="mt-1 w-full rounded border px-3 py-2"
                      placeholder="Ej: Av. Siempre Viva"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold">Número</label>
                    <input
                      value={form.number ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, number: e.target.value }))
                      }
                      className="mt-1 w-full rounded border px-3 py-2"
                      placeholder="123"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold">Piso (opcional)</label>
                    <input
                      value={form.floor ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, floor: e.target.value }))
                      }
                      className="mt-1 w-full rounded border px-3 py-2"
                      placeholder="2"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold">Dpto (opcional)</label>
                    <input
                      value={form.apartment ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, apartment: e.target.value }))
                      }
                      className="mt-1 w-full rounded border px-3 py-2"
                      placeholder="A"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold">Código postal</label>
                    <input
                      value={form.zip ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, zip: e.target.value }))
                      }
                      className="mt-1 w-full rounded border px-3 py-2"
                      placeholder="5000"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold">Ciudad</label>
                    <input
                      value={form.city ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, city: e.target.value }))
                      }
                      className="mt-1 w-full rounded border px-3 py-2"
                      placeholder="Córdoba"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold">Provincia</label>
                    <input
                      value={form.province ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, province: e.target.value }))
                      }
                      className="mt-1 w-full rounded border px-3 py-2"
                      placeholder="Córdoba"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold">Notas (opcional)</label>
                    <input
                      value={form.notes ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, notes: e.target.value }))
                      }
                      className="mt-1 w-full rounded border px-3 py-2"
                      placeholder="Ej: timbre roto, llamar antes..."
                    />
                  </div>

                  <label className="sm:col-span-2 flex items-center gap-2 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={Boolean(form.isDefault)}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, isDefault: e.target.checked }))
                      }
                    />
                    Usar como predeterminada
                  </label>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={saveAddress}
                    className="rounded bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                    type="button"
                    disabled={saving}
                  >
                    {saving
                      ? "Guardando…"
                      : editingId
                      ? "Guardar cambios"
                      : "Guardar dirección"}
                  </button>

                  <button
                    onClick={() => resetForm(true)}
                    className="rounded border border-neutral-300 px-4 py-2 text-sm font-semibold disabled:opacity-60"
                    type="button"
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
