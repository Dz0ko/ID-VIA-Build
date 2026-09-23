import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";
export type ProjectRelease = { number: number; fingerprint: string; createdAt: string; deployedAt?: string; provider?: string; url?: string };
type Source = { id: string; userId: string; html: string; kind: string; files?: { path: string; content: string }[] };
const key = (id: string) => `project-releases:${id}`;
export async function projectReleases(projectId: string, userId: string): Promise<ProjectRelease[]> {
  if (!await db.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })) throw new Error("Project not found");
  const row = await db.setting.findUnique({ where: { key: key(projectId) } });
  return row ? JSON.parse(row.value).releases : [];
}
/** Called only after the server observes a successful build/publish. Same source keeps its release number. */
export async function recordProjectRelease(source: Source, deployment?: { provider: string; url: string }) {
  const fingerprint = createHash("sha256").update(JSON.stringify({ kind: source.kind, html: source.kind === "app" ? "" : source.html, files: [...(source.kind === "app" ? source.files ?? [] : [])].map(f => ({ path: f.path, content: f.content })).sort((a,b) => a.path.localeCompare(b.path)) })).digest("hex");
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${source.id} AND "userId" = ${source.userId} FOR UPDATE`;
    if (!await tx.project.findFirst({ where: { id: source.id, userId: source.userId }, select: { id: true } })) throw new Error("Project not found");
    const row = await tx.setting.findUnique({ where: { key: key(source.id) } });
    const state: { next: number; releases: ProjectRelease[] } = row ? JSON.parse(row.value) : { next: 1, releases: [] };
    let release = state.releases.find(r => r.fingerprint === fingerprint);
    if (!release) { release = { number: state.next++, fingerprint, createdAt: new Date().toISOString() }; state.releases.unshift(release); }
    if (deployment) Object.assign(release, deployment, { deployedAt: new Date().toISOString() });
    state.releases = state.releases.slice(0, 100);
    await tx.setting.upsert({ where: { key: key(source.id) }, create: { key: key(source.id), value: JSON.stringify(state) }, update: { value: JSON.stringify(state) } });
    return release;
  });
}
