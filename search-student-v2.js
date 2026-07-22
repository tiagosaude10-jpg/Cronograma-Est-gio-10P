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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function avatarName(avatar) {
    var copy = avatar.cloneNode(true);
    var initials = copy.querySelector('.circ');
    if (initials) initials.remove();
    return copy.textContent.trim();
  }

  function activeSpecialty() {
    var obst = document.getElementById('s-obst');
    return obst && obst.checked ? 'Obstetrícia' : 'Pediatria';
  }

  function collectStudents() {
    if (studentRecords) return studentRecords;
    studentRecords = [];

    document.querySelectorAll('.content').forEach(function (content) {
      var context = content.querySelector('.ctxstrip');
      var avatars = content.querySelectorAll('.avatars .avatar');
      if (!context || !avatars.length) return;

      var specialty = content.id.indexOf('content-obst-') === 0 ? 'Obstetrícia' : 'Pediatria';
      Array.prototype.forEach.call(avatars, function (avatar) {
        var name = avatarName(avatar);
        studentRecords.push({
          name: name,
          normalizedName: normalize(name),
          specialty: specialty,
          context: context.textContent.replace(/\s+/g, ' ').trim(),
          content: content
        });
      });
    });

    return studentRecords;
  }

  function parseDetail(detail, fallbackTitle) {
    var parts = String(detail || '').split('·').map(function (part) {
      return part.trim();
    }).filter(Boolean);
    var preceptorParts = parts.filter(function (part) {
      return /\b(prof|profª|profa|prec|preceptor|dra|dr)\.?\b/i.test(part);
    });
    var locationParts = parts.filter(function (part) {
      return preceptorParts.indexOf(part) === -1 && !/\d{1,2}h/i.test(part);
    });

    return {
      location: locationParts[0] || fallbackTitle || 'Local não informado',
      preceptor: preceptorParts.join(' · ') || 'Não informado'
    };
  }

  function fullSchedule(record) {
    var entries = [];
    var weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    record.content.querySelectorAll('.weekcard[data-ini]').forEach(function (week) {
      var start = new Date(week.getAttribute('data-ini') + 'T00:00:00');
      var rows = week.querySelectorAll('table tr');

      for (var dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        var date = new Date(start);
        date.setDate(start.getDate() + dayIndex);

        for (var rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
          var timeCell = rows[rowIndex].querySelector('.blkname');
          var activityCell = rows[rowIndex].children[dayIndex + 1];
          var chip = activityCell && activityCell.querySelector('.chip');
          if (!timeCell || !chip) continue;

          var titleElement = chip.querySelector('.t');
          var detailElement = chip.querySelector('.s');
          var title = titleElement ? titleElement.textContent.trim() : 'Atividade de estágio';
          var detail = detailElement ? detailElement.textContent.trim() : '';
          var parsed = parseDetail(detail, title);

          entries.push({
            date: date,
            weekday: weekdays[date.getDay()],
            time: timeCell.textContent.trim(),
            location: parsed.location,
            activity: title,
            preceptor: parsed.preceptor,
            detail: detail
          });
        }
      }
    });

    entries.sort(function (a, b) {
      return a.date - b.date;
    });
    return entries;
  }

  function choiceHtml(record, index) {
    return '<button class="student-choice" type="button" data-student-index="' + index + '">' +
      '<span><span class="student-choice-name">' + escapeHtml(record.name) + '</span>' +
      '<span class="student-choice-context">' + escapeHtml(record.context) + '</span></span>' +
      '<span class="student-choice-arrow" aria-hidden="true">›</span></button>';
  }

  function tableHtml(record) {
    var entries = fullSchedule(record);
    var rows = entries.map(function (entry) {
      var day = String(entry.date.getDate()).padStart(2, '0');
      var month = String(entry.date.getMonth() + 1).padStart(2, '0');
      var year = entry.date.getFullYear();
      return '<tr>' +
        '<td class="student-date">' + day + '/' + month + '/' + year + '<span class="student-weekday">' + escapeHtml(entry.weekday) + '</span></td>' +
        '<td>' + escapeHtml(entry.time) + '</td>' +
        '<td><span class="student-location">' + escapeHtml(entry.location) + '</span><span class="student-activity">' + escapeHtml(entry.activity) + '</span></td>' +
        '<td class="student-preceptor">' + escapeHtml(entry.preceptor) + '</td>' +
        '</tr>';
    }).join('');

    var schedule = entries.length ?
      '<div class="student-schedule-wrap"><table class="student-schedule"><thead><tr><th>DATA</th><th>HORÁRIO</th><th>CAMPO / ATIVIDADE</th><th>PRECEPTOR</th></tr></thead><tbody>' + rows + '</tbody></table></div>' :
      '<div class="student-table-empty">Nenhuma atividade de estágio foi encontrada neste período.</div>';

    return '<section class="student-selected">' +
      '<div class="student-selected-head"><div><div class="student-selected-name">' + escapeHtml(record.name) + '</div>' +
      '<div class="student-selected-context">' + escapeHtml(record.specialty + ' · ' + record.context) + '</div></div>' +
      '<button type="button" class="student-change" id="student-change">Trocar aluno</button></div>' +
      '<div class="student-schedule-title">CRONOGRAMA COMPLETO · ' + entries.length + ' ATIVIDADES</div>' +
      schedule +
      '<div class="student-table-note">Deslize a tabela para os lados para visualizar todas as colunas.</div>' +
      '</section>';
  }

  onReady(function () {
    var input = document.getElementById('student-search');
    var clear = document.getElementById('student-search-clear');
    var status = document.getElementById('student-search-status');
    var results = document.getElementById('student-search-results');
    var currentMatches = [];
    if (!input || !clear || !status || !results) return;

    function bindChoices() {
      results.querySelectorAll('[data-student-index]').forEach(function (button) {
        button.addEventListener('click', function () {
          var record = currentMatches[Number(button.getAttribute('data-student-index'))];
          if (!record) return;
          results.innerHTML = tableHtml(record);
          status.textContent = '';
          var change = document.getElementById('student-change');
          if (change) change.addEventListener('click', runSearch);
        });
      });
    }

    function runSearch() {
      var query = normalize(input.value);
      var specialty = activeSpecialty();
      clear.style.display = query ? 'block' : 'none';
      results.innerHTML = '';

      if (query.length < 2) {
        status.textContent = query ? 'Digite mais uma letra para pesquisar.' : '';
        return;
      }

      currentMatches = collectStudents().filter(function (record) {
        return record.specialty === specialty && record.normalizedName.indexOf(query) !== -1;
      }).sort(function (a, b) {
        return a.name.localeCompare(b.name, 'pt-BR');
      }).slice(0, 20);

      if (!currentMatches.length) {
        status.textContent = 'Nenhum aluno encontrado em ' + specialty + '.';
        return;
      }

      status.textContent = 'Selecione o aluno em ' + specialty + ':';
      results.innerHTML = '<div class="student-choices">' + currentMatches.map(choiceHtml).join('') + '</div>';
      bindChoices();
    }

    input.addEventListener('input', runSearch);
    input.addEventListener('search', runSearch);
    clear.addEventListener('click', function () {
      input.value = '';
      runSearch();
      input.focus();
    });

    ['s-obst', 's-ped'].forEach(function (id) {
      var tab = document.getElementById(id);
      if (tab) tab.addEventListener('change', function () {
        if (input.value.trim()) runSearch();
      });
    });
  });
})();
