import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs" || context.routePath.includes("/api/admin/errors") || context.routePath.includes("/api/monitoring")) return;
  const { recordPlatformError } = await import("./lib/platform-errors");
  const { getCurrentUser } = await import("./lib/auth");
  // Only verified session identity; never persist headers or query strings.
  const user = await getCurrentUser().catch(() => null);
  await recordPlatformError(error, { source: "server", userId: user?.id, route: context.routePath });
};
