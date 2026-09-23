import { withUser, json } from "@/lib/api";
import { getAnnouncement } from "@/lib/announcements";
export async function GET() {
  return withUser(async user => {
    const announcement = await getAnnouncement();
    return json({ announcement: announcement && (!announcement.plan || announcement.plan === user.plan) ? announcement : null });
  });
}
