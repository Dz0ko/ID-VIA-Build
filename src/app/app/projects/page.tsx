import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { TEMPLATES } from "@/lib/templates";
import { PageHeader } from "@/components/app/PageHeader";
import { NewProject } from "@/components/app/NewProject";
import { ProjectGrid } from "@/components/app/ProjectGrid";

export default async function Projects() {
  const user = await requireUser();
  const projects = await db.project.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, slug: true, status: true, kind: true, description: true, updatedAt: true, publishedAt: true } });
  return (
    <>
      <PageHeader title="Projects" subtitle={`${projects.length} project${projects.length === 1 ? "" : "s"}`}>
        <Suspense><NewProject templates={TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: t.category }))} /></Suspense>
      </PageHeader>
      <div className="flex-1 overflow-y-auto p-6"><ProjectGrid projects={projects} /></div>
    </>
  );
}
