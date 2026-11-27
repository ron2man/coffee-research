// Cookie consent banner for analytics. Loaded only on pages that load GTM (production with
// PUBLIC_GTM_ID). Consent defaults come from Analytics.astro: analytics storage is denied in the
// UK, EEA and Switzerland (by Google's IP region) and granted elsewhere; a saved choice is applied
// there before GTM loads. This file shows the banner, saves the reader's choice and updates consent.
//
// Who sees the banner without asking for it: readers whose time zone is in Europe (plus the
// Atlantic islands of EEA countries and Iceland), or whose time zone is unknown. The guess only
// decides whether to ask: a UK reader with a non-European time zone still starts denied, so a
// wrong guess never grants consent. Everyone can open the banner from "Cookie settings" in the footer.
(function () {
  var KEY = 'analytics-consent';
  var ATLANTIC = ['Atlantic/Reykjavik', 'Atlantic/Canary', 'Atlantic/Madeira', 'Atlantic/Azores', 'Atlantic/Faroe', 'Arctic/Longyearbyen'];

  function saved() {
    try { var v = localStorage.getItem(KEY); return v === 'granted' || v === 'denied' ? v : null; } catch (e) { return null; }
  }
  function save(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: the choice lasts for this page only */ }
  }
  function askByDefault() {
    var zone = '';
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* unknown */ }
    return !zone || zone.indexOf('Europe/') === 0 || ATLANTIC.indexOf(zone) !== -1;
  }
  function choose(value, banner) {
    save(value);
    if (window.gtag) window.gtag('consent', 'update', { analytics_storage: value });
    banner.hidden = true;
  }

  function init() {
    var banner = document.getElementById('consent');
    if (!banner) return;
    var accept = document.getElementById('consent-accept');
    var reject = document.getElementById('consent-reject');
    var settings = document.getElementById('consent-settings');
    accept.addEventListener('click', function () { choose('granted', banner); });
    reject.addEventListener('click', function () { choose('denied', banner); });
    if (settings) {
      settings.hidden = false;
      settings.addEventListener('click', function () { banner.hidden = false; accept.focus(); });
    }
    if (!saved() && askByDefault()) banner.hidden = false;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
