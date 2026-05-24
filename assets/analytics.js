/**
 * Cenaris — Analytics (GA4 + Microsoft Clarity)
 *
 * Loads only after explicit cookie consent. Runs only on cenaris.com.au.
 *
 * IDs: Replace the placeholder strings before going live.
 *   GA4:     Google Analytics Admin → Data streams → Measurement ID (G-XXXXXXXXXX)
 *   Clarity: Microsoft Clarity → Settings → Overview → Project ID (10-char string)
 *
 * PRIVACY — strictly enforced:
 *   Never pass to any analytics call: names, email addresses, phone numbers,
 *   organisation names, free-text form responses, NDIS participant data,
 *   or any health information. Only anonymised categorical values are sent
 *   (e.g. form_type='contact', score_band='MOSTLY READY', intent='book_call').
 */

const _GA4_ID     = 'G-JRRFYW0XYY';
const _CLARITY_ID = 'wvzpun60gq';

// Analytics fires only on the live domain — not localhost or Vercel preview URLs.
const _isProd = (
  window.location.hostname === 'cenaris.com.au' ||
  window.location.hostname === 'www.cenaris.com.au'
);

// ─── Loaders ──────────────────────────────────────────────────────────────

function _loadGA4() {
  if (window.__cenGA4) return;
  window.__cenGA4 = true;
  window.dataLayer = window.dataLayer || [];
  // Define gtag before the script loads so queued events are buffered correctly.
  window.gtag = function() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', _GA4_ID, {
    // Disable ad-audience and remarketing signals — not needed for B2B SaaS.
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    anonymize_ip: true,
  });
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + _GA4_ID;
  document.head.appendChild(s);
}

function _loadClarity() {
  if (window.__cenClarity) return;
  window.__cenClarity = true;

  // Mask all text-like inputs before Clarity recording begins.
  // This runs synchronously here, before the async Clarity script downloads,
  // so no typed content can be captured. Individual inputs also carry
  // data-clarity-mask attributes in the HTML as a belt-and-suspenders backup.
  document.querySelectorAll(
    'input:not([type="radio"]):not([type="checkbox"])' +
    ':not([type="submit"]):not([type="button"]):not([type="hidden"]),' +
    'textarea'
  ).forEach(function(el) { el.setAttribute('data-clarity-mask', ''); });

  // Standard Clarity loader snippet.
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.id='cenaris-clarity';
    t.src='https://www.clarity.ms/tag/'+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window,document,'clarity','script',_CLARITY_ID);
}

// ─── Consent & init ───────────────────────────────────────────────────────

function _init() {
  if (!_isProd) return;
  _loadGA4();
  _loadClarity();
}

// Load immediately if consent was previously granted.
if (localStorage.getItem('cenaris-cookie') === 'accept') {
  _init();
}

// Called by chrome.js when the user clicks "Accept" on the cookie banner.
window.cenarisCookieAccept = _init;

// ─── Event tracking API ───────────────────────────────────────────────────
// All functions are silent no-ops when analytics is unavailable (blocked,
// not consented, or on a non-production domain).

function trackEvent(name, params) {
  try { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); } catch(_) {}
  try { if (typeof window.clarity === 'function') window.clarity('event', name); } catch(_) {}
}

// Primary conversion events

function trackLeadFormSubmit(formType) {
  trackEvent('lead_form_submit', { form_type: formType, page_location: window.location.pathname });
}

function trackWaitlistSubmit(ctaLocation) {
  trackEvent('waitlist_submit', { cta_location: ctaLocation || 'form', page_location: window.location.pathname });
}

function trackDemoClick(ctaLocation) {
  trackEvent('demo_booking_click', { cta_location: ctaLocation, page_location: window.location.pathname });
}

function trackROICalculatorComplete(intent) {
  // intent: 'book_call' | 'join_waitlist' | 'email_results'
  trackEvent('roi_calculator_complete', { intent: intent, page_location: window.location.pathname });
}

function trackAuditScreenerComplete(scoreBand) {
  // scoreBand: e.g. 'MOSTLY READY' — never the raw numeric score
  trackEvent('audit_screener_complete', { score_band: scoreBand, page_location: window.location.pathname });
}

// Secondary events

function trackLeadMagnetDownload(docName) {
  trackEvent('lead_magnet_download', { document_name: docName, page_location: window.location.pathname });
}

function trackOutboundClick(destinationType, ctaLocation) {
  trackEvent('outbound_click', {
    destination_type: destinationType,
    cta_location: ctaLocation || '',
    page_location: window.location.pathname,
  });
}

function trackPricingTierClick(tierName) {
  trackEvent('pricing_tier_click', { tier_name: tierName, page_location: window.location.pathname });
}

function trackPrimaryCtaClick(ctaText, ctaLocation) {
  trackEvent('primary_cta_click', { cta_text: ctaText, cta_location: ctaLocation || '', page_location: window.location.pathname });
}

// ─── Delegated click tracking ─────────────────────────────────────────────

document.addEventListener('click', function(e) {
  var a = e.target.closest('a[href]');
  if (!a) return;
  var href = a.getAttribute('href') || '';

  // Calendly links = demo booking intent
  if (href.indexOf('calendly.com') !== -1) {
    var section = a.closest('[data-screen-label]');
    trackDemoClick(section ? section.getAttribute('data-screen-label') : window.location.pathname);
    return;
  }

  // Outbound social links
  var social = {
    'facebook.com': 'facebook', 'instagram.com': 'instagram',
    'linkedin.com': 'linkedin', 'tiktok.com': 'tiktok',
    'twitter.com': 'twitter',   'x.com': 'twitter',
  };
  for (var domain in social) {
    if (href.indexOf(domain) !== -1) {
      trackOutboundClick('social_' + social[domain], 'footer');
      return;
    }
  }

  // Downloadable files
  if (/\.(pdf|xlsx?|docx?|zip)(\?|$)/i.test(href)) {
    trackLeadMagnetDownload(href.split('/').pop().split('?')[0]);
  }
});

// Pricing page: fire a page-level event once on load.
if (window.CENARIS_PAGE === 'pricing') {
  trackEvent('pricing_page_view', { page_location: window.location.pathname });
}
