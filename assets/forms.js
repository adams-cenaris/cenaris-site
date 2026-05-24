// Cenaris forms &mdash; UTM capture + submission helper.
// Posts JSON to a Google Apps Script web app deployed against the partner sheet.
// See site/apps-script.gs for the server-side code and deploy instructions.

(function () {
  // ----------------------------------------------------------------
  // CONFIG &mdash; paste your Apps Script /exec URL here after deploying.
  // It will look like:  https://script.google.com/macros/s/AKfycb&hellip;/exec
  const ENDPOINT = window.CENARIS_FORMS_ENDPOINT || 'https://script.google.com/macros/s/AKfycbx8qTtF0IFTB5D62NDFrs3RkRhk-gA-F1i52rrSMNXpcx5E6SJczLXRvnMYTSlUcpNX/exec';

  // -- UTM + referrer capture (runs on every page load) --------------
  // Stored in sessionStorage so they persist as the user navigates
  // from the landing page through to the partner form.
  const UTM_KEYS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid'];
  try {
    const params = new URLSearchParams(window.location.search);
    UTM_KEYS.forEach(k => {
      const v = params.get(k);
      if (v) sessionStorage.setItem('cenaris-' + k, v);
    });
    // Capture the FIRST external referrer in the session only.
    if (!sessionStorage.getItem('cenaris-referrer')) {
      const ref = document.referrer || '';
      if (ref && !ref.includes(window.location.host)) {
        sessionStorage.setItem('cenaris-referrer', ref);
      }
    }
    // Landing page = first page in this session.
    if (!sessionStorage.getItem('cenaris-landing')) {
      sessionStorage.setItem('cenaris-landing', window.location.pathname + window.location.search);
    }
  } catch (_) { /* sessionStorage can fail in private modes &mdash; ignore */ }

  function readTrackingContext() {
    const ctx = { page: window.location.pathname, userAgent: navigator.userAgent };
    UTM_KEYS.forEach(k => { ctx[k] = sessionStorage.getItem('cenaris-' + k) || ''; });
    ctx.referrer = sessionStorage.getItem('cenaris-referrer') || document.referrer || '';
    ctx.landing = sessionStorage.getItem('cenaris-landing') || '';
    return ctx;
  }

  // -- Programmatic submission API -----------------------------------
  // Usage from outside: window.cenarisForms.submit('quiz', { email, score, &hellip; })
  // Returns a Promise<{ok: boolean, error?: string}>.
  async function programmaticSubmit(formName, fields) {
    const data = Object.assign({ form: formName }, fields, readTrackingContext());
    if (data.company_website) return { ok: true, dropped: 'honeypot' };
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        keepalive: true, // allow the request to complete after page navigation
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({ ok: res.ok }));
      return json;
    } catch (err) {
      console.error('[cenaris-forms] programmatic submit failed:', err);
      return { ok: false, error: String(err) };
    }
  }

  window.cenarisForms = { submit: programmaticSubmit };

  // -- Form wiring ---------------------------------------------------
  // Any <form data-cenaris-form="partner" data-thanks="partner-thanks.html"> will be wired.
  function wireForm(form) {
    const formName = form.getAttribute('data-cenaris-form');
    const thanksUrl = form.getAttribute('data-thanks') || null;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type=submit]');
      const errEl = form.querySelector('[data-form-error]');
      if (errEl) errEl.style.display = 'none';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.dataset._label = submitBtn.innerHTML; submitBtn.innerHTML = 'Submitting&hellip;'; }

      // Collect named fields.
      const data = { form: formName };
      form.querySelectorAll('[name]').forEach(el => {
        if (el.type === 'checkbox') data[el.name] = el.checked ? (el.value || 'on') : '';
        else if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
        else data[el.name] = el.value;
      });

      // Honeypot &mdash; if filled, silently "succeed" without contacting the server.
      if (data.company_website) {
        if (thanksUrl) window.location.href = thanksUrl;
        return;
      }

      // Merge tracking context.
      Object.assign(data, readTrackingContext());

      try {
        // text/plain content-type avoids CORS preflight against Apps Script.
        // Apps Script still receives the raw JSON in e.postData.contents.
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(data),
        });
        const json = await res.json().catch(() => ({ ok: res.ok }));
        if (!json.ok) throw new Error(json.error || 'Submission failed');
        // Track conversion — form type only, no PII.
        try {
          if (typeof window.trackLeadFormSubmit === 'function') window.trackLeadFormSubmit(formName);
          if (formName === 'waitlist' && typeof window.trackWaitlistSubmit === 'function') window.trackWaitlistSubmit('form');
        } catch(_) {}
        if (thanksUrl) {
          window.location.href = thanksUrl;
        } else {
          form.style.display = 'none';
          const success = form.parentElement.querySelector('[data-form-success]');
          if (success) success.style.display = 'block';
        }
      } catch (err) {
        console.error('[cenaris-forms] submission failed:', err);
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = submitBtn.dataset._label || 'Submit'; }
        if (errEl) {
          errEl.textContent = 'Something went wrong. Please try again, or email info@cenaris.com.au.';
          errEl.style.display = 'block';
        }
      }
    });
  }

  function init() {
    document.querySelectorAll('form[data-cenaris-form]').forEach(wireForm);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
