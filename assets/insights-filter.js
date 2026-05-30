'use strict';

// Category filter + active-state for the Insights grid
(function () {
  var filterBar = document.querySelector('.insights-filters');
  if (!filterBar) return;
  var cards = document.querySelectorAll('.insight-card');
  var emptyMsg = document.querySelector('.insights-empty');
  filterBar.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    filterBar.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('is-active', b === btn);
      if (b === btn) { b.style.background = 'var(--gray-900)'; b.style.color = '#fff'; b.style.borderColor = 'var(--gray-900)'; }
      else { b.style.background = ''; b.style.color = ''; b.style.borderColor = ''; }
    });
    var filter = btn.getAttribute('data-filter');
    var shown = 0;
    cards.forEach(function (c) {
      var match = filter === 'all' || c.getAttribute('data-category') === filter;
      c.style.display = match ? '' : 'none';
      if (match) shown++;
    });
    if (emptyMsg) emptyMsg.style.display = shown === 0 ? 'block' : 'none';
  });
  // Seed initial active state
  var init = filterBar.querySelector('button.is-active');
  if (init) { init.style.background = 'var(--gray-900)'; init.style.color = '#fff'; init.style.borderColor = 'var(--gray-900)'; }
})();
