import { PALETTES, type SiteConfig } from "./engine";

/**
 * Interactive mini-app templates: playable pages (quizzes, polls, countdowns, decision
 * makers, party games) in the spirit of social "playable post" feeds. Each is one
 * self-contained HTML document with Tailwind via CDN and vanilla JS; state lives in
 * localStorage, every page has a share button. Original content, no third-party code.
 */

const HEAD = (title: string, desc: string, accent: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root { --accent: ${accent}; }
  html, body { font-family: Inter, system-ui, sans-serif; }
  h1, h2, h3, .display { font-family: "Space Grotesk", Inter, sans-serif; letter-spacing: -0.02em; }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; min-height: 48px; padding: .75rem 1.25rem; border-radius: 999px; font-weight: 600; transition: transform .2s, box-shadow .2s, background .2s; }
  .btn:hover { transform: translateY(-1px); box-shadow: 0 12px 30px -12px var(--accent); }
  .btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  .btn-accent { background: var(--accent); color: #fff; }
  .btn-ghost { background: rgba(255,255,255,.06); color: #fff; border: 1px solid rgba(255,255,255,.12); }
  .card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1); border-radius: 24px; backdrop-filter: blur(12px); }
  .pop { animation: pop .45s cubic-bezier(.2,.8,.2,1) both; }
  @keyframes pop { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
  .bar { transition: width .8s cubic-bezier(.2,.8,.2,1); }
  @media (prefers-reduced-motion: reduce) { .pop { animation: none; } .bar, .btn { transition: none; } }
</style>
</head>
<body class="min-h-screen bg-[#0a0a0b] text-[#f5f5f7] antialiased">
<div class="fixed inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--accent)_28%,transparent),transparent_70%)]"></div>`;

const SHARE = `<script>
async function shareIt(text){const url=location.href;try{if(navigator.share){await navigator.share({title:document.title,text,url});return}}catch(e){}try{await navigator.clipboard.writeText(text+" "+url);toast("Link copied")}catch(e){toast("Copy the address bar link")}}
function toast(m){const t=document.createElement("div");t.textContent=m;t.className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white text-black text-sm font-medium pop";document.body.appendChild(t);setTimeout(()=>t.remove(),1800)}
</script>`;

const FOOT = `<footer class="mt-14 text-center text-xs text-white/40 pb-8">Made with IDÆVIA Build</footer>
</body>
</html>`;

const base = (over: Partial<SiteConfig> & Pick<SiteConfig, "id" | "name" | "description" | "brand" | "tagline" | "html">): SiteConfig => ({
  category: "Interactive",
  subline: over.description,
  ctaPrimary: "Play",
  ctaSecondary: "Share",
  nav: [],
  palette: PALETTES.dark,
  fontDisplay: "Space Grotesk",
  fontBody: "Inter",
  heroImageSeed: over.id,
  features: [],
  dark: true,
  ...over,
});

export const INTERACTIVE_TEMPLATES: SiteConfig[] = [
  base({
    id: "trivia-quiz",
    name: "Interactive · Trivia quiz",
    description: "Timed 8-question trivia with score, streaks, confetti and a share button. Edit the questions array.",
    brand: "QuickFire Trivia",
    tagline: "How much do you really know?",
    html: `${HEAD("QuickFire Trivia", "Eight questions, fifteen seconds each. Beat your friends.", "#5b5cff")}
<main class="max-w-xl mx-auto px-5 py-10 sm:py-16">
  <header class="text-center">
    <p class="text-[11px] font-mono uppercase tracking-[.18em] text-white/50">QuickFire Trivia</p>
    <h1 class="mt-3 text-4xl sm:text-5xl font-bold">How much do you really know?</h1>
    <p class="mt-3 text-white/60">8 questions · 15 seconds each · share your score</p>
  </header>
  <section id="start" class="card p-8 mt-10 text-center pop">
    <div class="text-6xl">🧠</div>
    <button class="btn btn-accent mt-6 w-full" onclick="start()">Start quiz</button>
    <p id="best" class="mt-4 text-sm text-white/50"></p>
  </section>
  <section id="quiz" class="card p-6 sm:p-8 mt-10 hidden">
    <div class="flex items-center justify-between text-xs text-white/50"><span id="progress">1 / 8</span><span id="streak"></span><span id="timer" class="font-mono text-white">15</span></div>
    <div class="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden"><div id="timebar" class="h-full bg-[var(--accent)] bar" style="width:100%"></div></div>
    <h2 id="q" class="mt-6 text-2xl font-semibold leading-snug"></h2>
    <div id="answers" class="mt-6 grid gap-3"></div>
  </section>
  <section id="result" class="card p-8 mt-10 text-center hidden">
    <div id="emoji" class="text-6xl"></div>
    <h2 class="mt-4 text-3xl font-bold"><span id="score"></span> / 8</h2>
    <p id="verdict" class="mt-2 text-white/60"></p>
    <div class="mt-6 grid gap-3 sm:grid-cols-2">
      <button class="btn btn-accent" onclick="start()">Play again</button>
      <button class="btn btn-ghost" onclick="shareIt('I scored '+document.getElementById('score').textContent+'/8 on QuickFire Trivia. Can you beat me?')">Share score</button>
    </div>
  </section>
</main>
${FOOT.replace("</body>", SHARE + `<script>
const QUESTIONS=[
 {q:"Which planet has the most moons?",a:["Jupiter","Saturn","Uranus","Neptune"],c:1},
 {q:"What year did the first iPhone launch?",a:["2005","2006","2007","2008"],c:2},
 {q:"Which language runs natively in web browsers?",a:["Python","JavaScript","Rust","Go"],c:1},
 {q:"How many strings does a standard guitar have?",a:["4","5","6","7"],c:2},
 {q:"What is the largest ocean on Earth?",a:["Atlantic","Indian","Arctic","Pacific"],c:3},
 {q:"Which gas do plants absorb from the air?",a:["Oxygen","Nitrogen","Carbon dioxide","Helium"],c:2},
 {q:"Who painted the Mona Lisa?",a:["Michelangelo","Raphael","Leonardo da Vinci","Donatello"],c:2},
 {q:"How many bits are in a byte?",a:["4","8","16","32"],c:1},
];
let i=0,score=0,streak=0,t=15,timer=null;
const $=(id)=>document.getElementById(id);
const best=Number(localStorage.getItem("trivia-best")||0); if(best) $("best").textContent="Your best: "+best+"/8";
function start(){i=0;score=0;streak=0;$("start").classList.add("hidden");$("result").classList.add("hidden");$("quiz").classList.remove("hidden");show()}
function show(){const Q=QUESTIONS[i];$("progress").textContent=(i+1)+" / "+QUESTIONS.length;$("streak").textContent=streak>1?"🔥 "+streak+" streak":"";$("q").textContent=Q.q;$("q").classList.add("pop");
 $("answers").innerHTML=Q.a.map((x,k)=>'<button class="btn btn-ghost justify-start text-left" onclick="pick('+k+',this)">'+x+'</button>').join("");
 clearInterval(timer);t=15;$("timer").textContent=t;$("timebar").style.width="100%";timer=setInterval(()=>{t--;$("timer").textContent=t;$("timebar").style.width=(t/15*100)+"%";if(t<=0){clearInterval(timer);pick(-1,null)}},1000)}
function pick(k,btn){clearInterval(timer);const Q=QUESTIONS[i];const ok=k===Q.c;if(ok){score++;streak++}else streak=0;
 [...$("answers").children].forEach((b,idx)=>{b.disabled=true;if(idx===Q.c)b.classList.add("!bg-emerald-500/20","!border-emerald-400");else if(idx===k)b.classList.add("!bg-red-500/20","!border-red-400")});
 setTimeout(()=>{i++;if(i<QUESTIONS.length)show();else finish()},900)}
function finish(){$("quiz").classList.add("hidden");$("result").classList.remove("hidden");$("score").textContent=score;
 const v=score>=7?["🏆","Genius level. Frame this."]:score>=5?["🎯","Solid. A couple more and you're unstoppable."]:score>=3?["🙂","Not bad. One more round?"]:["😅","Everyone starts somewhere. Again?"];
 $("emoji").textContent=v[0];$("verdict").textContent=v[1];
 if(score>best)localStorage.setItem("trivia-best",String(score))}
</script></body>`)}`,
  }),

  base({
    id: "live-poll",
    name: "Interactive · Poll",
    description: "One-question poll with animated results, vote lock per device and share. Edit the options array.",
    brand: "Quick Poll",
    tagline: "Settle it with a vote.",
    html: `${HEAD("Quick Poll", "One question. Vote and see what everyone else thinks.", "#22c55e")}
<main class="max-w-xl mx-auto px-5 py-10 sm:py-16">
  <p class="text-[11px] font-mono uppercase tracking-[.18em] text-white/50 text-center">Quick Poll</p>
  <h1 id="question" class="mt-3 text-3xl sm:text-4xl font-bold text-center">Which is the best time to work?</h1>
  <p class="mt-2 text-center text-white/50 text-sm"><span id="total">0</span> votes</p>
  <section id="options" class="card p-4 sm:p-6 mt-8 grid gap-3"></section>
  <div class="mt-6 flex gap-3 justify-center">
    <button class="btn btn-ghost" onclick="shareIt('Vote in my poll: '+document.getElementById('question').textContent)">Share poll</button>
    <button class="btn btn-ghost" onclick="resetVote()">Change my vote</button>
  </div>
  <p class="mt-6 text-center text-xs text-white/40">Votes are stored on this device. Connect a database (Supabase) from the Database agent to make it live for everyone.</p>
</main>
${FOOT.replace("</body>", SHARE + `<script>
const OPTIONS=["Early morning ☀️","Afternoon 🌤️","Late night 🌙","Whenever the coffee kicks in ☕"];
const KEY="poll-"+location.pathname;
let votes=JSON.parse(localStorage.getItem(KEY+"-votes")||"null")||OPTIONS.map(()=>Math.floor(Math.random()*20+5));
let mine=localStorage.getItem(KEY+"-mine");
const $=(id)=>document.getElementById(id);
function render(){const total=votes.reduce((a,b)=>a+b,0);$("total").textContent=total;
 $("options").innerHTML=OPTIONS.map((o,i)=>{const pct=total?Math.round(votes[i]/total*100):0;const voted=mine!==null;const isMine=String(i)===mine;
 return '<button '+(voted?"disabled":"")+' onclick="vote('+i+')" class="relative overflow-hidden text-left rounded-2xl border '+(isMine?"border-[var(--accent)]":"border-white/10")+' bg-white/[.03] px-5 py-4 '+(voted?"":"hover:border-white/30")+' transition">'+
 (voted?'<div class="absolute inset-y-0 left-0 bar bg-[var(--accent)]/20" style="width:'+pct+'%"></div>':"")+
 '<div class="relative flex items-center justify-between gap-3"><span class="font-medium">'+o+(isMine?' <span class="text-[var(--accent)] text-xs ml-1">your vote</span>':"")+'</span>'+(voted?'<span class="font-mono text-sm text-white/70">'+pct+'%</span>':"")+'</div></button>'}).join("")}
function vote(i){if(mine!==null)return;votes[i]++;mine=String(i);localStorage.setItem(KEY+"-votes",JSON.stringify(votes));localStorage.setItem(KEY+"-mine",mine);render();toast("Vote counted")}
function resetVote(){if(mine===null)return;votes[Number(mine)]=Math.max(0,votes[Number(mine)]-1);mine=null;localStorage.setItem(KEY+"-votes",JSON.stringify(votes));localStorage.removeItem(KEY+"-mine");render()}
render();
</script></body>`)}`,
  }),

  base({
    id: "event-countdown",
    name: "Interactive · Event countdown",
    description: "Countdown to a date with RSVP, add-to-calendar and share. Change the EVENT constant.",
    brand: "Launch Night",
    tagline: "The countdown is on.",
    html: `${HEAD("Launch Night · Countdown", "Join us for the launch. Counting down live.", "#f59e0b")}
<main class="max-w-2xl mx-auto px-5 py-10 sm:py-16 text-center">
  <p class="text-[11px] font-mono uppercase tracking-[.18em] text-white/50">You're invited</p>
  <h1 class="mt-3 text-4xl sm:text-6xl font-bold">Launch Night</h1>
  <p id="when" class="mt-3 text-white/60"></p>
  <section class="card p-6 sm:p-8 mt-10 grid grid-cols-4 gap-3">
    <div><div id="d" class="display text-4xl sm:text-6xl font-bold tabular-nums">00</div><div class="text-xs text-white/50 mt-1">days</div></div>
    <div><div id="h" class="display text-4xl sm:text-6xl font-bold tabular-nums">00</div><div class="text-xs text-white/50 mt-1">hours</div></div>
    <div><div id="m" class="display text-4xl sm:text-6xl font-bold tabular-nums">00</div><div class="text-xs text-white/50 mt-1">minutes</div></div>
    <div><div id="s" class="display text-4xl sm:text-6xl font-bold tabular-nums">00</div><div class="text-xs text-white/50 mt-1">seconds</div></div>
  </section>
  <p id="live" class="hidden mt-6 text-2xl font-semibold text-[var(--accent)] pop">It's happening now 🎉</p>
  <div class="mt-8 grid gap-3 sm:grid-cols-3">
    <button id="rsvp" class="btn btn-accent" onclick="rsvp()">I'm coming</button>
    <a id="cal" class="btn btn-ghost" href="#" download="event.ics">Add to calendar</a>
    <button class="btn btn-ghost" onclick="shareIt('Launch Night is coming. Save the date!')">Share</button>
  </div>
  <p id="count" class="mt-4 text-sm text-white/50"></p>
  <section class="card p-6 mt-10 text-left">
    <h2 class="text-lg font-semibold">What to expect</h2>
    <ul class="mt-3 grid gap-2 text-white/70 text-sm"><li>19:00 · Doors open and drinks</li><li>19:30 · The reveal</li><li>20:15 · Q&amp;A and demos</li><li>21:00 · Afterparty</li></ul>
  </section>
</main>
${FOOT.replace("</body>", SHARE + `<script>
const EVENT={title:"Launch Night",start:new Date(Date.now()+9*864e5).toISOString().slice(0,10)+"T19:00:00",durationHours:3,location:"Online"};
const target=new Date(EVENT.start);const $=(id)=>document.getElementById(id);
$("when").textContent=target.toLocaleString(undefined,{weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"})+" · "+EVENT.location;
function tick(){const diff=target-Date.now();if(diff<=0){$("live").classList.remove("hidden");["d","h","m","s"].forEach(k=>$(k).textContent="00");return}const p=(n)=>String(n).padStart(2,"0");$("d").textContent=p(Math.floor(diff/864e5));$("h").textContent=p(Math.floor(diff/36e5)%24);$("m").textContent=p(Math.floor(diff/6e4)%60);$("s").textContent=p(Math.floor(diff/1e3)%60)}
tick();setInterval(tick,1000);
const KEY="rsvp-"+location.pathname;let n=Number(localStorage.getItem(KEY+"-n")||27);let me=localStorage.getItem(KEY+"-me");
function paint(){$("count").textContent=n+" people are coming"+(me?" · including you":"");$("rsvp").textContent=me?"You're in ✓":"I'm coming"}
function rsvp(){if(me)return;n++;me="1";localStorage.setItem(KEY+"-n",String(n));localStorage.setItem(KEY+"-me","1");paint();toast("See you there!")}
paint();
const fmt=(d)=>d.toISOString().replace(/[-:]/g,"").replace(/\\.\\d{3}/,"");const end=new Date(target.getTime()+EVENT.durationHours*36e5);
$("cal").href="data:text/calendar;charset=utf-8,"+encodeURIComponent("BEGIN:VCALENDAR\\nVERSION:2.0\\nBEGIN:VEVENT\\nDTSTART:"+fmt(target)+"\\nDTEND:"+fmt(end)+"\\nSUMMARY:"+EVENT.title+"\\nLOCATION:"+EVENT.location+"\\nEND:VEVENT\\nEND:VCALENDAR");
</script></body>`)}`,
  }),

  base({
    id: "spin-wheel",
    name: "Interactive · Decision wheel",
    description: "Spin-the-wheel decision maker with editable options, canvas animation and history.",
    brand: "Wheel of Decisions",
    tagline: "Can't decide? Spin.",
    html: `${HEAD("Wheel of Decisions", "Add your options, spin the wheel, let fate decide.", "#ec4899")}
<main class="max-w-xl mx-auto px-5 py-10 sm:py-16 text-center">
  <p class="text-[11px] font-mono uppercase tracking-[.18em] text-white/50">Decision maker</p>
  <h1 class="mt-3 text-4xl sm:text-5xl font-bold">Can't decide? Spin.</h1>
  <div class="relative mx-auto mt-10 w-[300px] h-[300px] sm:w-[360px] sm:h-[360px]">
    <div class="absolute left-1/2 -top-3 -translate-x-1/2 z-10 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-white drop-shadow"></div>
    <canvas id="wheel" width="720" height="720" class="w-full h-full rounded-full shadow-[0_30px_80px_-30px_var(--accent)]"></canvas>
  </div>
  <button id="spin" class="btn btn-accent mt-8 w-full sm:w-auto px-10" onclick="spin()">Spin the wheel</button>
  <p id="result" class="mt-5 text-2xl font-semibold min-h-[2rem]"></p>
  <section class="card p-5 mt-10 text-left">
    <div class="flex items-center justify-between"><h2 class="font-semibold">Options</h2><button class="text-xs text-white/50 hover:text-white" onclick="addOpt()">+ add</button></div>
    <div id="opts" class="mt-3 grid gap-2"></div>
  </section>
  <p id="history" class="mt-6 text-xs text-white/40"></p>
</main>
${FOOT.replace("</body>", SHARE + `<script>
const KEY="wheel-"+location.pathname;let opts=JSON.parse(localStorage.getItem(KEY)||"null")||["Pizza","Sushi","Tacos","Burgers","Ramen","Salad"];
const COLORS=["#ec4899","#8b5cf6","#06b6d4","#22c55e","#f59e0b","#ef4444","#3b82f6","#14b8a6"];
const cv=document.getElementById("wheel"),ctx=cv.getContext("2d");let angle=0,spinning=false;const $=(id)=>document.getElementById(id);
function draw(){const n=opts.length,r=cv.width/2,slice=2*Math.PI/n;ctx.clearRect(0,0,cv.width,cv.height);
 opts.forEach((o,i)=>{ctx.beginPath();ctx.moveTo(r,r);ctx.arc(r,r,r-6,angle+i*slice,angle+(i+1)*slice);ctx.closePath();ctx.fillStyle=COLORS[i%COLORS.length];ctx.fill();ctx.strokeStyle="#0a0a0b";ctx.lineWidth=4;ctx.stroke();
 ctx.save();ctx.translate(r,r);ctx.rotate(angle+(i+.5)*slice);ctx.textAlign="right";ctx.fillStyle="#fff";ctx.font="600 30px Inter, sans-serif";ctx.fillText(o.slice(0,16),r-40,10);ctx.restore()});
 ctx.beginPath();ctx.arc(r,r,34,0,7);ctx.fillStyle="#0a0a0b";ctx.fill()}
function spin(){if(spinning||opts.length<2)return;spinning=true;$("spin").disabled=true;$("result").textContent="";const turns=6+Math.random()*4,target=angle+turns*2*Math.PI,start=performance.now(),dur=4200;
 (function f(t){const p=Math.min(1,(t-start)/dur),e=1-Math.pow(1-p,4);angle=angle+(target-angle)*e*(p<1?0.08:1);if(p<1){draw();requestAnimationFrame(f)}else{angle=target%(2*Math.PI);draw();done()}})(start)}
function done(){const n=opts.length,slice=2*Math.PI/n,pointer=(3*Math.PI/2-angle+2*Math.PI)%(2*Math.PI),i=Math.floor(pointer/slice)%n;const pick=opts[i];$("result").textContent="→ "+pick;$("result").classList.add("pop");
 const h=JSON.parse(localStorage.getItem(KEY+"-h")||"[]");h.unshift(pick);localStorage.setItem(KEY+"-h",JSON.stringify(h.slice(0,8)));hist();spinning=false;$("spin").disabled=false}
function hist(){const h=JSON.parse(localStorage.getItem(KEY+"-h")||"[]");$("history").textContent=h.length?"Recent: "+h.join(" · "):""}
function renderOpts(){$("opts").innerHTML=opts.map((o,i)=>'<div class="flex gap-2"><input value="'+o.replace(/"/g,"&quot;")+'" oninput="opts['+i+']=this.value;save()" class="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"/><button onclick="opts.splice('+i+',1);save();renderOpts()" class="text-white/40 hover:text-white px-2">✕</button></div>').join("")}
function addOpt(){opts.push("Option "+(opts.length+1));save();renderOpts()}
function save(){localStorage.setItem(KEY,JSON.stringify(opts));draw()}
renderOpts();draw();hist();
</script></body>`)}`,
  }),

  base({
    id: "personality-quiz",
    name: "Interactive · Personality quiz",
    description: "“Which … are you?” quiz: 6 questions map to 4 result profiles with shareable verdicts. Edit RESULTS and QUESTIONS.",
    brand: "Which founder are you?",
    tagline: "Six questions. One verdict.",
    html: `${HEAD("Which founder are you?", "Six quick questions reveal your builder type.", "#8b5cf6")}
<main class="max-w-xl mx-auto px-5 py-10 sm:py-16">
  <p class="text-[11px] font-mono uppercase tracking-[.18em] text-white/50 text-center">Personality quiz</p>
  <h1 class="mt-3 text-4xl sm:text-5xl font-bold text-center">Which founder are you?</h1>
  <section id="intro" class="card p-8 mt-10 text-center pop"><div class="text-6xl">🧭</div><p class="mt-4 text-white/60">Six questions, no wrong answers. Find out how you build.</p><button class="btn btn-accent mt-6 w-full" onclick="start()">Find out</button></section>
  <section id="quiz" class="card p-6 sm:p-8 mt-10 hidden">
    <div class="flex gap-1.5" id="dots"></div>
    <h2 id="q" class="mt-6 text-2xl font-semibold leading-snug"></h2>
    <div id="answers" class="mt-6 grid gap-3"></div>
  </section>
  <section id="result" class="card p-8 mt-10 text-center hidden">
    <div id="r-emoji" class="text-6xl"></div>
    <p class="mt-4 text-[11px] font-mono uppercase tracking-[.18em] text-white/50">You are</p>
    <h2 id="r-title" class="mt-1 text-3xl font-bold"></h2>
    <p id="r-text" class="mt-3 text-white/70"></p>
    <div class="mt-6 grid gap-3 sm:grid-cols-2"><button class="btn btn-ghost" onclick="start()">Retake</button><button class="btn btn-accent" onclick="shareIt('I am '+document.getElementById('r-title').textContent+'. Which founder are you?')">Share result</button></div>
  </section>
</main>
${FOOT.replace("</body>", SHARE + `<script>
const RESULTS={visionary:{e:"🔭",t:"The Visionary",x:"You see the finished product before the first line exists. Pair with an operator and nothing stops you."},builder:{e:"🛠️",t:"The Builder",x:"You'd rather ship a rough v1 tonight than plan a perfect v2. Momentum is your superpower."},operator:{e:"📈",t:"The Operator",x:"Systems, numbers, cadence. You turn chaos into a machine that compounds."},storyteller:{e:"🎤",t:"The Storyteller",x:"You make people care. Distribution is never your problem; focus is."}};
const QUESTIONS=[
 {q:"A new idea hits you at midnight. You…",a:[["Sketch the whole product in Notion","visionary"],["Open the editor and build","builder"],["Check if the numbers work","operator"],["Text three friends about it","storyteller"]]},
 {q:"Your favourite part of a launch:",a:[["The roadmap after","visionary"],["Watching it deploy","builder"],["The dashboard on day 2","operator"],["The launch post","storyteller"]]},
 {q:"Pick a tool:",a:[["Whiteboard","visionary"],["Terminal","builder"],["Spreadsheet","operator"],["Camera","storyteller"]]},
 {q:"When something breaks:",a:[["Ask if we needed it at all","visionary"],["Fix it before anyone notices","builder"],["Write a process so it never repeats","operator"],["Turn it into a story","storyteller"]]},
 {q:"Your ideal team size:",a:[["Two co-founders","visionary"],["Just me and the AI agents","builder"],["A small pod with clear roles","operator"],["A community","storyteller"]]},
 {q:"Success in a year looks like:",a:[["A product people describe as obvious","visionary"],["Ten things shipped","builder"],["Profitable and calm","operator"],["Everyone knows the name","storyteller"]]},
];
let i=0,tally={};const $=(id)=>document.getElementById(id);
function start(){i=0;tally={};$("intro").classList.add("hidden");$("result").classList.add("hidden");$("quiz").classList.remove("hidden");show()}
function show(){$("dots").innerHTML=QUESTIONS.map((_,k)=>'<span class="h-1.5 flex-1 rounded-full '+(k<=i?"bg-[var(--accent)]":"bg-white/10")+'"></span>').join("");$("q").textContent=QUESTIONS[i].q;
 $("answers").innerHTML=QUESTIONS[i].a.map((x,k)=>'<button class="btn btn-ghost justify-start text-left" onclick="pick('+k+')">'+x[0]+'</button>').join("")}
function pick(k){const key=QUESTIONS[i].a[k][1];tally[key]=(tally[key]||0)+1;i++;if(i<QUESTIONS.length)show();else finish()}
function finish(){const best=Object.entries(tally).sort((a,b)=>b[1]-a[1])[0][0],r=RESULTS[best];$("quiz").classList.add("hidden");$("result").classList.remove("hidden");$("r-emoji").textContent=r.e;$("r-title").textContent=r.t;$("r-text").textContent=r.x}
</script></body>`)}`,
  }),

  base({
    id: "would-you-rather",
    name: "Interactive · Would you rather",
    description: "Endless “would you rather” with live percentages and a streak. Edit the PAIRS array.",
    brand: "Would you rather",
    tagline: "Pick one. See what everyone else picked.",
    html: `${HEAD("Would you rather", "Impossible choices, instant results.", "#06b6d4")}
<main class="max-w-2xl mx-auto px-5 py-10 sm:py-16 text-center">
  <p class="text-[11px] font-mono uppercase tracking-[.18em] text-white/50">Would you rather…</p>
  <div id="pair" class="mt-8 grid sm:grid-cols-2 gap-4"></div>
  <div class="mt-6 flex items-center justify-center gap-3">
    <button id="next" class="btn btn-accent hidden" onclick="next()">Next</button>
    <button class="btn btn-ghost" onclick="shareIt('Would you rather… play with me:')">Share</button>
  </div>
  <p id="meta" class="mt-6 text-sm text-white/50"></p>
</main>
${FOOT.replace("</body>", SHARE + `<script>
const PAIRS=[["Never use social media again","Never watch a movie again"],["Be able to fly","Be invisible"],["Always be 10 minutes late","Always be 20 minutes early"],["Have unlimited coffee","Have unlimited sleep"],["Work 4 days a week for less","Work 5 days for more"],["Live in a city forever","Live by the sea forever"],["Know every language","Play every instrument"],["Have a rewind button","Have a pause button"]];
const KEY="wyr-"+location.pathname;let i=Number(localStorage.getItem(KEY+"-i")||0)%PAIRS.length,answered=0;const $=(id)=>document.getElementById(id);
function votes(k){const v=JSON.parse(localStorage.getItem(KEY+"-v-"+k)||"null")||[Math.floor(Math.random()*60+20),Math.floor(Math.random()*60+20)];return v}
function render(){const p=PAIRS[i];$("pair").innerHTML=p.map((t,k)=>'<button onclick="pick('+k+')" class="card p-8 sm:p-10 text-xl font-semibold hover:border-[var(--accent)] transition min-h-[160px] flex items-center justify-center pop">'+t+'</button>').join("");$("next").classList.add("hidden");$("meta").textContent="Round "+(i+1)+" of "+PAIRS.length+(answered?" · "+answered+" answered":"")}
function pick(k){const v=votes(i);v[k]++;localStorage.setItem(KEY+"-v-"+i,JSON.stringify(v));const total=v[0]+v[1];answered++;
 [...$("pair").children].forEach((b,idx)=>{const pct=Math.round(v[idx]/total*100);b.disabled=true;b.classList.add("relative","overflow-hidden");b.innerHTML='<div class="absolute inset-y-0 left-0 bar bg-[var(--accent)]/20" style="width:'+pct+'%"></div><div class="relative">'+PAIRS[i][idx]+'<div class="mt-2 text-3xl font-bold">'+pct+'%</div></div>';if(idx===k)b.classList.add("border-[var(--accent)]")});
 $("next").classList.remove("hidden")}
function next(){i=(i+1)%PAIRS.length;localStorage.setItem(KEY+"-i",String(i));render()}
render();
</script></body>`)}`,
  }),

  base({
    id: "party-cards",
    name: "Interactive · Party game cards",
    description: "Truth-or-dare style card deck with categories, swipe/next and a player rotation. Edit the DECK.",
    brand: "Party Deck",
    tagline: "Tap for a card. Pass the phone.",
    html: `${HEAD("Party Deck", "Truth, dare or challenge. Pass the phone.", "#f97316")}
<main class="max-w-md mx-auto px-5 py-10 sm:py-16 text-center">
  <p class="text-[11px] font-mono uppercase tracking-[.18em] text-white/50">Party Deck</p>
  <h1 class="mt-3 text-4xl font-bold">Tap for a card. Pass the phone.</h1>
  <div class="mt-6 flex justify-center gap-2" id="cats"></div>
  <section class="card p-8 mt-8 min-h-[260px] flex flex-col items-center justify-center" id="card">
    <p class="text-white/50 text-sm">Add players, then tap Draw.</p>
  </section>
  <div class="mt-6 grid gap-3 sm:grid-cols-2"><button class="btn btn-accent" onclick="draw()">Draw a card</button><button class="btn btn-ghost" onclick="shareIt('Play Party Deck with us')">Share</button></div>
  <section class="card p-5 mt-8 text-left">
    <div class="flex items-center justify-between"><h2 class="font-semibold">Players</h2><button class="text-xs text-white/50 hover:text-white" onclick="addPlayer()">+ add</button></div>
    <div id="players" class="mt-3 flex flex-wrap gap-2"></div>
  </section>
</main>
${FOOT.replace("</body>", SHARE + `<script>
const DECK={Truth:["What's the last thing you googled?","Describe your worst haircut.","What's a habit you'd never admit at work?","Which app do you open first every morning?","What's the most useless skill you have?"],Dare:["Speak in an accent until your next turn.","Show the last photo on your phone.","Let the group write your next status.","Do your best robot for 15 seconds.","Swap seats with the person on your left."],Challenge:["Name 5 countries starting with S in 10 seconds.","Hum a song until someone guesses it.","Hold a plank while the next two cards are drawn.","Say the alphabet backwards.","Balance something on your head for a full turn."]};
const KEY="party-"+location.pathname;let cat="Truth",players=JSON.parse(localStorage.getItem(KEY)||"[]"),turn=Number(localStorage.getItem(KEY+"-t")||0);const $=(id)=>document.getElementById(id);
function cats(){$("cats").innerHTML=Object.keys(DECK).map(c=>'<button onclick="cat=\\''+c+'\\';cats()" class="px-4 py-1.5 rounded-full text-sm border '+(cat===c?"border-[var(--accent)] text-white":"border-white/10 text-white/60")+'">'+c+'</button>').join("")}
function renderPlayers(){$("players").innerHTML=players.map((p,i)=>'<span class="pill inline-flex items-center gap-2 px-3 py-1.5 rounded-full border '+(i===turn%Math.max(players.length,1)?"border-[var(--accent)]":"border-white/10")+' text-sm">'+p+'<button onclick="players.splice('+i+',1);save()" class="text-white/40">✕</button></span>').join("")||'<span class="text-xs text-white/40">No players yet</span>'}
function addPlayer(){const n=prompt("Player name");if(!n)return;players.push(n.trim().slice(0,20));save()}
function save(){localStorage.setItem(KEY,JSON.stringify(players));renderPlayers()}
function draw(){const list=DECK[cat],card=list[Math.floor(Math.random()*list.length)],who=players.length?players[turn%players.length]:"Someone";turn++;localStorage.setItem(KEY+"-t",String(turn));renderPlayers();
 $("card").innerHTML='<p class="text-[11px] font-mono uppercase tracking-[.18em] text-[var(--accent)]">'+cat+' · '+who+'</p><p class="mt-4 text-2xl font-semibold leading-snug pop">'+card+'</p>';if(navigator.vibrate)navigator.vibrate(30)}
cats();renderPlayers();
</script></body>`)}`,
  }),
];
