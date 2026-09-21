/**
 * IDÆVIA Academy: a short, practical course for people who have never built
 * software. Plain language, no prerequisites, every lesson ends with something
 * to try inside the builder.
 */

export type LessonBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: { title: string; text: string }[] }
  | { type: "compare"; rows: [string, string, string][]; head: [string, string, string] }
  | { type: "tip"; text: string }
  | { type: "code"; lang: string; code: string }
  | { type: "try"; prompt: string; label?: string; agent?: string };

export interface Lesson {
  id: string;
  group: string;
  order: number;
  title: string;
  minutes: number;
  summary: string;
  blocks: LessonBlock[];
}

export const LESSON_GROUPS = ["Start here", "How software is built", "Design", "Tools you will hear about", "Build your first website", "Going further"] as const;

export const LESSONS: Lesson[] = [
  /* ---------------- Start here ---------------- */
  {
    id: "what-is-a-website",
    group: "Start here",
    order: 1,
    title: "What a website actually is",
    minutes: 4,
    summary: "Files, a server, a browser and a domain. That is the whole thing.",
    blocks: [
      { type: "p", text: "A website is a set of files (text, images, code) that live on a computer somewhere on the internet, called a server. When you type an address into your browser, the browser asks that server for the files and draws them on your screen." },
      { type: "h", text: "The four pieces" },
      { type: "list", items: [
        "Files: the HTML (structure), CSS (looks) and JavaScript (behaviour) of your pages.",
        "Server / hosting: the computer that stores the files and hands them out. You rent this from a hosting company (Vercel, Netlify, Cloudflare, IDÆVIA preview links).",
        "Domain: the human-readable address, like nimbus.app. You buy it from a registrar and point it at your hosting.",
        "Browser: Chrome, Safari, Firefox. It downloads the files and renders them.",
      ] },
      { type: "h", text: "Website, web app, SaaS: what is the difference?" },
      { type: "compare", head: ["Type", "What it does", "Example"], rows: [
        ["Website", "Shows information. Mostly the same for everyone.", "A restaurant site, a portfolio, a landing page"],
        ["Web app", "Lets each user do things and stores their data. Needs login.", "Gmail, Notion, a booking dashboard"],
        ["SaaS", "A web app that people pay for monthly. Software as a Service.", "Slack, Figma, IDÆVIA Build"],
      ] },
      { type: "tip", text: "In IDÆVIA a website project is a single page you can publish immediately. An app project has multiple files and a live React sandbox. Start with a website; it is the fastest way to learn." },
      { type: "try", prompt: "Build a simple one-page website for a coffee shop called Lumen: hero with a photo placeholder, menu with 6 items and prices, opening hours, and a contact section. Warm colours.", label: "Build a first page" },
    ],
  },
  {
    id: "frontend-vs-backend",
    group: "Start here",
    order: 2,
    title: "Frontend vs backend",
    minutes: 5,
    summary: "What the user sees versus what happens behind the scenes.",
    blocks: [
      { type: "p", text: "Think of a restaurant. The dining room, the menu and the waiter are the frontend: everything the guest sees and touches. The kitchen, the fridge and the recipes are the backend: where the real work and storage happens. The waiter carrying orders back and forth is the API." },
      { type: "compare", head: ["", "Frontend", "Backend"], rows: [
        ["Runs where", "In the user's browser or phone", "On a server in the cloud"],
        ["Made of", "HTML, CSS, JavaScript, React", "A server language (Node.js, Python, Go) plus a database"],
        ["Responsible for", "Layout, buttons, animations, forms", "Saving data, logins, payments, sending emails"],
        ["You can see it", "Yes, right-click → Inspect", "No, only its results"],
      ] },
      { type: "h", text: "Full-stack" },
      { type: "p", text: "A full-stack developer (or a full-stack tool like IDÆVIA) does both. A static website has almost no backend. A SaaS has a big one. Most of the price difference between a $500 website and a $50,000 app is backend work: accounts, data, security, payments." },
      { type: "tip", text: "When you ask IDÆVIA for “a login” or “save the orders”, the router automatically switches to a stronger model and the Database, Auth and API agents, because that is backend work." },
    ],
  },
  {
    id: "languages",
    group: "Start here",
    order: 3,
    title: "The languages, in one page",
    minutes: 6,
    summary: "HTML, CSS, JavaScript, TypeScript, React, Python, SQL. What each one is for.",
    blocks: [
      { type: "compare", head: ["Language", "What it is for", "One-line example"], rows: [
        ["HTML", "Structure: headings, paragraphs, buttons, images.", "<button>Buy now</button>"],
        ["CSS", "Looks: colours, spacing, fonts, layout, animation.", "button { background: #5b5cff; }"],
        ["JavaScript (JS)", "Behaviour: what happens when you click, scroll, type.", "button.onclick = () => alert('Hi')"],
        ["TypeScript (TS)", "JavaScript with type checking. Catches mistakes before users do.", "const price: number = 49"],
        ["React", "A JavaScript library for building interfaces out of reusable components.", "<PricingCard plan=\"Pro\" />"],
        ["Next.js", "A framework on top of React: pages, routing, server code, deployment.", "app/pricing/page.tsx → /pricing"],
        ["Node.js", "Runs JavaScript on the server instead of the browser.", "The IDÆVIA backend runs on it"],
        ["Python", "General purpose, huge in AI and data. Also used for backends.", "print('hello')"],
        ["SQL", "The language for asking a database questions.", "SELECT * FROM users WHERE plan = 'PRO'"],
      ] },
      { type: "h", text: "Which should you learn?" },
      { type: "p", text: "If you only learn one thing, learn to read HTML and CSS. It lets you understand what IDÆVIA generates and make small edits yourself. JavaScript comes next. You do not need Python or SQL to ship a website." },
      { type: "code", lang: "html", code: `<!-- A complete, valid web page -->\n<!doctype html>\n<html>\n  <head>\n    <title>Lumen Coffee</title>\n    <style>\n      body { font-family: sans-serif; background: #fff7ed; }\n      h1 { color: #7c2d12; }\n    </style>\n  </head>\n  <body>\n    <h1>Lumen Coffee</h1>\n    <p>Open every day, 7:00 to 19:00.</p>\n    <button onclick="alert('See you soon!')">Reserve a table</button>\n  </body>\n</html>` },
      { type: "try", prompt: "Explain, in the code comments, which parts of this page are HTML, which are CSS and which are JavaScript. Then add a second section with three feature cards.", label: "Ask the Builder to annotate" },
    ],
  },

  /* ---------------- How software is built ---------------- */
  {
    id: "project-lifecycle",
    group: "How software is built",
    order: 4,
    title: "How a project goes from idea to live, step by step",
    minutes: 7,
    summary: "The same seven steps every agency follows, and how IDÆVIA's agents map to them.",
    blocks: [
      { type: "steps", items: [
        { title: "1. Discovery", text: "What is the goal? Who is it for? What must it do on day one? Write it in five sentences. This is the brief. (IDÆVIA: the Planner agent turns your prompt into a plan.)" },
        { title: "2. Design", text: "Sketch the pages and the flow before writing code. Wireframes first (boxes, no colour), then visual design. (Designer, UI and UX agents.)" },
        { title: "3. Build the frontend", text: "Turn the design into HTML, CSS and JavaScript. Make it responsive: it must work on phones. (Builder agent.)" },
        { title: "4. Build the backend", text: "Only if needed: accounts, database, payments, emails. (Database, Auth, API, Payments agents.)" },
        { title: "5. Test", text: "Click everything. Try it on a phone. Check speed, accessibility and SEO. (QA, Performance, Accessibility, SEO agents and the Production audit.)" },
        { title: "6. Launch", text: "Buy a domain, connect hosting, publish. (Deploy agent writes your launch guide.)" },
        { title: "7. Iterate", text: "Look at analytics, listen to users, ship small improvements every week. (Analytics and Conversion agents.)" },
      ] },
      { type: "h", text: "Versions" },
      { type: "p", text: "Every change IDÆVIA makes is saved as a version. If something breaks, roll back. Professionals do the same with Git (next lessons)." },
      { type: "tip", text: "Do not skip discovery. Ten minutes writing the brief saves hours of rebuilding. A good prompt is a good brief: audience, goal, sections, style, examples you like." },
    ],
  },
  {
    id: "writing-a-good-prompt",
    group: "How software is built",
    order: 5,
    title: "Writing a brief that gets great results",
    minutes: 5,
    summary: "The five ingredients of a prompt, with before and after examples.",
    blocks: [
      { type: "p", text: "The builder can only be as good as the brief. A weak prompt gives a generic page. A strong one gives something that looks designed for you." },
      { type: "compare", head: ["Ingredient", "Weak", "Strong"], rows: [
        ["Who", "a website", "a website for a dental clinic in Skopje, patients aged 30 to 60"],
        ["Goal", "looks nice", "get people to book an appointment; the booking button must be visible on every screen"],
        ["Sections", "(none)", "hero, services with prices, doctors, reviews, FAQ, booking form, map"],
        ["Style", "modern", "calm, light, lots of white space, teal accent, rounded photos, serif headings"],
        ["References", "(none)", "like the layout of a Stripe landing page, but softer"],
      ] },
      { type: "h", text: "Then iterate in small steps" },
      { type: "list", items: [
        "“Make the hero headline shorter and more confident.”",
        "“Change the accent colour to deep green.”",
        "“Add a sticky booking button on mobile.”",
        "“The reviews section feels empty, add avatars and a rating.”",
      ] },
      { type: "tip", text: "Small edits cost 2 to 5 credits. A whole new page costs about 30. Ask for the full structure once, then refine." },
      { type: "try", prompt: "Build a website for a dental clinic in Skopje for patients aged 30 to 60. Goal: book an appointment; the booking button must be visible on every screen. Sections: hero, services with prices, doctors, reviews, FAQ, booking form, map placeholder. Calm, light style with lots of white space, teal accent, rounded photos, serif headings.", label: "Use the strong prompt" },
    ],
  },
  {
    id: "databases-and-auth",
    group: "How software is built",
    order: 6,
    title: "Databases, accounts and logins",
    minutes: 6,
    summary: "Where data lives, what a table is, and why passwords are never stored as text.",
    blocks: [
      { type: "p", text: "A database is a very organised spreadsheet that many people can read and write at the same time. Each sheet is a table (users, orders, projects). Each row is one record. Each column is one field (email, price, created date)." },
      { type: "compare", head: ["Term", "Plain meaning", "Example"], rows: [
        ["Table", "One kind of thing", "users"],
        ["Row / record", "One instance", "the user ana@example.com"],
        ["Column / field", "One attribute", "plan = PRO"],
        ["Primary key", "The unique ID of a row", "user id cmub…"],
        ["Relation", "A link between tables", "an order belongs to a user"],
        ["Query", "A question to the database", "all orders from last week"],
      ] },
      { type: "h", text: "SQL vs NoSQL" },
      { type: "p", text: "SQL databases (Postgres, MySQL, SQLite) use tables with fixed columns and are the default choice for almost everything. NoSQL databases (MongoDB, Firebase) store flexible documents and suit chat logs or feeds. If in doubt, Postgres." },
      { type: "h", text: "Authentication vs authorisation" },
      { type: "list", items: [
        "Authentication: proving who you are (email + password, Google, GitHub, magic link).",
        "Authorisation: what you are allowed to do (admin vs user, your projects vs mine).",
        "Passwords are never stored. A one-way hash is stored; at login the typed password is hashed again and compared.",
        "A session is a signed cookie that says “this browser is user X” so you do not log in on every click.",
      ] },
      { type: "tip", text: "Never build your own password storage from scratch when a service does it for you: Supabase Auth, Clerk, Auth0 or NextAuth. IDÆVIA's Auth agent wires these up." },
    ],
  },
  {
    id: "apis",
    group: "How software is built",
    order: 7,
    title: "What an API is",
    minutes: 5,
    summary: "The waiter between frontend and backend, and between your app and other companies.",
    blocks: [
      { type: "p", text: "API stands for Application Programming Interface. It is a menu of things one program lets another program ask for. Your frontend asks your backend “give me this user's orders”. Your backend asks Stripe “charge this card” or Anthropic “write this text”. Every request goes over the same HTTP the browser uses." },
      { type: "h", text: "The shape of a request" },
      { type: "code", lang: "http", code: `POST /api/projects/abc123/run\nContent-Type: application/json\nAuthorization: (your session cookie)\n\n{ "request": "Add a pricing section", "agentId": "builder" }\n\n→ 200 OK\n{ "versionNumber": 4, "creditsUsed": 8 }` },
      { type: "list", items: [
        "GET reads. POST creates. PATCH updates. DELETE deletes.",
        "The URL says what. The body says the details. The status code says how it went (200 fine, 401 not logged in, 402 pay, 404 missing, 500 server error).",
        "JSON is the text format for the data: curly braces, keys and values.",
        "An API key is a password for programs. Keep it on the server, never in frontend code.",
      ] },
      { type: "h", text: "Webhooks: the API calling you" },
      { type: "p", text: "A webhook is the reverse direction: when something happens at another company (a payment succeeds at Whop), they send a request to your server. That is how IDÆVIA knows to unlock a plan or a marketplace purchase." },
      { type: "try", prompt: "Add a newsletter signup form that POSTs the email to /api/subscribe and shows a success message. Explain in a comment what the backend endpoint should do.", label: "Wire a form to an API", agent: "api" },
    ],
  },

  /* ---------------- Design ---------------- */
  {
    id: "ui-vs-ux",
    group: "Design",
    order: 8,
    title: "UI vs UX",
    minutes: 5,
    summary: "UI is how it looks. UX is how it feels to use. You need both.",
    blocks: [
      { type: "compare", head: ["", "UI (User Interface)", "UX (User Experience)"], rows: [
        ["Question", "Is it beautiful and consistent?", "Can people do what they came for, fast, without confusion?"],
        ["Deals with", "Colours, type, spacing, icons, buttons", "Flows, hierarchy, copy, feedback, errors, speed"],
        ["Test", "Does it look premium?", "Watch a stranger use it. Where do they hesitate?"],
        ["Example fail", "Inconsistent button styles", "Checkout takes 9 steps and hides the total"],
      ] },
      { type: "h", text: "Ten UX rules that fix most sites" },
      { type: "list", items: [
        "One primary action per screen, visually the loudest thing.",
        "Say what the product does in the first sentence. No slogans.",
        "Every button says what happens next: “Book a table”, not “Submit”.",
        "Forms: as few fields as possible, clear error messages next to the field.",
        "Show progress and feedback: loading states, success messages.",
        "Mobile first. Thumbs, not cursors. 44px tap targets.",
        "Consistency: same thing looks the same everywhere.",
        "Contrast: text must be readable (4.5:1 minimum).",
        "Speed: under 2 seconds to see content.",
        "Never make people think about where they are: clear navigation and page titles.",
      ] },
      { type: "try", prompt: "Review this page for UX problems: primary action clarity, button labels, form friction, mobile tap targets, contrast and navigation. Report the ten most important fixes, ranked.", label: "Run the UX agent", agent: "ux" },
    ],
  },
  {
    id: "design-basics",
    group: "Design",
    order: 9,
    title: "Design basics: layout, type, colour, spacing",
    minutes: 7,
    summary: "The four levers that make something look designed instead of assembled.",
    blocks: [
      { type: "h", text: "1. Layout and hierarchy" },
      { type: "p", text: "The eye should know where to go first, second, third. Size, weight and position create hierarchy. Use a grid (12 columns on desktop) and align everything to it. Group related things close together and separate groups with space, not lines." },
      { type: "h", text: "2. Typography" },
      { type: "list", items: [
        "Two fonts maximum: one for headings, one for body. Or one font, two weights.",
        "A scale: 12, 14, 16, 20, 24, 32, 48, 64. Do not invent sizes.",
        "Line length 45 to 75 characters. Line height 1.5 for body, 1.1 for big headings.",
        "Headings tight (letter-spacing -0.02em), small caps labels loose (+0.1em).",
      ] },
      { type: "h", text: "3. Colour" },
      { type: "list", items: [
        "One neutral scale (5 to 7 greys), one accent, one or two status colours. That is a palette.",
        "60 / 30 / 10: 60% background neutral, 30% secondary, 10% accent for actions.",
        "Dark mode is not inverted light mode. Reduce saturation and use dark grey, not pure black, for surfaces.",
      ] },
      { type: "h", text: "4. Spacing" },
      { type: "p", text: "Use a 4px or 8px system: 4, 8, 12, 16, 24, 32, 48, 64, 96. Generous space reads as premium. Cramped reads as cheap. When in doubt, double the padding." },
      { type: "h", text: "The tools" },
      { type: "compare", head: ["Tool", "For", "Note"], rows: [
        ["Figma", "Designing screens and prototypes before code", "Industry standard, free tier"],
        ["Tailwind CSS", "Styling in code with utility classes", "What IDÆVIA generates"],
        ["Google Fonts", "Free fonts", "Inter, Space Grotesk, Playfair, DM Sans"],
        ["Lucide / Heroicons", "Icon sets", "Consistent line icons"],
        ["Coolors / Realtime Colors", "Palettes and contrast checking", ""],
      ] },
      { type: "try", prompt: "Apply a strict design system to this page: 8px spacing scale, a type scale of 14/16/20/24/32/48, one neutral grey scale, one accent, 60/30/10 colour usage. Keep the content, fix the hierarchy.", label: "Let the Designer apply a system", agent: "designer" },
    ],
  },

  /* ---------------- Tools ---------------- */
  {
    id: "git-and-github",
    group: "Tools you will hear about",
    order: 10,
    title: "Git and GitHub",
    minutes: 5,
    summary: "Version control: an unlimited undo history for code, shared with a team.",
    blocks: [
      { type: "p", text: "Git is a program that records snapshots of your files. Each snapshot is a commit with a message (“Add pricing section”). You can go back to any commit, compare them, or work on two ideas in parallel. GitHub is a website that stores Git projects online so teams can collaborate. GitLab and Bitbucket do the same." },
      { type: "compare", head: ["Term", "Meaning", ""], rows: [
        ["Repository (repo)", "One project's folder with its full history", ""],
        ["Commit", "One saved snapshot with a message", ""],
        ["Branch", "A parallel line of work, e.g. new-checkout", ""],
        ["Pull request (PR)", "A request to merge a branch into main, reviewed by others", ""],
        ["Clone / push / pull", "Copy a repo down, send commits up, fetch others' commits", ""],
        ["main", "The branch that is live", ""],
      ] },
      { type: "h", text: "Why you care" },
      { type: "list", items: [
        "Export your IDÆVIA project as a ZIP and push it to GitHub: you now own the code forever.",
        "Hosting services (Vercel, Netlify) deploy automatically every time you push to GitHub.",
        "You can import any public GitHub repo into IDÆVIA from the Import page.",
      ] },
      { type: "code", lang: "bash", code: `# The five commands you will actually use\ngit init                      # start tracking this folder\ngit add .                     # stage all changes\ngit commit -m "First version" # save a snapshot\ngit remote add origin https://github.com/you/site.git\ngit push -u origin main       # upload to GitHub` },
    ],
  },
  {
    id: "supabase-and-backends",
    group: "Tools you will hear about",
    order: 11,
    title: "Supabase, Firebase and “backend as a service”",
    minutes: 5,
    summary: "Rent a ready-made backend instead of building one.",
    blocks: [
      { type: "p", text: "Supabase gives you a Postgres database, user accounts, file storage and an instant API from a dashboard, in minutes, on a free tier. Firebase (Google) is the older equivalent with a NoSQL database. For most small products this replaces weeks of backend work." },
      { type: "compare", head: ["Need", "Supabase gives you", "How"], rows: [
        ["Store data", "Postgres tables", "Create a table in the dashboard, rows appear in your app"],
        ["Login", "Supabase Auth", "Email, Google, GitHub, magic links, with one line of code"],
        ["Files", "Storage buckets", "Upload images and PDFs"],
        ["Security", "Row Level Security", "Rules like “users can only read their own rows”"],
        ["Realtime", "Subscriptions", "Live updates when data changes"],
      ] },
      { type: "h", text: "Other names in the same family" },
      { type: "list", items: [
        "Neon, PlanetScale, Railway: hosted databases.",
        "Clerk, Auth0: logins only.",
        "Stripe, Whop, Lemon Squeezy, Paddle: payments and subscriptions.",
        "Resend, Postmark: sending email.",
        "Cloudflare R2, AWS S3: file storage.",
      ] },
      { type: "tip", text: "IDÆVIA's Deploy agent writes a launch guide that tells you exactly which of these your project needs and how to connect them. Ask for it in the Deploy step." },
    ],
  },
  {
    id: "hosting-and-domains",
    group: "Tools you will hear about",
    order: 12,
    title: "Hosting, domains, DNS, SSL",
    minutes: 5,
    summary: "How a site becomes reachable at your-name.com with the padlock.",
    blocks: [
      { type: "steps", items: [
        { title: "Buy a domain", text: "Namecheap, Cloudflare Registrar, GoDaddy. Around $10 to $15 a year for .com. Pick something short, no hyphens." },
        { title: "Choose hosting", text: "Static websites: Vercel, Netlify, Cloudflare Pages, GitHub Pages (all free tiers). Apps with a backend: Vercel, Railway, Render, Fly.io." },
        { title: "Point the domain at the host", text: "In the registrar's DNS settings add the records the host gives you (usually an A record and a CNAME for www). Propagation takes minutes to a few hours." },
        { title: "SSL / HTTPS", text: "The padlock. Every host above issues a free certificate automatically. Never ship a site on plain http." },
        { title: "Publish", text: "Upload the exported ZIP or connect GitHub. Every push deploys." },
      ] },
      { type: "compare", head: ["Term", "Meaning", ""], rows: [
        ["DNS", "The phone book that turns your-name.com into a server address", ""],
        ["A record", "Domain → IP address", ""],
        ["CNAME", "Domain → another domain (www → main)", ""],
        ["CDN", "Copies of your site around the world for speed (Cloudflare)", ""],
        ["SSL certificate", "Proves the site is yours and encrypts traffic", ""],
      ] },
      { type: "tip", text: "IDÆVIA preview links (idaevia.app/s/your-project) are free hosting for demos and client approval. For a real launch, export and put it on your own domain." },
    ],
  },
  {
    id: "ai-and-agents",
    group: "Tools you will hear about",
    order: 13,
    title: "AI models, tokens, agents and credits",
    minutes: 5,
    summary: "What actually happens when you press Build.",
    blocks: [
      { type: "p", text: "A large language model (LLM) like Claude or GPT is a program that predicts text. Give it a brief plus the current page and it writes the next version of the code. It reads and writes in tokens (roughly three quarters of a word). Providers charge per million tokens, and stronger models cost more." },
      { type: "compare", head: ["Term", "Meaning", "In IDÆVIA"], rows: [
        ["Model", "One trained AI, e.g. Claude Sonnet 5", "Tiers: fast, standard, advanced, premium, frontier"],
        ["Prompt", "The instructions you give", "Your request plus the system prompt of the agent"],
        ["Context", "Everything the model can see at once", "Your page, your project memory, your brief"],
        ["Agent", "A model with a role, a specialised prompt and rules", "30 agents: Builder, Designer, SEO, Debugger…"],
        ["Router", "Picks the model and agent for the job", "Small edits go to fast models, apps go to Opus"],
        ["Credits", "Your usage unit", "Small edit ≈ 5, page ≈ 30, full-stack ≈ 240"],
      ] },
      { type: "h", text: "Getting better results" },
      { type: "list", items: [
        "Be specific (see the brief lesson). Vague in, vague out.",
        "One change per request when refining. It is cheaper and easier to undo.",
        "Attach a screenshot when you want a specific look. Vision costs 1.5× credits but saves rounds.",
        "Use the higher tier for architecture (new app, database), the standard tier for copy and layout.",
      ] },
    ],
  },

  /* ---------------- Build your first website ---------------- */
  {
    id: "first-website",
    group: "Build your first website",
    order: 14,
    title: "Tutorial: launch a real website in 30 minutes",
    minutes: 30,
    summary: "From an empty project to a published preview link, with a client review and a launch guide.",
    blocks: [
      { type: "steps", items: [
        { title: "1. Write the brief (5 min)", text: "Open a note and answer: who is it for, what should they do, which sections, which style, any sites you like. Paste it as your first prompt." },
        { title: "2. Create the project (1 min)", text: "Dashboard → New project → Website. Name it. Paste the brief. Wait for v1 to stream in (about a minute)." },
        { title: "3. Fix the structure first (5 min)", text: "Do not touch colours yet. Reorder or add sections: “Move testimonials above pricing”, “Add an FAQ with 6 questions”. Structure changes are cheap while the page is young." },
        { title: "4. Copy and tone (5 min)", text: "Switch to the Copywriter agent (or just ask; Auto mode picks it). “Rewrite the hero for busy parents, warmer tone, shorter.”" },
        { title: "5. Design pass (5 min)", text: "Designer agent: “Apply an 8px spacing scale and a calm teal palette, rounded photos, more white space.” Then Animation: “Add fade-in on scroll and a soft hover on cards.”" },
        { title: "6. Production audit (3 min)", text: "Run the audit. It checks performance, SEO, accessibility, security and mobile. Press “Fix everything” to let the Debugger apply the fixes." },
        { title: "7. Client review (2 min)", text: "Share → create a client link. Send it. They can comment and approve without an account. Feedback shows up in your Builder." },
        { title: "8. Publish (1 min)", text: "Publish a preview link on idaevia.app, or Export ZIP for your own hosting." },
        { title: "9. Launch guide (3 min)", text: "Deploy agent: “Write my launch guide.” You get a personalised checklist: domain, hosting, forms, analytics, what to do next." },
      ] },
      { type: "tip", text: "Budget: the whole tutorial costs about 80 to 120 credits on the standard tier. The free plan's 100 credits are enough for a first version and a few edits." },
      { type: "try", prompt: "Build a website for a personal trainer called Nikola in Skopje. Audience: adults 25 to 45 who want to get fit with a coach. Goal: book a free first session. Sections: hero with strong headline, programs with prices, transformation results, about Nikola, testimonials, FAQ, booking form. Energetic dark style with a lime accent.", label: "Start the tutorial project" },
    ],
  },
  {
    id: "first-app",
    group: "Build your first website",
    order: 15,
    title: "Tutorial: your first web app (React)",
    minutes: 20,
    summary: "A multi-file app with state, a live sandbox and an export to Vite.",
    blocks: [
      { type: "p", text: "App projects (Pro plan and above) generate several files (App.tsx, components, styles) and run in a live sandbox in your browser. This is how real products are built: components that hold state and update when the user acts." },
      { type: "steps", items: [
        { title: "1. Create an App project", text: "New project → App. Prompt: “A habit tracker: add habits, tick them per day, weekly streak view, data saved in localStorage.”" },
        { title: "2. Read the file tree", text: "App.tsx is the entry. Components live in their own files. Styles use Tailwind classes. Click a file to read it in the editor." },
        { title: "3. Ask for one feature at a time", text: "“Add a dark mode toggle.” “Add a delete button with confirmation.” Each becomes a new version." },
        { title: "4. Understand state", text: "State is the data the interface remembers right now (the list of habits). When state changes, React redraws. localStorage keeps it after refresh; a database keeps it across devices." },
        { title: "5. Export", text: "Export as a Vite project, run npm install and npm run dev locally, push to GitHub, deploy on Vercel." },
      ] },
      { type: "compare", head: ["Concept", "Meaning", "In the code"], rows: [
        ["Component", "A reusable piece of UI", "function HabitCard() { … }"],
        ["Props", "Inputs to a component", "<HabitCard name=\"Run\" />"],
        ["State", "Data that changes", "const [habits, setHabits] = useState([])"],
        ["Effect", "Do something when data changes", "useEffect(() => save(habits), [habits])"],
      ] },
      { type: "try", prompt: "A habit tracker app: add habits, tick them per day, weekly streak view, data saved in localStorage. Clean, minimal design with a single accent colour.", label: "Create the habit tracker" },
    ],
  },

  /* ---------------- Going further ---------------- */
  {
    id: "seo-analytics",
    group: "Going further",
    order: 16,
    title: "SEO, analytics and conversion",
    minutes: 5,
    summary: "Getting found, measuring, and turning visitors into customers.",
    blocks: [
      { type: "h", text: "SEO (Search Engine Optimisation)" },
      { type: "list", items: [
        "One clear H1 per page that says what the page is. Descriptive title and meta description.",
        "Fast, mobile-friendly, HTTPS. Google ranks slow sites lower.",
        "Real text, not text inside images. Alt text on images.",
        "Content people actually search for: “dentist Skopje prices”, not “welcome to our website”.",
        "Structured data (schema.org) for businesses, products and FAQs. The SEO agent adds it.",
      ] },
      { type: "h", text: "Analytics" },
      { type: "p", text: "Install one tool (Plausible, Umami, Google Analytics, Vercel Analytics) and look at three numbers weekly: visitors, where they came from, and how many did the main action. Everything else is noise at the start." },
      { type: "h", text: "Conversion" },
      { type: "list", items: [
        "Conversion rate = actions ÷ visitors. 2 to 5% is normal for a landing page.",
        "Test one change at a time: headline, button text, price anchoring, social proof.",
        "Reduce friction: fewer form fields, no forced signup before value.",
      ] },
      { type: "try", prompt: "Audit this page for SEO: titles, meta description, heading structure, alt texts, structured data, and page speed hints. Then apply the fixes.", label: "Run the SEO agent", agent: "seo" },
    ],
  },
  {
    id: "security-basics",
    group: "Going further",
    order: 17,
    title: "Security basics you must know",
    minutes: 4,
    summary: "The five mistakes that get small sites hacked, and how to avoid them.",
    blocks: [
      { type: "list", items: [
        "Secrets in the frontend. API keys belong on the server or in environment variables, never in HTML or JavaScript the browser downloads.",
        "Trusting user input. Every form field can contain an attack. Validate on the server, escape before rendering (this prevents XSS and SQL injection).",
        "Weak logins. Use a provider (Supabase Auth, Clerk), enforce long passwords, offer Google/GitHub sign-in.",
        "No HTTPS. Free with every modern host; there is no excuse.",
        "Outdated dependencies. Run updates monthly. The Dependency agent flags known vulnerabilities.",
      ] },
      { type: "tip", text: "IDÆVIA-generated websites are single HTML files served from our database with no server-side code execution, which removes most of these risks by design. The Security agent reviews the rest." },
      { type: "try", prompt: "Review this project for security issues: exposed secrets, unsafe form handling, external scripts, insecure links. Report and fix.", label: "Run the Security agent", agent: "security" },
    ],
  },
  {
    id: "web3-smart-contracts",
    group: "Going further",
    order: 18,
    title: "Blockchain, smart contracts and Web3, explained simply",
    minutes: 6,
    summary: "What they are, when they make sense, and when they do not.",
    blocks: [
      { type: "p", text: "A blockchain is a shared database that nobody owns and nobody can secretly edit. Thousands of computers keep identical copies and agree on every new entry. Bitcoin uses one to track who owns which coins. Ethereum adds programs to it." },
      { type: "h", text: "Smart contracts" },
      { type: "p", text: "A smart contract is a small program stored on a blockchain that runs exactly as written, automatically, when someone sends it a transaction. Example: “when 1 ETH arrives, send the buyer NFT #42 and send the money to the seller.” No company in the middle, no chargebacks, no changes after deployment." },
      { type: "compare", head: ["Term", "Meaning", ""], rows: [
        ["Wallet", "Your account: a public address plus a secret key (MetaMask, Phantom)", ""],
        ["Transaction", "A signed request to the chain, costs a fee (“gas”)", ""],
        ["Token", "A unit of value defined by a contract (ERC-20)", ""],
        ["NFT", "A unique token, often pointing at an image or a right (ERC-721)", ""],
        ["Solidity", "The language most Ethereum contracts are written in", ""],
        ["dApp", "A normal web frontend that talks to contracts through the user's wallet", ""],
        ["Web3", "Umbrella term for apps built on these ideas", ""],
      ] },
      { type: "code", lang: "solidity", code: `// A tiny smart contract: anyone can leave a tip, only the owner can withdraw.\ncontract TipJar {\n  address public owner = msg.sender;\n\n  receive() external payable {}\n\n  function withdraw() external {\n    require(msg.sender == owner, "not owner");\n    payable(owner).transfer(address(this).balance);\n  }\n}` },
      { type: "h", text: "Should your project use it?" },
      { type: "list", items: [
        "Yes, if you need ownership that survives without your company, open auditability, or programmable money between strangers.",
        "No, for a normal business site, a booking system or a SaaS. A database is faster, cheaper and reversible when you make a mistake.",
        "Contracts cannot be edited after deployment. Bugs are permanent. Always audit.",
      ] },
      { type: "try", prompt: "Build a Web3 landing page for a token called ORBIT: hero with animated gradient, tokenomics section with a chart placeholder, roadmap, FAQ, and a “Connect wallet” button that explains what it will do. Explain in a comment which parts would need a real smart contract.", label: "Build a Web3 landing" },
    ],
  },
];

