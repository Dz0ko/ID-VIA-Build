const NAV_GUARD = `<script data-idaevia-project-navigation>(function(){
  var route=/^\\/(?:app|login|signup|admin|pricing|api)(?:[/?#]|$)/i;
  var host=/^(?:www\\.)?idaevia\\.app$/i;
  function blocked(value){
    var raw=String(value||'').trim();
    if(!raw||raw.charAt(0)==='#'||/^(?:mailto|tel|javascript):/i.test(raw)) return false;
    try{
      var url=new URL(raw,document.baseURI||location.href);
      if(host.test(url.hostname)) return route.test(url.pathname+url.search+url.hash);
      if(url.origin===location.origin) return route.test(url.pathname+url.search+url.hash);
    }catch(e){}
    return route.test(raw.replace(/^\\.\\//,'/'));
  }
  function stop(event){
    event.preventDefault();
    if(event.stopImmediatePropagation) event.stopImmediatePropagation();
  }
  document.addEventListener('click',function(event){
    var link=event.target&&event.target.closest?event.target.closest('a'):null;
    if(link&&blocked(link.getAttribute('href'))) stop(event);
  },true);
  document.addEventListener('submit',function(event){
    var form=event.target;
    if(form&&blocked(form.getAttribute('action')||'')) stop(event);
  },true);
})();</script>`;

/** Keeps generated projects from navigating into IDÆVIA's authenticated routes. */
export function protectProjectNavigation(html: string) {
  if (html.includes("data-idaevia-project-navigation")) return html;
  const bodyClose = new RegExp("</body>", "i");
  if (bodyClose.test(html)) return html.replace(bodyClose, `${NAV_GUARD}</body>`);
  return `${html}${NAV_GUARD}`;
}
