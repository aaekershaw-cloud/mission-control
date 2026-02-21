export function ok<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

export function err(code: string, error: string, status = 400, details?: unknown) {
  return Response.json({ error, code, details }, { status });
}

export function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

export function asNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return p.filter((x): x is string => typeof x === 'string');
    } catch {
      return [];
    }
  }
  return [];
}
