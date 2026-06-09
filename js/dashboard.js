
const body = document.body;
const toggleBtn = document.getElementById('toggleBtn');
const hamburger = document.getElementById('hamburger');
const overlay = document.getElementById('overlay');

/* ── Desktop: collapse / expand ── */
toggleBtn.addEventListener('click', () => {
  body.classList.toggle('collapsed');
});

/* ── Mobile: open drawer ── */
hamburger.addEventListener('click', () => {
  body.classList.add('mobile-open');
  overlay.classList.add('visible');
});

/* ── Mobile: close drawer (overlay click) ── */
overlay.addEventListener('click', closeMobile);

function closeMobile() {
  body.classList.remove('mobile-open');
  overlay.classList.remove('visible');
}

/* close drawer when a nav link is tapped on mobile */
document.querySelectorAll('.sidebar nav a').forEach(a => {
  a.addEventListener('click', () => {
    if (window.innerWidth <= 640) closeMobile();
  });
});
