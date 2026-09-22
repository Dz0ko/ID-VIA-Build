import type { FileMap } from "./project-files";

const API = "https://api.github.com";

async function gh<T>(token: string, path: string, init: RequestInit & { json?: unknown } = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "idaevia-build", "X-GitHub-Api-Version": "2022-11-28", ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    signal: AbortSignal.timeout(30000),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

export interface PushResult { owner: string; repo: string; branch: string; sha: string; url: string; commitUrl: string; created: boolean }

/**
 * Push a file tree to GitHub as one commit (Git Data API). Creates the repository when it
 * does not exist. `log` receives human-readable progress lines.
 */
export async function pushToGitHub(opts: { token: string; repo?: string; name: string; description?: string; isPrivate: boolean; message: string; files: FileMap; log: (line: string) => void }): Promise<PushResult> {
  const { token, log } = opts;
  const me = await gh<{ login: string }>(token, "/user");
  if (!me.ok) throw new Error("GitHub token is invalid or expired. Reconnect GitHub in Integrations.");
  const login = me.data.login;

  let owner = login;
  let repo = opts.repo ?? opts.name;
  if (repo.includes("/")) [owner, repo] = repo.split("/", 2);
  repo = repo.replace(/[^A-Za-z0-9._-]/g, "-").replace(/^-+|-+$/g, "") || "idaevia-project";
  log(`→ Repository ${owner}/${repo}`);

  let created = false;
  let info = await gh<{ default_branch?: string; html_url?: string; permissions?: { push?: boolean } }>(token, `/repos/${owner}/${repo}`);
  if (info.status === 404) {
    log(`  Repository not found, creating it (${opts.isPrivate ? "private" : "public"})…`);
    const create = owner === login
      ? await gh<{ default_branch?: string; html_url?: string; message?: string }>(token, "/user/repos", { method: "POST", json: { name: repo, description: opts.description?.slice(0, 200) ?? "Built with IDÆVIA Build", private: opts.isPrivate, auto_init: false } })
      : await gh<{ default_branch?: string; html_url?: string; message?: string }>(token, `/orgs/${owner}/repos`, { method: "POST", json: { name: repo, description: opts.description?.slice(0, 200) ?? "Built with IDÆVIA Build", private: opts.isPrivate, auto_init: false } });
    if (!create.ok) throw new Error(`Could not create the repository: ${create.data.message ?? create.status}. If you used a token, it needs "Administration: write" (or the repo scope) to create repos; otherwise create the repo on GitHub first.`);
    created = true;
    info = await gh(token, `/repos/${owner}/${repo}`);
  } else if (!info.ok) {
    throw new Error(`GitHub error ${info.status} reading the repository.`);
  } else if (info.data.permissions && info.data.permissions.push === false) {
    throw new Error(`You do not have push access to ${owner}/${repo}.`);
  }
  const branch = info.data.default_branch || "main";
  const htmlUrl = info.data.html_url ?? `https://github.com/${owner}/${repo}`;

  // Empty repositories have no ref yet: seed them with a first commit through the Contents API.
  let ref = await gh<{ object?: { sha: string } }>(token, `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  if (!ref.ok) {
    log("  Empty repository, creating the first commit…");
    const seed = await gh<{ message?: string }>(token, `/repos/${owner}/${repo}/contents/.idaevia`, { method: "PUT", json: { message: "Initialise repository (IDÆVIA Build)", content: Buffer.from("built-with: idaevia.app\n").toString("base64"), branch } });
    if (!seed.ok) throw new Error(`Could not initialise the repository: ${seed.data.message ?? seed.status}`);
    ref = await gh(token, `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    if (!ref.ok) throw new Error("Could not read the branch after initialising it.");
  }
  const parentSha = ref.data.object!.sha;
  const parentCommit = await gh<{ tree: { sha: string } }>(token, `/repos/${owner}/${repo}/git/commits/${parentSha}`);
  if (!parentCommit.ok) throw new Error("Could not read the latest commit.");

  log(`  Uploading ${opts.files.length} files…`);
  const tree: { path: string; mode: "100644"; type: "blob"; sha: string }[] = [];
  for (const f of opts.files) {
    const blob = await gh<{ sha: string; message?: string }>(token, `/repos/${owner}/${repo}/git/blobs`, { method: "POST", json: { content: Buffer.from(f.content, "utf8").toString("base64"), encoding: "base64" } });
    if (!blob.ok) throw new Error(`Upload failed for ${f.path}: ${blob.data.message ?? blob.status}`);
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.data.sha });
    log(`    + ${f.path} (${(f.content.length / 1024).toFixed(1)} KB)`);
  }
  const newTree = await gh<{ sha: string; message?: string }>(token, `/repos/${owner}/${repo}/git/trees`, { method: "POST", json: { base_tree: parentCommit.data.tree.sha, tree } });
  if (!newTree.ok) throw new Error(`Could not create the tree: ${newTree.data.message ?? newTree.status}`);
  const commit = await gh<{ sha: string; html_url: string; message?: string }>(token, `/repos/${owner}/${repo}/git/commits`, { method: "POST", json: { message: opts.message, tree: newTree.data.sha, parents: [parentSha] } });
  if (!commit.ok) throw new Error(`Could not create the commit: ${commit.data.message ?? commit.status}`);
  const update = await gh<{ message?: string }>(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, { method: "PATCH", json: { sha: commit.data.sha, force: false } });
  if (!update.ok) throw new Error(`Could not update ${branch}: ${update.data.message ?? update.status}`);
  log(`✓ Pushed ${commit.data.sha.slice(0, 7)} to ${owner}/${repo}@${branch}`);
  return { owner, repo, branch, sha: commit.data.sha, url: htmlUrl, commitUrl: commit.data.html_url, created };
}
