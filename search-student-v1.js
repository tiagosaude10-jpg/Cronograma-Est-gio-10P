(function () {
  'use strict';

  var studentRecords = null;

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function avatarName(avatar) {
    var copy = avatar.cloneNode(true);
    var initials = copy.querySelector('.circ');
    if (initials) initials.remove();
    return copy.textContent.trim();
  }

  function collectStudents() {
    if (studentRecords) return studentRecords;
    studentRecords = [];

    document.querySelectorAll('.content').forEach(function (content) {
      var context = content.querySelector('.ctxstrip');
      var avatars = content.querySelectorAll('.avatars .avatar');
      if (!context || !avatars.length) return;

      var members = Array.prototype.map.call(avatars, avatarName);
      var specialty = content.id.indexOf('content-obst-') === 0 ? 'Obstetrícia' : 'Pediatria';

      members.forEach(function (name) {
        studentRecords.push({
          name: name,
          normalizedName: normalize(name),
          specialty: specialty,
          context: context.textContent.replace(/\s+/g, ' ').trim(),
          members: members,
          content: content
        });
      });
    });

    return studentRecords;
  }

  function findWeek(content, date) {
    var cards = content.querySelectorAll('.weekcard[data-ini][data-fim]');
    for (var index = 0; index < cards.length; index += 1) {
      var start = new Date(cards[index].getAttribute('data-ini') + 'T00:00:00');
      var end = new Date(cards[index].getAttribute('data-fim') + 'T23:59:59');
      if (date >= start && date <= end) return cards[index];
    }
    return null;
  }

  function scheduleForDay(record, date) {
    var week = findWeek(record.content, date);
    if (!week) return [];
    var rows = week.querySelectorAll('table tr');
    var schedule = [];

    for (var rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      var timeCell = rows[rowIndex].querySelector('.blkname');
      var activityCell = rows[rowIndex].children[date.getDay() + 1];
      if (!timeCell || !activityCell) continue;

      var title = activityCell.querySelector('.t');
      var detail = activityCell.querySelector('.s');
      var free = activityCell.querySelector('.free');
      schedule.push({
        time: timeCell.textContent.trim(),
        title: title ? title.textContent.trim() : (free ? free.textContent.trim() : 'Sem informação'),
        detail: detail ? detail.textContent.trim() : ''
      });
    }

    return schedule;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function resultHtml(record, today) {
    var schedule = scheduleForDay(record, today);
    var date = String(today.getDate()).padStart(2, '0') + '/' + String(today.getMonth() + 1).padStart(2, '0');
    var shifts = schedule.length ? schedule.map(function (item) {
      return '<div class="student-shift">' +
        '<span class="student-shift-time">' + escapeHtml(item.time) + '</span>' +
        '<span class="student-shift-main">' + escapeHtml(item.title) +
        (item.detail ? '<span class="student-shift-detail">' + escapeHtml(item.detail) + '</span>' : '') +
        '</span></div>';
    }).join('') : '<div class="student-empty">Este rodízio não está ativo na data de hoje.</div>';

    return '<article class="student-result">' +
      '<div class="student-result-head"><div class="student-name">' + escapeHtml(record.name) + '</div>' +
      '<span class="student-specialty">' + escapeHtml(record.specialty) + '</span></div>' +
      '<div class="student-context">' + escapeHtml(record.context) + '</div>' +
      '<div class="student-today">HOJE · ' + date + '</div>' +
      '<div class="student-shifts">' + shifts + '</div>' +
      '<details class="student-members"><summary>Ver integrantes do grupo</summary><div>' +
      escapeHtml(record.members.join(' · ')) + '</div></details>' +
      '</article>';
  }

  onReady(function () {
    var input = document.getElementById('student-search');
    var clear = document.getElementById('student-search-clear');
    var status = document.getElementById('student-search-status');
    var results = document.getElementById('student-search-results');
    if (!input || !clear || !status || !results) return;

    function runSearch() {
      var query = normalize(input.value);
      clear.style.display = query ? 'block' : 'none';
      results.innerHTML = '';

      if (query.length < 2) {
        status.textContent = query ? 'Digite mais uma letra para pesquisar.' : '';
        return;
      }

      var matches = collectStudents().filter(function (record) {
        return record.normalizedName.indexOf(query) !== -1;
      }).slice(0, 12);

      if (!matches.length) {
        status.textContent = 'Nenhum aluno encontrado com esse nome.';
        return;
      }

      status.textContent = matches.length + (matches.length === 1 ? ' resultado encontrado.' : ' resultados encontrados.');
      var today = new Date();
      results.innerHTML = matches.map(function (record) {
        return resultHtml(record, today);
      }).join('');
    }

    input.addEventListener('input', runSearch);
    input.addEventListener('search', runSearch);
    clear.addEventListener('click', function () {
      input.value = '';
      runSearch();
      input.focus();
    });
  });
})();
