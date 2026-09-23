/** Tiny markdown renderer: headings, bullets, bold, inline code, paragraphs. */
export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  const flush = () => { if (list.length) { out.push(<ul key={`ul-${out.length}`} className="list-disc pl-5 space-y-1 my-2">{list}</ul>); list = []; } };
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) { list.push(<li key={i}><Inline text={line.replace(/^\s*[-*]\s+/, "")} /></li>); return; }
    flush();
    if (/^#{1,3}\s/.test(line)) { out.push(<div key={i} className="font-medium text-paper mt-3 mb-1">{line.replace(/^#{1,3}\s/, "")}</div>); return; }
    if (/^\d+\.\s/.test(line)) { out.push(<div key={i} className="pl-1"><Inline text={line} /></div>); return; }
    if (!line.trim()) { out.push(<div key={i} className="h-2" />); return; }
    out.push(<p key={i}><Inline text={line} /></p>);
  });
  flush();
  return <>{out}</>;
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return <>{parts.map((p, i) => p.startsWith("**") ? <strong key={i} className="text-paper font-medium">{p.slice(2, -2)}</strong> : p.startsWith("`") ? <code key={i} className="font-mono text-[12px] bg-void px-1 rounded">{p.slice(1, -1)}</code> : <span key={i}>{p}</span>)}</>;
}
