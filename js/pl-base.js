/* =============================================================================
 *  PL-BASE.JS — tells the Piano Lab engine files (tools/piano-lab/*.js) where
 *  their recordings and packs are, relative to ScoreDAW's index.html
 *  (CONFIG.pianoRig.base). Loaded right before tools/piano-lab/presets.js.
 * ============================================================================= */
window.PL = window.PL || {};
window.PL.BASE = (typeof CONFIG !== 'undefined' && CONFIG.pianoRig && CONFIG.pianoRig.base) || 'tools/piano-lab/';
