/* Character Tavern – Hauptseite: baut Navigation und Ansichten aus data/site.json */
(function () {
  'use strict';

  var site = null;
  var $ = function (s) { return document.querySelector(s); };

  function el(tag, attrs) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      n.append(c.nodeType ? c : document.createTextNode(c));
    }
    return n;
  }
  function base(p) { return String(p).split('/').pop(); }
  function pages() { // alle Seiten flach: [{item, parent}]
    var out = [];
    (site.nav || []).forEach(function (t) {
      if (t.file) out.push({ item: t, parent: null });
      (t.children || []).forEach(function (c) { if (c.file) out.push({ item: c, parent: t }); });
    });
    return out;
  }
  function find(id) {
    var all = pages();
    for (var i = 0; i < all.length; i++) if (all[i].item.id === id) return all[i];
    return null;
  }
  function iconNode(item, cls) {
    if (item.logo) return el('img', { class: cls || 'nav-logo', src: item.logo, alt: '' });
    if (item.icon) return el('span', { 'aria-hidden': 'true', text: item.icon });
    return null;
  }
  function visible(t) { return t.file || (t.children && t.children.length); }

  /* ---------- Navigation ---------- */
  function renderNav() {
    var nav = $('#nav');
    nav.textContent = '';
    var ul = el('ul', { class: 'menu' });
    ul.append(el('li', {}, el('a', { href: '#/', 'data-route': '/' }, el('span', { 'aria-hidden': 'true', text: '🏠' }), 'Tavern')));
    (site.nav || []).filter(visible).forEach(function (t) {
      if (t.children && t.children.length) {
        var btn = el('button', { class: 'navbtn', type: 'button', 'aria-expanded': 'false', 'aria-haspopup': 'true' },
          iconNode(t), t.title, el('span', { class: 'caret', 'aria-hidden': 'true', text: '▼' }));
        var sub = el('ul', { class: 'sub' });
        t.children.forEach(function (c) {
          if (!c.file) return;
          sub.append(el('li', {}, el('a', { href: '#/p/' + c.id, 'data-route': '/p/' + c.id }, iconNode(c), c.title)));
        });
        var li = el('li', { class: 'has-sub', 'data-top': t.id }, btn, sub);
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var open = !li.classList.contains('open');
          closeMenus();
          li.classList.toggle('open', open);
          btn.setAttribute('aria-expanded', String(open));
        });
        ul.append(li);
      } else {
        ul.append(el('li', {}, el('a', { href: '#/p/' + t.id, 'data-route': '/p/' + t.id }, iconNode(t), t.title)));
      }
    });
    ul.append(el('li', {}, el('a', { href: '#/downloads', 'data-route': '/downloads' }, el('span', { 'aria-hidden': 'true', text: '📜' }), 'Downloads')));
    nav.append(ul);
  }
  function closeMenus() {
    document.querySelectorAll('.has-sub.open').forEach(function (n) {
      n.classList.remove('open');
      n.querySelector('button').setAttribute('aria-expanded', 'false');
    });
  }
  function markActive(route) {
    document.querySelectorAll('#nav a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-route') === route);
    });
    document.querySelectorAll('#nav .has-sub').forEach(function (li) {
      li.classList.toggle('active', !!li.querySelector('a.active'));
    });
  }

  /* ---------- Ansichten ---------- */
  function viewHome() {
    var h = site.home || {};
    var wrap = document.createDocumentFragment();
    wrap.append(el('section', { class: 'signboard' },
      el('h1', { text: h.heading || site.title }),
      h.lead ? el('p', { class: 'lead', text: h.lead }) : null));

    var cards = el('section', { class: 'cards' });
    (site.nav || []).filter(visible).forEach(function (t) {
      var list = el('ul');
      if (t.file) list.append(el('li', {}, el('a', { href: '#/p/' + t.id }, 'Öffnen')));
      (t.children || []).forEach(function (c) {
        if (c.file) list.append(el('li', {}, el('a', { href: '#/p/' + c.id }, c.title)));
      });
      cards.append(el('article', { class: 'card' },
        t.logo ? el('img', { class: 'card-logo', src: t.logo, alt: '' }) : el('div', { class: 'card-icon', 'aria-hidden': 'true', text: t.icon || '📜' }),
        el('h2', { text: t.title }),
        t.desc ? el('p', { text: t.desc }) : null,
        list));
    });
    cards.append(el('article', { class: 'card' },
      el('div', { class: 'card-icon', 'aria-hidden': 'true', text: '📜' }),
      el('h2', { text: 'Downloads' }),
      el('p', { text: 'Jede Seite einzeln oder alles als Paket – für die Nutzung ohne Internet.' }),
      el('ul', {}, el('li', {}, el('a', { href: '#/downloads' }, 'Zum Download-Bereich')))));
    wrap.append(cards);

    var blocks = el('section', { class: 'blocks' });
    (h.blocks || []).forEach(function (b) {
      blocks.append(el('article', { class: 'parchment' }, el('h3', { text: b.heading }), el('p', { text: b.text })));
    });
    wrap.append(blocks);
    setView(wrap, false);
    document.title = site.title;
  }

  function viewPage(id) {
    var f = find(id);
    if (!f) return viewHome();
    var it = f.item;
    var title = (f.parent ? f.parent.title + ' · ' : '') + it.title;
    var bar = el('div', { class: 'pagebar' },
      el('strong', { text: title }),
      el('a', { class: 'btn small', href: it.file, target: '_blank', rel: 'noopener' }, 'In neuem Tab'),
      el('a', { class: 'btn small gold', href: it.file, download: base(it.file) }, '⬇ Herunterladen'));
    var frame = el('iframe', { class: 'frame', src: it.file, title: title,
      sandbox: 'allow-scripts allow-same-origin allow-downloads allow-popups allow-forms allow-modals' });
    var wrap = document.createDocumentFragment();
    wrap.append(bar, frame);
    setView(wrap, true);
    document.title = it.title + ' – ' + site.title;
  }

  function dlRow(title, desc, file) {
    return el('div', { class: 'dl-row' },
      el('div', { class: 'dl-info' }, el('strong', { text: title }), desc ? el('span', { text: desc }) : null),
      el('a', { class: 'btn small gold', href: file, download: base(file) }, '⬇ Herunterladen'));
  }

  function viewDownloads() {
    var wrap = document.createDocumentFragment();
    wrap.append(el('section', { class: 'signboard' }, el('h1', { text: 'Downloads' }),
      el('p', { class: 'lead', text: 'Nimm dir die Werkzeuge mit. Jede Datei läuft allein im Browser – ganz ohne Internet.' })));

    // Offline-Box
    var status = el('span', { id: 'offline-state', class: 'muted' });
    var offBtn = el('button', { class: 'btn gold', type: 'button' }, '💾 Für Offline-Nutzung speichern');
    offBtn.addEventListener('click', function () { requestPrecache(status); });
    var zipBtn = el('button', { class: 'btn', type: 'button' }, '📦 Alle Seiten als ZIP');
    zipBtn.addEventListener('click', function () { downloadZip(zipBtn); });
    wrap.append(el('section', { class: 'parchment' },
      el('h2', { text: 'Tavern offline nutzen' }),
      el('div', { class: 'offline-box' },
        el('p', { text: 'Speichere die gesamte Tavern in deinem Browser – danach funktionieren alle Seiten auch ohne Verbindung. Alternativ lädst du alles als ZIP herunter.' }),
        offBtn, zipBtn),
      el('p', { class: 'muted', style: 'margin:.8rem 0 0' }, status)));
    updateOfflineState(status);

    // Automatische Kategorie: alle Seiten
    var all = pages();
    if (all.length) {
      var sec = el('section', { class: 'parchment' }, el('h2', { text: 'Alle Seiten als Einzeldatei' }));
      all.forEach(function (f) {
        sec.append(dlRow((f.parent ? f.parent.title + ' – ' : '') + f.item.title, 'Eigenständige HTML-Datei, funktioniert offline.', f.item.file));
      });
      wrap.append(sec);
    }
    // Eigene Kategorien aus dem Admin
    ((site.downloads || {}).categories || []).forEach(function (c) {
      if (!c.items || !c.items.length) return;
      var sec = el('section', { class: 'parchment' }, el('h2', { text: c.title }));
      c.items.forEach(function (i) { sec.append(dlRow(i.title, i.desc, i.file)); });
      wrap.append(sec);
    });
    setView(wrap, false);
    document.title = 'Downloads – ' + site.title;
  }

  function setView(node, wide) {
    var v = $('#view');
    v.className = wide ? 'wide' : '';
    v.textContent = '';
    v.append(node);
    if (!wide) window.scrollTo(0, 0);
  }

  /* ---------- Routing ---------- */
  function route() {
    if (!site) return;
    var h = location.hash.replace(/^#/, '') || '/';
    closeMenus();
    $('#nav').classList.remove('open');
    $('#burger').setAttribute('aria-expanded', 'false');
    var m;
    if ((m = h.match(/^\/p\/(.+)$/))) { viewPage(decodeURIComponent(m[1])); markActive('/p/' + decodeURIComponent(m[1])); }
    else if (h === '/downloads') { viewDownloads(); markActive('/downloads'); }
    else { viewHome(); markActive('/'); }
  }

  /* ---------- Offline ---------- */
  function updateOfflineState(node) {
    if (!node) return;
    if (!('serviceWorker' in navigator)) { node.textContent = 'Dein Browser unterstützt das Offline-Speichern hier nicht.'; return; }
    navigator.serviceWorker.getRegistration().then(function (reg) {
      node.textContent = reg && reg.active
        ? '✔ Offline-Modus ist aktiv. Neue Inhalte werden beim nächsten Besuch automatisch gespeichert.'
        : 'Offline-Modus wird eingerichtet … (nur über https oder localhost möglich)';
    });
  }
  function requestPrecache(statusNode) {
    if (!('serviceWorker' in navigator)) return updateOfflineState(statusNode);
    statusNode.textContent = 'Speichere …';
    navigator.serviceWorker.ready.then(function (reg) {
      reg.active.postMessage({ type: 'precache' });
    });
  }
  function downloadZip(btn) {
    var old = btn.textContent;
    btn.textContent = 'Packe …';
    var files = [{ path: 'README.txt', data: new TextEncoder().encode('Character Tavern – Einzeldateien. Jede HTML-Datei per Doppelklick im Browser öffnen.\n') }];
    var seen = {};
    var jobs = pages().map(function (f) {
      return fetch(f.item.file).then(function (r) { return r.arrayBuffer(); }).then(function (b) {
        var name = base(f.item.file);
        if (seen[name]) return;
        seen[name] = 1;
        files.push({ path: name, data: new Uint8Array(b) });
      });
    });
    Promise.all(jobs).then(function () {
      var a = el('a', { href: URL.createObjectURL(window.CTZip.make(files)), download: 'character-tavern.zip' });
      document.body.append(a); a.click(); a.remove();
    }).catch(function () { alert('Das ZIP konnte nicht erstellt werden (offline und nicht gespeichert?).'); })
      .then(function () { btn.textContent = old; });
  }
  function setOnlineState() {
    var on = navigator.onLine;
    $('#status').innerHTML = '<span class="dot' + (on ? '' : ' off') + '"></span>' + (on ? 'online' : 'offline – gespeicherte Seiten laufen weiter');
  }

  /* ---------- Start ---------- */
  function start() {
    $('#burger').addEventListener('click', function (e) {
      e.stopPropagation();
      var open = $('#nav').classList.toggle('open');
      this.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.has-sub')) closeMenus(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenus(); });
    window.addEventListener('hashchange', route);
    window.addEventListener('online', setOnlineState);
    window.addEventListener('offline', setOnlineState);
    setOnlineState();

    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
      navigator.serviceWorker.addEventListener('message', function (e) {
        if (e.data && e.data.type === 'precache-done') {
          var n = $('#offline-state');
          if (n) n.textContent = '✔ ' + e.data.count + ' Dateien für die Offline-Nutzung gespeichert.';
        }
      });
    }

    fetch('data/site.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { site = j; renderNav(); route(); })
      .catch(function () {
        $('#view').innerHTML = '<p class="error">Die Seitendaten konnten nicht geladen werden.<br>' +
          'Bitte die Tavern über GitHub Pages oder einen lokalen Server öffnen (z. B. <code>python3 -m http.server</code>), nicht per Doppelklick.</p>';
      });
  }
  start();
})();
