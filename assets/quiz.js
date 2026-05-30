'use strict';

const QUESTIONS = [
  { d:'Rights & responsibilities', t:'We can produce evidence for every NDIS Practice Standard within 24 hours.' },
  { d:'Governance & operations',   t:'Our policies are version-controlled in a single source of truth.' },
  { d:'Governance & operations',   t:'Every staff member can locate the current policy that applies to their role.' },
  { d:'Provision of supports',     t:'Incident logs are linked to corrective actions that are tracked to closure.' },
  { d:'Support environment',       t:'Supervision notes and training records are stored in one place and tied to roles.' },
  { d:'Rights & responsibilities', t:'We could pass an unannounced audit this week without a "scramble".' },
  { d:'Governance & operations',   t:'Our governance reports are produced from live data, not last-minute compilations.' },
  { d:'Support environment',       t:'Risk is monitored continuously, not just before audits.' },
  { d:'Provision of supports',     t:'Auditor read-only access can be granted in minutes, not days.' },
  { d:'Governance & operations',   t:'The Board / leadership team sees compliance status at least monthly.' },
];
const OPTIONS = [
  { l:'Strongly disagree', v:0 },
  { l:'Disagree',          v:33 },
  { l:'Agree',             v:66 },
  { l:'Strongly agree',    v:100 },
];

const DOMAIN_KEYS = {
  'Rights & responsibilities': 'rights',
  'Governance & operations':   'governance',
  'Provision of supports':     'supports',
  'Support environment':       'environment',
};

let idx = 0;
const answers = new Array(QUESTIONS.length).fill(null);
const QUIZ_STATE = {};

