// Prints device check results, walk session summaries and sound test scores in the dev server
// terminal (or Vercel logs), so a run on the phone can be read without Chrome remote debugging.
export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > 20_000) return new Response(null, { status: 413 });
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  const sent = (parsed as { kind?: unknown } | null)?.kind;
  const kind = sent === "walk" || sent === "sounds" ? sent : "check";
  console.info(`[beluga ${kind}] ${body}`);
  return new Response(null, { status: 204 });
}
