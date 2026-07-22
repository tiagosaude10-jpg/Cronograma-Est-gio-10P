(function () {
  'use strict';

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function findVisibleContent() {
    var contents = document.querySelectorAll('.content');
    for (var index = 0; index < contents.length; index += 1) {
      if (window.getComputedStyle(contents[index]).display !== 'none') {
        return contents[index];
      }
    }
    return null;
  }

  function findCurrentWeek(content, today) {
    if (!content) return null;
    var cards = content.querySelectorAll('.weekcard[data-ini][data-fim]');
    for (var index = 0; index < cards.length; index += 1) {
      var start = new Date(cards[index].getAttribute('data-ini') + 'T00:00:00');
      var end = new Date(cards[index].getAttribute('data-fim') + 'T23:59:59');
      if (today >= start && today <= end) return cards[index];
    }
    return null;
  }

  function scrollToToday() {
    var today = new Date();
    var content = findVisibleContent();
    var card = findCurrentWeek(content, today);
    if (!card) return;

    if (typeof card.scrollIntoView === 'function') {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo(0, Math.max(0, card.offsetTop - 80));
    }

    window.setTimeout(function () {
      var wrap = card.querySelector('.gridwrap');
      var headers = card.querySelectorAll('table tr:first-child th:not(.blk)');
      var header = card.querySelector('th.today') || headers[today.getDay()];
      if (!wrap || !header) return;

      var target = Math.max(0, header.offsetLeft - (wrap.clientWidth / 2) + (header.offsetWidth / 2));
      if (typeof wrap.scrollTo === 'function') {
        wrap.scrollTo({ left: target, behavior: 'smooth' });
      } else {
        wrap.scrollLeft = target;
      }
    }, 450);
  }

  function writeToday() {
    var today = new Date();
    var weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    var day = String(today.getDate()).padStart(2, '0');
    var month = String(today.getMonth() + 1).padStart(2, '0');
    var target = document.getElementById('today-date');
    if (target) target.textContent = weekdays[today.getDay()] + ' · ' + day + '/' + month;
  }

  onReady(function () {
    writeToday();
    var button = document.getElementById('today-card');
    if (button) {
      button.addEventListener('click', scrollToToday);
      button.setAttribute('data-today-ready', 'true');
    }
    window.cronogramasGoToToday = scrollToToday;
  });
})();
