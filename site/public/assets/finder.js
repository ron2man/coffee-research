// Setup finder and setup-aware guide lists. Two parts that share only the reader's answers:
//   1. The finder ([data-finder], home page) asks one optional question at a time, stores the
//      answers in localStorage ("setup") and announces them with a "ycs:setup" event.
//   2. Any guide list marked [data-setup-list] filters (data-filter) and sorts (data-rank) its rows
//      by those answers, using each row's tags (data-setup). It works on any page, finder or not.
// The matching rules equal site/lib/finder.mjs (questionVisible, fitsProfile); a test keeps them so.
(function () {
  var KEY = 'setup';
  var EVENT = 'ycs:setup';

  // ---- shared: the stored profile ----
  function load() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; }
  }
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: lasts for this page */ }
  }
  function track(name, params) {
    if (!window.dataLayer) return;
    var page = document.body && document.body.getAttribute('data-page');
    if (page) params.page_id = page;
    window.dataLayer.push({ event: name, params: params });
  }

  // ---- rules (pure, tested) ----
  function visible(q, answers) {
    var s = q.showIf || {};
    return Object.keys(s).every(function (k) { return s[k].indexOf(answers[k]) !== -1; });
  }
  function nextFrom(questions, i, answers, skipped) {
    for (var j = i + 1; j < questions.length; j++) {
      var q = questions[j];
      if (visible(q, answers) && !(q.key in answers) && !skipped[q.key]) return q.key;
    }
    return null;
  }
  function fits(tags, answers, filterKeys) {
    return filterKeys.every(function (k) { return !(k in answers) || !tags[k] || tags[k].indexOf(answers[k]) !== -1; });
  }
  function rankScore(tags, answers, rankKeys) {
    return rankKeys.filter(function (k) { return k in answers && tags[k] && tags[k].indexOf(answers[k]) !== -1; }).length;
  }
  window.YCSFinder = { visible: visible, nextFrom: nextFrom, fits: fits, rankScore: rankScore };

  // ---- part 1: the finder ----
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function button(cls, text, onClick) {
    var b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  function mountFinder(root) {
    var data = JSON.parse(root.querySelector('.finder-data').textContent);
    var Q = data.questions;
    var stored = load();
    // First visit: open. Later visits: folded, with the answers in the bar.
    var state = {
      answers: (stored && stored.answers) || {},
      skipped: (stored && stored.skipped) || {},
      folded: !!stored,
      cur: null
    };
    state.cur = nextFrom(Q, -1, state.answers, state.skipped);
    var view = el('div', 'finder-view');
    root.appendChild(view);
    root.hidden = false;

    function indexOf(key) { for (var i = 0; i < Q.length; i++) if (Q[i].key === key) return i; return -1; }
    function labelOf(q, v) { for (var i = 0; i < q.options.length; i++) if (q.options[i][0] === v) return q.options[i][1]; return v; }
    function commit(focus) {
      save({ answers: state.answers, skipped: state.skipped, folded: state.folded });
      document.dispatchEvent(new CustomEvent(EVENT, { detail: { answers: state.answers } }));
      render(focus);
    }
    function choose(q, value) {
      state.answers[q.key] = value;
      Q.forEach(function (x) { if (x.key in state.answers && !visible(x, state.answers)) delete state.answers[x.key]; });
      delete state.skipped[q.key];
      state.cur = nextFrom(Q, indexOf(q.key), state.answers, state.skipped);
      if (!state.cur) state.folded = true; // done: fold, the lists already follow every answer
      track('setup_answer', { question: q.key, answer: value });
      commit(state.folded ? 'bar' : 'question');
    }
    function skip(q) {
      state.skipped[q.key] = true;
      state.cur = nextFrom(Q, indexOf(q.key), state.answers, state.skipped);
      if (!state.cur) state.folded = true;
      track('setup_skip', { question: q.key });
      commit(state.folded ? 'bar' : 'question');
    }
    function edit(key) {
      state.folded = false;
      state.cur = key || nextFrom(Q, -1, state.answers, {}) || Q[0].key;
      if (!key) state.skipped = {};
      track('setup_fold', { folded: 'no' });
      commit('question');
    }
    function fold() {
      state.folded = true;
      track('setup_fold', { folded: 'yes' });
      commit('bar');
    }
    function restart() {
      state.answers = {}; state.skipped = {}; state.folded = false; state.cur = Q[0].key;
      commit('question');
    }

    function chips(into) {
      Q.filter(function (q) { return q.key in state.answers && visible(q, state.answers); }).forEach(function (q) {
        var b = button('finder-chip', labelOf(q, state.answers[q.key]), function () { edit(q.key); });
        b.setAttribute('aria-label', 'Change: ' + q.text + ' ' + labelOf(q, state.answers[q.key]));
        into.appendChild(b);
      });
    }

    function render(focus) {
      view.textContent = '';
      var answered = Object.keys(state.answers).length > 0;
      if (state.folded) {
        var bar = el('div', 'finder-bar');
        if (answered) {
          bar.appendChild(el('span', 'finder-label', 'Your setup'));
          var c = el('span', 'finder-chips'); chips(c); bar.appendChild(c);
          var e = button('finder-edit link-button', 'Edit', function () { edit(null); });
          e.setAttribute('aria-label', 'Edit your setup');
          bar.appendChild(e);
        } else {
          bar.appendChild(el('span', 'finder-invite', 'Get guides that fit your setup. A few questions, all optional.'));
          bar.appendChild(button('finder-start', 'Start', function () { edit(null); }));
        }
        view.appendChild(bar);
        if (focus === 'bar') (bar.querySelector('button') || bar).focus();
        return;
      }
      var card = el('div', 'finder-card');
      var top = el('div', 'finder-top');
      var head = el('div', 'finder-chips');
      head.appendChild(el('span', 'finder-label', 'Your setup'));
      chips(head);
      top.appendChild(head);
      top.appendChild(button('finder-fold link-button', 'Fold', fold));
      card.appendChild(top);

      var q = state.cur ? Q[indexOf(state.cur)] : null;
      if (q) {
        var shown = Q.filter(function (x) { return visible(x, state.answers); });
        var set = el('fieldset', 'finder-q');
        var legend = el('legend');
        legend.appendChild(el('span', 'finder-step', 'Question ' + (shown.indexOf(q) + 1) + ' · optional'));
        var text = el('span', 'finder-text', q.text);
        text.tabIndex = -1;
        legend.appendChild(text);
        set.appendChild(legend);
        var opts = el('div', 'finder-options');
        q.options.forEach(function (o) {
          var b = button('finder-option', o[1], function () { choose(q, o[0]); });
          b.setAttribute('aria-pressed', state.answers[q.key] === o[0] ? 'true' : 'false');
          opts.appendChild(b);
        });
        set.appendChild(opts);
        card.appendChild(set);
        card.appendChild(button('finder-skip link-button', 'Skip this question', function () { skip(q); }));
        view.appendChild(card);
        if (focus === 'question') text.focus();
      } else {
        card.appendChild(el('p', 'finder-done', 'That’s your setup. The guides below follow it.'));
        card.appendChild(button('finder-skip link-button', 'Start over', restart));
        view.appendChild(card);
      }
    }
    render(null);
  }

  // ---- part 2: lists that follow the profile ----
  function mountList(list) {
    var filterKeys = (list.getAttribute('data-filter') || '').split(' ').filter(Boolean);
    var rankKeys = (list.getAttribute('data-rank') || '').split(' ').filter(Boolean);
    var rows = [].slice.call(list.querySelectorAll('li[data-setup]')).map(function (li, i) {
      var tags = {};
      try { tags = JSON.parse(li.getAttribute('data-setup')) || {}; } catch (e) { /* untagged */ }
      return { li: li, tags: tags, i: i };
    });
    var section = list.closest('section') || list.parentNode;
    var count = section.querySelector('[data-list-count]');
    var toggle = section.querySelector('[data-list-toggle]');
    var empty = section.querySelector('[data-list-empty]');
    var showAll = false;
    var answers = {};

    function apply() {
      var filtering = filterKeys.some(function (k) { return k in answers; });
      var matching = rows.filter(function (r) { return fits(r.tags, answers, filterKeys); });
      var hiding = filtering && !showAll;
      rows.slice().sort(function (a, b) {
        return (rankScore(b.tags, answers, rankKeys) - rankScore(a.tags, answers, rankKeys)) || (a.i - b.i);
      }).forEach(function (r) {
        r.li.hidden = hiding && matching.indexOf(r) === -1;
        list.appendChild(r.li);
      });
      if (count) count.textContent = filtering ? matching.length + ' of ' + rows.length + ' fit your setup' : '';
      if (empty) empty.hidden = !(hiding && matching.length === 0);
      if (toggle) {
        toggle.hidden = !filtering;
        toggle.textContent = showAll ? 'Only my setup' : 'Show all guides';
      }
    }
    if (toggle) toggle.addEventListener('click', function () { showAll = !showAll; apply(); });
    document.addEventListener(EVENT, function (e) { answers = (e.detail && e.detail.answers) || {}; showAll = false; apply(); });
    var stored = load();
    answers = (stored && stored.answers) || {};
    apply();
  }

  function init() {
    [].forEach.call(document.querySelectorAll('[data-setup-list]'), mountList);
    [].forEach.call(document.querySelectorAll('[data-finder]'), mountFinder);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
