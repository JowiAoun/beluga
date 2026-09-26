// The connection string as it was pasted: a value copied with its quotes, or with a space or a line
// break on the end, still connects. Vercel keeps what is typed into its form as is.
export function databaseUrl(raw: string | undefined): string | undefined {
  const url = raw?.trim().replace(/^(["'])([^]*)\1$/, "$2").trim();
  return url || undefined;
}
