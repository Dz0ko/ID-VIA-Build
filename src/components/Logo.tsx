import Link from "next/link";

export function Symbol({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center bg-paper text-void font-semibold relative shrink-0"
      style={{ width: size, height: size, borderRadius: size * 0.225, fontSize: size * 0.5, letterSpacing: "-0.04em" }}
      aria-hidden
    >
      Æ
      <span
        className="absolute bg-signal rounded-full"
        style={{ width: size * 0.18, height: size * 0.18, right: size * 0.08, bottom: size * 0.08 }}
      />
    </span>
  );
}

export function Logo({ href = "/", size = 28, tag = true }: { href?: string; size?: number; tag?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-3 select-none">
      <Symbol size={size} />
      <span className="wordmark text-paper" style={{ fontSize: size * 0.5 }}>
        IDÆVIA
      </span>
      {tag && <span className="build-tag bg-paper text-void hidden sm:inline-block">Build</span>}
    </Link>
  );
}
