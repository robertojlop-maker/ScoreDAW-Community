/* =============================================================================
 *  GL-BASE.JS — tells the Guitar Lab engine files (tools/guitar-lab/*.js) where
 *  their recordings, amp captures and packs are, relative to ScoreDAW's
 *  index.html (CONFIG.guitarRig.base). Loaded right before tools/guitar-lab/presets.js.
 * ============================================================================= */
window.GL = window.GL || {};
window.GL.BASE = (typeof CONFIG !== 'undefined' && CONFIG.guitarRig && CONFIG.guitarRig.base) || 'tools/guitar-lab/';
