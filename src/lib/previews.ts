/**
 * Self-contained HTML demos for the Components and Effects libraries.
 * Each preview is rendered in a sandboxed iframe (srcDoc) so users see the
 * real thing (including hover/scroll/cursor behaviour) before adding it.
 */

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font:13px/1.45 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif;background:#0b0b0d;color:#f2f2f4;overflow:hidden;-webkit-font-smoothing:antialiased}
.wrap{height:100%;display:flex;align-items:center;justify-content:center;padding:14px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:7px 12px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid transparent;cursor:pointer;transition:transform .2s,box-shadow .2s,background .2s}
.btn-p{background:#f2f2f4;color:#0b0b0d}
.btn-s{background:#5b5cff;color:#fff}
.btn-o{border-color:#2a2a30;color:#f2f2f4;background:transparent}
.card{background:#141418;border:1px solid #232329;border-radius:12px;padding:12px}
.muted{color:#8b8b93}
.pill{display:inline-block;padding:2px 8px;border-radius:999px;border:1px solid #2a2a30;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#8b8b93}
h1{font-size:20px;line-height:1.15;letter-spacing:-.02em;font-weight:700}
h3{font-size:12px;font-weight:600}
.grid{display:grid;gap:8px}
.avatar{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#5b5cff,#f5c04a)}
.img{background:linear-gradient(135deg,#1c1c22,#2a2a34);border-radius:8px;position:relative;overflow:hidden}
.img::after{content:"";position:absolute;inset:0;background:radial-gradient(60% 60% at 30% 20%,rgba(91,92,255,.45),transparent 70%)}
input,textarea{width:100%;background:#0b0b0d;border:1px solid #2a2a30;border-radius:8px;padding:6px 8px;color:#f2f2f4;font:inherit;font-size:11px}
`;

function doc(body: string, css = "", js = "") {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${BASE_CSS}${css}</style></head><body>${body}${js ? `<script>${js}</script>` : ""}</body></html>`;
}

const COMPONENT_PREVIEWS: Record<string, string> = {
  navbar: doc(
    `<div style="height:100%;background:linear-gradient(#0b0b0d,#111116)">
      <nav style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #232329;background:rgba(11,11,13,.7);backdrop-filter:blur(8px)">
        <div style="display:flex;align-items:center;gap:6px;font-weight:700"><span style="width:18px;height:18px;border-radius:5px;background:#f2f2f4;color:#0b0b0d;display:grid;place-items:center;font-size:10px">Æ</span>Nimbus</div>
        <div class="muted" style="display:flex;gap:10px;font-size:10px"><span>Product</span><span>Pricing</span><span>Docs</span></div>
        <div style="display:flex;gap:6px"><span class="btn btn-p" style="padding:5px 10px;font-size:10px;white-space:nowrap">Get started</span></div>
      </nav>
      <div style="padding:22px 14px"><div class="muted" style="font-size:10px">Sticky, blurred, with a working mobile menu.</div></div>
    </div>`,
  ),
  hero: doc(
    `<div class="wrap" style="text-align:center;flex-direction:column;gap:10px;background:radial-gradient(60% 50% at 50% 0%,rgba(91,92,255,.25),transparent 70%)">
      <span class="pill">New · v2.0</span>
      <h1>Ship your product<br><span style="background:linear-gradient(90deg,#9b9cff,#f5c04a);-webkit-background-clip:text;color:transparent">ten times faster</span></h1>
      <p class="muted" style="max-width:260px;font-size:11px">One workspace to plan, build and launch. No credit card required.</p>
      <div style="display:flex;gap:6px"><span class="btn btn-s">Start free</span><span class="btn btn-o">See demo</span></div>
    </div>`,
  ),
  logos: doc(
    `<div class="wrap" style="flex-direction:column;gap:10px"><div class="muted" style="font-size:10px;letter-spacing:.1em;text-transform:uppercase">Trusted by</div>
      <div style="overflow:hidden;width:100%;mask:linear-gradient(90deg,transparent,#000 15%,#000 85%,transparent)"><div class="track">${["Vertex","Orbit","Northform","Lumen","Keystone","Forge","Vertex","Orbit","Northform","Lumen","Keystone","Forge"].map((n) => `<span>${n}</span>`).join("")}</div></div></div>`,
    `.track{display:flex;gap:28px;width:max-content;animation:m 14s linear infinite;font-weight:700;font-size:14px;color:#8b8b93;letter-spacing:-.01em}@keyframes m{to{transform:translateX(-50%)}}`,
  ),
  features: doc(
    `<div class="wrap"><div class="grid" style="grid-template-columns:repeat(3,1fr);width:100%;gap:6px">${["Realtime sync","Role-based access","Audit log","API & webhooks","SSO","Exports"].map((t, i) => `<div class="card" style="padding:8px;display:flex;align-items:center;gap:7px"><div style="width:20px;height:20px;border-radius:6px;background:rgba(91,92,255,.2);color:#9b9cff;display:grid;place-items:center;font-size:9px;flex-shrink:0">0${i + 1}</div><h3 style="font-size:10px;line-height:1.2">${t}</h3></div>`).join("")}</div></div>`,
  ),
  pricing: doc(
    `<div class="wrap"><div class="grid" style="grid-template-columns:repeat(3,1fr);width:100%;align-items:end">${[["Starter","$19",""],["Pro","$49","1px solid #5b5cff"],["Team","$99",""]].map(([n, p, b]) => `<div class="card" style="padding:10px;${b ? `border:${b};transform:translateY(-4px)` : ""}"><div style="display:flex;justify-content:space-between;align-items:center"><h3>${n}</h3>${b ? '<span class="pill" style="border-color:#5b5cff;color:#9b9cff">Popular</span>' : ""}</div><div style="font-size:20px;font-weight:700;margin:6px 0 2px">${p}<span class="muted" style="font-size:9px;font-weight:400">/mo</span></div><div class="muted" style="font-size:9px;line-height:1.7">✓ Unlimited projects<br>✓ Priority support</div><span class="btn ${b ? "btn-s" : "btn-o"}" style="width:100%;margin-top:8px;padding:5px">Choose</span></div>`).join("")}</div></div>`,
  ),
  testimonials: doc(
    `<div class="wrap"><div class="grid" style="grid-template-columns:repeat(3,1fr);width:100%">${["“Cut our launch time in half.”","“The best tool we adopted this year.”","“Our clients love the previews.”"].map((q, i) => `<div class="card" style="padding:10px"><div style="color:#f5c04a;font-size:10px;letter-spacing:1px">★★★★★</div><p style="font-size:11px;margin:6px 0 8px">${q}</p><div style="display:flex;align-items:center;gap:6px"><span class="avatar"></span><div><div style="font-size:10px;font-weight:600">${["Mila K.","Jon R.","Ana D."][i]}</div><div class="muted" style="font-size:9px">${["Founder, Orbit","CTO, Vertex","Design lead"][i]}</div></div></div></div>`).join("")}</div></div>`,
  ),
  faq: doc(
    `<div class="wrap"><div style="width:100%;max-width:320px">${["Can I cancel any time?","Do you offer refunds?","Is there a free plan?"].map((q, i) => `<details ${i === 0 ? "open" : ""}><summary>${q}<span>+</span></summary><p class="muted" style="font-size:10px;padding:0 0 8px">Yes. Everything is month to month and you keep what you built.</p></details>`).join("")}</div></div>`,
    `details{border-bottom:1px solid #232329}summary{list-style:none;display:flex;justify-content:space-between;align-items:center;padding:8px 0;font-size:11px;font-weight:600;cursor:pointer}summary span{color:#8b8b93;transition:transform .2s}details[open] summary span{transform:rotate(45deg)}`,
  ),
  cta: doc(
    `<div class="wrap"><div style="width:100%;border-radius:14px;padding:22px 16px;text-align:center;background:linear-gradient(120deg,#5b5cff,#2d2ea8 45%,#f5c04a);position:relative;overflow:hidden"><div style="position:absolute;inset:0;background:radial-gradient(60% 80% at 80% 0%,rgba(255,255,255,.25),transparent 60%)"></div><h1 style="font-size:17px;position:relative">Ready to launch?</h1><p style="font-size:10px;opacity:.85;position:relative;margin:4px 0 10px">Join 12,000 teams shipping with Nimbus.</p><span class="btn btn-p" style="position:relative">Start building free</span></div></div>`,
  ),
  contact: doc(
    `<div class="wrap"><div class="grid" style="grid-template-columns:1.2fr 1fr;width:100%;gap:12px"><div class="card" style="display:grid;gap:6px"><input placeholder="Name"><input placeholder="Email"><textarea rows="2" placeholder="Message"></textarea><span class="btn btn-s" style="padding:5px">Send message</span></div><div style="font-size:10px;line-height:1.8"><h3>Nimbus HQ</h3><div class="muted">hello@nimbus.app<br>+1 (555) 010-2030<br>Mon–Fri, 9–18</div></div></div></div>`,
  ),
  footer: doc(
    `<div style="height:100%;display:flex;flex-direction:column;justify-content:flex-end"><div style="border-top:1px solid #232329;padding:14px;display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr;gap:10px;font-size:9px"><div><div style="font-weight:700;font-size:11px;margin-bottom:6px">Nimbus</div><input placeholder="Newsletter email" style="font-size:9px;padding:4px 6px"></div>${["Product","Company","Legal"].map((h) => `<div><div style="font-weight:600;margin-bottom:4px">${h}</div><div class="muted" style="line-height:1.9">Overview<br>Pricing<br>Changelog</div></div>`).join("")}</div><div class="muted" style="padding:6px 14px 10px;font-size:9px;display:flex;justify-content:space-between"><span>© 2026 Nimbus</span><span>𝕏 · in · gh</span></div></div>`,
  ),
  stats: doc(
    `<div class="wrap"><div class="grid" style="grid-template-columns:repeat(4,1fr);width:100%;text-align:center">${[["12,400","Teams"],["98.9%","Uptime"],["4.9","Rating"],["2.1M","Builds"]].map(([v, l]) => `<div><div class="n" data-v="${v}" style="font-size:20px;font-weight:700;letter-spacing:-.02em">0</div><div class="muted" style="font-size:9px;text-transform:uppercase;letter-spacing:.08em">${l}</div></div>`).join("")}</div></div>`,
    "",
    `document.querySelectorAll('.n').forEach(el=>{const t=el.dataset.v;const num=parseFloat(t.replace(/[^0-9.]/g,''));const suffix=t.replace(/[0-9.,]/g,'');const dec=(t.split('.')[1]||'').replace(/[^0-9]/g,'').length;const s=performance.now();const d=1400;function f(n){const p=Math.min(1,(n-s)/d);const e=1-Math.pow(1-p,3);el.textContent=(num*e).toLocaleString(undefined,{maximumFractionDigits:dec,minimumFractionDigits:dec})+suffix;if(p<1)requestAnimationFrame(f)}requestAnimationFrame(f)})`,
  ),
  table: doc(
    `<div class="wrap"><table>${["Order","Customer","Amount","Status"].map((h) => `<th>${h} ↕</th>`).join("")}${[["#1042","Mila K.","$240","Paid","#4ade80"],["#1041","Jon R.","$89","Pending","#fbbf24"],["#1040","Ana D.","$1,200","Paid","#4ade80"],["#1039","Leo M.","$45","Refunded","#f87171"]].map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td><span class="pill" style="color:${r[4]};border-color:${r[4]}55">${r[3]}</span></td></tr>`).join("")}</table></div>`,
    `table{width:100%;border-collapse:collapse;font-size:10px}th{text-align:left;color:#8b8b93;font-weight:500;padding:6px 8px;border-bottom:1px solid #232329;cursor:pointer}td{padding:6px 8px;border-bottom:1px solid #1c1c22}tr:hover td{background:#141418}`,
  ),
  login: doc(
    `<div class="wrap"><div class="card" style="width:220px;display:grid;gap:6px"><h3 style="font-size:13px">Welcome back</h3><div style="display:flex;gap:4px"><span class="btn btn-o" style="flex:1;padding:5px;font-size:9px">Google</span><span class="btn btn-o" style="flex:1;padding:5px;font-size:9px">GitHub</span></div><div class="muted" style="text-align:center;font-size:9px">or</div><input placeholder="Email"><input type="password" placeholder="Password"><span class="btn btn-p" style="padding:6px">Log in</span><div class="muted" style="font-size:9px;text-align:center">No account? <u>Sign up</u></div></div></div>`,
  ),
  modal: doc(
    `<div class="wrap"><span class="btn btn-s" id="o">Open modal</span></div><div id="m" class="ov"><div class="card" style="width:230px"><h3 style="font-size:13px">Delete project?</h3><p class="muted" style="font-size:10px;margin:6px 0 10px">This can't be undone. Type the name to confirm.</p><input placeholder="Project name"><div style="display:flex;gap:6px;justify-content:flex-end;margin-top:10px"><span class="btn btn-o" id="c" style="padding:5px 10px">Cancel</span><span class="btn" style="background:#f87171;color:#fff;padding:5px 10px">Delete</span></div></div></div>`,
    `.ov{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center}.ov.on{display:flex}.ov .card{animation:pop .2s ease-out}@keyframes pop{from{transform:scale(.95);opacity:0}}`,
    `const m=document.getElementById('m');document.getElementById('o').onclick=()=>m.classList.add('on');document.getElementById('c').onclick=()=>m.classList.remove('on');m.onclick=e=>{if(e.target===m)m.classList.remove('on')};document.addEventListener('keydown',e=>{if(e.key==='Escape')m.classList.remove('on')})`,
  ),
};

const HINT = `<div class="muted" style="position:absolute;bottom:8px;left:0;right:0;text-align:center;font-size:9px;pointer-events:none">`;

const EFFECT_PREVIEWS: Record<string, string> = {
  magnetic: doc(
    `<div class="wrap" style="position:relative"><span class="btn btn-s mag" style="padding:10px 18px;font-size:12px">Hover me</span>${HINT}Move the cursor near the button</div></div>`,
    "",
    `const b=document.querySelector('.mag');document.addEventListener('mousemove',e=>{const r=b.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;const dx=e.clientX-cx,dy=e.clientY-cy;const d=Math.hypot(dx,dy);if(d<90){b.style.transform='translate('+dx*.25+'px,'+dy*.25+'px)'}else b.style.transform=''});document.addEventListener('mouseleave',()=>b.style.transform='')`,
  ),
  glow: doc(
    `<div class="wrap" style="gap:10px;position:relative"><div class="card g" style="width:120px"><h3>Card</h3><div class="muted" style="font-size:9px">Hover for glow</div></div><span class="btn btn-s g">Primary</span>${HINT}Hover the card or button</div></div>`,
    `.g{transition:box-shadow .3s,transform .3s}.g:hover{box-shadow:0 0 0 1px rgba(91,92,255,.6),0 14px 40px -10px rgba(91,92,255,.8);transform:translateY(-2px)}`,
  ),
  tilt: doc(
    `<div class="wrap" style="perspective:600px;position:relative"><div class="card t" style="width:160px;transition:transform .15s"><div class="img" style="height:50px;margin-bottom:8px"></div><h3>3D tilt card</h3><div class="muted" style="font-size:9px">Follows the cursor</div></div>${HINT}Move over the card</div></div>`,
    "",
    `const c=document.querySelector('.t');c.onmousemove=e=>{const r=c.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;c.style.transform='rotateY('+x*22+'deg) rotateX('+(-y*22)+'deg) scale(1.03)'};c.onmouseleave=()=>c.style.transform=''`,
  ),
  "border-anim": doc(
    `<div class="wrap" style="position:relative"><div class="ab"><div class="in"><h3>Featured plan</h3><div style="font-size:18px;font-weight:700;margin:4px 0">$49<span class="muted" style="font-size:9px;font-weight:400">/mo</span></div><div class="muted" style="font-size:9px">Hover for the animated border</div></div></div></div>`,
    `@property --a{syntax:'<angle>';inherits:false;initial-value:0deg}.ab{padding:1px;border-radius:13px;background:#232329;transition:background .3s}.ab:hover{background:conic-gradient(from var(--a),#5b5cff,#f5c04a,#5b5cff);animation:spin 2.4s linear infinite}@keyframes spin{to{--a:360deg}}.in{background:#141418;border-radius:12px;padding:12px;width:170px}`,
  ),
  "image-zoom": doc(
    `<div class="wrap" style="gap:8px;position:relative">${[1, 2, 3].map(() => `<div class="z img" style="width:90px;height:90px"><div class="i"></div></div>`).join("")}${HINT}Hover an image</div></div>`,
    `.z{border-radius:10px}.z .i{position:absolute;inset:0;background:linear-gradient(135deg,#2a2a34,#5b5cff88);transition:transform .6s cubic-bezier(.2,.8,.2,1)}.z:hover .i{transform:scale(1.15)}`,
  ),
  "text-reveal": doc(
    `<div class="wrap" style="text-align:center;flex-direction:column;gap:8px"><h1 id="h" style="font-size:22px"></h1><span class="btn btn-o" id="r" style="padding:4px 10px;font-size:10px">Replay</span></div>`,
    `.w{display:inline-block;opacity:0;transform:translateY(14px);animation:up .6s cubic-bezier(.2,.8,.2,1) forwards;margin-right:.25em}@keyframes up{to{opacity:1;transform:none}}`,
    `const h=document.getElementById('h');function go(){h.innerHTML='';'Build anything. Ship everything.'.split(' ').forEach((w,i)=>{const s=document.createElement('span');s.className='w';s.textContent=w;s.style.animationDelay=(i*110)+'ms';h.appendChild(s)})}go();document.getElementById('r').onclick=go`,
  ),
  fade: doc(
    `<div class="sc">${["Hero","Features","Pricing","Testimonials","FAQ","Footer"].map((s) => `<section class="f card">${s} section</section>`).join("")}</div>${HINT.replace("bottom:8px", "bottom:6px")}Scroll inside the preview</div>`,
    `.sc{height:100%;overflow-y:auto;padding:12px;display:grid;gap:10px}.f{height:70px;display:grid;place-items:center;opacity:0;transform:translateY(16px);transition:opacity .6s,transform .6s}.f.in{opacity:1;transform:none}`,
    `const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('in')}),{threshold:.3});document.querySelectorAll('.f').forEach(el=>io.observe(el))`,
  ),
  parallax: doc(
    `<div class="sc" id="s"><div style="height:120px;position:relative;overflow:hidden;border-radius:10px"><div class="img" id="p" style="position:absolute;inset:-40px 0"></div><div style="position:relative;height:100%;display:grid;place-items:center"><h1 style="font-size:16px">Parallax hero</h1></div></div><div class="muted" style="height:260px;padding:12px;font-size:10px">Scroll: the background moves slower than the content.</div></div>`,
    `.sc{height:100%;overflow-y:auto;padding:12px}`,
    `const s=document.getElementById('s'),p=document.getElementById('p');s.onscroll=()=>{p.style.transform='translateY('+s.scrollTop*.4+'px)'}`,
  ),
  sticky: doc(
    `<div class="sc"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start"><div style="position:sticky;top:0;padding:8px 0"><h3>Features pin here</h3><div class="muted" style="font-size:9px" id="l">01 · Realtime</div></div><div style="display:grid;gap:10px">${["Realtime","Access","Audit","Exports"].map((t, i) => `<div class="img st" data-i="0${i + 1} · ${t}" style="height:110px"></div>`).join("")}</div></div></div>`,
    `.sc{height:100%;overflow-y:auto;padding:12px}`,
    `const l=document.getElementById('l');const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)l.textContent=e.target.dataset.i}),{threshold:.6});document.querySelectorAll('.st').forEach(el=>io.observe(el))`,
  ),
  progress: doc(
    `<div class="bar" id="b"></div><div class="sc" id="s"><div class="muted" style="height:520px;padding:12px;font-size:10px">Scroll to fill the bar at the top.</div></div>`,
    `.bar{position:fixed;top:0;left:0;height:3px;width:0;background:linear-gradient(90deg,#5b5cff,#f5c04a);z-index:9}.sc{height:100%;overflow-y:auto}`,
    `const s=document.getElementById('s'),b=document.getElementById('b');s.onscroll=()=>{b.style.width=(s.scrollTop/(s.scrollHeight-s.clientHeight)*100)+'%'}`,
  ),
  cursor: doc(
    `<div class="wrap" style="gap:10px;cursor:none;position:relative"><span class="btn btn-o" style="cursor:none">Link</span><span class="btn btn-s" style="cursor:none">Button</span><div class="dot" id="d"></div><div class="ring" id="r"></div>${HINT}Move the cursor here</div></div>`,
    `.dot{position:fixed;width:6px;height:6px;border-radius:50%;background:#f2f2f4;pointer-events:none;transform:translate(-50%,-50%);z-index:9}.ring{position:fixed;width:28px;height:28px;border-radius:50%;border:1px solid #9b9cff;pointer-events:none;transform:translate(-50%,-50%);transition:width .2s,height .2s,transform .12s;z-index:9}.ring.big{width:44px;height:44px}`,
    `const d=document.getElementById('d'),r=document.getElementById('r');let x=0,y=0,rx=0,ry=0;document.onmousemove=e=>{x=e.clientX;y=e.clientY;d.style.left=x+'px';d.style.top=y+'px';r.classList.toggle('big',!!e.target.closest('.btn'))};(function f(){rx+=(x-rx)*.18;ry+=(y-ry)*.18;r.style.left=rx+'px';r.style.top=ry+'px';requestAnimationFrame(f)})()`,
  ),
  "cursor-glow": doc(
    `<div class="wrap" id="h" style="position:relative;overflow:hidden;background:#0b0b0d"><div class="gl" id="g"></div><h1 style="position:relative;font-size:18px">Spotlight hero</h1>${HINT}Move the cursor</div></div>`,
    `.gl{position:absolute;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(91,92,255,.35),transparent 60%);pointer-events:none;transform:translate(-50%,-50%);left:50%;top:50%;transition:left .08s,top .08s}`,
    `const g=document.getElementById('g');document.getElementById('h').onmousemove=e=>{g.style.left=e.clientX+'px';g.style.top=e.clientY+'px'}`,
  ),
  gradient: doc(
    `<div class="wrap" style="position:relative;overflow:hidden"><div class="mesh"></div><h1 style="position:relative;font-size:18px">Aurora background</h1></div>`,
    `.mesh{position:absolute;inset:-40%;background:radial-gradient(40% 40% at 30% 30%,#5b5cff,transparent 60%),radial-gradient(40% 40% at 70% 60%,#f5c04a,transparent 60%),radial-gradient(35% 35% at 50% 80%,#2dd4bf,transparent 60%);filter:blur(30px);opacity:.55;animation:mv 9s ease-in-out infinite alternate}@keyframes mv{to{transform:rotate(25deg) scale(1.15) translate(6%,-4%)}}`,
  ),
  grid: doc(
    `<div class="wrap" style="position:relative;overflow:hidden"><div class="gr"></div><div class="noise"></div><h1 style="position:relative;font-size:18px">Grid + noise</h1></div>`,
    `.gr{position:absolute;inset:0;background-image:linear-gradient(#ffffff0f 1px,transparent 1px),linear-gradient(90deg,#ffffff0f 1px,transparent 1px);background-size:22px 22px;mask:radial-gradient(70% 70% at 50% 50%,#000,transparent)}.noise{position:absolute;inset:0;opacity:.12;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E")}`,
  ),
  particles: doc(
    `<canvas id="c" style="position:absolute;inset:0;width:100%;height:100%"></canvas><div class="wrap" style="position:relative"><h1 style="font-size:18px">Particle network</h1></div>`,
    "",
    `const c=document.getElementById('c'),x=c.getContext('2d');let W,H;const P=[];function rs(){W=c.width=c.clientWidth;H=c.height=c.clientHeight}rs();addEventListener('resize',rs);for(let i=0;i<38;i++)P.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5});(function f(){x.clearRect(0,0,W,H);for(const p of P){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1}for(let i=0;i<P.length;i++){for(let j=i+1;j<P.length;j++){const d=Math.hypot(P[i].x-P[j].x,P[i].y-P[j].y);if(d<70){x.strokeStyle='rgba(155,156,255,'+(1-d/70)*.5+')';x.beginPath();x.moveTo(P[i].x,P[i].y);x.lineTo(P[j].x,P[j].y);x.stroke()}}x.fillStyle='#9b9cff';x.beginPath();x.arc(P[i].x,P[i].y,1.6,0,7);x.fill()}requestAnimationFrame(f)})()`,
  ),
  "three-sphere": doc(
    `<div class="wrap" style="position:relative;overflow:hidden"><div class="sph" id="s"></div><h1 style="position:relative;font-size:18px;mix-blend-mode:screen">Glass sphere</h1>${HINT}Reacts to the cursor</div></div>`,
    `.sph{position:absolute;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.9),rgba(155,156,255,.55) 22%,rgba(91,92,255,.35) 50%,rgba(20,20,30,.9) 100%);box-shadow:inset -18px -18px 40px rgba(0,0,0,.6),inset 10px 10px 30px rgba(255,255,255,.15),0 30px 60px -20px rgba(91,92,255,.6);animation:fl 5s ease-in-out infinite;transition:transform .3s}@keyframes fl{50%{translate:0 -8px}}`,
    `const s=document.getElementById('s');document.onmousemove=e=>{const x=(e.clientX/innerWidth-.5)*30,y=(e.clientY/innerHeight-.5)*30;s.style.transform='translate('+x+'px,'+y+'px)'}`,
  ),
};

export function componentPreview(id: string): string | null {
  return COMPONENT_PREVIEWS[id] ?? null;
}

export function effectPreview(id: string): string | null {
  return EFFECT_PREVIEWS[id] ?? null;
}
