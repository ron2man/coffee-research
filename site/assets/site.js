// Market choice (auto-detect with manual override) and the Picker component.
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

  function matches(when, answers) {
    return Object.keys(when).every(function (k) { return answers[k] === when[k]; });
  }

  function mountPicker(root) {
    var tool = JSON.parse(root.querySelector('.picker-data').textContent);
    var answers = {};
    var form = document.createElement('div');
    form.className = 'picker-questions';
    var result = document.createElement('div');
    result.className = 'picker-result';
    result.setAttribute('role', 'status');
    result.setAttribute('aria-live', 'polite');
    root.appendChild(form);
    root.appendChild(result);

    function draw() {
      form.innerHTML = '';
      tool.questions.forEach(function (q, i) {
        var group = document.createElement('fieldset');
        group.className = 'picker-q';
        var legend = document.createElement('legend');
        legend.textContent = (i + 1) + '. ' + q.text;
        group.appendChild(legend);
        var opts = document.createElement('div');
        opts.className = 'picker-opts';
        q.options.forEach(function (o) {
          var b = document.createElement('button');
          b.type = 'button';
          b.textContent = o[1];
          b.setAttribute('aria-pressed', String(answers[q.key] === o[0]));
          b.addEventListener('click', function () { answers[q.key] = o[0]; draw(); });
          opts.appendChild(b);
        });
        group.appendChild(opts);
        form.appendChild(group);
      });
      var done = tool.questions.every(function (q) { return answers[q.key]; });
      result.innerHTML = '';
      result.hidden = !done;
      if (!done) return;
      var rule = tool.rules.filter(function (r) { return matches(r.when, answers); })[0];
      var r = tool.results[rule ? rule.result : tool['default']];
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
      reset.addEventListener('click', function () { answers = {}; draw(); form.querySelector('button').focus(); });
      result.appendChild(reset);
    }
    draw();
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
  });
})();
