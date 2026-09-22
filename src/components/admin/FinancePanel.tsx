import { ReconcilePaymentsButton } from "./ReconcilePaymentsButton";
import Link from "next/link";
import type { FinanceStats } from "@/lib/finance";
import { ExpenseForm } from "./ExpenseForm";
const usd = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);

export function FinancePanel({ stats: s, compact = false }: { stats: FinanceStats; compact?: boolean }) {
  return <section className="space-y-5">
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div><h2 className="text-xl font-semibold">Revenue & profit</h2><p className="text-xs text-ash mt-1">{s.period === "all" ? "All time" : "Last 30 days"} · {s.payments} verified payments · USD</p></div>
      <div className="flex gap-2"><Link href="/admin/payments?period=all" className="btn btn-outline btn-sm">All time</Link><Link href="/admin/payments?period=30d" className="btn btn-outline btn-sm">Last 30 days</Link></div>
    </div>
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className="card p-5"><div className="label">Gross revenue</div><div className="mt-2 text-3xl font-semibold">{usd(s.grossCents)}</div><p className="text-xs text-ash mt-2">Actual plan, credit pack and marketplace sales. Excludes tax and buyer fees.</p></div>
      <div className="card p-5"><div className="label">AI cost · estimated</div><div className="mt-2 text-3xl font-semibold">{usd(s.aiCostCents)}</div><p className="text-xs text-ash mt-2">Recorded provider usage × configured rates, including recorded failed runs.</p></div>
      <div className="card p-5"><div className="label">Referral & affiliate</div><div className="mt-2 text-3xl font-semibold">{usd(s.referralCents + s.affiliateCents)}</div><p className="text-xs text-ash mt-2">Earned commissions, both pending and paid. Deducted once.</p></div>
      <div className="card p-5 border-signal/40 bg-signal/5"><div className="label">Net profit · estimated</div><div className="mt-2 text-3xl font-semibold text-signal-soft">{usd(s.netCents)}</div><p className="text-xs text-ash mt-2">{s.marginPct === null ? "No revenue yet" : `${s.marginPct.toFixed(1)}% margin`} · after recorded costs</p></div>
    </div>
    {!compact && <>
      <div className="card p-5 grid lg:grid-cols-2 gap-6">
        <div><h3 className="text-sm font-medium mb-3">Where the money goes</h3><dl className="space-y-2 text-sm">
          {[["Gross revenue", s.grossCents], ["Refunds / disputed revenue", -s.returnedCents], ["Payment processing fees (reported)", -s.feeCents], ["Marketplace seller earnings", -s.sellerCents], ["Referral rewards · 5%", -s.referralCents], ["Partner affiliate commissions", -s.affiliateCents], ["AI usage cost (estimated)", -s.aiCostCents], ["Other recorded expenses", -s.expensesCents], ["Net profit (estimated)", s.netCents]].map(([label, amount]) => <div key={label} className="flex justify-between gap-4"><dt className="text-ash">{label}</dt><dd className="font-mono">{usd(Number(amount))}</dd></div>)}
        </dl></div>
        <div className="space-y-3 text-xs text-ash leading-relaxed"><h3 className="text-sm font-medium text-paper">Accounting coverage</h3>
          <p>Net = gross − refunds/disputes − payment fees − seller earnings − referral/affiliate commissions − AI cost − recorded expenses. Paying out an earned balance does not deduct it a second time.</p>
          <p>{s.unknownFees ? `${s.unknownFees} payments are missing processor fees. Net is overstated until those fees are reconciled.` : "All recorded payments have fee information."}</p>
          <p>AI costs use configured model prices, not provider invoices. Interrupted requests without returned usage and costs from before tracking may be missing. Add invoice differences, hosting, taxes and payout fees below.</p>
          <p>Revenue and costs are grouped by their own dates; unused credits can create future costs. The 30-day view is activity-based, not a deferred-revenue accounting statement.</p>
          {s.legacyEvents > 0 && <><p className="text-warning">{s.legacyEvents} legacy payment events require reconciliation before all-time totals can be treated as complete.</p><ReconcilePaymentsButton /></>}
        </div>
      </div>
      <div className="card overflow-hidden"><div className="p-5 border-b border-graphite"><h3 className="text-sm font-medium">Profit by customer</h3><p className="text-xs text-ash mt-1">Customer contribution before shared expenses. Includes free users who incurred AI costs.</p></div><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-ash"><tr>{["Customer", "Gross", "Returned", "AI cost", "Fees", "Seller share", "Commissions", "Net", "Credits used"].map((h) => <th key={h} className="p-3 text-left whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{s.users.map((u) => <tr key={u.id} className="border-t border-graphite"><td className="p-3">{u.email}</td>{[u.grossCents, u.returnedCents, u.aiCostCents, u.feeCents, u.sellerCents, u.referralCents + u.affiliateCents, u.netCents].map((v, i) => <td key={i} className="p-3 font-mono whitespace-nowrap">{usd(v)}{i === 3 && u.unknownFees > 0 ? "*" : ""}</td>)}<td className="p-3 font-mono">{u.credits.toLocaleString()}</td></tr>)}{s.users.length === 0 && <tr><td className="p-5 text-ash" colSpan={9}>No recorded payments or AI usage yet.</td></tr>}</tbody></table></div></div>
      <div className="card p-5 space-y-4"><div><h3 className="text-sm font-medium">Other expenses</h3><p className="text-xs text-ash mt-1">Add only costs not already recorded above. These reduce platform net profit.</p></div><ExpenseForm />
        {s.expenses.map((e) => <div key={e.id} className="flex justify-between gap-4 text-xs border-t border-graphite pt-3"><span className="text-ash">{e.incurredAt.toISOString().slice(0, 10)} · {e.category.replaceAll("_", " ")} · {e.note}</span><span className="font-mono">{usd(e.amountCents)}</span></div>)}
      </div>
    </>}
  </section>;
}
