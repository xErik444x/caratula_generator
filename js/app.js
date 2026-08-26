// app.js — wiring del formulario con el render del canvas
// Requiere card-render.js y case-render.js cargados antes

(function(){
  'use strict';

  const { draw, state } = window.CardRender;
  const CaseRender = window.CaseRender;

  const panel = document.querySelector('.panel');
    const canvasShell = document.querySelector('.canvas-shell');
    const formatToggle = document.getElementById('formatToggle');
    const titleInput = document.getElementById('titleInput');
    const subInput = document.getElementById('subInput');
    const showTitle = document.getElementById('showTitle');
    const showSubtitle = document.getElementById('showSubtitle');
    const artInput = document.getElementById('artInput');
    const dropZone = document.getElementById('dropZone');
    const uploadTxt = document.getElementById('uploadTxt');

    // ---- config del buscador de carátulas ----
    // workerd que hace de proxy a IGDB. Si necesitás apuntar a otro, cambiá esto.
    const SEARCH_API = 'https://covers.erikschwerdt18.workers.dev/search';
    // proxy de imagenes del worker: reenvia la img con CORS para poder pintarla al canvas
    // y exportarla. Si tu worker no tiene esta ruta, buscalo por el nombre que uses.
    const IMG_PROXY = 'https://covers.erikschwerdt18.workers.dev/img?url=';
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchResults = document.getElementById('searchResults');

  let format = 'card';

  function syncFromInputs(){
    state.title = titleInput.value;
    state.subtitle = subInput.value;
    state.showTitle = showTitle.checked;
    state.showSubtitle = showSubtitle.checked;
  }

  function setFormat(next){
    format = next;
    formatToggle.querySelectorAll('.fmt-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.fmt === format);
    });
    canvasShell.dataset.fmt = format;
    panel.classList.toggle('format-box', format === 'box');
    redraw();
  }

  function redraw(){
    syncFromInputs();
    if (format === 'box'){
      CaseRender.render();
    } else {
      draw();
    }
  }

  // ---- image upload ----
  function handleFile(file){
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        state.artImage = img;
        uploadTxt.innerHTML = '<b>✓ ' + file.name + '</b>';
        dropZone.classList.add('has-image');
        redraw();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  artInput.addEventListener('change', e => handleFile(e.target.files[0]));
  ['dragover'].forEach(evt => dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('drag'); }));
  ['dragleave','drop'].forEach(evt => dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.remove('drag'); }));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  formatToggle.addEventListener('click', e => {
    const btn = e.target.closest('.fmt-btn');
    if (!btn || btn.dataset.fmt === format) return;
    setFormat(btn.dataset.fmt);
  });

  document.getElementById('swatches').addEventListener('click', e => {
    const sw = e.target.closest('.swatch');
    if (!sw) return;
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    const parts = sw.dataset.color.split(',');
    state.accent = { main: parts[0], light: parts[1] };
    redraw();
  });

  [titleInput, subInput, showTitle, showSubtitle].forEach(inp => {
    inp.addEventListener('input', redraw);
    inp.addEventListener('change', redraw);
  });

  document.getElementById('downloadBtn').addEventListener('click', () => {
      const name = (titleInput.value || 'cover').trim().replace(/[^a-z0-9\-_ ]/gi,'').replace(/\s+/g,'_') || 'cover';
      const canvasId = format === 'box' ? 'boxCanvas' : 'cardCanvas';
      const link = document.createElement('a');
      link.download = name + '.png';
      link.href = document.getElementById(canvasId).toDataURL('image/png');
      link.click();
    });

    // ---- buscador de carátulas ----
    function setSearchMsg(msg){
      searchResults.hidden = false;
      searchResults.innerHTML = '<div class="sr-msg">' + msg + '</div>';
    }

    function setArtworkImage(img, label){
      state.artImage = img;
      uploadTxt.innerHTML = '<b>✓ ' + label + '</b>';
      dropZone.classList.add('has-image');
      redraw();
    }

    // carga la carátula elegida como arte, usando el proxy del worker (CORS)
          function loadCoverAsArt(url, label){
            const img = new Image();
            img.crossOrigin = 'anonymous';   // sin esto el canvas queda "contaminado" y no exporta
            img.onload = () => setArtworkImage(img, label || 'cover');
            img.onerror = () => {
              // si el proxy no existe, probamos la URL directa (puede que no exporte)
              const direct = new Image();
              direct.onload = () => setArtworkImage(direct, label || 'cover');
              direct.onerror = () => setSearchMsg('Could not load that cover.');
              direct.src = url;
            };
            img.src = IMG_PROXY + encodeURIComponent(url);
          }

          async function runSearch(q){
            q = (q || '').trim();
            if (!q) return;
            setSearchMsg('Searching…');
            try{
              const res = await fetch(SEARCH_API + '?q=' + encodeURIComponent(q), { headers: { Accept: 'application/json' } });
              if (!res.ok) throw new Error('HTTP ' + res.status);
              const txt = await res.text();
              let data;
              try{
                data = JSON.parse(txt);
              }catch(e){
                // el worker devolvió HTML o "Hello World": el endpoint /search no está activo
                setSearchMsg('The search endpoint did not return JSON. Is the worker deployed?');
                return;
              }
              const list = (data && data.results) || [];
              if (!list.length){
                setSearchMsg('No results for &ldquo;' + q + '&rdquo;.');
                return;
              }
        searchResults.hidden = false;
        searchResults.innerHTML = '';
        list.forEach(item => {
                  const el = document.createElement('div');
                  el.className = 'sr-item';
                  const platform = (item.platforms && item.platforms.length) ? item.platforms.join(', ') : '—';
                  const year = item.releaseDate ? String(item.releaseDate).slice(0,4) : '';
                  let thumb = document.createElement('span');
                  thumb.className = 'thumb-missing';
                  thumb.textContent = '🖼️';
                  if (item.cover){
                    thumb = document.createElement('img');
                    thumb.loading = 'lazy';
                    thumb.alt = '';
                    thumb.src = item.cover;
                    thumb.onerror = () => { thumb.classList.add('is-missing'); };
                  }
                  const meta = document.createElement('div');
                  meta.className = 'sr-meta';
                  const nameEl = document.createElement('div');
                  nameEl.className = 'sr-name';
                  nameEl.textContent = item.name;
                  const subEl = document.createElement('div');
                  subEl.className = 'sr-sub';
                  subEl.textContent = [platform, year ? '· ' + year : ''].filter(Boolean).join(' ');
                  meta.appendChild(nameEl);
                  meta.appendChild(subEl);
                  el.appendChild(thumb);
                  el.appendChild(meta);
                  el.addEventListener('click', () => {
                    if (item.cover){
                      loadCoverAsArt(item.cover, item.name);
                    } else {
                      setSearchMsg('That game has no cover to use.');
                    }
                  });
                  searchResults.appendChild(el);
                });
      }catch(err){
        setSearchMsg('Search error: ' + err.message);
      }
    }

    searchBtn.addEventListener('click', () => runSearch(searchInput.value));
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(searchInput.value); });

    // estado inicial desde los inputs y primer render
    syncFromInputs();
    window.CardRender.init();
    CaseRender.init();
})();
