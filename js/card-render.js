// card-render.js — dibujo de la carátula sobre el canvas
// Expone: window.CardRender = { init, draw, state }

(function(){
  'use strict';

  const canvas = document.getElementById('cardCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const state = {
    artImage: null,
    accent: { main:'#8b2fd6', light:'#c98bff' },
    title: 'GAME TITLE',
    subtitle: 'SUBTITLE / PORT INFO',
    showTitle: true,
    showSubtitle: true,
  };

  function roundRectPath(c, x, y, w, h, r){
    if (typeof r === 'number') r = {tl:r,tr:r,br:r,bl:r};
    c.beginPath();
    c.moveTo(x+r.tl, y);
    c.lineTo(x+w-r.tr, y);
    c.arcTo(x+w, y, x+w, y+r.tr, r.tr);
    c.lineTo(x+w, y+h-r.br);
    c.arcTo(x+w, y+h, x+w-r.br, y+h, r.br);
    c.lineTo(x+r.bl, y+h);
    c.arcTo(x, y+h, x, y+h-r.bl, r.bl);
    c.lineTo(x, y+r.tl);
    c.arcTo(x, y, x+r.tl, y, r.tl);
    c.closePath();
  }

  function fitTitleLines(text, maxWidth, maxHeight, family, maxLines){
    let size = 130;
    while (size > 28){
      ctx.font = `400 ${size}px ${family}`;
      const words = text.split(' ');
      let lines = [], cur = '';
      for (const w of words){
        const test = cur ? cur+' '+w : w;
        if (ctx.measureText(test).width <= maxWidth || !cur){
          cur = test;
        } else {
          lines.push(cur);
          cur = w;
        }
      }
      if (cur) lines.push(cur);
      const fits = lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= maxWidth);
      const lineH = size*1.08;
      if (fits && lines.length*lineH <= maxHeight) return {size, lines, lineH};
      size -= 3;
    }
    ctx.font = `400 ${size}px ${family}`;
    return {size, lines:[text], lineH:size*1.08};
  }

  function buildCardPath(x, y, w, h){
    const r = 40;
    ctx.beginPath();
    ctx.moveTo(x+r, y);

    // top edge → diagonal chamfer at top-right
    const diagStartX = x + w*0.80;
    const diagEndY = y + h*0.155;
    ctx.lineTo(diagStartX, y);
    ctx.lineTo(x+w, diagEndY);

    // right edge → single notch
    const rNotchTop = y + h*0.32;
    const rNotchH = h*0.05;
    const rNotchD = w*0.022;
    ctx.lineTo(x+w, rNotchTop);
    ctx.lineTo(x+w-rNotchD, rNotchTop);
    ctx.lineTo(x+w-rNotchD, rNotchTop+rNotchH);
    ctx.lineTo(x+w, rNotchTop+rNotchH);
    ctx.lineTo(x+w, y+h-r);

    // bottom-right corner
    ctx.arcTo(x+w, y+h, x+w-r, y+h, r);

    // bottom edge → two small connector nubs
    const nubDepth = h*0.014;
    const n2s = x+w*0.275, n2e = x+w*0.37;
    const n1s = x+w*0.14,  n1e = x+w*0.235;
    ctx.lineTo(n2e, y+h);
    ctx.lineTo(n2e, y+h-nubDepth);
    ctx.lineTo(n2s, y+h-nubDepth);
    ctx.lineTo(n2s, y+h);
    ctx.lineTo(n1e, y+h);
    ctx.lineTo(n1e, y+h-nubDepth);
    ctx.lineTo(n1s, y+h-nubDepth);
    ctx.lineTo(n1s, y+h);
    ctx.lineTo(x+r, y+h);

    // bottom-left corner
    ctx.arcTo(x, y+h, x, y+h-r, r);

    // left edge → two stacked notches
    const lNotchD = w*0.022;
    const l2Top = y+h*0.455, l2Bot = y+h*0.505;
    const l1Top = y+h*0.345, l1Bot = y+h*0.395;
    ctx.lineTo(x, l2Bot);
    ctx.lineTo(x+lNotchD, l2Bot);
    ctx.lineTo(x+lNotchD, l2Top);
    ctx.lineTo(x, l2Top);
    ctx.lineTo(x, l1Bot);
    ctx.lineTo(x+lNotchD, l1Bot);
    ctx.lineTo(x+lNotchD, l1Top);
    ctx.lineTo(x, l1Top);
    ctx.lineTo(x, y+r);

    // top-left corner
    ctx.arcTo(x, y, x+r, y, r);
    ctx.closePath();
  }

  function drawWrappedFit(text, maxWidth, baseSize, family, weight){
    weight = weight || '700';
    let size = baseSize;
    ctx.font = `${weight} ${size}px ${family}`;
    while (ctx.measureText(text).width > maxWidth && size > 10){
      size -= 2;
      ctx.font = `${weight} ${size}px ${family}`;
    }
    return size;
  }

  function draw(){
    ctx.clearRect(0,0,W,H);

    // outer card — SD-card silhouette: diagonal top-right chamfer, side notches, bottom nubs
    const pad = 20;
    const cardX = pad, cardY = pad, cardW = W-pad*2, cardH = H-pad*2;

    ctx.save();

    // white die-cut outline
    buildCardPath(cardX, cardY, cardW, cardH);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 22;
    ctx.stroke();

    // black casing fill
    ctx.fillStyle = '#17141f';
    ctx.fill();
    ctx.clip();

    //ARTWORK
    const diagEndY = cardH*0.155;
    const topMargin = diagEndY+26, sideMargin = 34, bottomMargin = 34;
    const frameX = cardX+sideMargin, frameY = cardY+topMargin;
    const frameW = cardW-sideMargin*2, frameH = cardH-topMargin-bottomMargin;

    roundRectPath(ctx, frameX, frameY, frameW, frameH, 22);
    ctx.fillStyle = '#211c30';
    ctx.fill();

    ctx.save();
    roundRectPath(ctx, frameX, frameY, frameW, frameH, 22);
    ctx.clip();
    if (state.artImage){
      const iw = state.artImage.width, ih = state.artImage.height;
      const scale = Math.max(frameW/iw, frameH/ih);
      const dw = iw*scale, dh = ih*scale;
      const dx = frameX + (frameW-dw)/2;
      const dy = frameY + (frameH-dh)/2;
      ctx.drawImage(state.artImage, dx, dy, dw, dh);
    } else {
      const cell = 28;
      for (let y=0; y<frameH; y+=cell){
        for (let x=0; x<frameW; x+=cell){
          const on = ((x/cell + y/cell) % 2) === 0;
          ctx.fillStyle = on ? '#2a2438' : '#241f31';
          ctx.fillRect(frameX+x, frameY+y, cell, cell);
        }
      }
      ctx.fillStyle = 'rgba(200,190,220,0.55)';
      ctx.textAlign = 'center';
      ctx.font = "700 26px 'Rajdhani', sans-serif";
      ctx.fillText('UPLOAD YOUR ARTWORK', frameX+frameW/2, frameY+frameH/2+10);
      ctx.textAlign = 'left';
    }

    ctx.restore();

    // accent border frame
    roundRectPath(ctx, frameX, frameY, frameW, frameH, 22);
    ctx.strokeStyle = state.accent.light;
    ctx.lineWidth = 6;
    ctx.stroke();

    //SUBTITLE
    const subText = state.showSubtitle ? (state.subtitle || '').toUpperCase() : '';
    const subH = 56;
    const subY = frameY+frameH-24-subH;
    if (subText){
      ctx.fillStyle = state.accent.main;
      ctx.fillRect(frameX, subY, frameW, subH);
      ctx.fillStyle = '#ffffff';
      ctx.font = "700 30px 'Rajdhani', sans-serif";
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(subText, frameX+frameW/2, subY+subH/2+2);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
    }

    // TITLE
    if (state.showTitle){
      const titleText = (state.title || 'GAME TITLE').toUpperCase();
      const titleAreaX = cardX+38;
      const titleAreaW = cardW-76;
      const titleAreaBottom = frameY-18;
      const titleAreaTop = cardY+34;
      const fit = fitTitleLines(titleText, titleAreaW, titleAreaBottom-titleAreaTop, "'Russo One', sans-serif", 2);
      const tSize = fit.size, lines = fit.lines, lineH = fit.lineH;
      ctx.font = `400 ${tSize}px 'Russo One', sans-serif`;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.textAlign = 'left';

      lines.forEach((line, i) => {
        const y = titleAreaBottom - (lines.length-1-i)*lineH;
        // soft accent glow + thin dark outline for crispness against the black margin
        ctx.save();
        ctx.shadowColor = state.accent.light;
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = tSize*0.07;
        ctx.strokeText(line, titleAreaX, y);
        ctx.restore();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(line, titleAreaX, y);
      });
    }

    //R36S CORNER MARK
    const tagW = 150, tagH = 56;
    const tagX = frameX+frameW-tagW-18, tagY = frameY+18;
    roundRectPath(ctx, tagX, tagY, tagW, tagH, 10);
    ctx.fillStyle = state.accent.main;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = "700 30px 'Rajdhani', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R36S', tagX+tagW/2, tagY+tagH/2+1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.restore(); // end outer clip
  }

  // primera pasada apenas carga, y otra cuando las webfonts terminan de cargar
  function init(){
    draw();
    document.fonts.ready.then(draw);
    setTimeout(draw, 400); // safety redraw once webfonts settle
  }

  window.CardRender = { init, draw, state };
})();
