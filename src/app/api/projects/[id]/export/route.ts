import JSZip from "jszip";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]/export">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (user.plan === "FREE")
    return Response.json({ error: `Code export is available from the ${PLANS.STARTER.name} plan.`, code: "PLAN" }, { status: 403 });
  const project = await db.project.findFirst({ where: { id, userId: user.id } });
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const zip = new JSZip();
  zip.file("index.html", project.html);
  zip.file(
    "README.md",
    `# ${project.name}\n\nExported from IDÆVIA Build.\n\n- Open \`index.html\` in a browser, or deploy the folder to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages).\n- The page uses Tailwind CSS via CDN and Google Fonts; no build step required.\n`,
  );
  zip.file("vercel.json", JSON.stringify({ cleanUrls: true }, null, 2));
  const buf = await zip.generateAsync({ type: "arraybuffer" });
  return new Response(buf, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${project.slug}.zip"`,
    },
  });
}
