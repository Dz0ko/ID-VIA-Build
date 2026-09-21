import { NextResponse } from "next/server";
import { AuthError, getCurrentUser, type SessionUser } from "./auth";
import { InsufficientCredits } from "./credits";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function error(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function withUser<T>(
  fn: (user: SessionUser) => Promise<T>,
): Promise<T | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return error("Not authenticated", 401);
  try {
    return await fn(user);
  } catch (e) {
    return handleError(e);
  }
}

export function handleError(e: unknown) {
  if (e instanceof AuthError) return error(e.message, 401);
  if (e instanceof InsufficientCredits)
    return error(e.message, 402, { needed: e.needed, have: e.have, code: "INSUFFICIENT_CREDITS" });
  const message = e instanceof Error ? e.message : "Unexpected error";
  console.error(e);
  return error(message, 500);
}

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "site"
  );
}
