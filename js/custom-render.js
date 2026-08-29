// custom-render.js — "Custom": edita libremente el artwork bajo un overlay (frame).
// Reutiliza la idea del window-editor: arrastrás las 4 esquinas del rectángulo
// de la ventana, y podés escalar/mover el artwork con sliders o con el drag.
// Expone: window.CustomRender = { init, render, state, setOverlay, reset }

(function(){
  'use strict';

  const canvas = document.getElementById('customCanvas');
  const ctx = canvas.getContext('2d');
  const BW = canvas.width, BH = canvas.height;
  const Card = window.CardRender;

  // ---- estado del custom ----
  const state = {
    artImage: null,          // artwork subido
    overlayImage: null,      // frame (por defecto img/cover.png)
    scale: 1,                // escala del arte (1 = cover-fit a la ventana)
    offX: 0, offY: 0,        // desplazamiento del arte (px de la ventana)
    // ventana editable del overlay: 4 esquinas (px del canvas 1024×1536)
    winTL: [104, 63],
    winTR: [983, 116],
    winBR: [985, 1429],
    winBL: [102, 1483],
  };

  // ---- carga del overlay por defecto ----
  let overlayReady = false;
  function loadDefaultOverlay(){
    const img = new Image();
    img.onload = () => { state.overlayImage = img; overlayReady = true; if (window.CustomRender) redraw(); };
    img.src = 'img/cover.png';
  }

  // ---- helpers de geometría (igual que case-render) ----
  function quad(){
    return [state.winTL, state.winTR, state.winBR, state.winBL];
  }
  function winSize(){
    const q = quad();
    const w = Math.max(1, Math.round(q[1][0]-q[0][0]));
    const h = Math.max(1, Math.round((q[3][1]+q[2][1])/2 - (q[0][1]+q[1][1])/2));
    return { w, h };
  }
  function affineRect(g, img, sx, sy, sw, sh, lt, rt, lb){
    const o=[lt[0],lt[1]];
    const ux=(rt[0]-lt[0])/sw, uy=(rt[1]-lt[1])/sw;
    const vx=(lb[0]-lt[0])/sh, vy=(lb[1]-lt[1])/sh;
    const br=[rt[0]+(lb[0]-lt[0]), rt[1]+(lb[1]-lt[1])];
    g.save();
    g.beginPath();
    g.moveTo(lt[0],lt[1]); g.lineTo(rt[0],rt[1]);
    g.lineTo(br[0],br[1]); g.lineTo(lb[0],lb[1]);
    g.closePath(); g.clip();
    g.transform(ux,uy,vx,vy, o[0]-ux*sx-vx*sy, o[1]-uy*sx-vy*sy);
    g.drawImage(img,0,0);
    g.restore();
  }
  function drawQuadPerspective(g, img, q, strips){
    const iw=img.width, ih=img.height; strips=strips||150;
    const tl=q[0],tr=q[1],br=q[2],bl=q[3];
    const interp=(u,v)=>{
      const topx=tl[0]+(tr[0]-tl[0])*u, topy=tl[1]+(tr[1]-tl[1])*u;
      const botx=bl[0]+(br[0]-bl[0])*u, boty=bl[1]+(br[1]-bl[1])*u;
      return [topx+(botx-topx)*v, topy+(boty-topy)*v];
    };
    for(let s=0;s<strips;s++){
      const v0=s/strips, v1=(s+1)/strips;
      const lt=interp(0,v0), rt=interp(1,v0), lb=interp(0,v1);
      affineRect(g, img, 0, v0*ih, iw, ih/strips, lt, rt, lb);
    }
  }

  // ---- arte con escala/posición aplicadas, a la proporción de la ventana ----
  function makeArt(){
    // el artwork compartido vive en Card.state.artImage (lo setea handleFile / la búsqueda)
    const src = state.artImage || Card.state.artImage;
    if (!src) return null;
    const { w, h } = winSize();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const iw = src.width, ih = src.height;
    const base = Math.max(w/iw, h/ih);      // cover-fit a la ventana
    const sc = base * state.scale;
    const dw = iw*sc, dh = ih*sc;
    // offset en px (desplaza el centro del arte)
    const dx = (w-dw)/2 + state.offX;
    const dy = (h-dh)/2 + state.offY;
    g.drawImage(src, dx, dy, dw, dh);
    return c;
  }

  // ---- dibujo principal sobre el canvas custom ----
  // dibuja arte + overlay SIN las guías, sobre un contexto arbitrario
  function renderContent(g){
    const art = makeArt();
    if (art && overlayReady){
      drawQuadPerspective(g, art, quad(), 150);
    }
    if (overlayReady && state.overlayImage){
      g.drawImage(state.overlayImage, 0, 0);
    }
  }

  function draw(){
    ctx.clearRect(0, 0, BW, BH);
    renderContent(ctx);
    // guías de las 4 esquinas (solo en el editor, no en el preview/export)
    const art = makeArt();
    if (art && overlayReady){
      drawHandles();
    }
  }

  // miniatura sin guías para el sticky preview (a la proporción del case)
  function renderThumb(target){
    const tw = target.width, th = target.height;
    const g = target.getContext('2d');
    g.clearRect(0, 0, tw, th);
    g.save();
    g.scale(tw / BW, th / BH);
    renderContent(g);
    g.restore();
  }

  function drawHandles(){
    const q = quad();
    ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,0.7)';
    ctx.setLineDash([8,6]);
    ctx.beginPath();
    ctx.moveTo(q[0][0],q[0][1]);
    for (let i=1;i<4;i++) ctx.lineTo(q[i][0],q[i][1]);
    ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]);
    const names=['TL','TR','BR','BL'];
    const cols=['#ff9d2e','#4fc3ff','#ff9d2e','#4fc3ff'];
    for(let j=0;j<4;j++){
      ctx.beginPath(); ctx.arc(q[j][0],q[j][1],11,0,Math.PI*2);
      ctx.fillStyle=cols[j]; ctx.fill();
      ctx.lineWidth=2; ctx.strokeStyle='#fff'; ctx.stroke();
      ctx.fillStyle='#fff'; ctx.font='bold 12px monospace';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(names[j], q[j][0], q[j][1]);
    }
  }

  // ---- drag de esquinas ----
  let dragging = -1;
  function scaledPos(ev){
    const r = canvas.getBoundingClientRect();
    return { x:(ev.clientX-r.left)*BW/r.width, y:(ev.clientY-r.top)*BH/r.height };
  }
  function hitCorner(p){
    const q = quad();
    for (let i=0;i<4;i++) if (Math.hypot(p.x-q[i][0],p.y-q[i][1])<28) return i;
    return -1;
  }
  // muta la esquina en el estado (no reasignar, porque state.* es una referencia)
  function moveCorner(i, x, y){
    const corners = [state.winTL, state.winTR, state.winBR, state.winBL];
    corners[i][0] = Math.round(x);
    corners[i][1] = Math.round(y);
  }
  canvas.addEventListener('mousedown', ev => {
    dragging = hitCorner(scaledPos(ev));
    if (dragging>=0) ev.preventDefault();
  });
  window.addEventListener('mousemove', ev => {
    if (dragging<0) return;
    const p=scaledPos(ev);
    moveCorner(dragging, p.x, p.y);
    redraw();
  });
  window.addEventListener('mouseup', () => { dragging=-1; });
  canvas.addEventListener('touchstart', ev=>{
    dragging = hitCorner(scaledPos(ev.touches[0]));
  },{passive:true});
  canvas.addEventListener('touchmove', ev=>{
    ev.preventDefault(); if (dragging<0) return;
    const p=scaledPos(ev.touches[0]);
    moveCorner(dragging, p.x, p.y);
    redraw();
  },{passive:false});
  canvas.addEventListener('touchend', ()=>{ dragging=-1; });

  // ---- API ----
  function setOverlay(img){
    state.overlayImage = img;
    overlayReady = true;
    redraw();
  }
  function reset(){
    state.scale=1; state.offX=0; state.offY=0;
    state.winTL=[104,63]; state.winTR=[983,116];
    state.winBR=[985,1429]; state.winBL=[102,1483];
    redraw();
  }
  function redraw(){ draw(); }
  function render(){
    // se llama al entrar en el formato: si aún no cargó el overlay, espera
    if (overlayReady) redraw();
  }
  function init(){
    loadDefaultOverlay();
    redraw();
    document.fonts.ready.then(redraw);
  }

  // ---- export: renderiza SIN las guías de las esquinas (para el PNG) ----
  function cleanDataURL(){
    const hasGuides = (!!state.artImage || !!Card.state.artImage) && overlayReady;
    const drawOnly = () => {
      ctx.clearRect(0,0,BW,BH);
      const art = makeArt();
      if (art && overlayReady) drawQuadPerspective(art, quad(), 150);
      if (overlayReady && state.overlayImage) ctx.drawImage(state.overlayImage,0,0);
    };
    if (hasGuides){
      drawOnly();
      const url = canvas.toDataURL('image/png');
      draw(); // restaura con guías
      return url;
    }
    return canvas.toDataURL('image/png');
  }

  window.CustomRender = { init, render, draw, state, setOverlay, reset, cleanDataURL, renderThumb };
})();
