/* =============================================================================
 *  LAYOUT.JS — resizable and collapsible panels
 *  -----------------------------------------------------------------------------
 *  Side panels (Library left, Inspector right):
 *    ◂ / ▸ button in the panel title = collapse to a thin strip
 *    click the strip = open again · drag the inner edge = change the width
 *  Center panels (Song / Arrange, Input, Editor):
 *    ▾ button at the left of each toolbar (or double-click an empty part of
 *    the toolbar) = fold / unfold
 *    drag the bars between them = change the heights
 *  Shortcuts: Alt+1 Library · Alt+2 Arrange · Alt+3 Input · Alt+4 Editor ·
 *             Alt+5 Inspector · Alt+0 reset the layout
 *  The layout is remembered (localStorage 'scoredaw.layout').
 *  Default sizes live in CONFIG.ui.layout.
 * ============================================================================= */

(function (SDAW) {
  'use strict';
  const { $ } = SDAW;

  const DEF = Object.assign({
    libraryWidth: 280, inspectorWidth: 330, sideMin: 200, sideMax: 560, sideCollapsed: 38,
    arrangeHeight: 300, inputHeight: 168, minArrange: 110, minInput: 90, minEditor: 140
  }, (CONFIG.ui && CONFIG.ui.layout) || {});

  const L = {
    state: null,
    defaults() {
      return { libW: DEF.libraryWidth, inspW: DEF.inspectorWidth, libOpen: true, inspOpen: true,
        arrH: DEF.arrangeHeight, inH: DEF.inputHeight, arrOpen: true, inOpen: true, edOpen: true };
    }
  };
  SDAW.layout = L;

  function save() { try { localStorage.setItem('scoredaw.layout', JSON.stringify(L.state)); } catch (e) { /* ignore */ } }

  /** Apply the state to the DOM */
  L.apply = function () {
    const st = L.state;
    // side panels
    const lw = st.libOpen ? st.libW : DEF.sideCollapsed, iw = st.inspOpen ? st.inspW : DEF.sideCollapsed;
    $('#main').style.gridTemplateColumns = lw + 'px minmax(0, 1fr) ' + iw + 'px';
    $('#library').classList.toggle('side-collapsed', !st.libOpen);
    $('#inspector').classList.toggle('side-collapsed', !st.inspOpen);
    $('#btnLibCollapse').textContent = '◂';
    $('#btnInspCollapse').textContent = '▸';

    // center panels
    const arr = $('#arrangePanel'), inp = $('#inputStrip'), ed = $('#editorPanel');
    arr.classList.toggle('folded', !st.arrOpen);
    inp.classList.toggle('folded', !st.inOpen);
    ed.classList.toggle('folded', !st.edOpen);
    $('#btnFoldArrange').textContent = st.arrOpen ? '▾' : '▸';
    $('#btnFoldInput').textContent = st.inOpen ? '▾' : '▸';
    $('#btnFoldEditor').textContent = st.edOpen ? '▾' : '▸';

    // who takes the free space: the editor; if it is folded the arrange; then the input
    const flexer = st.edOpen ? ed : st.arrOpen ? arr : st.inOpen ? inp : null;
    [arr, inp, ed].forEach(p => { p.style.flex = '0 0 auto'; p.style.height = ''; });
    if (st.arrOpen && flexer !== arr) arr.style.height = st.arrH + 'px';
    const body = $('#inputBody');
    body.style.height = st.inOpen && flexer !== inp ? st.inH + 'px' : '';
    body.style.flex = flexer === inp ? '1 1 0' : '';
    if (flexer) flexer.style.flex = '1 1 0';

    // splitters are only useful between two open panels
    $('#split1').classList.toggle('disabled', !(st.arrOpen));
    $('#split2').classList.toggle('disabled', !(st.inOpen || st.arrOpen));
    save();
    SDAW.bus.emit('layout');
  };

  L.toggle = function (key) {
    L.state[key] = !L.state[key];
    L.apply();
    const names = { libOpen: 'Library', inspOpen: 'Inspector', arrOpen: 'Song / Arrange', inOpen: 'Input', edOpen: 'Editor' };
    SDAW.toast(names[key] + (L.state[key] ? ' opened' : ' closed'));
  };
  L.reset = function () { L.state = L.defaults(); L.apply(); SDAW.toast('Layout reset'); };

  /* --------------------------------------------------- dragging ---- */
  function dragger(handle, onMove) {
    handle.addEventListener('mousedown', e => {
      if (handle.classList.contains('disabled')) return;
      e.preventDefault();
      const sc = SDAW.app.scale || 1, x0 = e.clientX, y0 = e.clientY;
      const start = onMove(null);            // returns initial values
      document.body.classList.add('resizing');
      handle.classList.add('active');
      const mv = ev => onMove({ dx: (ev.clientX - x0) / sc, dy: (ev.clientY - y0) / sc, start });
      const up = () => {
        window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
        document.body.classList.remove('resizing'); handle.classList.remove('active');
        save(); SDAW.bus.emit('layout');
      };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    });
  }

  function centerHeight() { return $('#center').clientHeight; }

  L.init = function () {
    try { L.state = Object.assign(L.defaults(), JSON.parse(localStorage.getItem('scoredaw.layout') || '{}')); }
    catch (e) { L.state = L.defaults(); }

    $('#btnLibCollapse').addEventListener('click', () => L.toggle('libOpen'));
    $('#btnInspCollapse').addEventListener('click', () => L.toggle('inspOpen'));
    $('#libStrip').addEventListener('click', () => L.toggle('libOpen'));
    $('#inspStrip').addEventListener('click', () => L.toggle('inspOpen'));
    $('#btnFoldArrange').addEventListener('click', () => L.toggle('arrOpen'));
    $('#btnFoldInput').addEventListener('click', () => L.toggle('inOpen'));
    $('#btnFoldEditor').addEventListener('click', () => L.toggle('edOpen'));
    // double-click on an empty part of a toolbar folds the panel
    [['#arrangePanel', 'arrOpen'], ['#inputStrip', 'inOpen'], ['#editorPanel', 'edOpen']].forEach(([sel, key]) => {
      $(sel + ' > .panel-toolbar').addEventListener('dblclick', e => {
        if (e.target.classList.contains('panel-toolbar') || e.target.classList.contains('spacer') || e.target.tagName === 'H3') L.toggle(key);
      });
    });

    // side widths
    dragger($('#libResize'), d => {
      if (!d) return L.state.libW;
      L.state.libW = SDAW.clamp(d.start + d.dx, DEF.sideMin, DEF.sideMax); L.apply();
    });
    dragger($('#inspResize'), d => {
      if (!d) return L.state.inspW;
      L.state.inspW = SDAW.clamp(d.start - d.dx, DEF.sideMin, DEF.sideMax); L.apply();
    });
    // splitter 1: between Arrange and Input -> arrange height
    dragger($('#split1'), d => {
      if (!d) return L.state.arrH;
      const max = centerHeight() - (L.state.inOpen ? L.state.inH + 44 : 44) - (L.state.edOpen ? DEF.minEditor : 44) - 20;
      L.state.arrH = SDAW.clamp(d.start + d.dy, DEF.minArrange, Math.max(DEF.minArrange, max)); L.apply();
    });
    // splitter 2: between Input and Editor -> input height (or arrange if input is folded)
    dragger($('#split2'), d => {
      const key = L.state.inOpen ? 'inH' : 'arrH';
      if (!d) return L.state[key];
      const min = key === 'inH' ? DEF.minInput : DEF.minArrange;
      const used = key === 'inH' ? (L.state.arrOpen ? L.state.arrH : 44) + 44 : 44;
      const max = centerHeight() - used - (L.state.edOpen ? DEF.minEditor : 44) - 20;
      L.state[key] = SDAW.clamp(d.start + d.dy, min, Math.max(min, max)); L.apply();
    });
    // double-click a splitter = default size
    $('#split1').addEventListener('dblclick', () => { L.state.arrH = DEF.arrangeHeight; L.apply(); });
    $('#split2').addEventListener('dblclick', () => { L.state.inH = DEF.inputHeight; L.apply(); });

    L.apply();
  };

  /** Alt+0..5 shortcuts (called by app.js). Returns true if handled. */
  L.handleKey = function (e) {
    if (!e.altKey || e.ctrlKey) return false;
    const map = { Digit1: 'libOpen', Digit2: 'arrOpen', Digit3: 'inOpen', Digit4: 'edOpen', Digit5: 'inspOpen' };
    if (e.code === 'Digit0') { L.reset(); return true; }
    if (map[e.code]) { L.toggle(map[e.code]); return true; }
    return false;
  };

})(window.SDAW);
