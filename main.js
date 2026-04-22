// ── INTERSECTION OBSERVER — fade-up animations ────────────────────────────
function observeFadeUp(el) {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const visiblePeers = Array.from(
        document.querySelectorAll('.fade-up:not(.visible)')
      ).filter(peer => {
        const r = peer.getBoundingClientRect();
        return r.top < window.innerHeight && r.bottom > 0;
      });
      const delay = Math.max(0, visiblePeers.indexOf(entry.target)) * 80;
      setTimeout(() => entry.target.classList.add('visible'), delay);
      obs.disconnect();
    });
  }, { threshold: 0.05 });
  obs.observe(el);
}

window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.fade-up').forEach(el => observeFadeUp(el));
});

// ── MOBILE NAV ────────────────────────────────────────────────────────────
function toggleMobileNav() {
  const menu = document.getElementById('navMobileMenu');
  const btn  = document.getElementById('navHamburger');
  if (!menu || !btn) return;
  menu.classList.toggle('open');
  btn.classList.toggle('open');
}
function closeMobileNav() {
  const menu = document.getElementById('navMobileMenu');
  const btn  = document.getElementById('navHamburger');
  if (menu) menu.classList.remove('open');
  if (btn)  btn.classList.remove('open');
}
document.addEventListener('click', e => {
  const nav = document.querySelector('nav');
  if (nav && !nav.contains(e.target)) closeMobileNav();
});
