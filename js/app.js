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
    const SEARCH_API = 'https://covers.erik444.xyz/search';

    const IMG_PROXY = '';
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchResults = document.getElementById('searchResults');

  let format = 'card';


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
      // mantiene el mini-preview al día si está visible
      const mini = document.getElementById('miniPreview');
      if (mini && !mini.hidden) updateMiniPreview();
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

  // ---- zoom del arte dentro del Game Case ----
  const boxZoom = document.getElementById('boxZoom');
  const boxZoomVal = document.getElementById('boxZoomVal');
  function applyBoxZoom(){
    const v = parseInt(boxZoom.value, 10) / 100;      // 100..200 -> 1..2
    CaseRender.setZoom(v);
    boxZoomVal.textContent = boxZoom.value + '%';
    // si el mini-preview está visible, actualizarlo al instante
    const mini = document.getElementById('miniPreview');
    if (mini && !mini.hidden) updateMiniPreview();
  }
  boxZoom.addEventListener('input', applyBoxZoom);

  [titleInput, subInput, showTitle, showSubtitle].forEach(inp => {
    inp.addEventListener('input', redraw);
    inp.addEventListener('change', redraw);
  });

  // ---- guardado de imagen multiplataforma ----
  // iOS Safari no descarga a[download] con data:URL gigantes (canvas 1024×1536),
  // asi que en iOS usamos el share sheet de Apple ("Guardar imagen").
  // En Windows / Android / desktop se hace la descarga directa como siempre.
  function dataURLtoBlob(dataurl){
    const [head, data] = dataurl.split(',');
    const mime = (head.match(/:(.*?);/) || [])[1] || 'image/png';
    const bin = atob(data);
    const u8 = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  function isIOS(){
    // cubre iPhone/iPad/iPod y iPadOS (que se reporta como Macintosh)
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.maxTouchPoints > 2 && /Macintosh/i.test(navigator.userAgent));
  }

  async function saveCanvasAsPng(blob, filename){
    const file = new File([blob], filename, { type: blob.type });

    // SOLO iOS usa el share sheet de Apple
    if (isIOS() && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })){
      try{
        await navigator.share({ files: [file], title: filename });
        return;
      }catch(err){
        if (err.name === 'AbortError') return; // usuario cancelo
        // si falla por otra razon, cae al download directo abajo
      }
    }
    // fallback para iOS viejo sin canShare: intenta share igual
    if (isIOS() && navigator.share && !navigator.canShare){
      try{
        await navigator.share({ files: [file], title: filename });
        return;
      }catch(err){ /* cae al download directo */ }
    }

    // Windows / Android / desktop (y fallback iOS): descarga directa con objectURL
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  function canvasToBlob(canvas, filename){
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/png');
    });
  }

  document.getElementById('downloadBtn').addEventListener('click', async () => {
          const name = (titleInput.value || 'cover').trim().replace(/[^a-z0-9\-_ ]/gi,'').replace(/\s+/g,'_') || 'cover';
          const filename = name + '.png';
          let blob;
          if (format === 'custom'){
            // exporta sin las guías de las esquinas (devuelve dataURL) -> a blob
            blob = dataURLtoBlob(CustomRender.cleanDataURL());
          } else {
            const canvasId = format === 'box' ? 'boxCanvas' : 'cardCanvas';
            blob = await canvasToBlob(document.getElementById(canvasId), filename);
          }
          if (blob) await saveCanvasAsPng(blob, filename);
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
            img.src = url;
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

    // ---- mini-preview sticky (móvil) ----
    const miniPreview = document.getElementById('miniPreview');
    const miniCanvas = document.getElementById('miniCanvas');

    // copia el contenido del canvas activo a la miniatura (sin guías para custom)
    function updateMiniPreview(){
      let srcCanvas;
      if (format === 'custom'){
        // dibuja el resultado (sin guías) directamente en la miniatura
        CustomRender.renderThumb(miniCanvas);
        return;
      } else {
        srcCanvas = document.getElementById(format === 'box' ? 'boxCanvas' : 'cardCanvas');
        const g = miniCanvas.getContext('2d');
        g.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
        g.drawImage(srcCanvas, 0, 0, miniCanvas.width, miniCanvas.height);
      }
    }

    // muestra la miniatura solo cuando el preview grande sale de la vista (móvil)
    const previewCol = document.querySelector('.preview-col');
    let lastMiniToggled = false;
    function syncMiniVisibility(entry){
      const isMobile = window.innerWidth < 881;
      const outOfView = !entry.isIntersecting;
      const show = isMobile && outOfView;
      if (show !== lastMiniToggled){
        miniPreview.hidden = !show;
        lastMiniToggled = show;
        if (show) updateMiniPreview();
      }
    }
    const observer = new IntersectionObserver(entries => syncMiniVisibility(entries[0]), { threshold: 0 });
    if (previewCol) observer.observe(previewCol);
    // al agrandar la miniatura, volve al preview grande
    miniPreview.addEventListener('click', () => { previewCol && previewCol.scrollIntoView({ behavior: 'smooth' }); });

    // estado inicial desde los inputs y primer render
    syncFromInputs();
    window.CardRender.init();
    CaseRender.init();
    CustomRender.init();

    // ---- nav de vistas: Generator / Gallery (secciones completas, no tabs de pane) ----
    var viewGen = document.getElementById('viewGen');
    var viewGal = document.getElementById('viewGal');
    var paneGal = document.getElementById('paneGal');
    var tabsGen = document.getElementById('tabsGen');
    if (tabsGen && viewGen && viewGal && window.Gallery){
      tabsGen.addEventListener('click', function(e){
        var btn = e.target.closest('.tab-gen');
        if (!btn) return;
        var tab = btn.dataset.tab;
        tabsGen.querySelectorAll('.tab-gen').forEach(function(b){ b.classList.toggle('active', b === btn); });
        viewGen.hidden = tab !== 'gen';
        viewGal.hidden = tab !== 'gal';
        if (tab === 'gal') window.scrollTo({ top: 0 }); // la sección arranca arriba, como una página propia
        if (tab === 'gal') window.Gallery.reload(); // lista fresca cada vez que entra
      });
      window.Gallery.init();
    }

    // ---- upload de la cover generada a Covers Gallery ----
    var UPLOAD_API = 'https://covers-gallery.erik444.workers.dev/api/upload';
    var GALLERY_API = 'https://covers-gallery.erik444.workers.dev';
    var UPL_TAGS = ['nintendo','sony','sega','psx','snes','gba','nds','arcade','retro','anime','pixel-art','minimal'];
    var uplOverlay = document.getElementById('uplOverlay');
    var uplTags = document.getElementById('uplTags');
    var uplMsg = document.getElementById('uplMsg');
    var uplSel = new Set();

    if (uplOverlay && uplTags){
      // chips de tags
      UPL_TAGS.forEach(function(t){
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'upl-tag';
        b.textContent = '#' + t;
        b.addEventListener('click', function(){
          if (uplSel.has(t)) uplSel.delete(t);
          else if (uplSel.size < 4) uplSel.add(t);
          b.classList.toggle('on', uplSel.has(t));
        });
        uplTags.appendChild(b);
      });

      document.getElementById('uploadBtn').addEventListener('click', function(){
        // prellenado del título con el del generador
        var t = document.getElementById('uplTitle');
        if (t && !t.value) t.value = titleInput.value === 'GAME TITLE' ? '' : titleInput.value;
        setSrc('gen');
        uplMsg.textContent = '';
        uplMsg.className = 'upl-msg';
        uplOverlay.hidden = false;
        renderTurnstile();
        applyLockUI(); // kill-switch: deshabilita botones si la API está bloqueada
      });
      // botón ⬆ Upload en la toolbar de la Galería: mismo modal, modo archivo
      var galUploadBtn = document.getElementById('galUpload');
      if (galUploadBtn){
        galUploadBtn.addEventListener('click', function(){
          document.getElementById('uplTitle').value = '';
          document.getElementById('uplAuthor').value = '';
          uplSel.clear();
          document.querySelectorAll('#uplTags .upl-tag').forEach(function(b){ b.classList.remove('on'); });
          setSrc('gen');
          uplMsg.textContent = '';
          uplMsg.className = 'upl-msg';
          uplOverlay.hidden = false;
          renderTurnstile();
          applyLockUI(); // kill-switch: deshabilita botones si la API está bloqueada
        });
      }

      // ---- kill-switch UI: si la API bloqueó las subidas, todos los botones
      // ---- del modal se deshabilitan y se muestra el aviso (chequeo al abrir)
      var uplLockCache = null; // null = desconocido, true/false tras el primer chequeo
      function applyLockUI(){
        var confirmBtn = document.getElementById('uplConfirm');
        var titleEl = document.getElementById('uplTitle');
        var authorEl = document.getElementById('uplAuthor');
        function setLocked(locked){
          uplLockCache = locked;
          confirmBtn.disabled = locked;
          titleEl.disabled = locked;
          authorEl.disabled = locked;
          document.querySelectorAll('#uplTags .upl-tag').forEach(function(b){ b.disabled = locked; });
          document.querySelectorAll('#uplSrcRow .upl-src').forEach(function(b){ b.disabled = locked; });
          if (locked){
            uplMsg.textContent = '🔒 Uploads are temporarily disabled by the administrator.';
            uplMsg.className = 'upl-msg err';
          }
        }
        if (uplLockCache !== null){
          setLocked(uplLockCache);
          return;
        }
        try{
          var x = new XMLHttpRequest();
          x.open('GET', GALLERY_API + '/api/status', true);
          x.onload = function(){
            var locked = false;
            try{ locked = !!JSON.parse(x.responseText).uploadsLocked; }catch(e){}
            setLocked(locked);
          };
          x.onerror = function(){ setLocked(false); }; // si /api/status no responde, no bloqueo la UI
          x.send();
        }catch(e){ setLocked(false); }
      }
      document.getElementById('uplCancel').addEventListener('click', function(){
        uplOverlay.hidden = true;
      });
      uplOverlay.addEventListener('click', function(e){
        if (e.target === uplOverlay) uplOverlay.hidden = true;
      });

      // ---- fuente de la imagen: cover generada o archivo del dispositivo ----
      var uplSrc = 'gen'; // 'gen' | 'file'
      var uplFileBuf = null; // ArrayBuffer del archivo elegido
      var srcGen = document.getElementById('uplSrcGen');
      var srcFile = document.getElementById('uplSrcFile');
      var fileWrap = document.getElementById('uplFileWrap');
      var fileInput = document.getElementById('uplFile');
      var uplThumb = document.getElementById('uplThumb');
      function setSrc(mode){
        uplSrc = mode;
        srcGen.classList.toggle('on', mode === 'gen');
        srcFile.classList.toggle('on', mode === 'file');
        fileWrap.hidden = mode !== 'file';
        if (mode === 'gen') { uplFileBuf = null; fileInput.value = ''; uplThumb.hidden = true; }
        uplMsg.textContent = '';
        uplMsg.className = 'upl-msg';
      }
      srcGen.addEventListener('click', function(){ setSrc('gen'); });
      srcFile.addEventListener('click', function(){ setSrc('file'); });
      fileInput.addEventListener('change', function(){
        var f = fileInput.files && fileInput.files[0];
        if (!f){ uplFileBuf = null; uplThumb.hidden = true; return; }
        if (f.size > 8 * 1024 * 1024){
          uplMsg.textContent = 'Max file size is 8MB.';
          uplMsg.className = 'upl-msg err';
          uplFileBuf = null;
          return;
        }
        var rd = new FileReader();
        rd.onload = function(){
          uplThumb.src = String(rd.result);
          uplThumb.hidden = false;
        };
        rd.readAsDataURL(f);
        f.arrayBuffer().then(function(b){ uplFileBuf = b; uplMsg.textContent = ''; uplMsg.className = 'upl-msg'; });
      });

      // ---- Turnstile (captcha invisible/managed de Cloudflare) ----
      // Widget dentro de un modal hidden: Turnstile no renderiza en display:none,
      // así que se monta/recicla cada vez que se abre el modal.
      var TS_SITEKEY = '0x4AAAAAAFAR4BL10Yke01da';
      var tsWidgetId = null;
      function renderTurnstile(){
        var box = document.getElementById('uplTs');
        if (!box) return;
        if (typeof window.turnstile === 'undefined'){ setTimeout(renderTurnstile, 250); return; }
        if (tsWidgetId !== null){ try { turnstile.remove(tsWidgetId); } catch(e){} tsWidgetId = null; }
        box.innerHTML = '';
        try {
          tsWidgetId = turnstile.render(box, {
            sitekey: TS_SITEKEY,
            theme: 'dark',
            language: 'en',
            'response-field': false,
          });
        } catch(e){ /* red sin acceso a challenges.cloudflare.com: el upload fallará con captcha error */ }
      }
      function turnstileToken(){
        if (tsWidgetId === null) return '';
        try { return turnstile.getResponse(tsWidgetId) || ''; } catch(e){ return ''; }
      }

      document.getElementById('uplConfirm').addEventListener('click', async function(){
        var btn = this;
        var title = document.getElementById('uplTitle').value.trim();
        var author = document.getElementById('uplAuthor').value.trim();
        if (!title){ uplMsg.textContent = 'Enter a title.'; uplMsg.className = 'upl-msg err'; return; }
        if (!uplSel.size){ uplMsg.textContent = 'Choose at least 1 tag.'; uplMsg.className = 'upl-msg err'; return; }
        var tk = turnstileToken();
        if (!tk){
          uplMsg.textContent = 'Waiting for the captcha check — try again in a second.';
          uplMsg.className = 'upl-msg err';
          renderTurnstile();
          return;
        }
        if (uplSrc === 'file' && !uplFileBuf){
          uplMsg.textContent = 'Choose an image file first.';
          uplMsg.className = 'upl-msg err';
          return;
        }

        // imagen: cover generada (canvas→JPEG) o archivo elegido (buf→base64)
        var dataUrl;
        if (uplSrc === 'file'){
          try{
            var u8 = new Uint8Array(uplFileBuf);
            var bin = '';
            var CH = 8192;
            for (var ci = 0; ci < u8.length; ci += CH){
              bin += String.fromCharCode.apply(null, u8.subarray(ci, ci + CH));
            }
            dataUrl = 'data:' + (fileInput.files[0].type || 'image/jpeg') + ';base64,' + btoa(bin);
          }catch(err){
            uplMsg.textContent = 'Could not read the file.';
            uplMsg.className = 'upl-msg err';
            return;
          }
        } else {
          try{
            if (format === 'custom'){
              dataUrl = CustomRender.cleanDataURL();
            } else {
              var canvasId = format === 'box' ? 'boxCanvas' : 'cardCanvas';
              dataUrl = document.getElementById(canvasId).toDataURL('image/jpeg', 0.92);
            }
          }catch(err){
            uplMsg.textContent = 'Could not export the cover (canvas tainted?).';
            uplMsg.className = 'upl-msg err';
            return;
          }
        }
        // ~1.37x por base64; tope duro del worker son 2MB de binario
        if (Math.round(dataUrl.length * 0.75) > 2 * 1024 * 1024){
          uplMsg.textContent = 'The cover is over 2MB — try a smaller artwork.';
          uplMsg.className = 'upl-msg err';
          return;
        }

        // POST JSON dataURL fire-and-forget + confirmación por polling:
        // el Chromium bajo CDP no lee respuestas de ~7s de este worker (fetch Y XHR
        // fallan al leer, aunque el upload siempre entra y crea la entry). La fuente
        // de verdad es la API de lectura (GET), que sí es 100% confiable: disparamos
        // el POST, ignoramos su respuesta, y consultamos /api/list?title=… cada 2s.
        btn.disabled = true;
        uplMsg.textContent = 'Uploading and moderating…';
        uplMsg.className = 'upl-msg';
        var payload = JSON.stringify({
          image: dataUrl,
          title: title,
          author: author,
          tags: Array.from(uplSel).join(','),
        });
        try{
          var confirmado = await new Promise(function(resolve){
            var xhr = new XMLHttpRequest();
            xhr.open('POST', UPLOAD_API, true);
            xhr.setRequestHeader('content-type', 'application/json');
            xhr.setRequestHeader('x-turnstile-token', tk);
            xhr.send(payload); // respuesta ignorada a conciencia
            var intentos = 0;
            var timer = setInterval(function(){
              intentos++;
              var q = encodeURIComponent(title);
              var x = new XMLHttpRequest();
              x.open('GET', GALLERY_API + '/api/list?limit=100&q=' + q, true);
              x.onload = function(){
                try{
                  var arr = JSON.parse(x.responseText).items || [];
                  if (arr.length){ clearInterval(timer); resolve(true); }
                }catch(e){ /* sigue */ }
                if (intentos >= 12){ clearInterval(timer); resolve(false); }
              };
              x.onerror = function(){
                if (intentos >= 12){ clearInterval(timer); resolve(false); }
              };
              x.send();
            }, 2500);
          });
          if (confirmado){
            uplMsg.textContent = 'Published! It is already in the gallery ✓';
            uplMsg.className = 'upl-msg ok';
            setTimeout(function(){
              uplOverlay.hidden = true;
              uplMsg.textContent = '';
              uplMsg.className = 'upl-msg';
              // si la tab galería está visible, refresca
              if (paneGal && !paneGal.hidden && window.Gallery) window.Gallery.reload();
            }, 1400);
          } else {
            uplMsg.textContent = 'Upload may have failed — check the gallery tab.';
            uplMsg.className = 'upl-msg err';
            btn.disabled = false;
          }
        }catch(err){
          uplMsg.textContent = 'Upload error: ' + err.message;
          uplMsg.className = 'upl-msg err';
          btn.disabled = false;
        }
      });
    }
})();
