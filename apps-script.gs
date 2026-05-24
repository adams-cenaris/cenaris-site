/**
 * ============================================================================
 * Cenaris — Form submissions → Google Sheet + email notification
 * ============================================================================
 *
 * One Apps Script handles ALL forms on the Cenaris site.
 * Each form gets its own tab in the sheet, named after `data.form`
 * (e.g. "partner", "contact"). Per-form column layouts are defined
 * in FORM_SCHEMAS below — add a new form by adding a new entry there.
 *
 * RE-DEPLOYING AFTER EDITS
 * ------------------------
 * Apps Script versions deployments. To make a change live:
 *   Deploy → Manage deployments → pencil icon → Version: "New version" → Deploy.
 * The /exec URL stays the same across new versions.
 *
 * TEST IT
 * -------
 * In the script editor, select `testRun` from the function dropdown and Run.
 * It writes a fake row to every configured form tab + sends a test email.
 *
 * ============================================================================
 */

const SHEET_ID     = '1MRGf6Dh7BU9QziX-COxBeN-w7gDA9Y9mCtGFZlMx-hw';
const NOTIFY_EMAIL = 'info@cenaris.com.au';

// Resend API key — get this from resend.com → API Keys.
// Store it in Apps Script project settings: Project Settings → Script Properties
// → Add property: RESEND_API_KEY = re_xxxxxxxxxxxx
// (Never paste the key directly here — this file is in version control.)
function getResendApiKey() {
  return PropertiesService.getScriptProperties().getProperty('RESEND_API_KEY') || '';
}

// ─── Form schemas ────────────────────────────────────────────────────────────
// Each entry defines the columns shown in that form's tab, in order.
// `[header, dataKey]` — header appears in the sheet, dataKey is the JSON
// field name posted from the website form.
const FORM_SCHEMAS = {
  waitlist: {
    label: 'waitlist signup',
    columns: [
      ['Full name',         'fullName'],
      ['Email',             'email'],
      ['Organisation',      'organisation'],
      ['Role',              'role'],
      ['Organisation type', 'orgType'],
      ['Staff count',       'staff'],
      ['Pain point',        'painPoint'],
      ['Partner interest',  'partnerInterest'],
    ],
  },
  partner: {
    label: 'partner application',
    columns: [
      ['Full name',           'fullName'],
      ['Email',               'email'],
      ['Phone',               'phone'],
      ['Company / role',      'company'],
      ['How they will refer', 'referMethod'],
      ['How they heard',      'heard'],
    ],
  },
  contact: {
    label: 'contact message',
    columns: [
      ['Name',             'fullName'],
      ['Email',            'email'],
      ['Organisation',     'organisation'],
      ['Phone',            'phone'],
      ['Subject',          'subject'],
      ['Message',          'message'],
      ['Newsletter opt-in','newsletter'],
    ],
  },
  quiz: {
    label: 'audit readiness check',
    columns: [
      ['Email',                       'email'],
      ['Score',                       'score'],
      ['Band',                        'band'],
      ['Headline',                    'headline'],
      ['Rights & responsibilities',   'domain_rights'],
      ['Governance & operations',     'domain_governance'],
      ['Provision of supports',       'domain_supports'],
      ['Support environment',         'domain_environment'],
      ['Focus area 1',                'focus_1'],
      ['Focus area 2',                'focus_2'],
      ['Focus area 3',                'focus_3'],
    ],
  },
  newsletter: {
    label: 'newsletter signup',
    columns: [
      ['Email', 'email'],
    ],
  },
  roi: {
    label: 'ROI calculator lead',
    columns: [
      ['Email',                'email'],
      ['Intent',               'intent'],          // book_call | join_waitlist
      ['Suggested plan',       'plan_name'],
      ['Plan $/mo',            'plan_monthly'],
      ['Plan $/yr',            'plan_annual'],
      ['Staff',                'staff'],
      ['Hours/week on compliance', 'hours'],
      ['Blended hourly $',     'rate'],
      ['Audit prep weeks',     'weeks'],
      ['External consultant $/yr', 'consult'],
      ['Non-conformities last audit', 'noncon'],
      ['Current annual cost',  'current_cost'],
      ['Cost with Cenaris',    'cenaris_cost'],
      ['Estimated savings',    'savings'],
      ['Savings %',            'savings_pct'],
      ['Payback (months)',     'payback_months'],
    ],
  },
};

