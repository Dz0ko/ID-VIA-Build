import { processEmailQueue } from "@/lib/email";
export const maxDuration = 300;
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  return Response.json(await processEmailQueue({ limit: 200, seconds: 220 }));
}