function startQuiz() {
  document.getElementById('intro').style.display = 'none';
  document.getElementById('quiz').style.display = 'block';
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function render() {
  const q = QUESTIONS[idx];
  document.getElementById('q-counter').textContent = `Question ${idx + 1} of ${QUESTIONS.length}`;
  document.getElementById('q-progress').style.width = `${(idx + 1) / QUESTIONS.length * 100}%`;
  document.getElementById('q-domain').textContent = q.d;
  document.getElementById('q-text').textContent = q.t;
  const opts = document.getElementById('q-options');
  opts.innerHTML = '';
  OPTIONS.forEach(o => {
    const btn = document.createElement('button');
    btn.className = 'quiz-opt' + (answers[idx] === o.v ? ' selected' : '');
    btn.textContent = o.l;
    btn.onclick = () => { answers[idx] = o.v; next(); };
    opts.appendChild(btn);
  });
  document.getElementById('q-back').style.visibility = idx === 0 ? 'hidden' : 'visible';
}

function next() {
  if (idx < QUESTIONS.length - 1) { idx++; render(); }
  else finish();
}

function back() { if (idx > 0) { idx--; render(); } }

function skip() { answers[idx] = 50; next(); }

function finish() {
  document.getElementById('quiz').style.display = 'none';
  document.getElementById('results').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const valid = answers.map(a => a == null ? 50 : a);
  const score = Math.round(valid.reduce((s, v) => s + v, 0) / valid.length);
  QUIZ_STATE.score = score;

  const numEl  = document.getElementById('score-num');
  const ringEl = document.getElementById('score-ring');
  const bandEl = document.getElementById('score-band');
  let band, ringColor, headline, body;
  if (score >= 80) {
    band = 'AUDIT READY'; ringColor = '#16A34A';
    headline = "You're in good shape.";
    body = "Your systems look defensible. Focus on continuous improvement and tightening the smaller gaps highlighted below. Cenaris can keep that visibility live so you don't drift.";
  } else if (score >= 60) {
    band = 'MOSTLY READY'; ringColor = '#D97706';
    headline = 'Mostly there: a few real risks.';
    body = 'You have foundations in place but specific domains will be exposed in an audit. Address the focus areas below before your next cycle.';
  } else if (score >= 40) {
    band = 'NEEDS WORK'; ringColor = '#D97706';
    headline = 'Meaningful gaps to close.';
    body = 'An unannounced audit would be uncomfortable. Several domains rely on memory or scramble. Cenaris is designed to turn this around in 60–90 days.';
  } else {
    band = 'HIGH RISK'; ringColor = '#DC2626';
    headline = 'High audit risk right now.';
    body = 'Compliance visibility appears reactive. Structured infrastructure is the fastest way back to defensible; start with the three focus areas below.';
  }
  bandEl.textContent = band;
  ringEl.setAttribute('stroke', ringColor);
  QUIZ_STATE.band = band;
  QUIZ_STATE.headline = headline;

  let n = 0;
  const tick = () => { if (n <= score) { numEl.textContent = n; n++; requestAnimationFrame(tick); } };
  tick();
  const circ = 2 * Math.PI * 84;
  ringEl.setAttribute('stroke-dasharray', `${(score / 100) * circ} ${circ}`);

  document.getElementById('result-headline').textContent = headline;
  document.getElementById('result-body').textContent = body;

  const domains = {};
  QUESTIONS.forEach((q, i) => {
    if (!domains[q.d]) domains[q.d] = [];
    domains[q.d].push(valid[i]);
  });
  const bars = document.getElementById('domain-bars');
  bars.innerHTML = '';
  QUIZ_STATE.domains = {};
  Object.entries(domains).forEach(([name, arr]) => {
    const v = Math.round(arr.reduce((s, x) => s + x, 0) / arr.length);
    QUIZ_STATE.domains[name] = v;
    const c = v >= 80 ? '#16A34A' : v >= 60 ? '#D97706' : v >= 40 ? '#D97706' : '#DC2626';
    bars.insertAdjacentHTML('beforeend', `
      <div class="domain-score-row" style="display:grid;grid-template-columns:240px 1fr 50px;gap:14px;align-items:center">
        <div style="font-weight:500;color:var(--gray-800);font-size:14px">${name}</div>
        <div class="mock-bar domain-bar"><span style="width:${v}%;background:${c}"></span></div>
        <div style="font-weight:700;color:${c};text-align:right;font-variant-numeric:tabular-nums">${v}</div>
      </div>
    `);
  });

  const sorted = QUESTIONS.map((q, i) => ({ q, v: valid[i], i })).sort((a, b) => a.v - b.v).slice(0, 3);
  QUIZ_STATE.focusAreas = sorted.map(s => ({ text: s.q.t, domain: s.q.d }));
  const focus = document.getElementById('focus-list');
  focus.innerHTML = '';
  sorted.forEach((s, i) => {
    focus.insertAdjacentHTML('beforeend', `
      <li style="display:flex;gap:14px;align-items:flex-start">
        <div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:var(--blue-50);color:var(--blue-700);display:inline-flex;align-items:center;justify-content:center;font-weight:700">${i + 1}</div>
        <div>
          <div style="font-weight:600;color:var(--gray-900);line-height:1.35">${s.q.t}</div>
          <div style="font-size:13px;color:var(--gray-500);margin-top:4px">${s.q.d}</div>
        </div>
      </li>
    `);
  });
}

async function emailResults() {
  const input = document.getElementById('quiz-email');
  const btn   = document.getElementById('quiz-email-btn');
  const msg   = document.getElementById('quiz-email-msg');
  const form  = document.getElementById('quiz-email-form');
  const email = (input.value || '').trim();

  msg.style.display = 'none';
  msg.style.color = 'rgba(255,255,255,0.9)';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    msg.textContent = 'Please enter a valid email address.';
    msg.style.color = '#FCA5A5';
    msg.style.display = 'block';
    input.focus();
    return;
  }

  btn.disabled = true;
  const origLabel = btn.textContent;
  btn.textContent = 'Sending…';

  const payload = {
    email,
    score: QUIZ_STATE.score,
    band: QUIZ_STATE.band,
    headline: QUIZ_STATE.headline,
  };
  Object.entries(QUIZ_STATE.domains || {}).forEach(([name, v]) => {
    const key = DOMAIN_KEYS[name];
    if (key) payload['domain_' + key] = v;
  });
  (QUIZ_STATE.focusAreas || []).forEach((f, i) => {
    payload['focus_' + (i + 1)] = f.text;
    payload['focus_' + (i + 1) + '_domain'] = f.domain;
  });

  if (!window.cenarisForms || !window.cenarisForms.submit) {
    msg.textContent = 'Form helper not loaded. Please refresh and try again.';
    msg.style.color = '#FCA5A5';
    msg.style.display = 'block';
    btn.disabled = false;
    btn.textContent = origLabel;
    return;
  }

  const result = await window.cenarisForms.submit('quiz', payload);
  if (result && result.ok) {
    form.style.display = 'none';
    msg.textContent = '✓ Sent. Check your inbox (and spam folder just in case).';
    msg.style.display = 'block';
    try { if (typeof window.trackAuditScreenerComplete === 'function') window.trackAuditScreenerComplete(QUIZ_STATE.band); } catch (_) {}
  } else {
    msg.textContent = 'Something went wrong. Please try again, or email info@cenaris.com.au.';
    msg.style.color = '#FCA5A5';
    msg.style.display = 'block';
    btn.disabled = false;
    btn.textContent = origLabel;
  }
}

// Wire up button event listeners once the DOM is ready.
// This script is loaded at the bottom of <body> so the DOM is already parsed.
document.getElementById('quiz-start-btn').addEventListener('click', startQuiz);
document.getElementById('q-back').addEventListener('click', back);
document.getElementById('quiz-skip-btn').addEventListener('click', skip);
document.getElementById('quiz-email-btn').addEventListener('click', emailResults);
