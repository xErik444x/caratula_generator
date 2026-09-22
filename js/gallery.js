// gallery.js — Tab "Galería": listar covers de covers-gallery.erik444.workers.dev,
// buscar por nombre/tag y descarga múltiple (ZIP STORE sin dependencias).
// API: GET /api/list?q=&tag=&limit= · GET /img/:id (CORS abierto, hotlink OK)
(function(){
  'use strict';

  var API = 'https://covers-gallery.erik444.workers.dev';

  // ---------- estado ----------
  var items = [];
  var checked = {}; // id -> entry
  var filtros = { q: '', tag: '' };
  var xmlGames = []; // selección capturada al abrir el modal gamelist.xml

  // ---------- helpers DOM ----------
  function el(tag, cls, txt){
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  // ---------- obtener lista ----------
  async function fetchList(){
    var qs = [];
    if (filtros.q) qs.push('q=' + encodeURIComponent(filtros.q));
    if (filtros.tag) qs.push('tag=' + encodeURIComponent(filtros.tag));
    qs.push('limit=200');
    var r = await fetch(API + '/api/list?' + qs.join('&'));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var j = await r.json();
    return (j && j.items) || [];
  }

  // ---------- render ----------
  function renderGrid(){
    var grid = dom('galGrid');
    var count = dom('galCount');
    var empty = dom('galEmpty');
    if (!grid) return;
    grid.innerHTML = '';
    if (count) count.textContent = items.length + (items.length === 1 ? ' cover' : ' covers');
    var emptyMsg = (filtros.q || filtros.tag)
      ? 'Nothing matches that filter.'
      : 'The gallery is empty — be the first to upload!';
    if (empty){
      empty.hidden = items.length > 0;
      empty.textContent = emptyMsg;
    }
    items.forEach(function(it){
      var card = el('div', 'gal-card');
      card.dataset.id = it.id;

      var chk = el('input');
      chk.type = 'checkbox';
      chk.className = 'gal-chk';
      chk.checked = !!checked[it.id];
      chk.title = 'Select';
      chk.addEventListener('change', function(){
        if (chk.checked) checked[it.id] = it; else delete checked[it.id];
        card.classList.toggle('checked', chk.checked);
        updateButtons();
      });
      card.appendChild(chk);

      var imgWrap = el('div', 'gal-thumb');
      var img = el('img');
      img.loading = 'lazy';
      img.alt = it.t || it.title || '';
      img.src = abs(it.thumb || it.image);
      img.title = 'Click to download';
      img.addEventListener('click', function(){
        downloadOne(it, safeName(it.t || it.title || it.id) + '.png');
      });
      imgWrap.appendChild(img);
      card.appendChild(imgWrap);

      var meta = el('div', 'gal-meta');
      var tEl = el('div', 'gal-title', it.t || it.title || it.id);
      tEl.title = tEl.textContent;
      meta.appendChild(tEl);
      if (it.tags && it.tags.length){
        meta.appendChild(el('div', 'gal-tags', it.tags.map(function(t){ return '#' + t; }).join(' ')));
      }
      card.appendChild(meta);
      grid.appendChild(card);
    });
    updateButtons();
  }

  function dom(id){ return document.getElementById(id); }

  function abs(p){
    if (!p) return API + '/';
    return p.indexOf('http') === 0 ? p : API + p;
  }

  function safeName(s){
    return (s || 'cover').trim().replace(/[^a-z0-9\x20\-_]/gi, '').replace(/\s+/g, '_') || 'cover';
  }

  function updateButtons(){
    var n = Object.keys(checked).length;
    var btnDl = dom('galDownload');
    var btnSelAll = dom('galSelAll');
    var btnXml = dom('galXml');
    if (btnDl) btnDl.disabled = n === 0;
    if (btnXml) btnXml.disabled = n === 0;
    if (btnSelAll) btnSelAll.textContent = (n && n === items.length) ? 'Deselect all' : 'Select all';
  }

  // ---------- descarga ----------
  async function downloadOne(it, filename){
    try{
      var r = await fetch(abs(it.image));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      saveBlob(await r.blob(), filename);
    }catch(err){
      alert('Could not download: ' + err.message);
    }
  }

  function saveBlob(blob, filename){
    // iOS Safari ignora <a download> con blob: URLs → Share Sheet nativo
    // ("Save to Photos"/"Save to Files"). Desktop/Android: <a download>.
    var isIos = /iP(hone|ad|od)/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIos && navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: blob.type })] })){
      navigator.share({ files: [new File([blob], filename, { type: blob.type })] })
        .catch(function(){ /* usuario canceló el Share Sheet: no es error */ });
      return;
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  // ---------- CRC32 ----------
  var crcTable = null;
  function crc32(u8){
    if (!crcTable){
      crcTable = new Uint32Array(256);
      for (var n = 0; n < 256; n++){
        var c = n;
        for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        crcTable[n] = c >>> 0;
      }
    }
    var crc = 0 ^ (-1);
    for (var i = 0; i < u8.length; i++){
      crc = (crc >>> 8) ^ crcTable[(crc ^ u8[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  // ---------- ZIP (STORE, sin compresión; analizable con unzip) ----------
  function makeZip(files){
    // files: [{name, u8}]
    var chunks = [];
    var central = [];
    var offset = 0;

    function u16(v){ return [v & 0xFF, (v >>> 8) & 0xFF]; }
    function u32(v){ return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }
    function str(s){ return Array.from(s).map(function(ch){ return ch.charCodeAt(0) & 0xFF; }); }

    files.forEach(function(f){
      var nameB = str(f.name);
      var crc = crc32(f.u8);
      var sz = f.u8.length;

      var local = [].concat(
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0x21),
        u32(crc), u32(sz), u32(sz), u16(nameB.length), u16(0),
        nameB
      );
      chunks.push(new Uint8Array(local), f.u8);
      central.push({ name: nameB, crc: crc, sz: sz, off: offset });
      offset += local.length + sz;
    });

    var cdStart = offset;
    var cdSize = 0;
    central.forEach(function(c){
      var rec = [].concat(
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0x21),
        u32(c.crc), u32(c.sz), u32(c.sz), u16(c.name.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(c.off), c.name
      );
      chunks.push(new Uint8Array(rec));
      cdSize += rec.length;
      offset += rec.length;
    });

    var end = [].concat(
      u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
      u32(cdSize), u32(cdStart), u16(0)
    );
    chunks.push(new Uint8Array(end));

    var total = 0;
    chunks.forEach(function(c){ total += c.length; });
    var out = new Uint8Array(total);
    var pos = 0;
    chunks.forEach(function(c){ out.set(c, pos); pos += c.length; });
    return out; // Uint8Array (el caller lo convierte en Blob)
  }

  // ---------- descarga múltiple ----------
  async function downloadSelected(){
    var ids = Object.keys(checked);
    if (!ids.length) return;
    var btn = dom('galDownload');
    var orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Preparing… (0/' + ids.length + ')';
    var files = [];
    var failed = 0;
    for (var i = 0; i < ids.length; i++){
      var it = checked[ids[i]];
      if (btn) btn.textContent = 'Preparing… (' + (i + 1) + '/' + ids.length + ')';
      try{
        var r = await fetch(abs(it.image));
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var buf = new Uint8Array(await r.arrayBuffer());
        files.push({ name: uniqueName(safeName(it.t || it.title || it.id) + '.png', files), u8: buf });
      }catch(err){
        failed++;
      }
    }
    if (btn){
      btn.textContent = orig;
      updateButtons();
    }
    if (!files.length){
      alert('None of the covers could be downloaded.');
      return;
    }
    var blob = new Blob([makeZip(files)], { type: 'application/zip' });
    saveBlob(blob, 'covers_' + new Date().toISOString().slice(0, 10) + '.zip');
    if (failed) alert(failed + ' cover(s) could not be added to the ZIP.');
  }

  function uniqueName(name, files){
    var taken = {};
    files.forEach(function(f){ taken[f.name] = 1; });
    var base = name.replace(/\.png$/, '');
    var n = 1;
    var candidate = name;
    while (taken[candidate]){
      n++;
      candidate = base + '_' + n + '.png';
    }
    return candidate;
  }

  // ---------- gamelist.xml (EmulationStation / Batocera / R36S) ----------
  // Estructura R36S: descomprimir dentro de /roms/<sistema>/ con las imágenes en
  // ./images/. <path> relativo al mismo directorio donde vive gamelist.xml.
  function xmlEscape(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function extFromRom(rom){
    var m = /\.([a-z0-9]+)$/i.exec((rom || '').trim());
    return m ? m[1].toLowerCase() : '';
  }

  function buildXml(games, ext){
    var lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<gameList>'];
    games.forEach(function(g){
      // g.rom ya viene resuelto desde exportXml (rom tipeado o nombre+ext)
      var romFile = (g.rom || '').trim() || (g.name + '.' + (ext || 'ext'));
      lines.push('\t<game>');
      lines.push('\t\t<path>./' + xmlEscape(romFile) + '</path>');
      lines.push('\t\t<name>' + xmlEscape(g.name) + '</name>');
      if (g.image) lines.push('\t\t<image>./images/' + xmlEscape(g.image) + '</image>');
      if (g.desc) lines.push('\t\t<desc>' + xmlEscape(g.desc) + '</desc>');
      if (g.rating != null && g.rating >= 0) lines.push('\t\t<rating>' + g.rating.toFixed(2) + '</rating>');
      if (g.releasedate) lines.push('\t\t<releasedate>' + xmlEscape(g.releasedate) + '</releasedate>');
      if (g.developer) lines.push('\t\t<developer>' + xmlEscape(g.developer) + '</developer>');
      if (g.publisher) lines.push('\t\t<publisher>' + xmlEscape(g.publisher) + '</publisher>');
      if (g.genre) lines.push('\t\t<genre>' + xmlEscape(g.genre) + '</genre>');
      if (g.players) lines.push('\t\t<players>' + xmlEscape(g.players) + '</players>');
      lines.push('\t</game>');
    });
    lines.push('</gameList>', '');
    return lines.join('\n');
  }

  // ---- modal XML: DOM + estado ----
  var xmlUi = null;

  function ensureXmlModal(){
    if (xmlUi) return xmlUi;
    var overlay = el('div', 'upl-overlay');
    overlay.id = 'xmlOverlay';
    overlay.hidden = true;

    var modal = el('div', 'upl-modal xml-modal');

    var h3 = el('h3', null, 'Generate gamelist.xml');
    modal.appendChild(h3);

    var hint = el('p', 'upl-hint');
    hint.innerHTML = 'EmulationStation / Batocera / R36S. Unzip inside <b>/roms/&lt;system&gt;/</b>. Images go to <b>images/</b>.';
    modal.appendChild(hint);

    var labExt = el('label', null, 'ROM file extension (global, no dot)');
    modal.appendChild(labExt);
    var inExt = el('input');
    inExt.id = 'xmlExt';
    inExt.type = 'text';
    inExt.maxLength = 8;
    inExt.placeholder = 'sfc, smc, z64, bin…';
    modal.appendChild(inExt);

    var labList = el('label', null, 'Games (set the ROM filename for each one)');
    modal.appendChild(labList);

    var list = el('div');
    list.id = 'xmlGames';
    modal.appendChild(list);

    var msg = el('p', 'upl-msg');
    msg.id = 'xmlMsg';
    modal.appendChild(msg);

    var btns = el('div', 'upl-btns');
    var btnCancel = el('button', 'upl-cancel', 'Cancel');
    btnCancel.type = 'button';
    btnCancel.id = 'xmlCancel';
    var btnXmlOnly = el('button', 'upl-cancel', 'XML only');
    btnXmlOnly.type = 'button';
    btnXmlOnly.id = 'xmlOnly';
    var btnZip = el('button', 'upl-confirm', 'ZIP (R36S)');
    btnZip.type = 'button';
    btnZip.id = 'xmlZip';
    btns.appendChild(btnCancel);
    btns.appendChild(btnXmlOnly);
    btns.appendChild(btnZip);
    modal.appendChild(btns);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    xmlUi = { overlay: overlay, list: list, msg: msg, inExt: inExt, btnZip: btnZip, btnOnly: btnXmlOnly };
    return xmlUi;
  }

  // fila editable: [Título fijo] [textbox nombre.rom] → usa ext global al exportar
  function renderXmlRows(){
    var u = ensureXmlModal();
    u.list.innerHTML = '';
    xmlGames.forEach(function(g, idx){
      var row = el('div', 'xml-row');
      var title = el('span', 'xml-gametitle', g.name);
      title.title = g.name;
      var inp = el('input');
      inp.type = 'text';
      inp.className = 'xml-romin';
      inp.placeholder = 'game.' + (u.inExt.value || 'ext');
      inp.value = g.rom || '';
      inp.dataset.idx = idx;
      inp.addEventListener('input', function(){
        xmlGames[idx].rom = inp.value;
        syncZipLabel();
      });
      row.appendChild(title);
      row.appendChild(inp);
      u.list.appendChild(row);
    });
  }

  // base del nombre de imagen/rom: título seguro; prefijo opcional por sistema
  function gameBase(g){
    return safeName(g.name);
  }

  function syncZipLabel(){
    // si algún rom quedó sin ext y hay ext global, avisar cuantos la heredan
    var u = xmlUi; if (!u) return;
    var ext = u.inExt.value.trim().replace(/\./g, '').toLowerCase();
    var nExt = xmlGames.filter(function(g){ return !!extFromRom(g.rom); }).length;
    u.msg.className = 'upl-msg';
    u.msg.textContent = ext
      ? (nExt < xmlGames.length
        ? (xmlGames.length - nExt) + ' game(s) will use .' + ext
        : 'Ready — ' + xmlGames.length + ' game(s).')
      : '';
  }

  function openXmlModal(){
    var ids = Object.keys(checked);
    if (!ids.length) return;
    xmlGames = ids.map(function(id){
      var it = checked[id];
      return {
        id: it.id,
        // nombre mostrado = título sin extensión vieja si el título la trae
        name: String(it.t || it.title || it.id).replace(/\.[a-z0-9]+$/i, '').trim() || it.id,
        rom: '',
        image: null, // binario bajado en exportXml
        desc: '', rating: -1, releasedate: '', developer: '', publisher: '', genre: '', players: ''
      };
    });
    var u = ensureXmlModal();
    u.inExt.value = '';
    renderXmlRows();
    syncZipLabel();
    u.msg.className = 'upl-msg';
    u.msg.textContent = '';
    u.overlay.hidden = false;
  }

  function closeXmlModal(){
    if (xmlUi) xmlUi.overlay.hidden = true;
  }

  // baja el binario de una cover; null si falla
  async function fetchCoverU8(it){
    try{
      var r = await fetch(abs(it.image));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return new Uint8Array(await r.arrayBuffer());
    }catch(err){
      return null;
    }
  }

  // imagen para <image>: images/<Safe_Title>.jpg/png
  function imageFileName(g, u8){
    var ext = 'png';
    if (u8 && u8.length > 3){
      // magia: JPEG FFD8FF vs PNG 89504E47
      if (u8[0] === 0xFF && u8[1] === 0xD8) ext = 'jpg';
      else if (u8[0] === 0x89 && u8[1] === 0x50) ext = 'png';
    }
    return gameBase(g) + '.' + ext;
  }

  async function exportXml(mode){ // mode: 'xml' | 'zip'
    var u = xmlUi;
    if (!u || !xmlGames.length) return;
    // ext global: la del input, o la primera inferible de los roms tipeados
    var ext = u.inExt.value.trim().replace(/\./g, '').toLowerCase();
    if (!ext){
      for (var i = 0; i < xmlGames.length; i++){
        var e = extFromRom(xmlGames[i].rom);
        if (e){ ext = e; break; }
      }
    }
    var btnBusy, orig;
    if (mode === 'zip'){
      btnBusy = u.btnZip; orig = btnBusy.textContent;
    } else {
      btnBusy = u.btnOnly; orig = btnBusy.textContent;
    }
    btnBusy.disabled = true;
    btnBusy.textContent = 'Fetching covers…';

    // validar roms: si falta nombre de archivo en alguno, avisar (XML igual posible)
    var missing = xmlGames.some(function(g){ return !(g.rom || '').trim(); });
    if (missing && !confirm('Some games have no ROM filename set.\n<path> will use "' + (xmlGames[0].name || 'game') + '.' + (ext || 'ext') + '"-style names.\nContinue?')){
      btnBusy.disabled = false;
      btnBusy.textContent = orig;
      return;
    }

    var xmlGamesFetched = [];
    var failed = [];
    // XML only: igual necesita las imágenes para nombrar bien <image> (jpg vs png)
    for (var i = 0; i < xmlGames.length; i++){
      var g = xmlGames[i];
      u.msg.className = 'upl-msg';
      u.msg.textContent = 'Downloading covers… (' + (i + 1) + '/' + xmlGames.length + ')';
      var u8 = await fetchCoverU8(checked[g.id]);
      if (!u8){
        failed.push(g.name);
        xmlGamesFetched.push({ g: g, u8: null, imageFile: gameBase(g) + '.png' });
        continue;
      }
      xmlGamesFetched.push({ g: g, u8: u8, imageFile: imageFileName(g, u8) });
    }

    var gamesXml = xmlGamesFetched.map(function(f){
      var romFile = f.g.rom && f.g.rom.trim()
        ? f.g.rom.trim()
        : (f.g.name + (ext ? '.' + ext : '.ext'));
      return {
        name: f.g.name,
        rom: romFile,
        image: f.imageFile,
        desc: f.g.desc, rating: f.g.rating, releasedate: f.g.releasedate,
        developer: f.g.developer, publisher: f.g.publisher, genre: f.g.genre, players: f.g.players
      };
    });
    var xml = buildXml(gamesXml, ext);

    var enc = new TextEncoder();
    var xmlU8 = enc.encode(xml);

    if (mode === 'xml'){
      saveBlob(new Blob([xmlU8], { type: 'application/xml' }), 'gamelist.xml');
      u.msg.className = 'upl-msg ok';
      u.msg.textContent = 'gamelist.xml downloaded.';
      btnBusy.disabled = false;
      btnBusy.textContent = orig;
      return;
    }

    // ZIP R36S: gamelist.xml + images/<file>
    var files = [{ name: 'gamelist.xml', u8: xmlU8 }];
    xmlGamesFetched.forEach(function(f){
      if (f.u8) files.push({ name: 'images/' + f.imageFile, u8: f.u8 });
    });
    var blob = new Blob([makeZip(files)], { type: 'application/zip' });
    saveBlob(blob, 'r36s_gamelist_' + new Date().toISOString().slice(0, 10) + '.zip');
    u.msg.className = 'upl-msg ok';
    u.msg.textContent = 'ZIP ready: ' + (files.length - 1) + ' images + gamelist.xml' + (failed.length ? ' — ' + failed.length + ' cover(s) failed: ' + failed.join(', ') : '');
    btnBusy.disabled = false;
    btnBusy.textContent = orig;
  }

  // ---------- init/wire ----------
  function init(){
    var q = dom('galSearch');
    var tag = dom('galTag');
    var btnReload = dom('galReload');
    var btnDl = dom('galDownload');
    var btnSelAll = dom('galSelAll');
    if (!q) return;

    var t = null;
    q.addEventListener('input', function(){
      clearTimeout(t);
      t = setTimeout(function(){
        filtros.q = q.value.trim();
        reload();
      }, 350);
    });
    if (tag){
      tag.addEventListener('change', function(){
        filtros.tag = tag.value;
        reload();
      });
    }
    if (btnReload) btnReload.addEventListener('click', reload);
    if (btnDl) btnDl.addEventListener('click', downloadSelected);
    var btnXml = dom('galXml');
    if (btnXml){
      btnXml.addEventListener('click', function(){
        openXmlModal();
        renderXmlRows();
        syncZipLabel();
      });
    }
    var u = ensureXmlModal();
    u.btnZip.addEventListener('click', function(){ exportXml('zip'); });
    u.btnOnly.addEventListener('click', function(){ exportXml('xml'); });
    u.inExt.addEventListener('input', syncZipLabel);
    dom('xmlCancel').addEventListener('click', closeXmlModal);
    u.overlay.addEventListener('click', function(ev){
      if (ev.target === u.overlay) closeXmlModal();
    });
    if (btnSelAll){
      btnSelAll.addEventListener('click', function(){
        if (items.length && Object.keys(checked).length === items.length){
          checked = {};
        } else {
          items.forEach(function(it){ checked[it.id] = it; });
        }
        renderGrid();
      });
    }
    reload();
  }

  async function reload(){
    var empty = dom('galEmpty');
    var count = dom('galCount');
    if (count) count.textContent = 'Loading…';
    if (empty) empty.hidden = true;
    try{
      items = await fetchList();
      renderGrid();
    }catch(err){
      if (count) count.textContent = '';
      if (empty){
        empty.hidden = false;
        empty.textContent = 'Error loading the gallery: ' + err.message;
      }
    }
  }

  window.Gallery = { init: init, reload: reload };
})();
