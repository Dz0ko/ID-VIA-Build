/** Route a whole product brief before matching incidental specialist keywords. */
export function isProductBrief(request: string): boolean {
  const first = request.trim().split(/\n/)[0];
  if (/^(?:please )?(?:rewrite|translate|shorten|proofread|summari[sz]e|improve)\b.*\b(?:copy|text|headline|wording|paragraph|brief)\b/i.test(first)) return false;
  if (/\b(?:rebuild|replace (?:the )?(?:project|website|site|app)|start over|from scratch|rewrite everything|whole (?:site|app)|entire (?:site|app))\b/i.test(first)) return true;
  if (/\b(?:project|site|website|app) is (?:wrong|different)\b/i.test(first)) return true;
  const sections = ['navbar', 'hero', 'footer', 'category grid', 'best sellers', 'testimonials', 'pricing', 'dashboard', 'newsletter', 'shop by vendor'];
  const matches = sections.filter(section => request.toLowerCase().includes(section)).length;
  return matches >= 4 && /\b(?:website|site|app|marketplace|platform|landing page|saas|design direction|structure)\b/i.test(request);
}
/** Library attachment instructions describe a build, even when their defaults mention accessibility/SEO. */
export function isComponentImplementation(request: string): boolean {
  return /^Implement the selected components in this project:/i.test(request.trim()) && /\[COMPONENT:[a-z0-9-]+\]/.test(request);
}

/**
 * A new overall look touches most of the document, which exact search/replace edits cannot express
 * within the edit and time limits. Requests naming a specific target stay targeted edits.
 */
export function requestsVisualOverhaul(request: string): boolean {
  const first = request.trim().split(/\n/)[0].toLowerCase();
  if (!first || first.length > 400 || isProductBrief(request) || requestsProjectReplacement(request)) return false;
  // Questions about design are answered, not built.
  if (/\?\s*$/.test(first) || /^(?:how|why|what|which|can|could|should|would|is|are|do|does|kako|zosto|shto|dali|како|зошто|што|дали)\b/u.test(first)) return false;
  if (/\b(?:nav(?:bar|igation)?|header|footer|hero|button|cta|section|card|pricing|faq|testimonial|logo|image|photo|icon|title|headline|heading|text|copy|paragraph|form|table|menu|link|badge|banner|modal|gallery|contact|about|wheel|only|just|dark mode|light mode)\b|(?:навбар|хедер|футер|копче|секци|лого|слик|наслов|текст|само)/u.test(first)) return false;
  return /\b(?:redesign|new (?:design|look|style)|(?:more|very|super|really) (?:modern|moderen|modren|professional|proffesional|profesional|premium|elegant|beautiful|polished|clean|minimal)|moderni[sz]e|make (?:it|this|the (?:site|website|page|design)) (?:look )?(?:more |much )?(?:modern|professional|premium|beautiful|better|nicer|cleaner|elegant|polished)|(?:better|improve(?:d)? the|upgrade the|change the|update the|fix the|refresh the) (?:whole |entire |overall |site |website |page |visual )?(?:design|look|style|styling|ui|visuals?)|design (?:is|looks) (?:bad|ugly|old|outdated|cheap|boring|basic)|looks? (?:bad|ugly|old|outdated|cheap|boring|basic|amateur)|premium look|professional look)\b/.test(first)
    || /(?:подобар дизајн|поубав дизајн|помодерен|попрофесионал|редизајн|целиот дизајн|смени го дизајнот|подобри го дизајнот|podobar dizajn|poubav dizajn|pomoderen|poprofesional|redizajn|smeni go dizajnot|podobri go dizajnot)/u.test(first);
}

/** Replacing a working project requires an explicit whole-project request. */
export function requestsProjectReplacement(request: string): boolean {
  const first = request.trim().split(/\n/)[0];
  if (/\b(?:do not|don't|never|without)\s+(?:rebuild|replace|rewrite|redesign)/i.test(first) || /(?:не менувај|ne menuvaj)/i.test(first)) return false;
  if (/\b(?:project|site|website|app) is (?:wrong|different)\b/i.test(first) && isProductBrief(request)) return true;
  return /\b(?:rebuild|redesign|replace|rewrite)\s+(?:(?:the|my|whole|entire|complete|existing|current)\s+)*(?:website|site|project|app|application)\b/i.test(first)
    || /\b(?:start over|from scratch|rewrite everything)\b/i.test(first)
    || /(?:смени|замени|преработи|smeni|zameni|preraboti)\s+(?:(?:го|go)\s+)?(?:целиот|celiot)\s+(?:сајт|проект|sajt|proekt)/i.test(first);
}
