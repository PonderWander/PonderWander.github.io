// ── CONTACT FORM ──────────────────────────────────────────────────────────
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xwvaejpl';

const msgField  = document.getElementById('message');
const charCount = document.getElementById('charCount');

// Character counter
msgField.addEventListener('input', () => {
  const len = msgField.value.length;
  charCount.textContent = len + ' / 1200';
  charCount.classList.toggle('warn', len > 1000);
});

// Client-side validation — highlights empty required fields
function validate(fields) {
  let valid = true;
  fields.forEach(({ id, val }) => {
    const el    = document.getElementById(id);
    const label = el.closest('.field-group').querySelector('.field-label');
    if (!val) {
      label.style.color = '#ff6b6b';
      if (valid) el.focus(); // focus the first invalid field only
      valid = false;
    } else {
      label.style.color = ''; // clear previous error colour
    }
  });
  return valid;
}

// Submit handler
async function handleSubmit() {
  const name  = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const org   = document.getElementById('org').value.trim();
  const type  = document.getElementById('type').value;
  const domain= document.getElementById('domain').value;
  const msg   = document.getElementById('message').value.trim();

  const isValid = validate([
    { id: 'name',    val: name  },
    { id: 'email',   val: email },
    { id: 'type',    val: type  },
    { id: 'message', val: msg   },
  ]);
  if (!isValid) return;

  const btn = document.getElementById('submitBtn');
  btn.disabled    = true;
  btn.textContent = 'Sending...';

  try {
    const res = await fetch(FORMSPREE_ENDPOINT, {
      method:  'POST',
      headers: { 'Accept': 'application/json' },
      body:    new URLSearchParams({
        name,
        email,
        organization: org,
        engagement_type: type,
        domain_of_interest: domain,
        message: msg
      })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    document.getElementById('successMsg').classList.add('visible');
    btn.style.display = 'none';

  } catch (err) {
    console.error('Formspree error:', err);
    btn.disabled    = false;
    btn.textContent = 'Send Message →';
    // Show inline error rather than a blocking alert
    const errEl = document.getElementById('submitError');
    if (errEl) errEl.style.display = 'block';
  }
}
