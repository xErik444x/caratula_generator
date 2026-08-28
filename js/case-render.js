// case-render.js — Game Case: compone el artwork bajo img/cover.png con perspectiva.

(function(){
  'use strict';

  const box = document.getElementById('boxCanvas');
  const ctx = box.getContext('2d');
  const BW = box.width, BH = box.height;
  const Card = window.CardRender;
  const CU = window.ColorUtils;

  const caseImg = new Image();
  caseImg.src = 'img/cover.png';
  let caseReady = false;
  caseImg.onload = () => {
    caseReady = true;
    if (window.CaseRender){
      draw();
      window.CaseRender._pending = false;
    }
  };

  // ---- filtro de color del case ----
  // El template (img/cover.png) viene en violeta. Para "pintarlo" de otro color rotamos
  // el tono (hue) SOLO de los píxeles saturados (el violeta de lomo/badges), y dejamos
  // intacto todo lo casi-gris: blanco, negro y el plateado del borde plástico.
  // '#8b2fd6' (default) es un no-op: se devuelve la imagen original, sin recalcular nada.
  const DEFAULT_CASE_COLOR = '#8b2fd6';
  const SOURCE_HUE = 265; // tono medido del violeta real del PNG (no es exactamente el de #8b2fd6)
  const GRAY_THRESHOLD = 18; // max-min de canal por debajo de esto = "gris", se deja igual
  const SAT_THRESHOLD = 0.12;

  let currentCaseColor = DEFAULT_CASE_COLOR;
  const recolorCache = new Map(); // hex|'mono' -> canvas recoloreado
  let taintedWarned = false; // evita loguear/advertir mas de una vez

  function recolorCaseUnsafe(key){
    const c = document.createElement('canvas');
    c.width = caseImg.width;
    c.height = caseImg.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(caseImg, 0, 0);

    const isMono = key === 'mono'; // opción "Stealth": desatura a blanco/negro/gris
    let shift = 0;
    if (!isMono){
      const hsl = CU.hexToHsl(key);
      const targetHue = hsl ? hsl.h : SOURCE_HUE;
      shift = targetHue - SOURCE_HUE;
    }

    // getImageData puede tirar SecurityError si la página se abrió como file:// en vez
    // de servirse por http (canvas "contaminado"): dejamos que se propague y lo maneja
    // getRecoloredCase con un fallback, en vez de romper el draw() entero.
    const imgData = g.getImageData(0, 0, c.width, c.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4){
      const r = d[i], gg = d[i + 1], b = d[i + 2], a = d[i + 3];
      if (a === 0) continue;
      const max = Math.max(r, gg, b), min = Math.min(r, gg, b);
      if (max - min < GRAY_THRESHOLD) continue; // ya es gris/blanco/negro: no tocar
      const hsl = CU.rgbToHsl(r, gg, b);
      if (hsl.s < SAT_THRESHOLD) continue;
      if (isMono){
        const v = Math.round(hsl.l * 255);
        d[i] = v; d[i + 1] = v; d[i + 2] = v;
      } else {
        let nh = (hsl.h + shift) % 360;
        if (nh < 0) nh += 360;
        const rgb = CU.hslToRgb(nh, hsl.s, hsl.l);
        d[i] = rgb.r; d[i + 1] = rgb.g; d[i + 2] = rgb.b;
      }
    }
    g.putImageData(imgData, 0, 0);
    return c;
  }

  function getRecoloredCase(key){
    key = key || DEFAULT_CASE_COLOR;
    if (recolorCache.has(key)) return recolorCache.get(key);

    if (key.toLowerCase() === DEFAULT_CASE_COLOR){
      recolorCache.set(key, caseImg); // sin cambios: usamos la imagen original tal cual
      return caseImg;
    }

    try {
      const result = recolorCaseUnsafe(key);
      recolorCache.set(key, result);
      return result;
    } catch (err) {
      // Canvas contaminado (típicamente al abrir el HTML con doble-click, file://,
      // en vez de servirlo por http). No podemos leer los píxeles para recolorear,
      // así que devolvemos el case original en vez de dejar el draw() a mitad de camino.
      recolorCache.set(key, caseImg);
      if (!taintedWarned){
        taintedWarned = true;
        console.warn('[CaseRender] No se pudo aplicar el filtro de color (canvas "tainted"). ' +
          'Esto pasa cuando la página se abre con doble-click (file://) en vez de servirse ' +
          'desde un servidor local. Probá: "python3 -m http.server" en esta carpeta, o abrila ' +
          'con la extensión "Live Server" de VSCode.', err);
        if (window.CaseRender) window.CaseRender._tainted = true;
      }
      return caseImg;
    }
  }

  function setColor(hex){
    currentCaseColor = hex || DEFAULT_CASE_COLOR;
    render();
  }

  function getColor(){
    return currentCaseColor;
  }

  // ---- ventana del case: 4 esquinas (px del PNG 1024×1536) ----
  // Valores que calibraste en el editor.
  const winTL = [94, 108];   // superior izquierda
  const winTR = [985, 158];  // superior derecha
  const winBR = [989, 1433]; // inferior derecha
  const winBL = [92, 1492];  // inferior izquierda

  // ---- warp de cuadrilátero en perspectiva (franjas finas, sin costuras) ----
  // Respeta las 4 esquinas EXACTAS. Un afín no sirve porque ignora BR y desborda.
  // dibuja un rect de la imagen (sx,sy,sw,sh) al paralelogramo lt/rt/lb (br derivado)
  function affineRect(img, sx, sy, sw, sh, lt, rt, lb){
    const o = [lt[0], lt[1]];
    const ux = (rt[0]-lt[0])/sw, uy = (rt[1]-lt[1])/sw;
    const vx = (lb[0]-lt[0])/sh, vy = (lb[1]-lt[1])/sh;
    const br = [rt[0]+(lb[0]-lt[0]), rt[1]+(lb[1]-lt[1])];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(lt[0], lt[1]); ctx.lineTo(rt[0], rt[1]);
    ctx.lineTo(br[0], br[1]); ctx.lineTo(lb[0], lb[1]);
    ctx.closePath(); ctx.clip();
    // transform(a,b,c,d,e,f): x'=a*x+c*y+e ; y'=b*x+d*y+f  (origen textura = (sx,sy))
    ctx.transform(ux, uy, vx, vy, o[0]-ux*sx-vx*sy, o[1]-uy*sx-vy*sy);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  function drawQuadPerspective(img, q, strips){
    const iw = img.width, ih = img.height;
    strips = strips || 150;
    const tl=q[0], tr=q[1], br=q[2], bl=q[3];
    // interpola bilinealmente el quad (u=0..1, v=0..1)
    const interp = (u, v) => {
      const topx = tl[0]+(tr[0]-tl[0])*u, topy = tl[1]+(tr[1]-tl[1])*u;
      const botx = bl[0]+(br[0]-bl[0])*u, boty = bl[1]+(br[1]-bl[1])*u;
      return [topx+(botx-topx)*v, topy+(boty-topy)*v];
    };
    for (let s=0; s<strips; s++){
      const v0 = s/strips, v1 = (s+1)/strips;
      const lt = interp(0, v0), rt = interp(1, v0), lb = interp(0, v1);
      affineRect(img, 0, v0*ih, iw, ih/strips, lt, rt, lb);
    }
  }

  // tamaño del arte según la ventana (para makePlaceholderArt / makeGameArt)
  function getWindowSize(){
    const w = Math.max(1, Math.round(winTR[0]-winTL[0]));
    const h = Math.max(1, Math.round((winBL[1]+winBR[1])/2 - (winTL[1]+winTR[1])/2));
    return { w, h };
  }

  function trimLetterbox(img){
    try {
      return trimLetterboxUnsafe(img);
    } catch (err) {
      return img;
    }
  }

  function trimLetterboxUnsafe(img){
    const W = img.width, H = img.height;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const { data } = g.getImageData(0, 0, W, H);

    function rowMostlyDark(y){
      let dark = 0, total = 0;
      for (let x = 0; x < W; x++){
        const i = (y * W + x) * 4;
        if (data[i + 3] < 8) continue;
        total++;
        if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 22) dark++;
      }
      return total > 0 && dark / total > 0.9;
    }

    function colMostlyDark(x){
      let dark = 0, total = 0;
      for (let y = 0; y < H; y++){
        const i = (y * W + x) * 4;
        if (data[i + 3] < 8) continue;
        total++;
        if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 22) dark++;
      }
      return total > 0 && dark / total > 0.9;
    }

    let top = 0, bottom = H - 1, left = 0, right = W - 1;
    while (top < bottom && rowMostlyDark(top)) top++;
    while (bottom > top && rowMostlyDark(bottom)) bottom--;
    while (left < right && colMostlyDark(left)) left++;
    while (right > left && colMostlyDark(right)) right--;

    const tw = right - left + 1, th = bottom - top + 1;
    if (tw < W * 0.45 || th < H * 0.45 || tw < 32 || th < 32) return img;

    const out = document.createElement('canvas');
    out.width = tw;
    out.height = th;
    out.getContext('2d').drawImage(c, left, top, tw, th, 0, 0, tw, th);
    return out;
  }

  function artForCase(){
    if (!Card.state.artImage) return null;
    return trimLetterbox(Card.state.artImage);
  }

  // precarga el arte, con cover-fit, a la proporción exacta de la ventana.
  // Así el cuadrilátero deforma la forma pero NO aplasta las proporciones.
  function makeWindowArt(){
    const src = artForCase() || makePlaceholderArt();
    const { w, h } = getWindowSize();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const iw = src.width, ih = src.height;
    const sc = Math.max(w/iw, h/ih);
    const dw = iw*sc, dh = ih*sc;
    g.drawImage(src, (w-dw)/2, (h-dh)/2, dw, dh);
    return c;
  }

  function draw(){
    ctx.clearRect(0, 0, BW, BH);

    if (!caseReady){
      cardOnly();
      return;
    }

    const art = makeWindowArt();
    const win = [winTL, winTR, winBR, winBL];
    drawQuadPerspective(art, win, 150);

    ctx.drawImage(getRecoloredCase(currentCaseColor), 0, 0);
  }

  function makePlaceholderArt(){
    const { w, h } = getWindowSize();
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#17141f';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(200,190,220,0.5)';
    g.textAlign = 'center';
    g.font = "700 30px 'Rajdhani', sans-serif";
    g.fillText('UPLOAD YOUR ARTWORK', w / 2, h / 2);
    g.textAlign = 'left';
    return c;
  }

  function cardOnly(){
    const art = Card.state.artImage || makePlaceholderArt();
    if (!art) return;
    const s = Math.min(BW * 0.9 / art.width, BH * 0.9 / art.height);
    const dw = art.width * s, dh = art.height * s;
    ctx.drawImage(art, (BW - dw) / 2, (BH - dh) / 2, dw, dh);
  }

  function render(){
    if (caseReady){
      draw();
      window.CaseRender._pending = false;
    } else {
      window.CaseRender._pending = true;
    }
  }

  function init(){
    render();
    document.fonts.ready.then(render);
  }

  window.CaseRender = { init, render, setColor, getColor, _pending: false, _tainted: false, _debug: { getWindowSize } };
})();
