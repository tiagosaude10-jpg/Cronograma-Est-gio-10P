(function () {
  'use strict';

  var preceptorRecords = null;

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

  function isPreceptorPart(part) {
    return /\b(prof|profª|profa|prec|preceptor|preceptora|dra|dr)\.?\b/i.test(part);
  }

  function personKey(label) {
    return normalize(String(label || '').replace(/^\s*(prof(?:ª|a)?|prec|preceptor(?:a)?|dra?|dr)\.?\s*/i, ''));
  }

  function parseChip(detail, title) {
    var parts = String(detail || '').split('·').map(function (part) {
      return part.trim();
    }).filter(Boolean);
    var preceptors = parts.filter(isPreceptorPart);
    var locations = parts.filter(function (part) {
      return !isPreceptorPart(part) && !/\d{1,2}h/i.test(part);
    });

    return {
      preceptors: preceptors,
      location: locations[0] || title || 'Local não informado'
    };
  }

  function addUnique(list, value) {
    if (value && list.indexOf(value) === -1) list.push(value);
  }

  function collectPreceptors() {
    if (preceptorRecords) return preceptorRecords;

    var recordMap = {};
    var weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    document.querySelectorAll('.content').forEach(function (content) {
      var contextElement = content.querySelector('.ctxstrip');
      var avatars = content.querySelectorAll('.avatars .avatar');
      if (!contextElement || !avatars.length) return;

      var specialty = content.id.indexOf('content-obst-') === 0 ? 'Obstetrícia' : 'Pediatria';
      var context = contextElement.textContent.replace(/\s+/g, ' ').trim();
      var students = Array.prototype.map.call(avatars, avatarName);

      content.querySelectorAll('.weekcard[data-ini]').forEach(function (week) {
        var startValue = week.getAttribute('data-ini');
        var start = new Date(startValue + 'T00:00:00');
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
            var parsed = parseChip(detail, title);

            parsed.preceptors.forEach(function (label) {
              var key = personKey(label);
              if (!key) return;
              var recordKey = specialty + '|' + key;

              if (!recordMap[recordKey]) {
                recordMap[recordKey] = {
                  key: key,
                  name: label,
                  normalizedName: normalize(label + ' ' + key),
                  specialty: specialty,
                  eventMap: {}
                };
              }

              var eventKey = startValue + '|' + dayIndex + '|' + timeCell.textContent.trim() + '|' + normalize(title) + '|' + normalize(parsed.location);
              var event = recordMap[recordKey].eventMap[eventKey];
              if (!event) {
                event = recordMap[recordKey].eventMap[eventKey] = {
                  date: date,
                  weekday: weekdays[date.getDay()],
                  time: timeCell.textContent.trim(),
                  location: parsed.location,
                  activity: title,
                  students: [],
                  contexts: []
                };
              }

              students.forEach(function (student) {
                addUnique(event.students, student);
              });
              addUnique(event.contexts, context);
            });
          }
        }
      });
    });

    preceptorRecords = Object.keys(recordMap).map(function (recordKey) {
      var record = recordMap[recordKey];
      record.events = Object.keys(record.eventMap).map(function (eventKey) {
        return record.eventMap[eventKey];
      }).sort(function (a, b) {
        var dateDifference = a.date - b.date;
        return dateDifference || a.time.localeCompare(b.time, 'pt-BR');
      });
      delete record.eventMap;
      return record;
    });

    return preceptorRecords;
  }

  function choiceHtml(record, index) {
    return '<button class="student-choice" type="button" data-preceptor-index="' + index + '">' +
      '<span><span class="student-choice-name">' + escapeHtml(record.name) + '</span>' +
      '<span class="student-choice-context">' + escapeHtml(record.specialty + ' · ' + record.events.length + ' atividades no período') + '</span></span>' +
      '<span class="student-choice-arrow" aria-hidden="true">›</span></button>';
  }

  function tableHtml(record) {
    var rows = record.events.map(function (entry) {
      var day = String(entry.date.getDate()).padStart(2, '0');
      var month = String(entry.date.getMonth() + 1).padStart(2, '0');
      var year = entry.date.getFullYear();
      return '<tr>' +
        '<td class="student-date">' + day + '/' + month + '/' + year + '<span class="student-weekday">' + escapeHtml(entry.weekday) + '</span></td>' +
        '<td>' + escapeHtml(entry.time) + '</td>' +
        '<td><span class="student-location">' + escapeHtml(entry.location) + '</span><span class="student-activity">' + escapeHtml(entry.activity) + '</span></td>' +
        '<td><span class="preceptor-students">' + escapeHtml(entry.students.join(' · ')) + '</span><span class="preceptor-groups">' + escapeHtml(entry.contexts.join(' | ')) + '</span></td>' +
        '</tr>';
    }).join('');

    return '<section class="student-selected">' +
      '<div class="student-selected-head"><div><div class="student-selected-name">' + escapeHtml(record.name) + '</div>' +
      '<div class="student-selected-context">' + escapeHtml(record.specialty + ' · cronograma completo da preceptora') + '</div></div>' +
      '<button type="button" class="student-change" id="preceptor-change">Trocar preceptora</button></div>' +
      '<div class="student-schedule-title">CRONOGRAMA COMPLETO · ' + record.events.length + ' ATIVIDADES</div>' +
      '<div class="student-schedule-wrap"><table class="student-schedule preceptor-schedule"><thead><tr><th>DATA</th><th>HORÁRIO</th><th>CAMPO / ATIVIDADE</th><th>ALUNOS / GRUPOS</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="student-table-note">Deslize a tabela para os lados para visualizar alunos e grupos.</div>' +
      '</section>';
  }

  onReady(function () {
    var input = document.getElementById('preceptor-search');
    var clear = document.getElementById('preceptor-search-clear');
    var status = document.getElementById('preceptor-search-status');
    var results = document.getElementById('preceptor-search-results');
    var currentMatches = [];
    if (!input || !clear || !status || !results) return;

    function bindChoices() {
      results.querySelectorAll('[data-preceptor-index]').forEach(function (button) {
        button.addEventListener('click', function () {
          var record = currentMatches[Number(button.getAttribute('data-preceptor-index'))];
          if (!record) return;
          results.innerHTML = tableHtml(record);
          status.textContent = '';
          var change = document.getElementById('preceptor-change');
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

      currentMatches = collectPreceptors().filter(function (record) {
        return record.specialty === specialty && record.normalizedName.indexOf(query) !== -1;
      }).sort(function (a, b) {
        return a.name.localeCompare(b.name, 'pt-BR');
      }).slice(0, 20);

      if (!currentMatches.length) {
        status.textContent = 'Nenhuma preceptora encontrada em ' + specialty + '.';
        return;
      }

      status.textContent = 'Selecione a preceptora em ' + specialty + ':';
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
