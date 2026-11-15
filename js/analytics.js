// Site analytics: Google Analytics 4 (stream "Startup 84 site", G-3DQZB9NQH0) with consent mode.
// In the EEA, the UK and Switzerland nothing is stored until the visitor allows it; elsewhere analytics
// is on until the visitor declines. Ads storage is never granted. The choice is kept in localStorage.
(function () {
  var ID = 'G-3DQZB9NQH0', KEY = 's84-analytics';
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  var denied = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' };
  gtag('consent', 'default', Object.assign({}, denied, { region: ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE','GB','CH'] }));
  gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
  var choice = null;
  try { choice = localStorage.getItem(KEY); } catch (e) {}
  if (choice) gtag('consent', 'update', { analytics_storage: choice });
  gtag('js', new Date());
  gtag('config', ID);
  var s = document.createElement('script');
  s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);
  if (choice) return;
  function decide(v) {
    gtag('consent', 'update', { analytics_storage: v });
    try { localStorage.setItem(KEY, v); } catch (e) {}
    bar.remove();
  }
  var bar = document.createElement('div');
  bar.className = 'consent';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Analytics choice');
  bar.innerHTML = '<p>This site counts visits with Google Analytics. No ads, no account.</p>' +
    '<button type="button" data-v="granted">Allow</button><button type="button" data-v="denied">Decline</button>';
  bar.addEventListener('click', function (e) { var v = e.target.getAttribute('data-v'); if (v) decide(v); });
  document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(bar); });
})();
