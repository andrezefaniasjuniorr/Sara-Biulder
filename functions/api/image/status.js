export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      ok: true,
      available: true,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
