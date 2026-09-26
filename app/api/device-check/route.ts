// Prints device check results and walk session summaries in the dev server terminal (or Vercel
// logs), so a run on the phone can be read without Chrome remote debugging.
export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > 20_000) return new Response(null, { status: 413 });
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  const kind = (parsed as { kind?: unknown } | null)?.kind === "walk" ? "walk" : "check";
  console.info(`[beluga ${kind}] ${body}`);
  return new Response(null, { status: 204 });
}
