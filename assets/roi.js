'use strict';

const PLANS = [
  { maxStaff: 10,       name: 'Tier 1 Essentials',  monthly: 149,  annual: 1788  },
  { maxStaff: 50,       name: 'Tier 2 Assurance',   monthly: 349,  annual: 4188  },
  { maxStaff: 150,      name: 'Tier 3 Confidence',  monthly: 699,  annual: 8388  },
  { maxStaff: Infinity, name: 'Enterprise (from)',  monthly: 1499, annual: 17988 },
];

function pickPlan(staff) {
  return PLANS.find(p => staff <= p.maxStaff) || PLANS[PLANS.length - 1];
}

const ROI_STATE = {};

const fmt = n => '$' + Math.round(n).toLocaleString('en-AU');

const animate = (el, to) => {
  const from = parseFloat(el.dataset.v || 0);
  const start = performance.now();
  const step = t => {
    const p = Math.min(1, (t - start) / 500);
    const eased = 1 - Math.pow(1 - p, 3);
    const v = from + (to - from) * eased;
    el.textContent = '$' + Math.round(v).toLocaleString('en-AU');
    if (p < 1) requestAnimationFrame(step);
    else el.dataset.v = to;
  };
  requestAnimationFrame(step);
};

function compute() {
  const staff   = +document.getElementById('i-staff').value   || 0;
  const hours   = +document.getElementById('i-hours').value   || 0;
  const rate    = +document.getElementById('i-rate').value    || 0;
  const weeks   = +document.getElementById('i-weeks').value   || 0;
  const consult = +document.getElementById('i-consult').value || 0;
  const noncon  = +document.getElementById('i-noncon').value  || 0;

  const ongoingNow  = hours * rate * 52;
  const auditNow    = (weeks * 40 * rate) / 3;
  const consultNow  = consult;
  const ncNow       = noncon * 3500 / 3;
  const totalNow    = ongoingNow + auditNow + consultNow + ncNow;

  const ongoingNew  = ongoingNow * 0.45;
  const auditNew    = auditNow   * 0.30;
  const consultNew  = consultNow * 0.60;
  const ncNew       = ncNow      * 0.40;
  const plan        = pickPlan(staff);
  const subscription = plan.annual;
  const totalNew    = ongoingNew + auditNew + consultNew + ncNew + subscription;

  const savings  = Math.max(0, totalNow - totalNew);
  const pct      = totalNow > 0 ? Math.round(savings / totalNow * 100) : 0;
  const payback  = subscription > 0 ? (subscription / Math.max(1, savings / 12)).toFixed(1) : '--';

  animate(document.getElementById('o-current'), totalNow);
  animate(document.getElementById('o-cenaris'), totalNew);
  animate(document.getElementById('o-savings'), savings);
  document.getElementById('o-pct').textContent     = pct;
  document.getElementById('o-payback').textContent = (savings > 0 && payback !== '--') ? `${payback} months` : '--';
  document.getElementById('o-plan').textContent    = `${plan.name} · $${plan.monthly}/mo · billed annually`;

  Object.assign(ROI_STATE, {
    staff, hours, rate, weeks, consult, noncon,
    plan_name:      plan.name,
    plan_monthly:   plan.monthly,
    plan_annual:    plan.annual,
    current_cost:   Math.round(totalNow),
    cenaris_cost:   Math.round(totalNew),
    savings:        Math.round(savings),
    savings_pct:    pct,
    payback_months: payback,
  });

  const items = [
    ['Staff hours saved', ongoingNow - ongoingNew, '#4A9FCC'],
    ['Audit prep saved',  auditNow   - auditNew,   '#16A34A'],
    ['Consultant spend',  consultNow - consultNew,  '#D97706'],
    ['Non-conformities',  ncNow      - ncNew,       '#7C3AED'],
  ];
  const max  = Math.max(1, ...items.map(i => i[1]));
  const wrap = document.getElementById('breakdown');
  wrap.innerHTML = items.map(([label, v, c]) => `
    <div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
        <span style="color:var(--gray-700)">${label}</span>
        <strong style="color:var(--gray-900);font-variant-numeric:tabular-nums">${fmt(v)}</strong>
      </div>
      <div class="mock-bar"><span style="width:${(v / max) * 100}%;background:${c}"></span></div>
    </div>
  `).join('');
}

