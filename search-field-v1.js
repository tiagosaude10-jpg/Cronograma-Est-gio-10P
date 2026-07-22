(function () {
  'use strict';

  var fieldRecords = null;

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

  function looksLikeField(value) {
    return /\b(hmmi|hrc|creami|ubs|upa|pnar|pnbr|uti|usg|hospital|maternidade|policl[ií]nica|enfermaria|ambulat[oó]rio|neonatologia|pediatria)\b/i.test(value);
  }

  function parseChip(detail, title) {
    var parts = String(detail || '').split('·').map(function (part) {
      return part.trim();
    }).filter(Boolean);
    var preceptors = parts.filter(isPreceptorPart);
    var locations = parts.filter(function (part) {
      return !isPreceptorPart(part) &&
        !/\d{1,2}h/i.test(part) &&
        !/^(at[eé]|conforme)\b/i.test(part);
    });
    var explicitLocation = locations[0] || '';
    var field = title;

    if (explicitLocation) {
      if (looksLikeField(title)) {
        var normalizedTitle = normalize(title);
        var normalizedLocation = normalize(explicitLocation);
        field = normalizedTitle.indexOf(normalizedLocation) !== -1 ? title : title + ' · ' + explicitLocation;
      } else {
        field = explicitLocation;
      }
    }

    return {
      field: field || 'Campo não informado',
      preceptors: preceptors
    };
  }

  function addUnique(list, value) {
    if (value && list.indexOf(value) === -1) list.push(value);
  }

  function collectFields() {
    if (fieldRecords) return fieldRecords;

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
            var fieldKey = normalize(parsed.field);
            if (!fieldKey) continue;
            var recordKey = specialty + '|' + fieldKey;

            if (!recordMap[recordKey]) {
              recordMap[recordKey] = {
                key: fieldKey,
                name: parsed.field,
                normalizedName: normalize(parsed.field),
                specialty: specialty,
                eventMap: {}
              };
            }

            var eventKey = startValue + '|' + dayIndex + '|' + timeCell.textContent.trim() + '|' + normalize(title) + '|' + normalize(parsed.preceptors.join(' '));
            var event = recordMap[recordKey].eventMap[eventKey];
            if (!event) {
              event = recordMap[recordKey].eventMap[eventKey] = {
                date: date,
                weekday: weekdays[date.getDay()],
                time: timeCell.textContent.trim(),
                activity: title,
                preceptors: parsed.preceptors.length ? parsed.preceptors.slice() : ['Não informado'],
                students: [],
                contexts: []
              };
            }

            parsed.preceptors.forEach(function (preceptor) {
              if (event.preceptors[0] === 'Não informado') event.preceptors = [];
              addUnique(event.preceptors, preceptor);
            });
            students.forEach(function (student) {
              addUnique(event.students, student);
            });
            addUnique(event.contexts, context);
          }
        }
      });
    });

    fieldRecords = Object.keys(recordMap).map(function (recordKey) {
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

    return fieldRecords;
  }

  function choiceHtml(record, index) {
    return '<button class="student-choice" type="button" data-field-index="' + index + '">' +
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
        '<td><span class="student-location">' + escapeHtml(entry.activity) + '</span></td>' +
        '<td><span class="field-preceptors">' + escapeHtml(entry.preceptors.join(' · ')) + '</span></td>' +
        '<td><span class="preceptor-students">' + escapeHtml(entry.students.join(' · ')) + '</span><span class="preceptor-groups">' + escapeHtml(entry.contexts.join(' | ')) + '</span></td>' +
        '</tr>';
    }).join('');

    return '<section class="student-selected">' +
      '<div class="student-selected-head"><div><div class="student-selected-name">' + escapeHtml(record.name) + '</div>' +
      '<div class="student-selected-context">' + escapeHtml(record.specialty + ' · programação completa do campo') + '</div></div>' +
      '<button type="button" class="student-change" id="field-change">Trocar campo</button></div>' +
      '<div class="student-schedule-title">PROGRAMAÇÃO COMPLETA · ' + record.events.length + ' ATIVIDADES</div>' +
      '<div class="student-schedule-wrap"><table class="student-schedule field-schedule"><thead><tr><th>DATA</th><th>HORÁRIO</th><th>ATIVIDADE</th><th>PRECEPTOR</th><th>ALUNOS / GRUPOS</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="student-table-note">Deslize a tabela para os lados para visualizar preceptores, alunos e grupos.</div>' +
      '</section>';
  }

  onReady(function () {
    var input = document.getElementById('field-search');
    var clear = document.getElementById('field-search-clear');
    var status = document.getElementById('field-search-status');
    var results = document.getElementById('field-search-results');
    var currentMatches = [];
    if (!input || !clear || !status || !results) return;

    function bindChoices() {
      results.querySelectorAll('[data-field-index]').forEach(function (button) {
        button.addEventListener('click', function () {
          var record = currentMatches[Number(button.getAttribute('data-field-index'))];
          if (!record) return;
          results.innerHTML = tableHtml(record);
          status.textContent = '';
          var change = document.getElementById('field-change');
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

      currentMatches = collectFields().filter(function (record) {
        return record.specialty === specialty && record.normalizedName.indexOf(query) !== -1;
      }).sort(function (a, b) {
        return a.name.localeCompare(b.name, 'pt-BR');
      }).slice(0, 30);

      if (!currentMatches.length) {
        status.textContent = 'Nenhum campo encontrado em ' + specialty + '.';
        return;
      }

      status.textContent = 'Selecione o campo em ' + specialty + ':';
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
