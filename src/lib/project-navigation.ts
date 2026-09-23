const NAV_GUARD = `<script data-idaevia-project-navigation>(function(){
  var blocked=/^\\/(?:app|login|signup|admin|pricing|api)(?:[/?#]|$)/i;
  document.addEventListener('click',function(event){
    var link=event.target&&event.target.closest?event.target.closest('a'):null;
    if(!link) return;
    var href=link.getAttribute('href')||'';
    if(!blocked.test(href)) return;
    event.preventDefault();
    var hash=href.indexOf('#')>=0?href.slice(href.indexOf('#')):'';
    var target=hash?document.querySelector(hash):document.querySelector('main')||document.body;
    if(target&&target.scrollIntoView) target.scrollIntoView({behavior:'smooth',block:'start'});
  },true);
})();</script>`;

/** Keeps generated projects from navigating into IDÆVIA's authenticated routes. */
export function protectProjectNavigation(html: string) {
  if (html.includes("data-idaevia-project-navigation")) return html;
  const bodyClose = new RegExp("</body>", "i");
  if (bodyClose.test(html)) return html.replace(bodyClose, `${NAV_GUARD}</body>`);
  return `${html}${NAV_GUARD}`;
}
