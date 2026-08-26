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

  // estado inicial desde los inputs y primer render
  syncFromInputs();
  window.CardRender.init();
  CaseRender.init();
})();
