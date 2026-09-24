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

/** Replacing a working project requires an explicit whole-project request. */
export function requestsProjectReplacement(request: string): boolean {
  const first = request.trim().split(/\n/)[0];
  if (/\b(?:do not|don't|never|without)\s+(?:rebuild|replace|rewrite|redesign)/i.test(first) || /(?:не менувај|ne menuvaj)/i.test(first)) return false;
  if (/\b(?:project|site|website|app) is (?:wrong|different)\b/i.test(first) && isProductBrief(request)) return true;
  return /\b(?:rebuild|redesign|replace|rewrite)\s+(?:(?:the|my|whole|entire|complete|existing|current)\s+)*(?:website|site|project|app|application)\b/i.test(first)
    || /\b(?:start over|from scratch|rewrite everything)\b/i.test(first)
    || /(?:смени|замени|преработи|smeni|zameni|preraboti)\s+(?:(?:го|go)\s+)?(?:целиот|celiot)\s+(?:сајт|проект|sajt|proekt)/i.test(first);
}
