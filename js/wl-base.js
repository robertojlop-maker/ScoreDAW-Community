/* =============================================================================
 *  WL-BASE.JS — tells the Wind Lab engine files (tools/wind-lab/*.js) where
 *  their recordings and packs are, relative to ScoreDAW's index.html
 *  (CONFIG.windRig.base). Loaded right before tools/wind-lab/presets.js.
 * ============================================================================= */
window.WL = window.WL || {};
window.WL.BASE = (typeof CONFIG !== 'undefined' && CONFIG.windRig && CONFIG.windRig.base) || 'tools/wind-lab/';
