/** Liveness and release marker for deploy checks and uptime monitors. No data, no authentication. */
export async function GET() {
  return Response.json(
    { ok: true, release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null, checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
