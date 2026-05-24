# Cenaris Analytics Implementation

Google Analytics 4 and Microsoft Clarity are loaded by `assets/analytics.js`,
which is included on every page before `chrome.js`.

---

## Configuration

Both IDs live at the top of `assets/analytics.js`:

```js
const _GA4_ID     = 'INSERT_GA4_MEASUREMENT_ID_HERE';
const _CLARITY_ID = 'INSERT_CLARITY_PROJECT_ID_HERE';
```

Replace the placeholder strings with real values. These IDs are semi-public
(they appear in the page source of any site using them) — the data is secured
by your GA4 and Clarity account access, not by keeping the IDs secret.

### Where to find your IDs

**GA4 Measurement ID** (format: `G-XXXXXXXXXX`)
GA4 → Admin → Data streams → your web stream → Measurement ID

**Microsoft Clarity Project ID** (format: 10-char alphanumeric)
Clarity → Settings → Overview → Project ID

---

## Privacy rules — strictly enforced

Never pass to any analytics call:
- Names, email addresses, phone numbers
- Organisation names
- Free-text form responses (pain points, messages, referral descriptions)
- NDIS participant data
- Health information
- Uploaded file names or contents

Only anonymised categorical values are sent, e.g.:
- `form_type: 'contact'`
- `score_band: 'MOSTLY READY'`
- `intent: 'book_call'`
- `tier_name: 'Essentials'`

---

## Consent & production gating

Analytics **only loads** when both conditions are true:

1. **Consent granted** — `localStorage.getItem('cenaris-cookie') === 'accept'`
2. **Production domain** — `window.location.hostname` is `cenaris.com.au` or `www.cenaris.com.au`

On localhost or Vercel preview URLs (`.vercel.app`), no scripts load and no
events fire — regardless of cookie state.

The existing cookie banner in `chrome.js` calls `window.cenarisCookieAccept()`
when the user clicks Accept, which triggers analytics initialisation immediately.

---

## Tracked events

### Primary conversions (mark these as Conversions in GA4)

| Event name | Fired from | Parameters |
|---|---|---|
| `lead_form_submit` | `forms.js` on every form success | `form_type`, `page_location` |
| `waitlist_submit` | `forms.js` when waitlist form succeeds | `cta_location`, `page_location` |
| `contact_form_submit` | `contact-thanks.html` on page load | `page_location` |
| `partner_enquiry_submit` | `partner-thanks.html` on page load | `page_location` |
| `roi_calculator_complete` | `roi.html` CTA buttons | `intent` (book_call/join_waitlist/email_results), `page_location` |
| `audit_screener_complete` | `audit-readiness-check.html` on email send success | `score_band`, `page_location` |

### Secondary events

| Event name | Fired from | Parameters |
|---|---|---|
| `demo_booking_click` | Any Calendly link click (delegated) | `cta_location`, `page_location` |
| `outbound_click` | Social links in footer (delegated) | `destination_type`, `cta_location`, `page_location` |
| `lead_magnet_download` | PDF/XLSX/ZIP link clicks (delegated) | `document_name`, `page_location` |
| `pricing_page_view` | `analytics.js` on load when `CENARIS_PAGE === 'pricing'` | `page_location` |
| `pricing_tier_click` | Manual call to `trackPricingTierClick(tierName)` | `tier_name`, `page_location` |
| `primary_cta_click` | Manual call to `trackPrimaryCtaClick(text, location)` | `cta_text`, `cta_location`, `page_location` |

---

## Analytics helper API

All functions are global (attached to `window`) and are silent no-ops if analytics
is not loaded. Safe to call unconditionally.

```js
trackEvent(name, params)                  // raw event
trackLeadFormSubmit(formType)             // fires lead_form_submit
trackWaitlistSubmit(ctaLocation)          // fires waitlist_submit
trackDemoClick(ctaLocation)               // fires demo_booking_click
trackROICalculatorComplete(intent)        // fires roi_calculator_complete
trackAuditScreenerComplete(scoreBand)     // fires audit_screener_complete
trackLeadMagnetDownload(docName)          // fires lead_magnet_download
trackOutboundClick(destinationType, loc)  // fires outbound_click
trackPricingTierClick(tierName)           // fires pricing_tier_click
trackPrimaryCtaClick(ctaText, location)   // fires primary_cta_click
```

---

## Clarity masking

Before the Clarity script loads, `analytics.js` programmatically adds
`data-clarity-mask` to every text input and textarea on the page. This prevents
typed content from appearing in session recordings. Radio buttons, checkboxes,
selects (predefined values), and hidden inputs are NOT masked.

To exclude a specific element from Clarity session recording entirely:
```html
<div data-clarity-disable-session-recording="true">…</div>
```

---

## Testing

### GA4 DebugView

1. Install the [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna) Chrome extension, or add `?_ga_debug=1` to the URL.
2. In GA4: Admin → DebugView.
3. Accept cookies on the live site (`cenaris.com.au`) to trigger analytics load.
4. Perform a conversion action (submit a form, click a Calendly link).
5. Events should appear in DebugView within seconds.

Alternatively, open DevTools → Network → filter by `google-analytics` or `gtag`
to see hits being sent.

### Microsoft Clarity

1. Go to Clarity → your project → Recordings.
2. Accept cookies on the live site.
3. Browse a few pages and submit a test form.
4. Wait ~2 minutes, then refresh Recordings.
5. Confirm session appears and form inputs show masked values (asterisks).
6. Check Dashboard → Custom events for `roi_calculator_complete` etc.

### Confirming no tracking in development

Open the browser console on localhost. You should see **no** requests to
`google-analytics.com`, `clarity.ms`, or `googletagmanager.com`. The `_isProd`
check in `analytics.js` prevents any loading outside the live domain.

### Marking GA4 events as Conversions

In GA4: Admin → Events → find the event → toggle "Mark as conversion".

Recommended conversions to mark:
- `contact_form_submit`
- `partner_enquiry_submit`
- `waitlist_submit`
- `roi_calculator_complete`
- `audit_screener_complete`
- `demo_booking_click`

---

## Adding a new form

1. Add the form schema to `apps-script.gs` → `FORM_SCHEMAS`.
2. Ensure `data-cenaris-form="your_form_name"` is on the `<form>` element.
3. `forms.js` will automatically call `trackLeadFormSubmit('your_form_name')` on success.
4. If you need a specific conversion event, add it to the `wireForm` success block
   in `forms.js` or fire it from the form's own handler.

---

## Files changed

| File | Change |
|---|---|
| `assets/analytics.js` | New — core analytics module |
| `assets/chrome.js` | Calls `window.cenarisCookieAccept()` on cookie Accept |
| `assets/forms.js` | Fires `lead_form_submit` / `waitlist_submit` on form success |
| `contact-thanks.html` | Fires `contact_form_submit` on page load |
| `partner-thanks.html` | Fires `partner_enquiry_submit` on page load |
| `roi.html` | Fires `roi_calculator_complete` from CTA handlers |
| `audit-readiness-check.html` | Fires `audit_screener_complete` from email handler |
| All 15 HTML pages | Added `<script src="assets/analytics.js"></script>` before `chrome.js` |
| `docs/analytics.md` | This file |
| `.env.example` | Analytics ID reference |
