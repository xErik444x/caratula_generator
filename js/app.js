// app.js — wiring del formulario con el render del canvas
// Requiere card-render.js y case-render.js cargados antes

(function(){
  'use strict';

  const { draw, state } = window.CardRender;
  const CaseRender = window.CaseRender;
  const CustomRender = window.CustomRender;
  const CU = window.ColorUtils;

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

  // evita recalcular algo pesado (como el recoloreo del case, ~1.5M px) en cada
  // micro-evento 'input' que dispara el <input type=color> nativo mientras se arrastra
  function debounce(fn, wait){
    let t;
    return function(...args){
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

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
      panel.classList.toggle('format-custom', format === 'custom');
      redraw();
    }

    function redraw(){
      syncFromInputs();
      if (format === 'box'){
        CaseRender.render();
      } else if (format === 'custom'){
        CustomRender.render();
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

  // ---- Accent color: swatches fijos + picker libre + hex ----
  const swatchesEl = document.getElementById('swatches');
  const accentPicker = document.getElementById('accentPicker');
  const accentCustomBtn = document.getElementById('accentCustomBtn');
  const accentCustomInner = accentCustomBtn.querySelector('.swatch-custom-inner');
  const accentHex = document.getElementById('accentHex');

  function clearAccentSwatches(){
    swatchesEl.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  }

  function applyAccent(mainHex, lightHex){
    const main = CU.normalizeHex(mainHex) || mainHex;
    const light = lightHex || CU.deriveLight(main);
    state.accent = { main, light };
    // no reescribir el campo mientras el usuario está tipeando en él (rompería el cursor
    // y, con un shorthand de 3 dígitos válido a mitad de tipeo, el texto que sigue escribiendo)
    if (document.activeElement !== accentHex){
      accentHex.value = main.replace('#','').toUpperCase();
    }
    accentHex.classList.remove('invalid');
    redraw();
  }

  function activateAccentCustom(hex){
    clearAccentSwatches();
    accentCustomBtn.classList.add('active');
    accentCustomBtn.style.color = hex;
    accentCustomInner.style.background = hex;
    accentCustomInner.textContent = '';
    accentPicker.value = hex;
  }

  swatchesEl.addEventListener('click', e => {
    const sw = e.target.closest('.swatch');
    if (!sw || sw === accentCustomBtn) return;
    clearAccentSwatches();
    sw.classList.add('active');
    const parts = sw.dataset.color.split(',');
    applyAccent(parts[0], parts[1]);
  });

  accentPicker.addEventListener('input', () => {
    activateAccentCustom(accentPicker.value);
    applyAccent(accentPicker.value);
  });

  accentHex.addEventListener('input', () => {
    const norm = CU.normalizeHex(accentHex.value);
    if (norm){
      activateAccentCustom(norm); // solo toca los swatches/picker, no este mismo input
      applyAccent(norm);
    } else if (accentHex.value.trim().length >= 3){
      accentHex.classList.add('invalid');
    }
  });
  // al salir del campo, prolijamos lo que quedó tipeado (mayúsculas, 3→6 dígitos)
  accentHex.addEventListener('change', () => {
    const norm = CU.normalizeHex(accentHex.value);
    if (norm) accentHex.value = norm.replace('#','').toUpperCase();
  });

  // ---- Case color: filtro de recoloreo del template del Game Case ----
  const caseSwatchesEl = document.getElementById('caseSwatches');
  const casePicker = document.getElementById('casePicker');
  const caseCustomBtn = document.getElementById('caseCustomBtn');
  const caseCustomInner = caseCustomBtn.querySelector('.swatch-custom-inner');
  const caseHex = document.getElementById('caseHex');
  const caseHint = document.getElementById('caseColorHint');

  function clearCaseSwatches(){
    caseSwatchesEl.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  }

  function applyCaseColor(value){
    CaseRender.setColor(value);
    if (value !== 'mono'){
      const norm = CU.normalizeHex(value) || value;
      if (document.activeElement !== caseHex){
        caseHex.value = norm.replace('#','').toUpperCase();
      }
      caseHex.classList.remove('invalid');
    }
    redraw();
    // si el filtro no pudo aplicarse (canvas "tainted" por abrir el HTML con file://
    // en vez de servirlo por http), avisamos una sola vez con instrucciones concretas
    if (CaseRender._tainted && !caseHint.dataset.taintedShown){
      caseHint.dataset.taintedShown = '1';
      caseHint.innerHTML = '⚠ The color filter needs this page served over http (it can\'t read the image pixels from a double-clicked file). Run <code>python3 -m http.server</code> in this folder and open it via <code>http://localhost:8000</code>, or use VSCode\'s "Live Server". The case will stay in its original color until then.';
      caseHint.classList.add('hint-warn');
    }
  }

  function activateCaseCustom(hex){
    clearCaseSwatches();
    caseCustomBtn.classList.add('active');
    caseCustomBtn.style.color = hex;
    caseCustomInner.style.background = hex;
    caseCustomInner.textContent = '';
    casePicker.value = hex;
  }

  // el <input type=color> nativo dispara 'input' en CADA micro-movimiento del mouse
  // mientras se arrastra dentro del selector; recolorear ~1.5M px en cada uno de esos
  // eventos congela la UI. Debounceamos el trabajo pesado y sólo lo corremos cuando
  // el usuario hace una pausa (o suelta el picker).
  const applyCaseColorDebounced = debounce(applyCaseColor, 80);

  caseSwatchesEl.addEventListener('click', e => {
    const sw = e.target.closest('.swatch');
    if (!sw || sw === caseCustomBtn) return;
    clearCaseSwatches();
    sw.classList.add('active');
    applyCaseColor(sw.dataset.color);
  });

  casePicker.addEventListener('input', () => {
    activateCaseCustom(casePicker.value); // feedback visual inmediato (barato)
    applyCaseColorDebounced(casePicker.value); // recoloreo real: pesado, se debounce
  });

  caseHex.addEventListener('input', () => {
    const norm = CU.normalizeHex(caseHex.value);
    if (norm){
      activateCaseCustom(norm); // solo toca los swatches/picker, no este mismo input
      applyCaseColor(norm);
    } else if (caseHex.value.trim().length >= 3){
      caseHex.classList.add('invalid');
    }
  });
  // al salir del campo, prolijamos lo que quedó tipeado (mayúsculas, 3→6 dígitos)
  caseHex.addEventListener('change', () => {
    const norm = CU.normalizeHex(caseHex.value);
    if (norm) caseHex.value = norm.replace('#','').toUpperCase();
  });

  [titleInput, subInput, showTitle, showSubtitle].forEach(inp => {
    inp.addEventListener('input', redraw);
    inp.addEventListener('change', redraw);
  });

  document.getElementById('downloadBtn').addEventListener('click', () => {
          const name = (titleInput.value || 'cover').trim().replace(/[^a-z0-9\-_ ]/gi,'').replace(/\s+/g,'_') || 'cover';
          let url;
          if (format === 'custom'){
            // exporta sin las guías de las esquinas
            url = CustomRender.cleanDataURL();
          } else {
            const canvasId = format === 'box' ? 'boxCanvas' : 'cardCanvas';
            url = document.getElementById(canvasId).toDataURL('image/png');
          }
          const link = document.createElement('a');
          link.download = name + '.png';
          link.href = url;
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
                      if (q.length < 4){
                        setSearchMsg('Type at least 4 characters.');
                        return;
                      }
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
                                    // sin portada: se deja ver pero no se puede clickear (así la lista no se cierra)
                                    if (!item.cover){
                                      el.classList.add('no-cover');
                                      const tag = document.createElement('span');
                                      tag.className = 'sr-no-cover';
                                      tag.textContent = 'No cover';
                                      el.appendChild(tag);
                                    } else {
                                      el.addEventListener('click', () => loadCoverAsArt(item.cover, item.name));
                                    }
                                    searchResults.appendChild(el);
                });
      }catch(err){
        setSearchMsg('Search error: ' + err.message);
      }
    }

    searchBtn.addEventListener('click', () => runSearch(searchInput.value));
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(searchInput.value); });

    // ---- controles del formato custom ----
    const artScale = document.getElementById('artScale');
    const artScaleVal = document.getElementById('artScaleVal');
    const artX = document.getElementById('artX');
    const artY = document.getElementById('artY');
    const overlayInput = document.getElementById('overlayInput');
    const overlayZone = document.getElementById('overlayZone');
    const overlayTxt = document.getElementById('overlayTxt');
    const customState = CustomRender.state;

    function applyArtSettings(){
      customState.scale = parseInt(artScale.value,10) / 100;
      customState.offX = parseInt(artX.value,10);
      customState.offY = parseInt(artY.value,10);
      artScaleVal.textContent = artScale.value + '%';
      CustomRender.render();
    }
    artScale.addEventListener('input', applyArtSettings);
    artX.addEventListener('input', applyArtSettings);
    artY.addEventListener('input', applyArtSettings);

    overlayInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          CustomRender.setOverlay(img);
          overlayTxt.innerHTML = '<b>✓ ' + file.name + '</b>';
          overlayZone.classList.add('has-image');
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    // estado inicial desde los inputs y primer render
    syncFromInputs();
    window.CardRender.init();
    CaseRender.init();
    CustomRender.init();
})();
