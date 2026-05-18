// Cenaris site chrome — pre-launch bar, nav, footer, cookie banner, countdown.
// Inserted via <script> on every page. Set window.CENARIS_PAGE = 'home' | 'about' | … before loading.
(function () {
  const LAUNCH_ISO = '2026-07-01T00:00:00+10:00';
  const launchTime = new Date(LAUNCH_ISO).getTime();
  const page = window.CENARIS_PAGE || '';

  const navLinks = [
    { href: 'index.html',                 key: 'home',     label: 'Home' },
    { href: 'about.html',                 key: 'about',    label: 'About' },
    { href: 'insights.html',              key: 'insights', label: 'Insights' },
    { href: 'pricing.html',               key: 'pricing',  label: 'Pricing' },
    { href: 'partner-with-us.html',        key: 'partner',  label: 'Partner' },
  ];

  // ── Pre-launch bar ──────────────────────────
  const prelaunchEl = document.getElementById('prelaunch');
  if (prelaunchEl && !sessionStorage.getItem('cenaris-prelaunch-dismissed')) {
    prelaunchEl.innerHTML = `
      <div class="prelaunch">
        <div class="container">
          <span>Cenaris launches 1 July 2026 —</span>
          <span class="countdown-mini" data-mini-cd></span>
          <a href="sign-up.html">Join the waitlist →</a>
          <button class="dismiss" aria-label="Dismiss announcement" data-dismiss-prelaunch>×</button>
        </div>
      </div>`;
    prelaunchEl.querySelector('[data-dismiss-prelaunch]').addEventListener('click', () => {
      sessionStorage.setItem('cenaris-prelaunch-dismissed', '1');
      prelaunchEl.innerHTML = '';
    });
  }

  // ── Nav ─────────────────────────────────────
  const navEl = document.getElementById('nav');
  if (navEl) {
    navEl.innerHTML = `
      <div class="nav-wrap" id="nav-wrap">
        <div class="container nav">
          <a href="index.html" class="nav-logo" aria-label="Cenaris home">
            <img src="assets/logo-horizontal.png" alt="Cenaris" />
          </a>
          <nav class="nav-links" aria-label="Primary">
            ${navLinks.map(l => `<a href="${l.href}" class="${page===l.key?'active':''}">${l.label}</a>`).join('')}
          </nav>
          <div class="nav-cta">
            <a href="contact.html" class="btn btn-ghost btn-sm btn-cta-secondary">Book a demo</a>
            <a href="sign-up.html" class="btn btn-primary btn-sm">Join the waitlist</a>
            <button class="nav-burger" aria-label="Open menu" aria-expanded="false" id="burger">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="17" x2="21" y2="17"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div class="mobile-drawer" id="drawer">
        ${navLinks.map(l => `<a href="${l.href}">${l.label}</a>`).join('')}
        <a href="contact.html">Book a demo</a>
        <a href="sign-up.html" class="btn btn-primary">Join the waitlist</a>
      </div>`;
    const wrap = document.getElementById('nav-wrap');
    window.addEventListener('scroll', () => {
      wrap.classList.toggle('scrolled', window.scrollY > 12);
    });
    const burger = document.getElementById('burger');
    const drawer = document.getElementById('drawer');
    burger.addEventListener('click', () => {
      const open = drawer.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
    });
  }

  // ── Footer ──────────────────────────────────
  const footerEl = document.getElementById('footer');
  if (footerEl) {
    footerEl.innerHTML = `
      <footer class="footer">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-brand">
              <div class="footer-logo">
                <img src="assets/logo-horizontal-white.png" alt="Cenaris" style="height:32px;width:auto;display:block"/>
              </div>
              <p><strong style="color:#fff">Compliance, Simplified.</strong><br/>
              We are currently in the final stages of development, focused on the NDIS Practice Standards. We aim to provide more frameworks in the near future. Spots are limited on the early-bird list for our 1 July 2026 launch — enquire now to secure your spot.</p>
              <div class="au">
                <svg width="24" height="12" viewBox="0 0 60 30" style="border-radius:2px;display:inline-block;flex-shrink:0" aria-label="Australian flag" role="img">
                  <rect width="60" height="30" fill="#012169"/>
                  <clipPath id="au-canton"><rect width="30" height="15"/></clipPath>
                  <g clip-path="url(#au-canton)">
                    <path d="M0,0 L30,15 M30,0 L0,15" stroke="#fff" stroke-width="3"/>
                    <path d="M0,0 L30,15 M30,0 L0,15" stroke="#C8102E" stroke-width="1.6"/>
                    <path d="M15,0 V15 M0,7.5 H30" stroke="#fff" stroke-width="5"/>
                    <path d="M15,0 V15 M0,7.5 H30" stroke="#C8102E" stroke-width="3"/>
                  </g>
                  <g fill="#fff">
                    <circle cx="15" cy="22.5" r="3"/>
                    <circle cx="47" cy="7" r="1.6"/>
                    <circle cx="52" cy="14" r="1.6"/>
                    <circle cx="42" cy="17" r="1.3"/>
                    <circle cx="47" cy="23" r="1.6"/>
                    <circle cx="55" cy="20" r="0.9"/>
                  </g>
                </svg>
                Proudly Australian · Servers hosted in Sydney
              </div>
            </div>
            <div class="footer-col">
              <h4>Product</h4>
              <ul>
                <li><a href="index.html">Home</a></li>
                <li><a href="pricing.html">Pricing</a></li>
                <li><a href="roi.html">ROI calculator</a></li>
                <li><a href="audit-readiness-check.html">Audit readiness check</a></li>
              </ul>
            </div>
            <div class="footer-col">
              <h4>Company</h4>
              <ul>
                <li><a href="about.html">About</a></li>
                <li><a href="partner-with-us.html">Partner with us</a></li>
                <li><a href="insights.html">Insights</a></li>
                <li><a href="contact.html">Contact</a></li>
              </ul>
            </div>
            <div class="footer-col">
              <h4>Legal</h4>
              <ul>
                <li><a href="privacy-policy-tcs.html">Privacy & T&Cs</a></li>
                <li><a href="mailto:info@cenaris.com.au">info@cenaris.com.au</a></li>
                <li><a href="https://calendly.com/adam-cenaris" target="_blank" rel="noopener">Book a demo</a></li>
              </ul>
            </div>
          </div>
          <div class="footer-bottom">
            <div>© 2026 Cenaris Pty Ltd. All rights reserved.</div>
            <div class="footer-social">
              <a href="https://www.facebook.com/788958947637764" aria-label="Facebook" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.3 0-1.7.8-1.7 1.6V12h2.9l-.5 2.9h-2.5v7A10 10 0 0 0 22 12z"/></svg></a>
              <a href="https://www.instagram.com/cenarisai/" aria-label="Instagram" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg></a>
              <a href="https://www.linkedin.com/company/cenariscompliance/" aria-label="LinkedIn" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.3 18.3H5.7v-8.5h2.6v8.5zM7 8.6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm11.3 9.7h-2.6V14c0-1-.4-1.7-1.3-1.7-.7 0-1.1.5-1.3 1-.1.2-.1.4-.1.7v4.3h-2.6v-8.5h2.6v1.2c.3-.6 1-1.4 2.4-1.4 1.8 0 3 1.2 3 3.6v5.1z"/></svg></a>
              <a href="https://www.tiktok.com/@cenaris5" aria-label="TikTok" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.8a4.6 4.6 0 0 1-2.6-1.4 4.6 4.6 0 0 1-1.2-2.4H9.7v12.2a2.4 2.4 0 1 1-1.7-2.3v-3a5.4 5.4 0 1 0 4.8 5.4V9.4a7.6 7.6 0 0 0 4.5 1.5V7.8a4.5 4.5 0 0 1-.7-2z"/></svg></a>
            </div>
          </div>
        </div>
      </footer>`;
  }

  // ── Cookie banner ───────────────────────────
  const cookieEl = document.getElementById('cookie');
  if (cookieEl && !localStorage.getItem('cenaris-cookie')) {
    cookieEl.innerHTML = `
      <div class="cookie" role="dialog" aria-label="Cookie preferences">
        <p>We use a small number of cookies to remember preferences and measure how the site is used. Read our <a href="privacy-policy-tcs.html">privacy policy</a>.</p>
        <div class="row">
          <button class="btn btn-secondary btn-sm" data-cookie="decline">Decline</button>
          <button class="btn btn-primary btn-sm" data-cookie="accept">Accept</button>
        </div>
      </div>`;
    cookieEl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      localStorage.setItem('cenaris-cookie', b.dataset.cookie);
      cookieEl.innerHTML = '';
    }));
  }

  // ── Countdown updates ───────────────────────
  function tick() {
    const now = Date.now();
    const diff = Math.max(0, launchTime - now);
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff / 3600000) % 24);
    const m = Math.floor((diff / 60000) % 60);
    const s = Math.floor((diff / 1000) % 60);
    document.querySelectorAll('[data-cd]').forEach(node => {
      node.innerHTML = `
        <div class="seg"><div class="v">${String(d).padStart(2,'0')}</div><div class="l">Days</div></div>
        <div class="seg"><div class="v">${String(h).padStart(2,'0')}</div><div class="l">Hours</div></div>
        <div class="seg"><div class="v">${String(m).padStart(2,'0')}</div><div class="l">Minutes</div></div>
        <div class="seg"><div class="v">${String(s).padStart(2,'0')}</div><div class="l">Seconds</div></div>`;
    });
    document.querySelectorAll('[data-mini-cd]').forEach(node => {
      node.textContent = `${d}d ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    });
  }
  tick(); setInterval(tick, 1000);

  // Reveal-on-scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
})();
