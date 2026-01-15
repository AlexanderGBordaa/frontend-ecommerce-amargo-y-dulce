type FetcherOptions = RequestInit & {
  headers?: Record<string, string>;
  auth?: boolean; // ✅ nuevo: si true, agrega Bearer token
};

export async function fetcher<T>(url: string, options: FetcherOptions = {}): Promise<T> {
  const base =
    process.env.STRAPI_URL ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    "http://localhost:1337";

  const fullUrl = url.startsWith("http")
    ? url
    : `${base}${url.startsWith("/") ? "" : "/"}${url}`;

  const token = process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN || "";

  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };

  // ✅ Solo agregamos Authorization si options.auth === true
  if (options.auth === true) {
    if (!token || token.length < 10) {
      throw new Error("Falta STRAPI_API_TOKEN/STRAPI_TOKEN para request con auth:true");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(fullUrl, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} - ${res.statusText} - ${text}`);
  }

  return (await res.json()) as T;
}
