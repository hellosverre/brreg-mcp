const BASE = "https://data.brreg.no/enhetsregisteret/api";

export type BrregError = {
  status: number;
  message: string;
};

export type BrregResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: BrregError };

function stripHal(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripHal);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "_links") continue;
      out[k] = stripHal(v);
    }
    return out;
  }
  return value;
}

export async function brregGet<T = unknown>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<BrregResult<T>> {
  const url = new URL(BASE + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (res.status === 404) {
    return { ok: false, error: { status: 404, message: "Not found" } };
  }
  if (res.status === 410) {
    return {
      ok: false,
      error: { status: 410, message: "Entity removed for legal reasons (Gone)" },
    };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      error: {
        status: res.status,
        message: `Brønnøysund API error ${res.status}: ${body.slice(0, 500) || res.statusText}`,
      },
    };
  }

  const raw = (await res.json()) as unknown;
  return { ok: true, data: stripHal(raw) as T };
}

export function isOrgNr(value: string): boolean {
  return /^\d{9}$/.test(value);
}
