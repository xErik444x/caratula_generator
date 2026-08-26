// case-render.js — Game Case: compone el artwork bajo img/cover.png con perspectiva.

(function(){
  'use strict';

  const box = document.getElementById('boxCanvas');
  const ctx = box.getContext('2d');
  const BW = box.width, BH = box.height;
  const Card = window.CardRender;

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

  // ---- ventana del case: 4 esquinas (px del PNG 1024×1536) ----
  // Valores que calibraste en el editor.
  const winTL = [93, 117];   // superior izquierda
  const winTR = [992, 145];  // superior derecha
  const winBR = [980, 1432]; // inferior derecha
  const winBL = [85, 1498];  // inferior izquierda

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

    ctx.drawImage(caseImg, 0, 0);
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

  window.CaseRender = { init, render, _pending: false, _debug: { getWindowSize } };
})();
