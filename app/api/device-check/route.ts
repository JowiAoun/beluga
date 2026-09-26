// Prints device check results in the dev server terminal (or Vercel logs), so a run on
// the phone can be read without Chrome remote debugging.
export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > 20_000) return new Response(null, { status: 413 });
  try {
    JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  console.info(`[beluga check] ${body}`);
  return new Response(null, { status: 204 });
}
