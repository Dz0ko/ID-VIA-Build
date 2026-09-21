/** Offline multi-file React app generator (used when no AI key is configured). */

export function mockReactApp(request: string): { path: string; content: string }[] {
  const title = (request.match(/(?:called|named)\s+["“']?([A-Z][\w ]{1,24})["”']?/)?.[1] ?? "Nimbus").trim();
  const dark = !/\blight\b/i.test(request);
  const accent = /green/i.test(request) ? "emerald" : /blue/i.test(request) ? "sky" : /purple|violet/i.test(request) ? "violet" : "indigo";
  return [
    {
      path: "/App.tsx",
      content: `import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { StatCard } from "./components/StatCard";
import { DataTable } from "./components/DataTable";
import { RevenueChart } from "./components/RevenueChart";
import { stats, rows } from "./lib/data";

export default function App() {
  const [page, setPage] = useState<"overview" | "customers" | "settings">("overview");
  return (
    <div className="min-h-screen flex ${dark ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"}">
      <Sidebar page={page} onChange={setPage} brand="${title}" />
      <main className="flex-1 p-6 md:p-10 space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight capitalize">{page}</h1>
            <p className="text-sm ${dark ? "text-zinc-400" : "text-zinc-500"}">Welcome back, here is what is happening today.</p>
          </div>
          <button className="rounded-full bg-${accent}-500 hover:bg-${accent}-400 text-white px-4 py-2 text-sm font-medium transition">New report</button>
        </header>
        {page === "overview" && (
          <>
            <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((s) => <StatCard key={s.label} {...s} />)}
            </section>
            <RevenueChart />
          </>
        )}
        {(page === "overview" || page === "customers") && <DataTable rows={rows} />}
        {page === "settings" && (
          <section className="rounded-2xl border ${dark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-white"} p-6 max-w-lg space-y-4">
            <h2 className="font-medium">Workspace settings</h2>
            <label className="block text-sm">Workspace name<input defaultValue="${title}" className="mt-1 w-full rounded-lg border ${dark ? "border-zinc-700 bg-zinc-950" : "border-zinc-300 bg-white"} px-3 py-2" /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked /> Email me weekly summaries</label>
            <button className="rounded-full bg-${accent}-500 text-white px-4 py-2 text-sm">Save changes</button>
          </section>
        )}
      </main>
    </div>
  );
}
`,
    },
    {
      path: "/components/Sidebar.tsx",
      content: `import { LayoutDashboard, Users, Settings } from "lucide-react";

type Page = "overview" | "customers" | "settings";
export function Sidebar({ page, onChange, brand }: { page: Page; onChange: (p: Page) => void; brand: string }) {
  const items: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "customers", label: "Customers", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ];
  return (
    <aside className="w-56 shrink-0 border-r ${dark ? "border-zinc-800 bg-zinc-900/60" : "border-zinc-200 bg-white"} p-4 hidden md:block">
      <div className="flex items-center gap-2 font-semibold mb-8"><span className="w-7 h-7 rounded-lg bg-${accent}-500 text-white grid place-items-center text-sm">{brand[0]}</span>{brand}</div>
      <nav className="space-y-1">
        {items.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => onChange(id)} className={"w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition " + (page === id ? "bg-${accent}-500/15 text-${accent}-400" : "${dark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-600 hover:bg-zinc-100"}")}>
            <Icon size={16} />{label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
`,
    },
    {
      path: "/components/StatCard.tsx",
      content: `export function StatCard({ label, value, delta }: { label: string; value: string; delta: string }) {
  const up = delta.startsWith("+");
  return (
    <div className="rounded-2xl border ${dark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-white"} p-5">
      <div className="text-xs uppercase tracking-wider ${dark ? "text-zinc-500" : "text-zinc-500"}">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      <div className={"mt-1 text-xs " + (up ? "text-emerald-400" : "text-rose-400")}>{delta} vs last month</div>
    </div>
  );
}
`,
    },
    {
      path: "/components/RevenueChart.tsx",
      content: `import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { revenue } from "../lib/data";

export function RevenueChart() {
  return (
    <section className="rounded-2xl border ${dark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-white"} p-5">
      <h2 className="text-sm font-medium mb-4">Revenue (last 12 months)</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={revenue}>
            <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
            <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
            <YAxis stroke="#71717a" fontSize={12} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }} />
            <Area type="monotone" dataKey="value" stroke="#6366f1" fill="url(#g)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
`,
    },
    {
      path: "/components/DataTable.tsx",
      content: `import type { Row } from "../lib/data";

export function DataTable({ rows }: { rows: Row[] }) {
  return (
    <section className="rounded-2xl border ${dark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-white"} overflow-hidden">
      <div className="px-5 py-4 border-b ${dark ? "border-zinc-800" : "border-zinc-200"} text-sm font-medium">Recent customers</div>
      <table className="w-full text-sm">
        <thead className="${dark ? "text-zinc-500" : "text-zinc-500"} text-left text-xs uppercase tracking-wider">
          <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Plan</th><th className="px-5 py-3">MRR</th><th className="px-5 py-3">Status</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t ${dark ? "border-zinc-800/80 hover:bg-zinc-800/40" : "border-zinc-100 hover:bg-zinc-50"}">
              <td className="px-5 py-3 font-medium">{r.name}</td>
              <td className="px-5 py-3">{r.plan}</td>
              <td className="px-5 py-3">{r.mrr}</td>
              <td className="px-5 py-3"><span className={"rounded-full px-2 py-0.5 text-xs " + (r.status === "Active" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400")}>{r.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
`,
    },
    {
      path: "/lib/data.ts",
      content: `export const stats = [
  { label: "MRR", value: "$48,200", delta: "+12.4%" },
  { label: "Active customers", value: "1,284", delta: "+3.1%" },
  { label: "Churn", value: "1.9%", delta: "-0.4%" },
  { label: "Trials", value: "212", delta: "+18%" },
];

export type Row = { name: string; plan: string; mrr: string; status: "Active" | "Trial" };
export const rows: Row[] = [
  { name: "Loop Studio", plan: "Growth", mrr: "$490", status: "Active" },
  { name: "Brightside", plan: "Starter", mrr: "$190", status: "Active" },
  { name: "Klar", plan: "Enterprise", mrr: "$2,400", status: "Active" },
  { name: "Fjord", plan: "Growth", mrr: "$490", status: "Trial" },
  { name: "Vela", plan: "Starter", mrr: "$190", status: "Trial" },
];

export const revenue = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((month, i) => ({ month, value: 22000 + i * 2200 + (i % 3) * 1400 }));
`,
    },
  ];
}