// Tracking columns appended after the form-specific ones on every tab.
const TRACKING_COLUMNS = [
  ['Page',         'page'],
  ['Landing page', 'landing'],
  ['Referrer',     'referrer'],
  ['utm_source',   'utm_source'],
  ['utm_medium',   'utm_medium'],
  ['utm_campaign', 'utm_campaign'],
  ['utm_term',     'utm_term'],
  ['utm_content',  'utm_content'],
  ['gclid',        'gclid'],
  ['fbclid',       'fbclid'],
  ['User agent',   'userAgent'],
];

// ─── Entry points ────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: 'No post data' });
    }
    const data = JSON.parse(e.postData.contents);

    // Honeypot — silently accept and drop bot submissions.
    if (data.company_website) {
      return jsonResponse({ ok: true, dropped: 'honeypot' });
    }

    appendRow(data);
    sendNotification(data);
    if ((data.form || '') === 'quiz' && data.email) {
      sendQuizResultsToUser(data);
    }
    if ((data.form || '') === 'roi' && data.email) {
      sendRoiReportToUser(data);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doGet() {
  return ContentService
    .createTextOutput('Cenaris forms endpoint is live. POST JSON to submit.')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ─── Core logic ──────────────────────────────────────────────────────────────

function appendRow(data) {
  const formKey = (data.form || 'submissions').toString().slice(0, 90);
  const schema  = FORM_SCHEMAS[formKey] || { label: formKey, columns: [] };
  const columns = [['Timestamp', '__timestamp']]
    .concat(schema.columns)
    .concat(TRACKING_COLUMNS);

  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(formKey);
  if (!sheet) {
    sheet = ss.insertSheet(formKey);
    sheet.appendRow(columns.map(c => c[0]));
    sheet.getRange(1, 1, 1, columns.length)
      .setFontWeight('bold')
      .setBackground('#231F20')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);                       // Timestamp
    // Widen first 3-4 data columns for readability.
    for (let i = 0; i < Math.min(4, schema.columns.length); i++) {
      sheet.setColumnWidth(i + 2, 200);
    }
  }

  const row = columns.map(([_, key]) => {
    if (key === '__timestamp') return new Date();
    const v = data[key];
    if (v === undefined || v === null) return '';
    return v;
  });
  sheet.appendRow(row);
}

function sendNotification(data) {
  const formKey = (data.form || '').toString();
  const schema  = FORM_SCHEMAS[formKey] || { label: 'form submission', columns: [] };

  // Refine the label for ROI based on click intent so the inbox subject
  // immediately tells you which CTA was clicked.
  let label = schema.label;
  if (formKey === 'roi') {
    if (data.intent === 'book_call')     label = 'ROI → call request';
    else if (data.intent === 'join_waitlist') label = 'ROI → waitlist signup';
  }

  const who = data.fullName || data.name || data.email || 'anonymous';
  const subject = `[Cenaris] New ${label} — ${who}`;

  const lines = [`A new ${schema.label} just came in.`, ''];
  schema.columns.forEach(([header, key]) => {
    const v = data[key];
    if (v === undefined || v === '' || v === null) return;
    if (header === 'Message' || header === 'How they will refer') {
      lines.push(`${header}:`);
      lines.push(String(v));
      lines.push('');
    } else {
      lines.push(`${header}: ${v}`);
    }
  });

  lines.push('');
  lines.push('— Tracking —');
  ['page','landing','referrer','utm_source','utm_medium','utm_campaign','gclid'].forEach(k => {
    if (data[k]) lines.push(`${k}: ${data[k]}`);
  });
  lines.push('');
  lines.push(`Sheet: https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`);

  MailApp.sendEmail({
    to:      NOTIFY_EMAIL,
    replyTo: data.email || NOTIFY_EMAIL,
    subject: subject,
    body:    lines.join('\n'),
  });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Quiz: send results email to the user ────────────────────────────────────
function sendQuizResultsToUser(data) {
  const score = Number(data.score) || 0;
  const band  = data.band || '';
  const headline = data.headline || 'Your audit readiness results';
  const calendly = 'https://calendly.com/adam-cenaris';

  // Band → color (matches the on-screen palette).
  let bandColor = '#16A34A';
  if (score < 80) bandColor = '#D97706';
  if (score < 40) bandColor = '#DC2626';

  const domains = [
    ['Rights & responsibilities', data.domain_rights],
    ['Governance & operations',   data.domain_governance],
    ['Provision of supports',     data.domain_supports],
    ['Support environment',       data.domain_environment],
  ];
  const focusAreas = [1, 2, 3]
    .map(i => ({ text: data['focus_' + i], domain: data['focus_' + i + '_domain'] }))
    .filter(f => f.text);

  // Plain-text fallback.
  const plain = [
    `Your audit readiness score: ${score}/100 (${band})`,
    headline,
    '',
    'Score by domain:',
    ...domains.map(([n, v]) => `  • ${n}: ${v ?? '—'}`),
    '',
    'Top 3 focus areas:',
    ...focusAreas.map((f, i) => `  ${i + 1}. ${f.text}  (${f.domain})`),
    '',
    `Book a 20-min walk-through with Adam: ${calendly}`,
    '',
    'This is a self-assessment indicator only. It does not constitute an audit, certification or regulatory assessment.',
    '',
    '— The Cenaris team',
    'https://cenaris.com.au',
  ].join('\n');

  // HTML email.
  const domainRowsHtml = domains.map(([name, v]) => {
    const pct = Math.max(0, Math.min(100, Number(v) || 0));
    const c = pct >= 80 ? '#16A34A' : pct >= 40 ? '#D97706' : '#DC2626';
    return `
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#231F20;width:55%">${escapeHtml(name)}</td>
        <td style="padding:8px 0">
          <div style="background:#ECEEF2;border-radius:999px;height:8px;width:100%;overflow:hidden">
            <div style="background:${c};height:8px;width:${pct}%;border-radius:999px"></div>
          </div>
        </td>
        <td style="padding:8px 0 8px 12px;font-size:14px;font-weight:700;color:${c};text-align:right;width:48px">${pct}</td>
      </tr>`;
  }).join('');

  const focusListHtml = focusAreas.map((f, i) => `
    <li style="margin:0 0 14px 0;padding:0">
      <div style="font-weight:600;color:#231F20;line-height:1.4;font-size:15px">${escapeHtml(f.text)}</div>
      <div style="font-size:12px;color:#6E7787;margin-top:2px">${escapeHtml(f.domain || '')}</div>
    </li>`).join('');

  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F5F6F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#231F20">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F5F6F8;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #DDE0E7">

        <tr><td style="padding:28px 32px 0 32px">
          <div style="font-size:12px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#4A9FCC">Cenaris · Audit Readiness Check</div>
          <h1 style="font-size:22px;font-weight:700;line-height:1.3;margin:14px 0 6px 0;color:#231F20">Your audit readiness results</h1>
          <p style="margin:0;color:#6E7787;font-size:14px;line-height:1.55">${escapeHtml(headline)}</p>
        </td></tr>

        <tr><td style="padding:24px 32px">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F5F6F8;border-radius:10px">
            <tr>
              <td style="padding:24px 28px" align="left">
                <div style="font-size:12px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#6E7787">Readiness score</div>
                <div style="font-size:48px;font-weight:800;letter-spacing:-0.02em;line-height:1;margin:6px 0 4px 0;color:#0E1A2B">${score}<span style="font-size:22px;color:#6E7787;font-weight:600"> / 100</span></div>
                <div style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.1em;background:${bandColor};color:#FFFFFF">${escapeHtml(band)}</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:8px 32px 24px 32px">
          <div style="font-size:13px;font-weight:600;color:#231F20;margin:0 0 8px 0">Score by domain</div>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${domainRowsHtml}</table>
        </td></tr>

        ${focusAreas.length ? `
        <tr><td style="padding:0 32px 24px 32px">
          <div style="font-size:13px;font-weight:600;color:#231F20;margin:0 0 12px 0">Top 3 focus areas</div>
          <ol style="margin:0;padding-left:20px">${focusListHtml}</ol>
        </td></tr>` : ''}

        <tr><td style="padding:0 32px 28px 32px">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0E1A2B;border-radius:10px">
            <tr><td style="padding:24px 28px" align="center">
              <div style="color:#FFFFFF;font-size:16px;font-weight:700;margin-bottom:6px">Want a personalised walk-through?</div>
              <div style="color:rgba(255,255,255,0.75);font-size:13px;line-height:1.55;margin-bottom:16px">Adam runs a 20-minute walk-through of your results and the evidence Cenaris would surface for each domain.</div>
              <a href="${calendly}" style="display:inline-block;background:#4A9FCC;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:8px">Book a 20-min walk-through →</a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 32px 24px 32px">
          <p style="font-size:12px;color:#6E7787;line-height:1.55;margin:0">This is a self-assessment indicator only. It does not constitute an audit, certification or regulatory assessment. Reply to this email if you'd like to chat through your results.</p>
        </td></tr>

        <tr><td style="padding:18px 32px 28px 32px;border-top:1px solid #DDE0E7">
          <div style="font-size:12px;color:#6E7787">— The Cenaris team · <a href="https://cenaris.com.au" style="color:#4A9FCC;text-decoration:none">cenaris.com.au</a></div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

  sendViaResend({
    to:      data.email,
    subject: `Your Cenaris audit readiness results — ${score}/100`,
    plain:   plain,
    html:    html,
  });
}

// Sends an email via Resend so it comes from info@cenaris.com.au.
// Falls back to MailApp if no API key is set (so testRun still works before setup).
function sendViaResend({ to, subject, plain, html }) {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    MailApp.sendEmail({ to, replyTo: NOTIFY_EMAIL, subject, body: plain, htmlBody: html, name: 'Cenaris' });
    return;
  }
  const res = UrlFetchApp.fetch('https://api.resend.com/emails', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify({
      from:    'Cenaris <' + NOTIFY_EMAIL + '>',
      to:      [to],
      reply_to: NOTIFY_EMAIL,
      subject: subject,
      text:    plain,
      html:    html,
    }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('Resend error ' + res.getResponseCode() + ': ' + res.getContentText());
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── ROI: send personalised report email to the user ─────────────────────────
function sendRoiReportToUser(data) {
  const intent     = data.intent || '';
  const planName   = data.plan_name || '—';
  const planMonth  = data.plan_monthly || '—';
  const planYear   = data.plan_annual || '—';
  const currentCost = Number(data.current_cost) || 0;
  const cenarisCost = Number(data.cenaris_cost) || 0;
  const savings    = Number(data.savings) || 0;
  const savingsPct = data.savings_pct ?? '—';
  const payback    = data.payback_months || '—';
  const calendly   = 'https://calendly.com/adam-cenaris';
  const waitlist   = 'https://cenaris.com.au/sign-up.html';

  const fmtAUD = n => '$' + Math.round(n).toLocaleString('en-AU');

  // Inputs row
  const inputsHtml = [
    ['Staff',                 data.staff],
    ['Hours/week on compliance', data.hours],
    ['Blended hourly rate',   data.rate ? '$' + data.rate : '—'],
    ['Audit prep weeks',      data.weeks],
    ['Consultant spend',      data.consult ? '$' + Number(data.consult).toLocaleString('en-AU') : '—'],
    ['Non-conformities last audit', data.noncon],
  ].map(([k, v]) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#6E7787;width:60%">${escapeHtml(k)}</td>
      <td style="padding:6px 0;font-size:13px;color:#231F20;font-weight:600;text-align:right">${escapeHtml(v == null || v === '' ? '—' : v)}</td>
    </tr>`).join('');

  // Plain-text fallback
  const plain = [
    `Your Cenaris ROI estimate — savings of ${fmtAUD(savings)}/yr`,
    '',
    `Suggested plan: ${planName} — $${planMonth}/mo ($${planYear}/yr, billed annually).`,
    '',
    `Current annual cost: ${fmtAUD(currentCost)}`,
    `Cost with Cenaris:  ${fmtAUD(cenarisCost)}`,
    `Estimated savings:  ${fmtAUD(savings)} (${savingsPct}% reduction)`,
    `Payback period:      ${payback} months`,
    '',
    `Book a 20-min walk-through with Adam: ${calendly}`,
    `Join the early-bird waitlist:        ${waitlist}`,
    '',
    'These figures are estimates only based on the inputs you provided and industry-blended ratios for NDIS providers. Not a quote.',
    '',
    '— The Cenaris team',
    'https://cenaris.com.au',
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F5F6F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#231F20">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F5F6F8;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #DDE0E7">

        <tr><td style="padding:28px 32px 0 32px">
          <div style="font-size:12px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#4A9FCC">Cenaris · Compliance ROI Estimate</div>
          <h1 style="font-size:22px;font-weight:700;line-height:1.3;margin:14px 0 6px 0;color:#231F20">Your estimated annual savings</h1>
          <p style="margin:0;color:#6E7787;font-size:14px;line-height:1.55">Based on the inputs you entered in the Cenaris compliance ROI calculator.</p>
        </td></tr>

        <tr><td style="padding:24px 32px">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:linear-gradient(135deg,#ECFDF5,#FFFFFF);border:1.5px solid #16A34A;border-radius:10px">
            <tr><td style="padding:24px 28px" align="left">
              <div style="font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#16A34A">Estimated annual savings</div>
              <div style="font-size:44px;font-weight:800;letter-spacing:-0.02em;line-height:1;margin:8px 0 4px 0;color:#16A34A">${fmtAUD(savings)}</div>
              <div style="font-size:13px;color:#16A34A;font-weight:600">${escapeHtml(savingsPct)}% reduction · payback in ${escapeHtml(payback)} months</div>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 32px 24px 32px">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">
            <tr>
              <td width="50%" style="padding:14px 16px;background:#F5F6F8;border-radius:8px 0 0 8px;border-right:2px solid #FFFFFF" align="left">
                <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6E7787">Current annual cost</div>
                <div style="font-size:22px;font-weight:800;color:#0E1A2B;margin-top:4px">${fmtAUD(currentCost)}</div>
              </td>
              <td width="50%" style="padding:14px 16px;background:#0E1A2B;border-radius:0 8px 8px 0" align="left">
                <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.65)">With Cenaris</div>
                <div style="font-size:22px;font-weight:800;color:#FFFFFF;margin-top:4px">${fmtAUD(cenarisCost)}</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:2px">${escapeHtml(planName)} · $${escapeHtml(planMonth)}/mo</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 32px 24px 32px">
          <div style="font-size:13px;font-weight:600;color:#231F20;margin:0 0 10px 0">Your inputs</div>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${inputsHtml}</table>
        </td></tr>

        <tr><td style="padding:0 32px 28px 32px">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0E1A2B;border-radius:10px">
            <tr><td style="padding:24px 28px" align="center">
              <div style="color:#FFFFFF;font-size:16px;font-weight:700;margin-bottom:6px">${intent === 'book_call' ? 'Your call request is in.' : intent === 'join_waitlist' ? 'You\'re on the waitlist track.' : 'Want to talk it through?'}</div>
              <div style="color:rgba(255,255,255,0.75);font-size:13px;line-height:1.55;margin-bottom:16px">Adam runs 20-minute walk-throughs of these numbers and the evidence Cenaris would surface for your structure. No sales pitch.</div>
              <a href="${calendly}" style="display:inline-block;background:#4A9FCC;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:8px">Book a 20-min walk-through →</a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 32px 24px 32px">
          <p style="font-size:12px;color:#6E7787;line-height:1.55;margin:0">These figures are estimates only based on the inputs you provided and industry-blended ratios for NDIS providers. Not a quote. Reply to this email if you'd like to walk through the model.</p>
        </td></tr>

        <tr><td style="padding:18px 32px 28px 32px;border-top:1px solid #DDE0E7">
          <div style="font-size:12px;color:#6E7787">— The Cenaris team · <a href="https://cenaris.com.au" style="color:#4A9FCC;text-decoration:none">cenaris.com.au</a></div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

  sendViaResend({
    to:      data.email,
    subject: `Your Cenaris ROI estimate — ${fmtAUD(savings)}/yr in savings`,
    plain:   plain,
    html:    html,
  });
}

// ─── Test helper ─────────────────────────────────────────────────────────────
// Select `testRun` from the function dropdown and click Run.
function testRun() {
  const testEmail = 'adamstefano@hotmail.com';
  const samples = {
    waitlist: {
      form: 'waitlist',
      fullName: 'Test Waitlist',
      email: testEmail,
      organisation: 'Acme Disability Services',
      role: 'Compliance Manager',
      orgType: 'NDIS provider',
      staff: '11–50',
      painPoint: 'Evidence is scattered across shared drives and no one can find it before an audit.',
      partnerInterest: 'yes',
    },
    partner: {
      form: 'partner',
      fullName: 'Test Partner',
      email: 'test+partner@example.com',
      phone: '0400 000 000',
      company: 'Test Consulting / Director',
      referMethod: 'Existing NDIS consulting clients.',
      heard: 'LinkedIn',
    },
    contact: {
      form: 'contact',
      fullName: 'Test Contact',
      email: 'test+contact@example.com',
      organisation: 'Acme Disability Services',
      phone: '08 0000 0000',
      subject: 'Book a demo',
      message: 'Hello — keen to see a walkthrough next week if possible.',
      newsletter: 'Yes',
    },
    quiz: {
      form: 'quiz',
      email: testEmail,
      score: 64,
      band: 'MOSTLY READY',
      headline: 'Mostly there — a few real risks.',
      domain_rights: 75,
      domain_governance: 50,
      domain_supports: 70,
      domain_environment: 60,
      focus_1: 'Our governance reports are produced from live data, not last-minute compilations.',
      focus_1_domain: 'Governance & operations',
      focus_2: 'Risk is monitored continuously, not just before audits.',
      focus_2_domain: 'Support environment',
      focus_3: 'Every staff member can locate the current policy that applies to their role.',
      focus_3_domain: 'Governance & operations',
    },
    newsletter: {
      form: 'newsletter',
      email: testEmail,
    },
    roi: {
      form: 'roi',
      email: testEmail,
      intent: 'book_call',
      plan_name: 'Tier 2 Assurance',
      plan_monthly: 349,
      plan_annual: 4188,
      staff: 25,
      hours: 12,
      rate: 75,
      weeks: 6,
      consult: 18000,
      noncon: 4,
      current_cost: 75467,
      cenaris_cost: 39715,
      savings: 35752,
      savings_pct: 47,
      payback_months: '1.4',
    },
  };
  Object.keys(samples).forEach(formKey => {
    const data = Object.assign({
      page: '/' + formKey + '.html',
      landing: '/' + formKey + '.html?utm_source=test',
      referrer: 'https://www.google.com/',
      utm_source: 'test',
      utm_medium: 'manual',
      utm_campaign: 'apps-script-test',
      userAgent: 'AppsScript testRun',
    }, samples[formKey]);
    const res = doPost({ postData: { contents: JSON.stringify(data) } });
    console.log(formKey, '→', res.getContent());
  });
}
