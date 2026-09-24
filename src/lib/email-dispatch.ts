import { recordPlatformError } from "./platform-errors";
import { after } from "next/server";
import { processEmailQueue } from "./email";
/** Invoked only from request handlers; the durable outbox survives interrupted workers. */
export function dispatchEmails() {
  try { after(async () => { try { await processEmailQueue(); } catch (error) { await recordPlatformError(error, { source: "email.worker" }); } }); } catch { /* Background callers have no request scope; cron drains the durable outbox. */ }
}
