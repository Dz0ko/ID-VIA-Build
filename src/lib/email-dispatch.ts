import { after } from "next/server";
import { processEmailQueue } from "./email";
/** Invoked only from request handlers; the durable outbox survives interrupted workers. */
export function dispatchEmails() {
  try { after(async () => { try { await processEmailQueue(); } catch { console.error("[email] Queue processing deferred; messages remain in the outbox."); } }); } catch { /* Background callers have no request scope; cron drains the durable outbox. */ }
}
