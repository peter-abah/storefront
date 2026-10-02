export async function GET() {
  return Response.json(
    { ok: true, wave: 1, service: "maison-editorial-shop" },
    { status: 200 },
  );
}
