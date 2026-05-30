'use strict';

// Bar chart fill — animates [data-bar] elements to their target width on load
window.addEventListener('DOMContentLoaded', function () {
  setTimeout(function () {
    document.querySelectorAll('[data-bar]').forEach(function (el) {
      el.style.width = el.dataset.bar + '%';
      el.style.background = el.dataset.barColor || 'var(--blue-400)';
    });
  }, 300);
});

// ROI count-up — triggers when the .roi-card scrolls into view
(function () {
  function fmt(n) {
    return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function fmtK(n) {
    return '$' + Math.round(n) + 'k';
  }
  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  var card = document.querySelector('.roi-card');
  if (!card) return;
  var strongs = card.querySelectorAll('.roi-line strong');
  var targets = [];
  strongs.forEach(function (el) {
    var text = el.textContent.trim();
    var dollarMatch = text.match(/^\$([0-9,]+)$/);
    var kRangeMatch = text.match(/^\$(\d+)k\s*[–-]\s*\$(\d+)k$/);
    if (dollarMatch) {
      targets.push({ el: el, type: 'dollar', val: parseInt(dollarMatch[1].replace(/,/g, ''), 10) });
    } else if (kRangeMatch) {
      targets.push({ el: el, type: 'krange', lo: parseInt(kRangeMatch[1], 10), hi: parseInt(kRangeMatch[2], 10) });
    }
  });
  function runCountUp() {
    var duration = 1200;
    var start = performance.now();
    function frame(now) {
      var t = Math.min((now - start) / duration, 1);
      var p = easeOut(t);
      targets.forEach(function (item) {
        if (item.type === 'dollar') {
          item.el.textContent = fmt(item.val * p);
        } else if (item.type === 'krange') {
          item.el.textContent = fmtK(item.lo * p) + ' – ' + fmtK(item.hi * p);
        }
      });
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        io.unobserve(e.target);
        runCountUp();
      }
    });
  }, { threshold: 0.3 });
  io.observe(card);
})();
