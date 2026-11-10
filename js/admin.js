/* Character Tavern – Verwaltung: Baukasten für Reiter, Seiten und Downloads; veröffentlicht per GitHub-API */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };

  var site = null;            // aktueller Bearbeitungsstand (site.json)
  var original = null;        // Stand beim Laden (Text), für "geändert?"
  var originalFiles = {};     // Pfade, die im Repo existieren
  var pending = {};           // neue/geänderte Dateien: pfad -> Uint8Array
  var drag = null;            // laufendes internes Ziehen {list, index, kind}
  var toastTimer = null;

  /* ---------- Hilfen ---------- */
  function el(tag, attrs) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'value') n.value = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      n.append(c.nodeType ? c : document.createTextNode(c));
    }
    return n;
  }
  function toast(msg, kind, ms) {
    var t = $('#toast');
    t.textContent = msg; t.className = 'toast ' + (kind || ''); t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, ms || 4500);
  }
  function slug(s) {
    return String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'seite';
  }
  function splitExt(name) {
    var i = name.lastIndexOf('.');
    return i > 0 ? [name.slice(0, i), name.slice(i).toLowerCase()] : [name, ''];
  }
  function allPaths() { // jede Datei, die jetzt belegt ist
    var set = {};
    Object.keys(originalFiles).forEach(function (p) { set[p] = 1; });
    Object.keys(pending).forEach(function (p) { set[p] = 1; });
    referenced().forEach(function (p) { set[p] = 1; });
    return set;
  }
  function uniquePath(dir, name) {
    var parts = splitExt(name), base = slug(parts[0]), ext = parts[1], taken = allPaths();
    var p = dir + '/' + base + ext, n = 2;
    while (taken[p]) p = dir + '/' + base + '-' + n++ + ext;
    return p;
  }
  function uniqueId(base) {
    var ids = {};
    (site.nav || []).forEach(function (t) { ids[t.id] = 1; (t.children || []).forEach(function (c) { ids[c.id] = 1; }); });
    var id = slug(base), n = 2;
    while (ids[id]) id = slug(base) + '-' + n++;
    return id;
  }
  function readFile(f) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(new Uint8Array(r.result)); };
      r.onerror = rej;
      r.readAsArrayBuffer(f);
    });
  }
  function titleOf(bytes, fallback) {
    var m = new TextDecoder().decode(bytes.slice(0, 4000)).match(/<title[^>]*>([^<]{1,80})<\/title>/i);
    var t = m ? m[1].replace(/&amp;/g, '&').trim() : '';
    return t || fallback.replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function referenced() {
    var out = [];
    (site.nav || []).forEach(function (t) {
      if (t.file) out.push(t.file);
      if (t.logo) out.push(t.logo);
      (t.children || []).forEach(function (c) { if (c.file) out.push(c.file); if (c.logo) out.push(c.logo); });
    });
    ((site.downloads || {}).categories || []).forEach(function (c) { (c.items || []).forEach(function (i) { if (i.file) out.push(i.file); }); });
    return out;
  }
  function isDirty() {
    return JSON.stringify(site, null, 2) !== original || Object.keys(pending).length > 0;
  }
  function changed() { $('#dirty').hidden = !isDirty(); }
  function isHtml(f) { return /\.html?$/i.test(f.name); }
  function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }

  /* ---------- Datei-Dropzonen ---------- */
  function dropzone(node, onFiles, opts) {
    opts = opts || {};
    node.addEventListener('dragover', function (e) {
      if (drag || !hasFiles(e)) return;
      e.preventDefault(); e.stopPropagation();
      node.classList.add('on');
    });
    node.addEventListener('dragleave', function (e) { if (!node.contains(e.relatedTarget)) node.classList.remove('on'); });
    node.addEventListener('drop', function (e) {
      if (drag || !hasFiles(e)) return;
      e.preventDefault(); e.stopPropagation();
      node.classList.remove('on');
      onFiles(Array.prototype.slice.call(e.dataTransfer.files));
    });
    if (opts.click) node.addEventListener('click', function (e) {
      if (e.target.closest('button,input,a')) return;
      var p = $('#picker');
      p.value = ''; p.multiple = true; p.accept = opts.accept || '';
      p.onchange = function () { onFiles(Array.prototype.slice.call(p.files)); };
      p.click();
    });
  }
  function onlyHtml(files) {
    var ok = files.filter(isHtml);
    if (ok.length < files.length) toast('Nur .html-Dateien werden hier angenommen – andere wurden übersprungen.', 'err');
    return ok;
  }
  async function addPage(file, parent) { // legt Datei ab und liefert Seiten-Eintrag
    var bytes = await readFile(file);
    var path = uniquePath('pages', file.name);
    pending[path] = bytes;
    var title = titleOf(bytes, splitExt(file.name)[0]);
    return { id: uniqueId(title), title: title, file: path };
  }
  async function dropAsNewTabs(files) {
    files = onlyHtml(files);
    for (var i = 0; i < files.length; i++) {
      var p = await addPage(files[i]);
      site.nav.push({ id: p.id, title: p.title, icon: '📜', desc: '', file: p.file });
    }
    if (files.length) { render(); toast(files.length + ' Reiter hinzugefügt. Zum Übernehmen „Veröffentlichen“ klicken.', 'ok'); }
  }
  async function dropAsChildren(tab, files) {
    files = onlyHtml(files);
    if (!files.length) return;
    tab.children = tab.children || [];
    if (tab.file) { // Reiter war eigene Seite → wird Unterpunkt, damit er ausklappbar wird
      tab.children.push({ id: uniqueId(tab.title), title: tab.title, file: tab.file });
      delete tab.file;
    }
    for (var i = 0; i < files.length; i++) tab.children.push(await addPage(files[i]));
    render(); toast(files.length + ' Unterpunkt(e) in „' + tab.title + '“ hinzugefügt.', 'ok');
  }
  async function dropAsDownloads(cat, files) {
    cat.items = cat.items || [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i], bytes = await readFile(f), path = uniquePath('downloads', f.name);
      pending[path] = bytes;
      cat.items.push({ title: titleOf(bytes, splitExt(f.name)[0]).slice(0, 80), desc: '', file: path });
    }
    render(); toast(files.length + ' Datei(en) hinzugefügt – Download-Buttons entstehen automatisch.', 'ok');
  }
  async function setLogo(item, file) {
    if (!/^image\//.test(file.type)) return toast('Bitte eine Bilddatei wählen.', 'err');
    var path = uniquePath('assets', 'user-' + item.id + splitExt(file.name)[1]);
    pending[path] = await readFile(file);
    item.logo = path;
    render();
  }

  /* ---------- Ziehen zum Sortieren ---------- */
  function sortable(node, handle, list, index, kind) {
    node.draggable = false;
    handle.draggable = true;
    handle.addEventListener('dragstart', function (e) {
      drag = { list: list, index: index, kind: kind };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'ct-sort');
      try { e.dataTransfer.setDragImage(node, 12, 12); } catch (x) {}
      node.classList.add('dragging');
      e.stopPropagation();
    });
    handle.addEventListener('dragend', function () { drag = null; render(); });
    node.addEventListener('dragover', function (e) {
      if (!drag || !compatible(kind)) return;
      e.preventDefault(); e.stopPropagation(); node.classList.add('over');
    });
    node.addEventListener('dragleave', function (e) { if (!node.contains(e.relatedTarget)) node.classList.remove('over'); });
    node.addEventListener('drop', function (e) {
      if (!drag || !compatible(kind)) return;
      e.preventDefault(); e.stopPropagation();
      move(drag, list, index);
    });
  }
  function compatible(kind) { return drag && drag.kind === kind; }
  function move(from, toList, toIndex) {
    var item = from.list.splice(from.index, 1)[0];
    if (from.list === toList && from.index < toIndex) toIndex--;
    toList.splice(Math.max(0, Math.min(toIndex, toList.length)), 0, item);
    drag = null; render();
  }
  function emptyTarget(node, list, kind) { // Ziehen in leere/Ende einer Liste
    node.addEventListener('dragover', function (e) { if (drag && drag.kind === kind) { e.preventDefault(); node.classList.add('over'); } });
    node.addEventListener('dragleave', function () { node.classList.remove('over'); });
    node.addEventListener('drop', function (e) {
      if (!drag || drag.kind !== kind) return;
      e.preventDefault(); e.stopPropagation(); move(drag, list, list.length);
    });
  }
  function confirmDel(what) { return window.confirm(what + ' wirklich löschen?'); }

  /* ---------- Rendern ---------- */
  function inputBind(obj, key, cls, ph) {
    var i = el('input', { class: cls || '', placeholder: ph || '', value: obj[key] || '' });
    i.addEventListener('input', function () { obj[key] = i.value; changed(); });
    return i;
  }

  function renderNav() {
    var box = $('#navList'); box.textContent = '';
    site.nav.forEach(function (t, ti) {
      var handle = el('span', { class: 'handle', title: 'Ziehen zum Sortieren', text: '⠿' });
      var del = el('button', { class: 'btn small danger', type: 'button', title: 'Reiter löschen', text: '🗑' });
      del.addEventListener('click', function () {
        if (!confirmDel('Reiter „' + t.title + '“ mit allen Unterpunkten')) return;
        site.nav.splice(ti, 1); render();
      });
      var logoBtn = el('button', { class: 'btn small', type: 'button', text: t.logo ? 'Logo ändern' : 'Logo wählen' });
      logoBtn.addEventListener('click', function () {
        var p = $('#picker'); p.value = ''; p.multiple = false; p.accept = 'image/*';
        p.onchange = function () { if (p.files[0]) setLogo(t, p.files[0]); };
        p.click();
      });
      var head = el('div', { class: 'head' }, handle,
        inputBind(t, 'icon', 'icon', '🎲'),
        inputBind(t, 'title', '', 'Name des Reiters'),
        t.logo ? el('img', { class: 'logo-prev', src: pending[t.logo] ? URL.createObjectURL(new Blob([pending[t.logo]])) : t.logo, alt: '' }) : null,
        logoBtn,
        t.file ? el('span', { class: 'tag', text: '→ ' + t.file }) : el('span', { class: 'tag', text: 'Ausklappmenü' }),
        del);
      var desc = el('div', { class: 'row', style: 'margin-top:.4rem' },
        el('label', { class: 'grow' }, 'Kurzbeschreibung (Karte auf der Startseite)', inputBind(t, 'desc', '', 'Zufallscharaktere und Namen …')));

      var kids = el('div', { class: 'children' });
      (t.children || []).forEach(function (c, ci) {
        var h = el('span', { class: 'handle', title: 'Ziehen (auch in anderen Reiter)', text: '⠿' });
        var d = el('button', { class: 'btn small danger', type: 'button', text: '🗑' });
        d.addEventListener('click', function () {
          if (!confirmDel('Unterpunkt „' + c.title + '“')) return;
          t.children.splice(ci, 1); render();
        });
        var row = el('div', { class: 'item child' }, el('div', { class: 'head' }, h, inputBind(c, 'title', '', 'Name'),
          el('span', { class: 'tag', text: c.file }), d));
        sortable(row, h, t.children, ci, 'child');
        kids.append(row);
      });
      t.children = t.children || [];
      emptyTarget(kids, t.children, 'child');

      var dz = el('div', { class: 'drop', text: '⬇ HTML-Datei hierher ziehen = neuer Unterpunkt in „' + (t.title || 'Reiter') + '“ (oder klicken)' });
      dropzone(dz, function (f) { dropAsChildren(t, f); }, { click: true, accept: '.html,.htm' });

      var card = el('div', { class: 'item' }, head, desc, kids, dz);
      dropzone(card, function (f) { dropAsChildren(t, f); });
      sortable(card, handle, site.nav, ti, 'nav');
      box.append(card);
    });
    if (!site.nav.length) box.append(el('p', { class: 'hint', text: 'Noch keine Reiter vorhanden.' }));
    emptyTarget(box, site.nav, 'nav');
  }

  function renderDownloads() {
    var box = $('#dlList'); box.textContent = '';
    var cats = site.downloads.categories;
    cats.forEach(function (c, ci) {
      var handle = el('span', { class: 'handle', text: '⠿', title: 'Ziehen zum Sortieren' });
      var del = el('button', { class: 'btn small danger', type: 'button', text: '🗑' });
      del.addEventListener('click', function () {
        if (!confirmDel('Kategorie „' + c.title + '“ mit allen Dateien')) return;
        cats.splice(ci, 1); render();
      });
      var items = el('div', { class: 'children' });
      c.items = c.items || [];
      c.items.forEach(function (it, ii) {
        var h = el('span', { class: 'handle', text: '⠿', title: 'Ziehen (auch in andere Kategorie)' });
        var d = el('button', { class: 'btn small danger', type: 'button', text: '🗑' });
        d.addEventListener('click', function () { c.items.splice(ii, 1); render(); });
        var row = el('div', { class: 'item child' },
          el('div', { class: 'head' }, h, inputBind(it, 'title', '', 'Anzeigename'), el('span', { class: 'tag', text: it.file }), d),
          el('div', { class: 'row', style: 'margin-top:.3rem' }, el('label', { class: 'grow' }, 'Beschreibung (optional)', inputBind(it, 'desc', '', '')))
        );
        sortable(row, h, c.items, ii, 'item');
        items.append(row);
      });
      emptyTarget(items, c.items, 'item');
      var dz = el('div', { class: 'drop', text: '⬇ Datei(en) hierher ziehen = Download-Button entsteht (oder klicken)' });
      dropzone(dz, function (f) { dropAsDownloads(c, f); }, { click: true });
      var card = el('div', { class: 'item' }, el('div', { class: 'head' }, handle, inputBind(c, 'title', '', 'Kategoriename'), del), items, dz);
      dropzone(card, function (f) { dropAsDownloads(c, f); });
      sortable(card, handle, cats, ci, 'cat');
      box.append(card);
    });
    if (!cats.length) box.append(el('p', { class: 'hint', text: 'Noch keine eigene Kategorie. (Die Einzelseiten stehen trotzdem automatisch im Download-Bereich.)' }));
    emptyTarget(box, cats, 'cat');
  }

  function renderBlocks() {
    var box = $('#blockList'); box.textContent = '';
    var blocks = site.home.blocks;
    blocks.forEach(function (b, bi) {
      var handle = el('span', { class: 'handle', text: '⠿', title: 'Ziehen zum Sortieren' });
      var del = el('button', { class: 'btn small danger', type: 'button', text: '🗑' });
      del.addEventListener('click', function () { blocks.splice(bi, 1); render(); });
      var ta = el('textarea', { rows: '3' }); ta.value = b.text || '';
      ta.addEventListener('input', function () { b.text = ta.value; changed(); });
      var card = el('div', { class: 'item' }, el('div', { class: 'head' }, handle, inputBind(b, 'heading', '', 'Überschrift'), del), ta);
      sortable(card, handle, blocks, bi, 'block');
      box.append(card);
    });
    emptyTarget(box, blocks, 'block');
  }

  function render() {
    renderNav(); renderDownloads(); renderBlocks(); changed();
  }

  /* ---------- Veröffentlichen ---------- */
  function b64(bytes) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  function conf() {
    return { owner: $('#gOwner').value.trim(), repo: $('#gRepo').value.trim(), branch: $('#gBranch').value.trim() || 'main', token: $('#gToken').value.trim() };
  }
  function saveConf() {
    try {
      if ($('#gRemember').checked) localStorage.setItem('ct-admin', JSON.stringify(conf()));
      else localStorage.removeItem('ct-admin');
    } catch (e) {}
  }
  function api(c, path, method, body) {
    return fetch('https://api.github.com/repos/' + c.owner + '/' + c.repo + path, {
      method: method || 'GET',
      headers: { 'Authorization': 'Bearer ' + c.token, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var msg = j.message || ('HTTP ' + r.status);
          if (r.status === 401) msg = 'Token ungültig oder abgelaufen.';
          if (r.status === 403 || r.status === 404) msg += '\n(Prüfe Benutzer, Repository-Name und ob der Token „Contents: Read and write“ für dieses Repo hat.)';
          throw new Error(msg);
        }
        return j;
      });
    });
  }
  function finalFiles() { // alles, was auf den Server soll: {pfad: Uint8Array}
    var out = {};
    Object.keys(pending).forEach(function (p) { out[p] = pending[p]; });
    out['data/site.json'] = new TextEncoder().encode(JSON.stringify(site, null, 2) + '\n');
    return out;
  }
  function orphans() { // Dateien, die im Repo liegen, aber nicht mehr gebraucht werden
    var used = {};
    referenced().forEach(function (p) { used[p] = 1; });
    return Object.keys(originalFiles).filter(function (p) {
      return !used[p] && (/^pages\//.test(p) || /^downloads\//.test(p) || /^assets\/user-/.test(p));
    });
  }
  async function publish() {
    var c = conf();
    if (!c.owner || !c.repo || !c.token) return toast('Bitte zuerst Benutzer, Repository und Token eintragen.', 'err');
    if (!isDirty()) return toast('Keine Änderungen zum Veröffentlichen.');
    saveConf();
    var btn = $('#btnPublish'); btn.disabled = true; btn.textContent = 'Veröffentliche …';
    try {
      var ref = await api(c, '/git/ref/heads/' + encodeURIComponent(c.branch));
      var commit = await api(c, '/git/commits/' + ref.object.sha);
      var files = finalFiles(), tree = [];
      var paths = Object.keys(files);
      for (var i = 0; i < paths.length; i++) {
        var blob = await api(c, '/git/blobs', 'POST', { content: b64(files[paths[i]]), encoding: 'base64' });
        tree.push({ path: paths[i], mode: '100644', type: 'blob', sha: blob.sha });
      }
      orphans().forEach(function (p) { tree.push({ path: p, mode: '100644', type: 'blob', sha: null }); });
      var newTree = await api(c, '/git/trees', 'POST', { base_tree: commit.tree.sha, tree: tree });
      var nc = await api(c, '/git/commits', 'POST', { message: 'Character Tavern: Inhalte aktualisiert (Verwaltung)', tree: newTree.sha, parents: [ref.object.sha] });
      await api(c, '/git/refs/heads/' + encodeURIComponent(c.branch), 'PATCH', { sha: nc.sha });
      // Zustand als gespeichert markieren
      Object.keys(files).forEach(function (p) { originalFiles[p] = 1; });
      orphans().forEach(function (p) { delete originalFiles[p]; });
      pending = {};
      original = JSON.stringify(site, null, 2);
      render();
      toast('✔ Veröffentlicht! GitHub Pages braucht jetzt ca. 1 Minute, dann ist alles online.', 'ok', 8000);
    } catch (e) {
      toast('Veröffentlichen fehlgeschlagen:\n' + e.message, 'err', 9000);
    } finally {
      btn.disabled = false; btn.textContent = '🚀 Veröffentlichen';
    }
  }
  function exportZip() {
    var files = finalFiles();
    var list = Object.keys(files).map(function (p) { return { path: p, data: files[p] }; });
    list.push({ path: 'LIESMICH.txt', data: new TextEncoder().encode('Diese Dateien in dein Repository kopieren (Ordnerstruktur beibehalten) und committen.\n') });
    var a = el('a', { href: URL.createObjectURL(window.CTZip.make(list)), download: 'tavern-aenderungen.zip' });
    document.body.append(a); a.click(); a.remove();
    toast('ZIP erstellt: enthält data/site.json und alle neuen Dateien.', 'ok');
  }

  /* ---------- Start ---------- */
  function boot(j) {
    site = j;
    site.nav = site.nav || [];
    site.downloads = site.downloads || {}; site.downloads.categories = site.downloads.categories || [];
    site.home = site.home || {}; site.home.blocks = site.home.blocks || [];
    originalFiles = {};
    referenced().forEach(function (p) { originalFiles[p] = 1; });
    originalFiles['data/site.json'] = 1;
    original = JSON.stringify(site, null, 2);
    $('#hHeading').value = site.home.heading || '';
    $('#hLead').value = site.home.lead || '';
    $('#hHeading').addEventListener('input', function () { site.home.heading = this.value; changed(); });
    $('#hLead').addEventListener('input', function () { site.home.lead = this.value; changed(); });
    render();
  }

  function init() {
    try {
      var s = JSON.parse(localStorage.getItem('ct-admin') || 'null');
      if (s) { $('#gOwner').value = s.owner || ''; $('#gRepo').value = s.repo || ''; $('#gBranch').value = s.branch || 'main'; $('#gToken').value = s.token || ''; $('#gRemember').checked = true; }
    } catch (e) {}
    try { // Repo-Namen aus GitHub-Pages-Adresse vorschlagen
      if (!$('#gOwner').value && /\.github\.io$/.test(location.hostname)) {
        $('#gOwner').value = location.hostname.split('.')[0];
        $('#gRepo').value = location.pathname.split('/')[1] || '';
      }
    } catch (e) {}

    $('#btnPublish').addEventListener('click', publish);
    $('#btnExport').addEventListener('click', exportZip);
    $('#btnNewTab').addEventListener('click', function () {
      site.nav.push({ id: uniqueId('neuer-reiter'), title: 'Neuer Reiter', icon: '📜', desc: '', children: [] });
      render();
    });
    $('#btnNewCat').addEventListener('click', function () { site.downloads.categories.push({ title: 'Neue Kategorie', items: [] }); render(); });
    $('#btnNewBlock').addEventListener('click', function () { site.home.blocks.push({ heading: 'Neue Überschrift', text: '' }); render(); });
    dropzone($('#dropNewTab'), dropAsNewTabs, { click: true, accept: '.html,.htm' });
    window.addEventListener('beforeunload', function (e) { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });
    // Verhindert, dass der Browser die Datei öffnet, wenn sie daneben fallen gelassen wird
    ['dragover', 'drop'].forEach(function (ev) { window.addEventListener(ev, function (e) { if (hasFiles(e)) e.preventDefault(); }); });

    fetch('data/site.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(boot)
      .catch(function () { toast('data/site.json konnte nicht geladen werden. Bitte über GitHub Pages oder einen lokalen Server öffnen.', 'err', 9000); });
  }
  init();
})();
