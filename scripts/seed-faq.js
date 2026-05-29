/**
 * One-time script: seed the Cenaris FAQ and pricing into the knowledge base.
 * Run: node scripts/seed-faq.js
 * Requires SITE_URL and ADMIN_TOKEN env vars (set automatically by the PowerShell seeding block).
 */

const https = require('https');

const SITE_URL  = process.env.SITE_URL  || 'https://cenaris.com.au';
const TOKEN     = process.env.ADMIN_TOKEN;

function post(path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url  = new URL(SITE_URL + path);
    const req  = https.request({
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(b) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const FAQ = `What is Cenaris?
Cenaris is an Australian-built compliance and audit-readiness platform designed for NDIS and healthcare providers. It helps organisations organise evidence, identify compliance gaps, strengthen governance systems, and prepare for audits in a structured and defensible way. Rather than scrambling before an audit, Cenaris supports continuous compliance across your organisation.

Who is Cenaris for?
Cenaris is built for NDIS registered providers, allied health clinics, aged care services, and disability organisations that need to manage regulatory obligations with clarity and confidence. It is particularly helpful for providers who feel overwhelmed by documentation, unsure whether their systems truly meet the standards, or reliant on consultants to fix things later.

Is Cenaris only for NDIS providers?
No. Cenaris is currently focused on NDIS providers. However, the platform is being built as a structured compliance infrastructure layer, not an NDIS-only tool. Future iterations will expand to broader healthcare and regulated service frameworks including disability, aged care, community health, and broader healthcare.

How does Cenaris align with the NDIS Practice Standards?
Cenaris is structured around the NDIS Practice Standards, including rights and responsibilities, governance and operational management, provision of supports, and the support environment. Evidence is not just stored; it is mapped to the exact areas auditors assess. The platform mirrors the structure regulators use, making audit preparation more logical and transparent.

Does Cenaris guarantee that I will pass an audit?
No platform can ethically guarantee audit outcomes. Audit results depend on real-world service delivery, staff competence, governance maturity, and how systems operate in practice. Cenaris strengthens your readiness, improves visibility, and reduces risk, but ultimate responsibility for compliance remains with your organisation.

How does Cenaris help with governance?
The NDIS Practice Standards place strong emphasis on governance, risk management, incident management, complaints handling, and quality improvement. Cenaris supports these areas by providing structured evidence mapping, audit logs, compliance tracking, and documentation management. This gives leadership teams clearer oversight and helps demonstrate that systems are active, not just written.

Does Cenaris assess provider suitability?
Cenaris does not conduct suitability assessments. However, it supports strong governance documentation and transparency, which can strengthen your overall compliance posture.

Where is data stored?
Cenaris operates on Microsoft Azure cloud infrastructure. Australian hosting options are configured to support compliance with the Privacy Act 1988 and the Australian Privacy Principles. Your organisation retains ownership of its data at all times.

Is Cenaris secure?
Cenaris is designed for regulated healthcare environments. It includes role-based access controls, encrypted storage, secure cloud hosting, audit logging of user activity, and automated backups. Access is permission-based, meaning users only see what they are authorised to see.

Can multiple staff use Cenaris?
Yes. Cenaris supports multiple users within an organisation, each with defined roles such as administrator, compliance manager, auditor, or standard user. Permissions are clearly separated to protect data integrity and maintain accountability.

What makes Cenaris different from generic document storage systems?
Most systems store documents. Cenaris structures them against regulatory frameworks, identifies gaps, tracks corrective actions, and produces audit-aligned reports. It is not a filing cabinet; it is a compliance engine.

Can auditors access the platform?
If you choose, auditors can be given secure, read-only access. This allows them to review mapped evidence and compliance summaries without you manually collating documents at the last minute.

Does Cenaris replace legal or professional advice?
No. Cenaris is a compliance support platform. It does not provide legal advice, clinical advice, or certification guarantees. Responsibility for regulatory compliance remains with the provider organisation.

What are the Cenaris pricing plans?

Free plan: $0 per month, forever free. Includes evidence repository, one compliance framework, manual tagging, basic dashboard, limited Policy Studio, and limited high-level mapping. Good for getting a feel for the platform.

Essentials plan: $149 per month, billed annually. Everything in Free, plus evidence clause-to-mapping, gap analysis, basic manual reminders, full Policy Studio, Audit Readiness View, exportable evidence lists, review schedules, and policy version control. Best for providers that need to get audit-ready on a single framework.

Confidence plan: $349 per month, billed annually. Everything in Essentials, plus two compliance frameworks, exportable audit packs, obligations and risk registers, continuous improvement tracking, task workflows and accountability, compliance calendar and reminders, evidence expiry monitoring, multi-user collaboration, auditor access portal, and executive compliance overview. Best for teams that want ongoing compliance workflows.

Enterprise plan: Custom pricing, contact the team to discuss. Everything in Confidence, plus unlimited frameworks, sites and users, executive dashboards and board reporting, API integrations and evidence automation, enterprise-grade permissions and single sign-on (SSO), cross-framework compliance mapping, regulatory monitoring and audit trails, dedicated onboarding, and priority support. Designed for multi-site networks and aged-care groups with custom integration needs.

How do I get started with Cenaris?
You can join the waitlist at cenaris.com.au or book a demo call directly with the team via the contact page. Cenaris is launching 1 July 2026 with limited early-bird spots available.

How do I book a demo or speak with the Cenaris team?
Adam Stefano (Co-Founder and CEO) personally takes every intro call during the pre-launch period. You can book a free, no-obligation 20-minute call directly at calendly.com/adam-cenaris. There is no sales pressure — Adam uses these calls to understand your organisation's situation and explain how Cenaris could fit. Alternatively, you can send a message via the chat on the website and the team will follow up.

How do I join the waitlist?
You can sign up at cenaris.com.au/sign-up. The waitlist is free and takes about two minutes. Joining early secures founding-member pricing (locked in for as long as you subscribe), first access when the platform launches on 1 July 2026, and a personal onboarding session with Adam in the first 90 days after launch.

What does it mean to be an early-bird or founding member?
Founding members are organisations that join the waitlist before the 1 July 2026 launch. They receive: their chosen plan rate locked in for the lifetime of their subscription (protected from future price increases), first access to the platform ahead of general availability, and direct onboarding support from Adam Stefano personally during the first 90 days. Early-bird spots are limited.`;

async function main() {
  if (!TOKEN) {
    // Auth inline if no token provided
    const auth = await post('/api/admin/auth', { password: process.env.ADMIN_PASSWORD || '' }, {});
    if (!auth.body.token) { console.error('Auth failed:', auth.body); process.exit(1); }
    process.env.ADMIN_TOKEN = auth.body.token;
  }

  const token = process.env.ADMIN_TOKEN;
  process.stdout.write('Seeding FAQ and pricing... ');

  const r = await post('/api/knowledge/seed', {
    title:     'Cenaris FAQ and Pricing',
    sourceUrl: SITE_URL + '/faq',
    content:   FAQ,
  }, { Authorization: 'Bearer ' + token });

  if (r.status === 200) {
    console.log(`OK — ${r.body.chunksCreated} chunks created`);
  } else {
    console.error(`FAIL — ${r.body.error || r.status}`);
    if (r.body.detail) console.error('Detail:', r.body.detail);
  }
}

main().catch(console.error);