export const GLOSSARY: { term: string; def: string }[] = [
  { term: "API", def: "A menu of requests one program lets another program make. Your frontend talks to your backend through one." },
  { term: "Backend", def: "The server side: data, logins, payments. The kitchen." },
  { term: "Frontend", def: "What runs in the browser: layout, buttons, animations. The dining room." },
  { term: "Full-stack", def: "Both frontend and backend." },
  { term: "HTML / CSS / JS", def: "Structure / looks / behaviour of a web page." },
  { term: "React", def: "A library for building interfaces from reusable components." },
  { term: "Next.js", def: "A framework around React with pages, server code and easy deployment." },
  { term: "TypeScript", def: "JavaScript with types; catches bugs early." },
  { term: "Tailwind", def: "CSS written as small utility classes in the HTML, e.g. p-4 rounded-xl." },
  { term: "Database", def: "Organised storage for data; tables, rows, columns." },
  { term: "SQL / Postgres", def: "The query language / the most popular open-source database." },
  { term: "Supabase", def: "A hosted Postgres database plus auth, storage and an API. Backend as a service." },
  { term: "Auth", def: "Authentication (who are you) and authorisation (what may you do)." },
  { term: "Session / cookie", def: "How the site remembers you are logged in between clicks." },
  { term: "Git", def: "Version control: a full undo history of your code." },
  { term: "GitHub", def: "A website that hosts Git repositories for collaboration." },
  { term: "Repo, commit, branch, PR", def: "Project, saved snapshot, parallel line of work, request to merge." },
  { term: "Deploy", def: "Putting a new version live on a server." },
  { term: "Hosting", def: "The server that serves your site (Vercel, Netlify, Cloudflare)." },
  { term: "Domain / DNS", def: "Your address (name.com) / the system that maps it to a server." },
  { term: "SSL / HTTPS", def: "Encryption and the padlock. Free and mandatory." },
  { term: "CDN", def: "Copies of your files around the world for speed." },
  { term: "Responsive", def: "Adapts to phone, tablet and desktop screens." },
  { term: "UI", def: "User interface: how it looks." },
  { term: "UX", def: "User experience: how it works for the person using it." },
  { term: "Wireframe", def: "A box-and-line sketch of a screen before visual design." },
  { term: "Design system", def: "The agreed colours, type, spacing and components a product uses everywhere." },
  { term: "Figma", def: "The standard tool for designing screens." },
  { term: "SEO", def: "Making pages easy for search engines to find and rank." },
  { term: "Analytics", def: "Measuring visitors and what they do." },
  { term: "Conversion", def: "A visitor doing the thing you wanted (buy, book, sign up)." },
  { term: "JSON", def: "A text format for data: { \"name\": \"Ana\" }." },
  { term: "Webhook", def: "Another service calling your server when something happens (payment succeeded)." },
  { term: "Environment variable", def: "A secret setting (API key) kept outside the code." },
  { term: "LLM / model", def: "An AI that reads and writes text and code (Claude, GPT)." },
  { term: "Token (AI)", def: "The unit models read and write; about three quarters of a word." },
  { term: "Agent", def: "A model with a role, instructions and tools. IDÆVIA has 30." },
  { term: "Credits", def: "IDÆVIA's usage unit. Small edit ≈ 5, page ≈ 30, full-stack ≈ 240." },
  { term: "SaaS", def: "Software as a Service: a web app people pay for monthly." },
  { term: "MVP", def: "Minimum viable product: the smallest version that is useful." },
  { term: "Blockchain", def: "A shared database nobody owns and nobody can secretly edit." },
  { term: "Smart contract", def: "A program on a blockchain that runs automatically and cannot be changed after deployment." },
  { term: "Wallet", def: "A blockchain account: public address plus secret key." },
  { term: "NFT", def: "A unique token on a blockchain, often representing an image or a right." },
  { term: "Web3", def: "Apps built on blockchains, wallets and smart contracts." },
];

export function lessonsByGroup() {
  return LESSON_GROUPS.map((g) => ({ group: g, lessons: LESSONS.filter((l) => l.group === g).sort((a, b) => a.order - b.order) })).filter((g) => g.lessons.length);
}

export function getLesson(id: string) {
  return LESSONS.find((l) => l.id === id) ?? null;
}

export function adjacentLessons(id: string) {
  const sorted = [...LESSONS].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((l) => l.id === id);
  return { prev: i > 0 ? sorted[i - 1] : null, next: i >= 0 && i < sorted.length - 1 ? sorted[i + 1] : null };
}
