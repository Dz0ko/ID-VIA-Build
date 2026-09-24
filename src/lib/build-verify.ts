import "server-only";
import { Sandbox } from "e2b";
import { runtimeResources } from "./runtime-resources";
import { reserveRuntimeCapacity } from "./runtime-capacity";
import { preparePreviewEnvironment } from "./preview-environment";
import { fileBytes } from "./file-content";
import { runtimePath } from "./runtime-command";
import { runtimeProfile } from "./runtime-profile";
import { redactRuntimeLog } from "./runtime-report";

/**
 * Builds a multi-file project in an isolated VM while the agent is still working, so a compile error is fixed
 * before the change is handed to the user instead of after. One VM serves every round of a run: files are
 * uploaded once and only the changed ones afterwards, and the toolchain install from the first round is reused.
 */
const ROOT = "/home/user/project";
const LIFETIME = 12 * 60_000;
export const VERIFY_BUILD_TIMEOUT_MS = 210_000;

export type VerifyResult = { ok: boolean; log: string; label: string; durationMs: number };
export interface BuildVerifier {
  build(files: { path: string; content: string }[]): Promise<VerifyResult>;
  close(): Promise<void>;
}

export function buildVerificationAvailable(): boolean {
  // The isolated test schema never starts VMs; tests inject a verifier when they want one.
  if (process.env.TEST_DATABASE_SCHEMA) return false;
  return Boolean(process.env.E2B_API_KEY) && process.env.AI_VERIFY_BUILDS !== "off";
}

export async function openBuildVerifier(opts: { projectId: string; userId: string; kind: string; settings: Record<string, string>; signal?: AbortSignal }): Promise<BuildVerifier> {
  const resources = runtimeResources(opts.kind);
  const release = await reserveRuntimeCapacity(opts.userId, `verify:${opts.projectId}`);
  let sandbox: Sandbox;
  try {
    sandbox = await Sandbox.create(resources.template, { timeoutMs: LIFETIME, metadata: { projectId: opts.projectId, purpose: "verify" }, network: { allowPublicTraffic: true } });
  } catch (error) { await release().catch(() => {}); throw error; }
  const secrets = Object.values(opts.settings).filter((v) => v.length >= 4);
  let uploaded = new Map<string, string>();
  let envs: Record<string, string> | null = null;
  const relative = (path: string) => runtimePath(path.replace(/^\/+/, ""));
  return {
    async build(files) {
      const started = Date.now();
      opts.signal?.throwIfAborted();
      const plain = files.map((f) => ({ path: f.path.replace(/^\/+/, ""), content: f.content }));
      const profile = runtimeProfile(plain);
      if (profile.issue) return { ok: false, log: profile.issue, label: profile.label, durationMs: 0 };
      const changed = plain.filter((f) => uploaded.get(f.path) !== f.content);
      const removed = [...uploaded.keys()].filter((path) => !plain.some((f) => f.path === path));
      plain.forEach((f) => relative(f.path));
      if (changed.length) await sandbox.files.write(changed.map((f) => ({ path: relative(f.path), data: new Uint8Array(fileBytes(f.content)).buffer })));
      for (const path of removed) await sandbox.files.remove(relative(path)).catch(() => {});
      uploaded = new Map(plain.map((f) => [f.path, f.content]));
      if (!envs) {
        envs = await preparePreviewEnvironment(sandbox, plain, opts.settings, resources.memoryMB);
        secrets.push(...Object.values(envs).filter((v) => v.length > 20));
      }
      let log = "";
      const output = (line: string) => { log = (log + redactRuntimeLog(line, secrets) + "\n").slice(-40_000); };
      try {
        await sandbox.commands.run(profile.build, { cwd: ROOT, envs, timeoutMs: VERIFY_BUILD_TIMEOUT_MS, onStdout: output, onStderr: output });
        return { ok: true, log, label: profile.label, durationMs: Date.now() - started };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Build failed";
        if (!log.includes(message.slice(0, 80))) output(message);
        return { ok: false, log, label: profile.label, durationMs: Date.now() - started };
      }
    },
    async close() { await sandbox.kill().catch(() => {}); await release().catch(() => {}); },
  };
}

/** The part of a build log the agent needs: the errors, not the install chatter. */
export function buildErrorExcerpt(log: string, max = 14_000): string {
  const lines = log.split("\n");
  const firstError = lines.findIndex((l) => /error|failed|exception|not found|cannot|unexpected|✖|✗/i.test(l));
  const from = firstError > 0 ? Math.max(0, firstError - 5) : Math.max(0, lines.length - 120);
  const excerpt = lines.slice(from).join("\n");
  return excerpt.length > max ? excerpt.slice(-max) : excerpt;
}