function preset(s, h, r, w, c, n) {
  document.getElementById('i-staff').value   = s;
  document.getElementById('i-hours').value   = h;
  document.getElementById('i-rate').value    = r;
  document.getElementById('i-weeks').value   = w;
  document.getElementById('i-consult').value = c;
  document.getElementById('i-noncon').value  = n;
  compute();
}

function captureRoiClick(intent, destinationHref, newTab) {
  const emailEl = document.getElementById('roi-email');
  const msgEl   = document.getElementById('roi-cta-msg');
  const email   = (emailEl.value || '').trim();

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    msgEl.style.color = 'var(--red-600)';
    msgEl.textContent = "That email doesn't look right. Fix it or leave it blank.";
    msgEl.style.display = 'block';
    emailEl.focus();
    return false;
  }

  const payload = Object.assign({ form: 'roi', email, intent }, ROI_STATE);
  if (window.cenarisForms && window.cenarisForms.submit) {
    window.cenarisForms.submit('roi', payload).catch(() => {});
  }

  if (email && !newTab) {
    msgEl.style.color = 'var(--green-700)';
    msgEl.textContent = '✓ Saved. We\'ll email you a copy.';
    msgEl.style.display = 'block';
  }

  try { if (typeof window.trackROICalculatorComplete === 'function') window.trackROICalculatorComplete(intent); } catch (_) {}
  return true;
}

// Wire up inputs and buttons once the DOM is ready.
// This script is loaded at the bottom of <body> so the DOM is already parsed.

document.querySelectorAll('#i-staff, #i-hours, #i-rate, #i-weeks, #i-consult, #i-noncon')
  .forEach(el => el.addEventListener('input', compute));

document.querySelectorAll('[data-preset]').forEach(btn => {
  btn.addEventListener('click', () => {
    const [s, h, r, w, c, n] = btn.dataset.preset.split(',').map(Number);
    preset(s, h, r, w, c, n);
  });
});

document.getElementById('roi-send').addEventListener('click', function () {
  const emailEl = document.getElementById('roi-email');
  const msgEl   = document.getElementById('roi-cta-msg');
  const email   = (emailEl.value || '').trim();

  if (!email) {
    msgEl.style.color = 'var(--red-600)';
    msgEl.textContent = 'Please enter your email address.';
    msgEl.style.display = 'block';
    emailEl.focus();
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    msgEl.style.color = 'var(--red-600)';
    msgEl.textContent = "That email doesn't look right. Please check it.";
    msgEl.style.display = 'block';
    emailEl.focus();
    return;
  }

  const payload = Object.assign({ form: 'roi', email, intent: 'email_results' }, ROI_STATE);
  if (window.cenarisForms && typeof window.cenarisForms.submit === 'function') {
    window.cenarisForms.submit('roi', payload).catch(() => {});
  }

  this.disabled = true;
  this.textContent = 'Sent ✓';
  msgEl.style.color = 'var(--green-700)';
  msgEl.textContent = '✓ On its way. Check your inbox shortly.';
  msgEl.style.display = 'block';
  try { if (typeof window.trackROICalculatorComplete === 'function') window.trackROICalculatorComplete('email_results'); } catch (_) {}
});

document.getElementById('roi-book').addEventListener('click', function (e) {
  if (!captureRoiClick('book_call', this.href, true)) e.preventDefault();
});

document.getElementById('roi-waitlist').addEventListener('click', function (e) {
  if (!captureRoiClick('join_waitlist', this.href, false)) e.preventDefault();
});

compute();
