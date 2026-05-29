'use strict';

async function login() {
  const btn = document.getElementById('submit-btn');
  const err = document.getElementById('err');
  const pw  = document.getElementById('pw').value;
  err.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    const r = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    const data = await r.json();
    if (data.ok) {
      window.location.href = '/admin/chat';
    } else {
      err.textContent = data.error || 'Incorrect password.';
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  } catch {
    err.textContent = 'Network error. Please try again.';
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
}

document.getElementById('pw').addEventListener('keydown', e => {
  if (e.key === 'Enter') login();
});
document.getElementById('submit-btn').addEventListener('click', login);
