// color-utils.js — helpers de color compartidos (hex <-> RGB <-> HSL)
// Usado por app.js (selector de color libre) y case-render.js (filtro de color del case)

window.ColorUtils = (function(){
  'use strict';

  function clamp(v, min, max){ return Math.min(max, Math.max(min, v)); }

  function hexToRgb(hex){
    hex = (hex || '').toString().replace(/#/g, '').trim();
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    const n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b){
    const h = n => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
    return '#' + h(r) + h(g) + h(b);
  }

  function rgbToHsl(r, g, b){
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0){
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max){
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return { h, s, l };
  }

  function hslToRgb(h, s, l){
    h = ((h % 360) + 360) % 360;
    if (s === 0){
      const v = Math.round(l * 255);
      return { r: v, g: v, b: v };
    }
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60){ r = c; g = x; b = 0; }
    else if (h < 120){ r = x; g = c; b = 0; }
    else if (h < 180){ r = 0; g = c; b = x; }
    else if (h < 240){ r = 0; g = x; b = c; }
    else if (h < 300){ r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
  }

  function hexToHsl(hex){
    const rgb = hexToRgb(hex);
    return rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;
  }

  function hslToHex(h, s, l){
    const rgb = hslToRgb(h, s, l);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  function isValidHex(hex){
    return !!hexToRgb(hex);
  }

  // hex "de entrada" (puede venir con # o sin, 3 o 6 dígitos) -> hex normalizado #rrggbb, o null
  function normalizeHex(hex){
    const rgb = hexToRgb(hex);
    return rgb ? rgbToHex(rgb.r, rgb.g, rgb.b) : null;
  }

  // deriva una variante "light" (glow/borde) a partir del color principal elegido
  function deriveLight(hex){
    const hsl = hexToHsl(hex);
    if (!hsl) return hex;
    const l = clamp(hsl.l + 0.28, 0, 0.86);
    const s = clamp(hsl.s + 0.05, 0, 1);
    return hslToHex(hsl.h, s, l);
  }

  return { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, hexToHsl, hslToHex, isValidHex, normalizeHex, deriveLight };
})();
