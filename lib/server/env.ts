import "server-only";

export class MissingEnvError extends Error {
  constructor(readonly names: string[]) {
    super(`Missing environment variables: ${names.join(", ")}`);
  }
}

// Reads backend settings at call time, so a missing key fails the one route that needs it.
export function env<const K extends string>(...names: K[]): Record<K, string> {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) throw new MissingEnvError(missing);
  return Object.fromEntries(names.map((name) => [name, process.env[name] as string])) as Record<K, string>;
}

export function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
