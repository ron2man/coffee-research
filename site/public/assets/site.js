// Market choice (auto-detect with manual override), the Picker component, and analytics events.
// Events go to the GTM dataLayer only when the page loaded GTM (production with PUBLIC_GTM_ID set);
// GA4 event tags in the GTM container forward them (docs/deploy.md).
(function () {
  var KEY = 'market';
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode */ } }

  // Root page: send the reader to their market, remembered choice first (manual links stay visible).
  function chooseMarket() {
    if (!document.body.classList.contains('chooser')) return;
    var known = Array.prototype.map.call(document.querySelectorAll('[data-market]'), function (a) { return a.getAttribute('data-market'); });
    var chosen = get();
    if (!chosen || known.indexOf(chosen) === -1) {
      var langs = (navigator.languages || [navigator.language || '']).join(',').toLowerCase();
      chosen = /en-gb|en-uk/.test(langs) && known.indexOf('en-gb') !== -1 ? 'en-gb' : known[0];
    }
    if (chosen) location.replace('/' + chosen + '/');
  }
  document.addEventListener('DOMContentLoaded', chooseMarket);

  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('[data-market]');
    if (link) set(link.getAttribute('data-market'));
  });

  // GA4 custom events (rebuild-spec 9): affiliate_click, tool_complete, scroll_depth.
  // Pushed as { event, params }: GTM reads params.* as data layer variables, and the nested object
  // is replaced on every push, so one event's parameters never leak into the next.
  function track(name, params) {
    if (!window.dataLayer) return;
    var page = document.body.getAttribute('data-page');
    if (page) params.page_id = page;
    window.dataLayer.push({ event: name, params: params });
  }
  var toolState = {};

  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[rel~="sponsored"][data-product]');
    if (!link) return;
    track('affiliate_click', {
      product_id: link.getAttribute('data-product'),
      seller: link.getAttribute('data-seller'),
      market: link.getAttribute('data-market'),
      position: link.getAttribute('data-position'),
      tool_state: toolState[link.getAttribute('data-product')] || 'none'
    });
  });

  function scrollDepth() {
    if (!document.body.getAttribute('data-page')) return;
    var marks = [25, 50, 75, 100];
    var sent = {};
    function check() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var pct = max > 0 ? Math.round((window.scrollY / max) * 100) : 100;
      marks.forEach(function (m) {
        if (pct >= m && !sent[m]) { sent[m] = true; track('scroll_depth', { percent: m }); }
      });
    }
    window.addEventListener('scroll', check, { passive: true });
  }

  function matches(when, answers) {
    return Object.keys(when).every(function (k) { return answers[k] === when[k]; });
  }
  // [value, label, showIf]: hidden once a showIf question is answered with a value it doesn't list;
  // shown until then. Same rule as optionVisible in engine/state/tools.mjs; a test keeps them equal.
  function optionVisible(option, answers) {
    var showIf = option[2];
    if (!showIf) return true;
    return Object.keys(showIf).every(function (k) {
      return answers[k] === undefined || [].concat(showIf[k]).indexOf(answers[k]) !== -1;
    });
  }
  function resultFor(tool, answers) {
    var rule = tool.rules.filter(function (r) { return matches(r.when, answers); })[0];
    return rule ? rule.result : tool['default'];
  }
  window.YCSPicker = { optionVisible: optionVisible, resultFor: resultFor };

  var pickerCount = 0;
  // One fieldset of radio buttons per question, built once. Changing an answer hides the options it
  // rules out (and clears them if chosen); the result appears once every question is answered.
  function mountPicker(root) {
    var tool = JSON.parse(root.querySelector('.picker-data').textContent);
    var prefix = 'pk' + (++pickerCount) + '-';
    var answers = {};
    var lastResult = null;
    var form = document.createElement('div');
    form.className = 'picker-questions';
    var result = document.createElement('div');
    result.className = 'picker-result';
    result.setAttribute('role', 'status');
    result.setAttribute('aria-live', 'polite');
    result.hidden = true;
    var inputs = [];

    tool.questions.forEach(function (q, i) {
      var group = document.createElement('fieldset');
      group.className = 'picker-q';
      var legend = document.createElement('legend');
      legend.textContent = (i + 1) + '. ' + q.text;
      group.appendChild(legend);
      var opts = document.createElement('div');
      opts.className = 'picker-opts';
      q.options.forEach(function (o) {
        var label = document.createElement('label');
        label.className = 'picker-opt';
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = prefix + q.key;
        input.value = o[0];
        input.addEventListener('change', function () { if (input.checked) { answers[q.key] = o[0]; update(); } });
        var text = document.createElement('span');
        text.textContent = o[1];
        label.appendChild(input);
        label.appendChild(text);
        opts.appendChild(label);
        inputs.push({ q: q, o: o, input: input, label: label });
      });
      group.appendChild(opts);
      form.appendChild(group);
    });
    root.appendChild(form);
    root.appendChild(result);

    function update() {
      inputs.forEach(function (it) {
        var visible = optionVisible(it.o, answers);
        it.label.hidden = !visible;
        it.input.disabled = !visible;
        if (!visible && it.input.checked) { it.input.checked = false; delete answers[it.q.key]; }
      });
      var done = tool.questions.every(function (q) { return answers[q.key]; });
      if (!done) { result.hidden = true; result.innerHTML = ''; lastResult = null; return; }
      var resultKey = resultFor(tool, answers);
      result.hidden = false;
      if (resultKey === lastResult) return;
      lastResult = resultKey;
      var r = tool.results[resultKey];
      if (r.productId) toolState[r.productId] = tool.id + ':' + resultKey;
      track('tool_complete', { tool_id: tool.id, result: resultKey });
      result.innerHTML = '';
      var h = document.createElement('strong');
      h.textContent = r.title;
      var p = document.createElement('p');
      p.textContent = r.text;
      result.appendChild(h);
      result.appendChild(p);
      if (r.productId && document.getElementById('buy-' + r.productId)) {
        var a = document.createElement('a');
        a.href = '#buy-' + r.productId;
        a.textContent = 'Where to buy';
        result.appendChild(a);
      }
      var reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'picker-reset';
      reset.textContent = 'Start over';
      reset.addEventListener('click', function () {
        answers = {};
        inputs.forEach(function (it) { it.input.checked = false; });
        update();
        inputs[0].input.focus();
      });
      result.appendChild(reset);
    }
    update();
  }

  // Sidebar "On this page": mark the section being read.
  function spyToc() {
    var links = document.querySelectorAll('.post-rail .toc a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var byId = {};
    Array.prototype.forEach.call(links, function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var heads = Object.keys(byId).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        Array.prototype.forEach.call(links, function (a) { a.removeAttribute('aria-current'); });
        byId[e.target.id].setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '0px 0px -70% 0px' });
    heads.forEach(function (h) { observer.observe(h); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    Array.prototype.forEach.call(document.querySelectorAll('.picker[data-tool]'), mountPicker);
    spyToc();
    scrollDepth();
  });
})();
