/* =============================================================================
 *  RIG-UI.JS — shared controls of the rig windows (Piano Rig; same look as the
 *  Guitar Rig): neon knobs, vertical faders, selects, segmented buttons, cards.
 *  -----------------------------------------------------------------------------
 *  SDAW.rigUI.make(adapter) → { knob, choice, segs, card, fader, fmt, snap }
 *  adapter = {
 *    param(id)            setting definition { id, label, min, max, step, unit, options, tip }
 *    value(id)            current value
 *    fac(id)              factory value
 *    set(id, v)           change live (inside an edit)
 *    begin() / end(label) open / close one undo step
 *    acts(id)             false = the control is dimmed (not used with this sound source)
 *    offNote              text explaining dimmed controls
 *    offBadge             short tag on dimmed knobs (default 'model')
 *  }
 *  Knobs: drag up / down (Shift = fine), mouse wheel, double-click = factory value.
 * ============================================================================= */
(function (SDAW) {
  'use strict';
  const { el, svg } = SDAW;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const scale = () => (SDAW.app && SDAW.app.scale) || 1;
  const ARC0 = -135, ARC1 = 135;
  function arcPath(cx, cy, r, a0, a1) {
    const rad = a => (a - 90) * Math.PI / 180, p0 = [cx + r * Math.cos(rad(a0)), cy + r * Math.sin(rad(a0))], p1 = [cx + r * Math.cos(rad(a1)), cy + r * Math.sin(rad(a1))];
    return 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
  }
  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  SDAW.rigUI = {
    noteName: m => NOTE[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1),
    make(A) {
      let wheelT = null;
      const same = (a, b) => typeof a === 'number' ? Math.abs(a - b) < 1e-9 : a === b;
      /** value as text */
      function fmt(p, v) {
        if (p.options) return String(v);
        const u = p.unit || '';
        if (u === 'dB') return (v > 0 ? '+' : '') + v.toFixed(1) + ' dB';
        if (u === 'Hz') return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 1 : 2) + ' kHz' : (p.step < 1 ? v.toFixed(1) : Math.round(v)) + ' Hz';
        if (u === 'ms' || u === 'ms/string') return (v < 10 ? v.toFixed(1) : Math.round(v)) + ' ms';
        if (u === 's') return v.toFixed(v < 1 ? 3 : 2) + ' s';
        if (u === 'midi') return SDAW.rigUI.noteName(Math.round(v));
        if (u === 'cents') return (v > 0 && p.min < 0 ? '+' : '') + v.toFixed(1) + ' ¢';
        if (u === 'st') return (v > 0 ? '+' : '') + v + ' st';
        if (u.startsWith('×')) return v.toFixed(2) + u;
        if (p.max === 8 && p.step === 1) return String(v);
        if (p.step === 1 && !u) return String(v);
        if (p.min === -1 && p.max === 1) return (v > 0 ? '+' : '') + Math.round(v * 100);
        if (p.min >= 0 && p.max <= 1.6 && !u) return Math.round(v * 100) + '%';
        return v.toFixed(p.step >= 1 ? 0 : p.step >= 0.1 ? 1 : 2) + (u ? ' ' + u : '');
      }
      const snap = (p, v) => { const st = p.step || 0.01; v = Math.round((v - p.min) / st) * st + p.min; return +clamp(v, p.min, p.max).toFixed(6); };
      const setOnce = (id, v, label) => { A.begin(); A.set(id, v); A.end(label); };

      /** knob(id, { label, cls:'big'|'small'|'chrome', color, onLive }) */
      function knob(id, o) {
        o = o || {};
        const p = A.param(id); if (!p) return null;
        const off = A.acts && !A.acts(id), cur = () => A.value(id);
        const size = /big/.test(o.cls || '') ? 76 : /chrome/.test(o.cls || '') ? 58 : /small/.test(o.cls || '') ? 44 : 56;
        const c = size / 2, r = c - 5;
        const fill = svg('path', { class: 'rk-fill' }), ptr = svg('line', { x1: c, y1: c - (r - 7), x2: c, y2: c - (r - 16), class: 'rk-ptr' }), g = svg('g', {}, [ptr]);
        const face = svg('svg', { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size, class: 'rk-svg' },
          [svg('path', { d: arcPath(c, c, r, ARC0, ARC1), class: 'rk-track' }), fill, svg('circle', { cx: c, cy: c, r: r - 6, class: 'rk-cap' }), g]);
        const val = el('div', { class: 'rk-val' });
        const label = o.label || p.label;
        const wrap = el('div', { class: 'rk ' + (o.cls || '') + (off ? ' off' : ''), style: o.color ? { '--kc': o.color } : null,
          'data-help': label + (p.tip ? ' — ' + p.tip : '') + ' · drag up/down (Shift = fine), wheel, double-click = factory' + (off ? ' · ' + (A.offNote || 'not used with this sound source') : '') },
          [face, el('div', { class: 'rk-lab' }, label), val, off ? el('span', { class: 'rk-badge' }, A.offBadge || 'model') : null]);
        function draw() {
          const v = cur(), f = (v - p.min) / ((p.max - p.min) || 1), a = ARC0 + f * (ARC1 - ARC0);
          const zero = p.min < 0 && p.max > 0 ? ARC0 + (-p.min / (p.max - p.min)) * (ARC1 - ARC0) : ARC0;
          fill.setAttribute('d', Math.abs(a - zero) < 0.5 ? '' : arcPath(c, c, r, Math.min(zero, a), Math.max(zero, a)));
          g.setAttribute('transform', 'rotate(' + a.toFixed(1) + ' ' + c + ' ' + c + ')');
          val.textContent = fmt(p, v);
          wrap.classList.toggle('changed', !same(v, A.fac(id)));
        }
        let y0 = 0, v0 = 0;
        wrap.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); wrap.setPointerCapture(e.pointerId); y0 = e.clientY; v0 = cur(); A.begin(); wrap.classList.add('drag'); });
        wrap.addEventListener('pointermove', e => {
          if (!wrap.hasPointerCapture(e.pointerId)) return;
          const v = snap(p, v0 + (y0 - e.clientY) / scale() / 170 * (p.max - p.min) * (e.shiftKey ? 0.15 : 1));
          if (v !== cur()) { A.set(id, v); draw(); if (o.onLive) o.onLive(v); }
        });
        const up = e => { if (!wrap.hasPointerCapture(e.pointerId)) return; wrap.releasePointerCapture(e.pointerId); wrap.classList.remove('drag'); A.end(label); };
        wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
        wrap.addEventListener('wheel', e => {
          e.preventDefault(); A.begin();
          const stp = (p.step || 0.01) * (e.shiftKey ? 1 : Math.max(1, Math.round((p.max - p.min) / (p.step || 0.01) / 60)));
          A.set(id, snap(p, cur() + (e.deltaY < 0 ? stp : -stp))); draw(); if (o.onLive) o.onLive(cur());
          clearTimeout(wheelT); wheelT = setTimeout(() => A.end(label), 450);
        }, { passive: false });
        wrap.addEventListener('dblclick', e => { e.stopPropagation(); setOnce(id, A.fac(id), label + ' (factory)'); });
        draw();
        return wrap;
      }
      /** select for an options setting */
      function choice(id, o) {
        o = o || {};
        const p = A.param(id), v = A.value(id), off = A.acts && !A.acts(id);
        return el('label', { class: 'rk-sel' + (off ? ' off' : ''), 'data-help': (o.label || p.label) + (p.tip ? ' — ' + p.tip : '') }, [
          el('span', {}, o.label || p.label),
          el('select', { onchange: e => setOnce(id, e.target.value, o.label || p.label) }, (o.options || p.options).map(x => el('option', { value: x, selected: x === v ? true : null }, x)))
        ]);
      }
      /** segmented buttons for an options setting */
      function segs(id, list, o) {
        o = o || {};
        const p = A.param(id), v = A.value(id);
        return el('div', { class: 'rig-segs' + (o.cls ? ' ' + o.cls : '') }, (list || p.options).map(x => el('button', {
          class: 'seg' + (x === v ? ' on' : ''), 'data-help': (o.help || p.label) + ': ' + x + (p.tip ? ' — ' + p.tip : ''),
          onclick: () => { if (o.set) o.set(x); else setOnce(id, x, p.label); }
        }, o.labels ? o.labels[x] || x : x)));
      }
      const card = (title, color, kids, cls) => el('div', { class: 'rig-card' + (cls ? ' ' + cls : ''), style: { '--cc': color } }, [el('div', { class: 'rig-card-t' }, title), el('div', { class: 'rig-card-b' }, kids)]);
      /** vertical fader (EQ bands); onLive after every change */
      function fader(id, label, onLive) {
        const p = A.param(id), cur = () => A.value(id), H = 190;
        const knobEl = el('div', { class: 'fd-knob' }), fillEl = el('div', { class: 'fd-fill' }), val = el('div', { class: 'fd-val' });
        const slot = el('div', { class: 'fd-slot' }, [el('div', { class: 'fd-zero' }), fillEl, knobEl]);
        const wrap = el('div', { class: 'fader', 'data-help': p.label + ' — drag, wheel, double-click = 0 dB' }, [val, slot, el('div', { class: 'fd-lab' }, label)]);
        const live = () => { draw(); if (onLive) onLive(); };
        function draw() {
          const v = cur(), f = (v - p.min) / (p.max - p.min), y = (1 - f) * H, yz = (1 - (-p.min / (p.max - p.min))) * H;
          knobEl.style.top = (y - 9) + 'px'; fillEl.style.top = Math.min(y, yz) + 'px'; fillEl.style.height = Math.abs(y - yz) + 'px';
          val.textContent = (v > 0 ? '+' : '') + v.toFixed(1);
          wrap.classList.toggle('changed', !same(v, A.fac(id)));
        }
        let yS = 0, vS = 0;
        slot.addEventListener('pointerdown', e => {
          e.preventDefault(); slot.setPointerCapture(e.pointerId); A.begin();
          const r = slot.getBoundingClientRect();
          if (e.target !== knobEl) { A.set(id, snap(p, p.min + (1 - (e.clientY - r.top) / r.height) * (p.max - p.min))); live(); }
          yS = e.clientY; vS = cur();
        });
        slot.addEventListener('pointermove', e => { if (!slot.hasPointerCapture(e.pointerId)) return; A.set(id, snap(p, vS + (yS - e.clientY) / scale() / H * (p.max - p.min) * (e.shiftKey ? 0.2 : 1))); live(); });
        const up = e => { if (!slot.hasPointerCapture(e.pointerId)) return; slot.releasePointerCapture(e.pointerId); A.end(p.label); };
        slot.addEventListener('pointerup', up); slot.addEventListener('pointercancel', up);
        slot.addEventListener('wheel', e => { e.preventDefault(); A.begin(); A.set(id, snap(p, cur() + (e.deltaY < 0 ? 0.5 : -0.5))); live(); clearTimeout(wheelT); wheelT = setTimeout(() => A.end(p.label), 450); }, { passive: false });
        wrap.addEventListener('dblclick', () => setOnce(id, 0, p.label + ' 0 dB'));
        draw();
        return wrap;
      }
      return { knob, choice, segs, card, fader, fmt, snap, setOnce };
    }
  };
})(window.SDAW);
