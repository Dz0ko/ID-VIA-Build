export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="h-14 shrink-0 border-b border-graphite px-6 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-sm font-medium truncate">{title}</h1>
        {subtitle && <p className="text-xs text-ash truncate">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
