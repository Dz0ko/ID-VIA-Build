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
