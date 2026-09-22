import { z } from "zod";

export const MIN_PAYOUT_CENTS = 1000; // $10

export const CRYPTO_NETWORKS = [
  { id: "usdt-trc20", label: "USDT · Tron (TRC-20)" },
  { id: "usdt-erc20", label: "USDT · Ethereum (ERC-20)" },
  { id: "usdc-erc20", label: "USDC · Ethereum (ERC-20)" },
  { id: "usdc-polygon", label: "USDC · Polygon" },
  { id: "usdc-solana", label: "USDC · Solana" },
  { id: "btc", label: "Bitcoin (BTC)" },
  { id: "eth", label: "Ethereum (ETH)" },
] as const;

export const payoutDetailsSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("crypto"),
    network: z.enum(CRYPTO_NETWORKS.map((n) => n.id) as [string, ...string[]]),
    address: z.string().trim().min(20).max(120).regex(/^[A-Za-z0-9]+$/, "Wallet address may only contain letters and digits"),
  }),
  z.object({
    method: z.literal("paypal"),
    email: z.string().trim().email().max(120),
  }),
]);

export type PayoutDetails = z.infer<typeof payoutDetailsSchema>;

export function parsePayoutDetails(method: string | null, raw: string | null): PayoutDetails | null {
  if (!method || !raw) return null;
  try {
    const r = payoutDetailsSchema.safeParse({ method, ...JSON.parse(raw) });
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function describePayout(d: PayoutDetails | null) {
  if (!d) return "Not set";
  if (d.method === "paypal") return `PayPal · ${d.email}`;
  const net = CRYPTO_NETWORKS.find((n) => n.id === d.network)?.label ?? d.network;
  return `${net} · ${d.address.slice(0, 6)}…${d.address.slice(-4)}`;
}
