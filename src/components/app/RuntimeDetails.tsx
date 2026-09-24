import type { RuntimeProfile } from "@/lib/runtime-profile";
import type { DeploymentProfile } from "@/lib/deployment-profile";
export function RuntimeDetails({ profile, deployment }: { profile: RuntimeProfile; deployment: DeploymentProfile }) {
  return <details className="border border-graphite rounded-lg text-xs">
    <summary className="cursor-pointer px-4 py-3 text-fog">{profile.label} · {profile.previewPort ? `Web preview :${profile.previewPort}` : "Terminal / native target"} · Runtime & deployment</summary>
    <div className="border-t border-graphite p-4 space-y-3">
      {profile.issue && <p className="text-warning">{profile.issue}</p>}
      <p className="text-ash">Project root: {profile.root} · Required tools: {profile.tools.join(", ") || "Defined by the project"}</p>
      <div><p className="text-ash mb-1">Build / check</p><pre className="whitespace-pre-wrap break-words font-mono text-fog">{profile.build}</pre></div>
      <div><p className="text-ash mb-1">Start</p><pre className="whitespace-pre-wrap break-words font-mono text-fog">{profile.preview}</pre></div>
      <p className="text-ash">{deployment.supported ? `Deployment: Vercel · ${deployment.label}. Connect your hosting account and configure project variables before deploying.` : deployment.reason}</p>
      <p className="text-ash">Custom stacks: .idaevia/runtime.json supports setup, build, start and port. Web servers listen on 0.0.0.0; use port: null for terminal apps. Native SDKs and external services need their own configuration.</p>
    </div>
  </details>;
}
