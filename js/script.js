/* =========================================================
   Bore Crossing Profile Generator
   Supports:
     1. Buried HDD bore crossing (depth entered directly)
     2. Aerial pole crossing (cable span above road)
   ========================================================= */

'use strict';

/* ---------- Element refs ---------- */
const els = {
  projectName:      document.getElementById('projectName'),
  roadName:         document.getElementById('roadName'),
  roadDirection:    document.getElementById('roadDirection'),
  bearingGroup:     document.getElementById('bearingGroup'),
  roadBearing:      document.getElementById('roadBearing'),
  pavementType:     document.getElementById('pavementType'),
  crossingAngle:    document.getElementById('crossingAngle'),
  roadWidth:        document.getElementById('roadWidth'),
  rowWidth:         document.getElementById('rowWidth'),
  // buried-only
  entrySetback:     document.getElementById('entrySetback'),
  exitSetback:      document.getElementById('exitSetback'),
  boreDepth:        document.getElementById('boreDepth'),
  boreDepthHint:    document.getElementById('boreDepthHint'),
  entryAngle:       document.getElementById('entryAngle'),
  exitAngle:        document.getElementById('exitAngle'),
  bitDiameter:      document.getElementById('bitDiameter'),
  conduitDiameter:  document.getElementById('conduitDiameter'),
  // aerial-only
  poleHeightA:      document.getElementById('poleHeightA'),
  poleHeightB:      document.getElementById('poleHeightB'),
  cableSag:         document.getElementById('cableSag'),
  poleSetback:      document.getElementById('poleSetback'),
  aerialConduitDia: document.getElementById('aerialConduitDia'),
  aerialClearanceHint: document.getElementById('aerialClearanceHint'),
  // canal-only (aerial)
  canalWidth:          document.getElementById('canalWidth'),
  waterDepth:          document.getElementById('waterDepth'),
  canalPoleHeight:     document.getElementById('canalPoleHeight'),
  canalCableSag:       document.getElementById('canalCableSag'),
  canalPoleSetback:    document.getElementById('canalPoleSetback'),
  canalConduitDia:     document.getElementById('canalConduitDia'),
  canalClearanceHint:  document.getElementById('canalClearanceHint'),
  canalAerialFields:   document.getElementById('canalAerialFields'),
  // canal-only (buried HDD)
  canalEntrySetback:   document.getElementById('canalEntrySetback'),
  canalExitSetback:    document.getElementById('canalExitSetback'),
  canalBoreDepth:      document.getElementById('canalBoreDepth'),
  canalEntryAngle:     document.getElementById('canalEntryAngle'),
  canalExitAngle:      document.getElementById('canalExitAngle'),
  canalBitDia:         document.getElementById('canalBitDia'),
  canalBoreConduitDia: document.getElementById('canalBoreConduitDia'),
  canalBoreHint:       document.getElementById('canalBoreHint'),
  canalBuriedFields:   document.getElementById('canalBuriedFields'),
  // sections
  buriedSection:    document.getElementById('buriedSection'),
  aerialSection:    document.getElementById('aerialSection'),
  canalSection:     document.getElementById('canalSection'),
  // output
  warning:           document.getElementById('formWarning'),
  planSvg:           document.getElementById('planSvg'),
  profileSvg:        document.getElementById('profileSvg'),
  resultStrip:       document.getElementById('resultStrip'),
  emptyState:        document.getElementById('emptyState'),
  drawingContent:    document.getElementById('drawingContent'),
  profileTypeLabel:  document.getElementById('profileTypeLabel'),
  btnGenerate:       document.getElementById('btnGenerate'),
};

/* ---------- State ---------- */
let currentType       = 'buried';
let currentUnits      = 'imperial';
let profileGenerated  = false;
let canalMethod       = 'aerial';   /* 'aerial' | 'buried' */

/* ---------- Unit helpers ---------- */
const FT_PER_M  = 3.28084;
const MM_PER_IN = 25.4;

function toFeet(v, units) { return units === 'metric' ? v * FT_PER_M : v; }
function fmtLen(ft, units, dec = 1) {
  return units === 'metric'
    ? (ft / FT_PER_M).toFixed(dec) + ' m'
    : ft.toFixed(dec) + ' ft';
}
function fmtSmall(v, units, dec) {
  return units === 'metric'
    ? v.toFixed(dec ?? 0) + ' mm'
    : v.toFixed(dec ?? 2) + ' in';
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Crossing type toggle ---------- */
document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentType = btn.dataset.type;
    document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b === btn));
    els.buriedSection.hidden = currentType !== 'buried';
    els.aerialSection.hidden = currentType !== 'aerial';
    els.canalSection.hidden  = currentType !== 'canal';
    hideWarning();
    if (profileGenerated) generate();
  });
});

/* ---------- Canal method sub-toggle ---------- */
document.getElementById('canalMethodCtrl').querySelectorAll('.seg[data-canal-method]').forEach(btn => {
  btn.addEventListener('click', () => {
    canalMethod = btn.dataset.canalMethod;
    btn.closest('#canalMethodCtrl').querySelectorAll('.seg').forEach(b => b.classList.toggle('active', b === btn));
    els.canalAerialFields.hidden  = canalMethod !== 'aerial';
    els.canalBuriedFields.hidden  = canalMethod !== 'buried';
    hideWarning();
    if (profileGenerated) generate();
  });
});

/* ---------- Units toggle ---------- */
document.querySelectorAll('.seg[data-units]').forEach(btn => {
  btn.addEventListener('click', () => {
    const newUnits = btn.dataset.units;
    if (newUnits === currentUnits) return;
    convertFields(newUnits);
    currentUnits = newUnits;
    document.querySelectorAll('.seg[data-units]').forEach(b => {
      b.classList.toggle('active', b.dataset.units === newUnits);
      b.setAttribute('aria-pressed', String(b.dataset.units === newUnits));
    });
    document.querySelectorAll('.unit-tag[data-u="len"]').forEach(t => { t.textContent = newUnits === 'metric' ? 'm' : 'ft'; });
    document.querySelectorAll('.unit-tag[data-u="small"]').forEach(t => { t.textContent = newUnits === 'metric' ? 'mm' : 'in'; });
    generate();
  });
});

function convertFields(newUnits) {
  const lenIds   = ['roadWidth', 'rowWidth', 'entrySetback', 'exitSetback', 'boreDepth', 'poleHeightA', 'poleHeightB', 'cableSag', 'poleSetback', 'canalWidth', 'waterDepth', 'canalPoleHeight', 'canalCableSag', 'canalPoleSetback', 'canalEntrySetback', 'canalExitSetback', 'canalBoreDepth'];
  const smallIds = ['bitDiameter', 'conduitDiameter', 'aerialConduitDia', 'canalConduitDia', 'canalBitDia', 'canalBoreConduitDia'];
  lenIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const v = parseFloat(el.value);
    if (isNaN(v)) return;
    el.value = (newUnits === 'metric' ? (v / FT_PER_M) : (v * FT_PER_M)).toFixed(2);
  });
  smallIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const v = parseFloat(el.value);
    if (isNaN(v)) return;
    el.value = (newUnits === 'metric' ? (v * MM_PER_IN) : (v / MM_PER_IN)).toFixed(2);
  });
}

/* ---------- Road direction ---------- */
const DIR_LABELS = { '0': { pos: 'N', neg: 'S' }, '90': { pos: 'E', neg: 'W' }, '45': { pos: 'NE', neg: 'SW' }, '315': { pos: 'NW', neg: 'SE' } };

els.roadDirection.addEventListener('change', () => {
  els.bearingGroup.hidden = els.roadDirection.value !== 'custom';
  if (profileGenerated) generate();
});

function getBearing() {
  if (els.roadDirection.value === 'custom') return ((parseFloat(els.roadBearing.value) % 360) + 360) % 360 || 0;
  return parseFloat(els.roadDirection.value);
}

/* ---------- Warnings ---------- */
function showWarning(msg) { els.warning.textContent = msg; els.warning.hidden = false; }
function hideWarning()    { els.warning.hidden = true; }

/* ---------- Live updates (only after first Generate click) ---------- */
const allInputs = document.querySelectorAll('#boreForm input, #boreForm select');
let debounceHandle = null;
allInputs.forEach(el => {
  el.addEventListener('input', () => {
    if (!profileGenerated) return;
    clearTimeout(debounceHandle);
    debounceHandle = setTimeout(generate, 200);
  });
});

/* ==========================================================
   GEOMETRY — BURIED BORE
   ========================================================== */
function computeBuriedGeometry() {
  const units = currentUnits;

  const roadWidthRaw  = parseFloat(els.roadWidth.value);
  const rowWidthRaw   = parseFloat(els.rowWidth.value);
  const entrySetbackRaw = parseFloat(els.entrySetback.value);
  const exitSetbackRaw  = parseFloat(els.exitSetback.value);
  const boreDepthRaw    = parseFloat(els.boreDepth.value);
  const entryAngleDeg   = parseFloat(els.entryAngle.value);
  const exitAngleDeg    = parseFloat(els.exitAngle.value);
  const bitDiaRaw       = parseFloat(els.bitDiameter.value);
  const condDiaRaw      = parseFloat(els.conduitDiameter.value) || 0;
  const crossAngDeg     = parseFloat(els.crossingAngle.value);

  const errors = [];
  if (!(roadWidthRaw > 0))                          errors.push('Road width must be greater than 0.');
  if (!(rowWidthRaw > 0))                           errors.push('ROW width must be greater than 0.');
  if (!(entrySetbackRaw >= 0))                      errors.push('Entry setback cannot be negative.');
  if (!(exitSetbackRaw >= 0))                       errors.push('Exit setback cannot be negative.');
  if (!(boreDepthRaw > 0))                          errors.push('Bore depth must be greater than 0.');
  if (!(entryAngleDeg > 0 && entryAngleDeg <= 45)) errors.push('Entry angle must be 1°–45°.');
  if (!(exitAngleDeg  > 0 && exitAngleDeg  <= 45)) errors.push('Exit angle must be 1°–45°.');
  if (!(bitDiaRaw > 0))                             errors.push('Bore diameter must be greater than 0.');
  if (!(crossAngDeg >= 15 && crossAngDeg <= 165))   errors.push('Crossing angle must be 15°–165°.');
  if (rowWidthRaw > 0 && rowWidthRaw < roadWidthRaw) errors.push('ROW width cannot be smaller than road width.');

  if (errors.length) { showWarning(errors.join(' ')); return null; }

  const roadWidth    = toFeet(roadWidthRaw,    units);
  const rowWidth     = toFeet(rowWidthRaw,     units);
  const entrySetback = toFeet(entrySetbackRaw, units);
  const exitSetback  = toFeet(exitSetbackRaw,  units);
  const boreDepth    = toFeet(boreDepthRaw,    units);

  const entryRad   = entryAngleDeg * Math.PI / 180;
  const exitRad    = exitAngleDeg  * Math.PI / 180;

  const entryRun   = boreDepth / Math.tan(entryRad);
  const exitRun    = boreDepth / Math.tan(exitRad);
  const entrySlant = boreDepth / Math.sin(entryRad);
  const exitSlant  = boreDepth / Math.sin(exitRad);

  const totalSpan  = entrySetback + roadWidth + exitSetback;
  const flatRunRaw = totalSpan - entryRun - exitRun;
  const overlap    = flatRunRaw < -0.001;
  const flatRun    = Math.max(0, flatRunRaw);
  const boreLength = entrySlant + flatRun + exitSlant;

  if (overlap) {
    showWarning('Entry/exit transitions overlap — bore depth may be too deep for these angles and setbacks. Reduce depth, increase angles, or increase setbacks.');
  } else {
    hideWarning();
  }

  return {
    type: 'buried', units, roadWidth, rowWidth, entrySetback, exitSetback,
    boreDepth, entryAngleDeg, exitAngleDeg, entryRun, exitRun,
    entrySlant, exitSlant, flatRun, boreLength, totalSpan, overlap,
    bitDiaRaw, condDiaRaw, crossAngDeg,
    bearing: getBearing(), roadDirSelect: els.roadDirection.value,
    pavementType: els.pavementType.value,
    projectName: els.projectName.value.trim() || 'Untitled Crossing',
    roadName:    els.roadName.value.trim() || 'Unnamed Road',
  };
}

/* ==========================================================
   GEOMETRY — AERIAL CROSSING
   ========================================================== */
function computeAerialGeometry() {
  const units = currentUnits;

  const roadWidthRaw   = parseFloat(els.roadWidth.value);
  const rowWidthRaw    = parseFloat(els.rowWidth.value);
  const poleHeightARaw = parseFloat(els.poleHeightA.value);
  const poleHeightBRaw = parseFloat(els.poleHeightB.value);
  const cableSagRaw    = parseFloat(els.cableSag.value);
  const poleSetbackRaw = parseFloat(els.poleSetback.value);
  const condDiaRaw     = parseFloat(els.aerialConduitDia.value) || 0;
  const crossAngDeg    = parseFloat(els.crossingAngle.value);

  const errors = [];
  if (!(roadWidthRaw > 0))    errors.push('Road width must be greater than 0.');
  if (!(rowWidthRaw > 0))     errors.push('ROW width must be greater than 0.');
  if (!(poleHeightARaw > 0))  errors.push('Pole A height must be greater than 0.');
  if (!(poleHeightBRaw > 0))  errors.push('Pole B height must be greater than 0.');
  if (!(cableSagRaw >= 0))    errors.push('Cable sag cannot be negative.');
  if (!(poleSetbackRaw >= 0)) errors.push('Pole setback cannot be negative.');
  if (rowWidthRaw > 0 && rowWidthRaw < roadWidthRaw) errors.push('ROW width cannot be smaller than road width.');

  if (errors.length) { showWarning(errors.join(' ')); return null; }
  hideWarning();

  const roadWidth    = toFeet(roadWidthRaw,    units);
  const rowWidth     = toFeet(rowWidthRaw,     units);
  const poleHeightA  = toFeet(poleHeightARaw,  units);
  const poleHeightB  = toFeet(poleHeightBRaw,  units);
  const cableSag     = toFeet(cableSagRaw,     units);
  const poleSetback  = toFeet(poleSetbackRaw,  units);
  const span         = roadWidth + poleSetback * 2;
  /* mid-span clearance ≈ average attachment height minus sag */
  const clearance    = (poleHeightA + poleHeightB) / 2 - cableSag;

  const warn = clearance < 18 ? `⚠ Midspan clearance is ${fmtLen(clearance, units)} — may not meet 18 ft minimum for vehicle traffic.` : null;
  els.aerialClearanceHint.textContent = warn || `✓ Midspan clearance: ${fmtLen(clearance, units)}`;
  els.aerialClearanceHint.classList.toggle('is-warning', !!warn);

  return {
    type: 'aerial', units, roadWidth, rowWidth, poleHeightA, poleHeightB, cableSag, poleSetback,
    span, clearance, condDiaRaw, crossAngDeg, totalSpan: span,
    bearing: getBearing(), roadDirSelect: els.roadDirection.value,
    pavementType: els.pavementType.value,
    projectName: els.projectName.value.trim() || 'Untitled Crossing',
    roadName:    els.roadName.value.trim() || 'Unnamed Road',
  };
}

/* ==========================================================
   GEOMETRY — CANAL / DITCH CROSSING
   ========================================================== */
function computeCanalGeometry() {
  const units = currentUnits;

  const canalWidthRaw   = parseFloat(els.canalWidth.value);
  const waterDepthRaw   = parseFloat(els.waterDepth.value);
  const poleHeightRaw   = parseFloat(els.canalPoleHeight.value);
  const cableSagRaw     = parseFloat(els.canalCableSag.value);
  const poleSetbackRaw  = parseFloat(els.canalPoleSetback.value);
  const condDiaRaw      = parseFloat(els.canalConduitDia.value) || 0;
  const crossAngDeg     = parseFloat(els.crossingAngle.value);
  const rowWidthRaw     = parseFloat(els.rowWidth.value);

  const errors = [];
  if (!(canalWidthRaw > 0))                         errors.push('Canal width must be greater than 0.');
  if (!(waterDepthRaw >= 0))                        errors.push('Water depth cannot be negative.');
  if (!(poleHeightRaw > 0))                         errors.push('Pole height must be greater than 0.');
  if (!(cableSagRaw >= 0))                          errors.push('Cable sag cannot be negative.');
  if (!(poleSetbackRaw >= 0))                       errors.push('Pole setback cannot be negative.');
  if (!(crossAngDeg >= 15 && crossAngDeg <= 165))   errors.push('Crossing angle must be 15°–165°.');

  if (errors.length) { showWarning(errors.join(' ')); return null; }
  hideWarning();

  const canalWidth  = toFeet(canalWidthRaw,  units);
  const waterDepth  = toFeet(waterDepthRaw,  units);
  const poleHeight  = toFeet(poleHeightRaw,  units);
  const cableSag    = toFeet(cableSagRaw,    units);
  const poleSetback = toFeet(poleSetbackRaw, units);
  const rowWidth    = rowWidthRaw > 0 ? toFeet(rowWidthRaw, units) : canalWidth + poleSetback * 4;

  const span                = canalWidth + 2 * poleSetback;
  const clearanceAboveBank  = poleHeight - cableSag;
  const clearanceAboveWater = poleHeight - cableSag + waterDepth;

  const warn = clearanceAboveBank < 0 ? 'Cable sag exceeds pole height — cable will dip below bank level!' : null;
  if (els.canalClearanceHint) {
    els.canalClearanceHint.textContent = warn || `✓ Clearance above water: ${fmtLen(clearanceAboveWater, units)}`;
    els.canalClearanceHint.classList.toggle('is-warning', !!warn);
  }

  return {
    type: 'canal', method: 'aerial', units, crossAngDeg,
    canalWidth, waterDepth, poleHeight, cableSag, poleSetback,
    span, clearanceAboveBank, clearanceAboveWater, condDiaRaw,
    bearing: getBearing(), roadDirSelect: els.roadDirection.value,
    pavementType: els.pavementType.value,
    projectName: els.projectName.value.trim() || 'Untitled Crossing',
    roadName:    els.roadName.value.trim() || 'Unnamed Canal',
    /* aliases used by drawPlanView */
    roadWidth: canalWidth, rowWidth, poleSetback,
    entrySetback: poleSetback, exitSetback: poleSetback, totalSpan: span,
  };
}

/* ==========================================================
   GEOMETRY — CANAL BURIED (HDD UNDER CANAL)
   ========================================================== */
function computeCanalBuriedGeometry() {
  const units = currentUnits;

  const canalWidthRaw   = parseFloat(els.canalWidth.value);
  const waterDepthRaw   = parseFloat(els.waterDepth.value);
  const entrySetbackRaw = parseFloat(els.canalEntrySetback.value);
  const exitSetbackRaw  = parseFloat(els.canalExitSetback.value);
  const boreDepthRaw    = parseFloat(els.canalBoreDepth.value);
  const entryAngleDeg   = parseFloat(els.canalEntryAngle.value);
  const exitAngleDeg    = parseFloat(els.canalExitAngle.value);
  const bitDiaRaw       = parseFloat(els.canalBitDia.value);
  const condDiaRaw      = parseFloat(els.canalBoreConduitDia.value) || 0;
  const crossAngDeg     = parseFloat(els.crossingAngle.value);
  const rowWidthRaw     = parseFloat(els.rowWidth.value);

  const errors = [];
  if (!(canalWidthRaw > 0))                         errors.push('Canal width must be greater than 0.');
  if (!(waterDepthRaw >= 0))                        errors.push('Water depth cannot be negative.');
  if (!(entrySetbackRaw >= 0))                      errors.push('Entry setback cannot be negative.');
  if (!(exitSetbackRaw >= 0))                       errors.push('Exit setback cannot be negative.');
  if (!(boreDepthRaw > 0))                          errors.push('Bore depth must be greater than 0.');
  if (!(entryAngleDeg > 0 && entryAngleDeg <= 45)) errors.push('Entry angle must be 1°–45°.');
  if (!(exitAngleDeg  > 0 && exitAngleDeg  <= 45)) errors.push('Exit angle must be 1°–45°.');
  if (!(bitDiaRaw > 0))                             errors.push('Bore diameter must be greater than 0.');
  if (!(crossAngDeg >= 15 && crossAngDeg <= 165))   errors.push('Crossing angle must be 15°–165°.');

  if (errors.length) { showWarning(errors.join(' ')); return null; }
  hideWarning();

  const canalWidth  = toFeet(canalWidthRaw,  units);
  const waterDepth  = toFeet(waterDepthRaw,  units);
  const entrySetback = toFeet(entrySetbackRaw, units);
  const exitSetback  = toFeet(exitSetbackRaw,  units);
  const boreDepth    = toFeet(boreDepthRaw,    units);
  const entryRad  = entryAngleDeg * Math.PI / 180;
  const exitRad   = exitAngleDeg  * Math.PI / 180;
  const entryRun  = boreDepth / Math.tan(entryRad);
  const exitRun   = boreDepth / Math.tan(exitRad);
  const entrySlant = boreDepth / Math.sin(entryRad);
  const exitSlant  = boreDepth / Math.sin(exitRad);

  const totalSpan  = entrySetback + canalWidth + exitSetback;
  /* ROW must at least encompass the full bore path so plan-view ROW boundary sits outside pits */
  const rowWidth   = Math.max(
    rowWidthRaw > 0 ? toFeet(rowWidthRaw, units) : canalWidth + (entrySetback + exitSetback) * 2,
    totalSpan
  );
  const flatRunRaw = totalSpan - entryRun - exitRun;
  const overlap    = flatRunRaw < -0.001;
  const flatRun    = Math.max(0, flatRunRaw);
  const boreLength = entrySlant + flatRun + exitSlant;
  const clearanceBelowBed = boreDepth - waterDepth;  /* bore below canal bed */

  const warn = clearanceBelowBed < 2
    ? clearanceBelowBed < 0
      ? '⚠ Bore is above canal bed — increase bore depth!'
      : `⚠ Low clearance below canal bed: ${fmtLen(clearanceBelowBed, units)}. Minimum 2 ft recommended.`
    : null;
  if (els.canalBoreHint) {
    els.canalBoreHint.textContent = warn || `✓ Clearance below canal bed: ${fmtLen(clearanceBelowBed, units)}`;
    els.canalBoreHint.classList.toggle('is-warning', !!warn);
  }
  if (warn && clearanceBelowBed < 0) { showWarning(warn); return null; }

  /* When the entry/exit slant extends into the canal zone, the bore depth at the
     canal edge must still exceed water depth — otherwise the bore surfaces inside the canal. */
  if (waterDepth > 0) {
    const depthAtEntry = entrySetback * Math.tan(entryRad);
    const depthAtExit  = exitSetback  * Math.tan(exitRad);
    if (entryRun > entrySetback + 0.01 && depthAtEntry < waterDepth - 0.01) {
      const minSb = Math.ceil(waterDepth / Math.tan(entryRad) * 10) / 10;
      showWarning(`Entry setback too small — bore is above the canal bed at the canal edge (only ${fmtLen(depthAtEntry, units)} deep vs ${fmtLen(waterDepth, units)} water depth). Increase entry setback to ≥ ${fmtLen(minSb, units)}, or steepen the entry angle.`);
      return null;
    }
    if (exitRun > exitSetback + 0.01 && depthAtExit < waterDepth - 0.01) {
      const minSb = Math.ceil(waterDepth / Math.tan(exitRad) * 10) / 10;
      showWarning(`Exit setback too small — bore is above the canal bed at the canal edge (only ${fmtLen(depthAtExit, units)} deep vs ${fmtLen(waterDepth, units)} water depth). Increase exit setback to ≥ ${fmtLen(minSb, units)}, or steepen the exit angle.`);
      return null;
    }
  }

  return {
    type: 'canal', method: 'buried', units, crossAngDeg,
    canalWidth, waterDepth, entrySetback, exitSetback, boreDepth,
    entryAngleDeg, exitAngleDeg, bitDiaRaw, condDiaRaw,
    entryRun, exitRun, entrySlant, exitSlant, flatRun, boreLength, overlap,
    clearanceBelowBed,
    bearing: getBearing(), roadDirSelect: els.roadDirection.value,
    pavementType: els.pavementType.value,
    projectName: els.projectName.value.trim() || 'Untitled Crossing',
    roadName:    els.roadName.value.trim() || 'Unnamed Canal',
    /* plan-view aliases */
    roadWidth: canalWidth, rowWidth,
    poleSetback: 0, totalSpan,
  };
}

/* ==========================================================
   SHARED SVG HELPERS
   ========================================================== */
function arcPath(cx, cy, v1, v2, r) {
  const p1   = { x: cx + v1.x * r, y: cy + v1.y * r };
  const p2   = { x: cx + v2.x * r, y: cy + v2.y * r };
  const cross = v1.x * v2.y - v1.y * v2.x;
  return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A ${r} ${r} 0 0 ${cross > 0 ? 1 : 0} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
}
function bisector(v1, v2) {
  const bx = v1.x + v2.x, by = v1.y + v2.y;
  const len = Math.hypot(bx, by) || 1;
  return { x: bx / len, y: by / len };
}
function hDim(x1, x2, y, label) {
  return `
    <line x1="${x1.toFixed(1)}" y1="${(y-9).toFixed(1)}" x2="${x1.toFixed(1)}" y2="${(y+4).toFixed(1)}" class="ext-line"/>
    <line x1="${x2.toFixed(1)}" y1="${(y-9).toFixed(1)}" x2="${x2.toFixed(1)}" y2="${(y+4).toFixed(1)}" class="ext-line"/>
    <line x1="${x1.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y.toFixed(1)}" class="dim-line" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
    <text x="${((x1+x2)/2).toFixed(1)}" y="${(y-6).toFixed(1)}" text-anchor="middle" class="dim-label">${esc(label)}</text>`;
}
function vDim(x, y1, y2, label, side = 1) {
  return `
    <line x1="${(x-8).toFixed(1)}" y1="${y1.toFixed(1)}" x2="${(x+8).toFixed(1)}" y2="${y1.toFixed(1)}" class="ext-line"/>
    <line x1="${(x-8).toFixed(1)}" y1="${y2.toFixed(1)}" x2="${(x+8).toFixed(1)}" y2="${y2.toFixed(1)}" class="ext-line"/>
    <line x1="${x.toFixed(1)}" y1="${(y1+3).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y2-3).toFixed(1)}" class="dim-line" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
    <text x="${(x+side*10).toFixed(1)}" y="${((y1+y2)/2).toFixed(1)}" text-anchor="${side > 0 ? 'start' : 'end'}" dominant-baseline="middle" class="dim-label">${esc(label)}</text>`;
}
function vDimV(x, y1, y2, label, side = 1) {
  const midY = (y1 + y2) / 2;
  const lx   = (x + side * 20).toFixed(1);
  const ly   = midY.toFixed(1);
  return `
    <line x1="${(x-8).toFixed(1)}" y1="${y1.toFixed(1)}" x2="${(x+8).toFixed(1)}" y2="${y1.toFixed(1)}" class="ext-line"/>
    <line x1="${(x-8).toFixed(1)}" y1="${y2.toFixed(1)}" x2="${(x+8).toFixed(1)}" y2="${y2.toFixed(1)}" class="ext-line"/>
    <line x1="${x.toFixed(1)}" y1="${(y1+3).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y2-3).toFixed(1)}" class="dim-line" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
    <text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#000" font-family="'IBM Plex Sans Condensed',sans-serif" transform="rotate(-90,${lx},${ly})">${esc(label)}</text>`;
}
function dimAlong(p1, p2, off, label, white = false, labelAngle = null, fontSize = null) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const o1  = { x: p1.x + nx * off, y: p1.y + ny * off };
  const o2  = { x: p2.x + nx * off, y: p2.y + ny * off };
  const mid = { x: (o1.x + o2.x) / 2, y: (o1.y + o2.y) / 2 };
  let ang = Math.atan2(dy, dx) * 180 / Math.PI;
  if (ang > 90 || ang < -90) ang += 180;
  const textAng = labelAngle !== null ? labelAngle : ang;
  const lblCls = white ? 'dim-label-w' : 'dim-label';
  const lineSt = white ? 'stroke:#fff;stroke-width:1.2;' : '';
  const fsSt   = fontSize ? ` font-size="${fontSize}"` : '';
  return `
    <line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${o1.x.toFixed(1)}" y2="${o1.y.toFixed(1)}" class="ext-line" style="${lineSt}"/>
    <line x1="${p2.x.toFixed(1)}" y1="${p2.y.toFixed(1)}" x2="${o2.x.toFixed(1)}" y2="${o2.y.toFixed(1)}" class="ext-line" style="${lineSt}"/>
    <line x1="${o1.x.toFixed(1)}" y1="${o1.y.toFixed(1)}" x2="${o2.x.toFixed(1)}" y2="${o2.y.toFixed(1)}" class="dim-line" style="${lineSt}" marker-start="url(#${white?'arrowW':'arrow'})" marker-end="url(#${white?'arrowW':'arrow'})"/>
    <text x="${mid.x.toFixed(1)}" y="${mid.y.toFixed(1)}" dy="-4" text-anchor="middle" class="${lblCls}"${fsSt} transform="rotate(${textAng.toFixed(1)} ${mid.x.toFixed(1)} ${mid.y.toFixed(1)})">${esc(label)}</text>`;
}

function pavementFillId(type) {
  return type === 'concrete' ? 'paveConcrete' : type === 'gravel' ? 'paveGravel' : type === 'brick' ? 'paveBrick' : type === 'dirt' ? 'paveDirt' : 'paveAsphalt';
}
function pavementLabel(type) {
  return { asphalt: 'ASPHALT PAVEMENT', concrete: 'CONCRETE PAVEMENT', gravel: 'GRAVEL SURFACE', brick: 'BRICK / PAVER', dirt: 'DIRT / UNPAVED' }[type] || 'PAVEMENT';
}
function paveLabelFill(type) {
  return type === 'concrete' || type === 'gravel' || type === 'dirt' ? '#1B3A5C' : '#fff';
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function sharedDefs() {
  return `
    <defs>
      <!-- soil hatch -->
      <pattern id="soilHatch" width="9" height="9" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <rect width="9" height="9" fill="#F2EEE2"/>
        <line x1="0" y1="0" x2="0" y2="9" stroke="#C9B79C" stroke-width="1.3"/>
      </pattern>
      <!-- pavement fills -->
      <pattern id="paveAsphalt" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="#1A1D23"/>
        <line x1="0" y1="0" x2="0" y2="6" stroke="#0E1014" stroke-width="1.8"/>
      </pattern>
      <pattern id="paveConcrete" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#9EB4C4"/>
        <line x1="0" y1="0" x2="8" y2="0" stroke="#7898A8" stroke-width="0.8"/>
        <line x1="0" y1="0" x2="0" y2="8" stroke="#7898A8" stroke-width="0.8"/>
      </pattern>
      <pattern id="paveGravel" width="5" height="5" patternUnits="userSpaceOnUse">
        <rect width="5" height="5" fill="#A08060"/>
        <circle cx="1.5" cy="1.5" r="1" fill="#806040"/>
        <circle cx="3.5" cy="3.5" r="1" fill="#907050"/>
      </pattern>
      <pattern id="paveBrick" width="10" height="6" patternUnits="userSpaceOnUse">
        <rect width="10" height="6" fill="#C06040"/>
        <rect x="0" y="0" width="9" height="2.5" fill="none" stroke="#903020" stroke-width="0.5"/>
        <rect x="5" y="3" width="4" height="2.5" fill="none" stroke="#903020" stroke-width="0.5"/>
        <rect x="0" y="3" width="4" height="2.5" fill="none" stroke="#903020" stroke-width="0.5"/>
      </pattern>
      <pattern id="paveDirt" width="8" height="8" patternTransform="rotate(30)" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#B09070"/>
        <line x1="0" y1="4" x2="8" y2="4" stroke="#907050" stroke-width="0.7" stroke-dasharray="2 3"/>
      </pattern>
      <!-- grass/ground -->
      <pattern id="grassFill" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="#D4EBBF"/>
        <line x1="1" y1="6" x2="1" y2="3" stroke="#7BBF50" stroke-width="0.8"/>
        <line x1="3" y1="6" x2="3" y2="4" stroke="#7BBF50" stroke-width="0.8"/>
        <line x1="5" y1="6" x2="5" y2="2" stroke="#7BBF50" stroke-width="0.8"/>
      </pattern>
      <!-- sky -->
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#C8E8F8"/>
        <stop offset="100%" stop-color="#E8F4FC"/>
      </linearGradient>
      <!-- base course -->
      <pattern id="baseCourse" width="7" height="7" patternUnits="userSpaceOnUse">
        <rect width="7" height="7" fill="#7A6B58"/>
        <line x1="0" y1="0" x2="7" y2="0" stroke="#5A4B38" stroke-width="0.7"/>
        <line x1="0" y1="0" x2="0" y2="7" stroke="#5A4B38" stroke-width="0.7"/>
        <circle cx="3.5" cy="3.5" r="1" fill="#5A4B38" opacity=".4"/>
      </pattern>
      <!-- subbase aggregate -->
      <pattern id="subbase" width="9" height="9" patternUnits="userSpaceOnUse">
        <rect width="9" height="9" fill="#C4A07A"/>
        <circle cx="2" cy="2" r="1.2" fill="#A07848" opacity=".7"/>
        <circle cx="7" cy="5" r="1" fill="#A07848" opacity=".6"/>
        <circle cx="4" cy="7" r="0.8" fill="#A07848" opacity=".5"/>
      </pattern>
      <!-- arrow markers -->
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 Z" fill="#1B3A5C"/>
      </marker>
      <marker id="arrowW" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 Z" fill="#fff"/>
      </marker>
    </defs>`;
}

function sharedSvgStyle() {
  return `
    <style>
      .ext-line   { stroke: #1B3A5C; stroke-width: 1.2; }
      .dim-line   { stroke: #1B3A5C; stroke-width: 1.4; }
      .dim-label  { font-family: 'IBM Plex Mono', monospace; font-size: 15px; fill: #000; }
      .dim-label-w{ font-family: 'IBM Plex Mono', monospace; font-size: 15px; fill: #fff; }
      .pit-label  { font-family: 'IBM Plex Sans Condensed', sans-serif; font-size: 13px; font-weight: 700; fill: #1B3A5C; letter-spacing: .04em; }
      .angle-label{ font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 600; fill: #1B3A5C; }
      .leader-lbl { font-family: 'IBM Plex Mono', monospace; font-size: 13px; fill: #1B3A5C; }
      .tb-title   { font-family: 'IBM Plex Sans Condensed', sans-serif; font-size: 14px; font-weight: 700; fill: #1B3A5C; letter-spacing: .04em; }
      .tb-key     { font-family: 'IBM Plex Sans', sans-serif; font-size: 11px; fill: #5B7898; text-transform: uppercase; letter-spacing: .04em; }
      .tb-val     { font-family: 'IBM Plex Mono', monospace; font-size: 13px; fill: #1B3A5C; }
      .callout    { font-family: 'IBM Plex Sans Condensed', sans-serif; font-size: 15px; font-weight: 700; fill: #fff; }
      .plan-note  { font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; fill: #1B3A5C; }
      .road-end   { font-family: 'IBM Plex Sans Condensed', sans-serif; font-size: 22px; font-weight: 700; fill: #1B3A5C; }
      .pave-label { font-family: 'IBM Plex Sans Condensed', sans-serif; font-size: 13px; font-weight: 700; fill: #fff; letter-spacing: .06em; }
      .pole-label { font-family: 'IBM Plex Sans Condensed', sans-serif; font-size: 13px; font-weight: 700; fill: #1B3A5C; letter-spacing: .04em; }
      .layer-lbl  { font-family: 'IBM Plex Sans Condensed', sans-serif; font-size: 12px; font-weight: 600; fill: #1B3A5C; }
    </style>`;
}

/* title block reused by both profile views */
function titleBlock(geom, x, y, w, h) {
  const dateStr = todayStr();
  const typeLabel = geom.type === 'aerial' ? 'AERIAL POLE CROSSING'
    : geom.type === 'canal' && geom.method === 'buried' ? 'CANAL / DITCH — BURIED HDD BORE'
    : geom.type === 'canal' ? 'CANAL / DITCH — AERIAL CROSSING'
    : 'BURIED BORE CROSSING';
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#1B3A5C" stroke-width="1.5"/>
    <rect x="${x+3}" y="${y+3}" width="${w-6}" height="${h-6}" fill="none" stroke="#1B3A5C" stroke-width="0.5"/>
    <rect x="${x}" y="${y}" width="${w}" height="22" fill="#1B3A5C"/>
    <text x="${x+w/2}" y="${y+15}" text-anchor="middle" class="tb-title" fill="#fff">FIBER CABLE ROAD CROSSING — ${typeLabel}</text>
    <line x1="${x+4}" y1="${y+32}" x2="${x+w-4}" y2="${y+32}" stroke="#1B3A5C" stroke-width="0.5"/>
    <text x="${x+8}" y="${y+28}" class="tb-key">Project</text>
    <text x="${x+8}" y="${y+40}" class="tb-val">${esc(geom.projectName)}</text>
    <line x1="${x+4}" y1="${y+47}" x2="${x+w-4}" y2="${y+47}" stroke="#1B3A5C" stroke-width="0.5"/>
    <text x="${x+8}" y="${y+57}" class="tb-key">Road / Location</text>
    <text x="${x+8}" y="${y+69}" class="tb-val">${esc(geom.roadName)}</text>
    <line x1="${x+4}" y1="${y+76}" x2="${x+w-4}" y2="${y+76}" stroke="#1B3A5C" stroke-width="0.5"/>
    <text x="${x+8}"   y="${y+86}" class="tb-key">Date</text>
    <text x="${x+8}"   y="${y+98}" class="tb-val">${dateStr}</text>`;
}

/* populate the editable HTML title block below the drawings */
function updateTitleBlock(geom) {
  const typeLabel = geom.type === 'aerial' ? 'AERIAL POLE CROSSING'
    : geom.type === 'canal' && geom.method === 'buried' ? 'CANAL / DITCH — BURIED HDD BORE'
    : geom.type === 'canal' ? 'CANAL / DITCH — AERIAL CROSSING'
    : 'BURIED BORE CROSSING';
  document.getElementById('tbTypeDisplay').textContent = `FIBER CABLE CROSSING — ${typeLabel}`;
  document.getElementById('tbProject').textContent    = geom.projectName;
  document.getElementById('tbRoad').textContent       = geom.roadName;
  document.getElementById('tbDate').textContent       = todayStr();
  document.getElementById('tbType').textContent = geom.type === 'aerial' ? 'Aerial Poles'
    : geom.type === 'canal' && geom.method === 'buried' ? 'Canal Buried HDD'
    : geom.type === 'canal' ? 'Canal Aerial'
    : 'Buried Bore';
}

/* compass rose — drawing is always north-up, so the arrow never rotates */
function northArrow(cx, cy) {
  return `
    <g>
      <line x1="${cx}" y1="${cy+42}" x2="${cx}" y2="${cy-42}" stroke="#1B3A5C" stroke-width="3.5"/>
      <path d="M${cx-26} ${cy-16} L${cx} ${cy-58} L${cx+26} ${cy-16} Z" fill="#1B3A5C"/>
      <path d="M${cx-26} ${cy-16} L${cx} ${cy-58} L${cx+26} ${cy-16} Z" fill="#050505" clip-path="inset(0 50% 0 0)"/>
      <circle cx="${cx}" cy="${cy}" r="6" fill="#1B3A5C"/>
    </g>
    <text x="${cx}" y="${cy+62}" text-anchor="middle" font-size="20" font-weight="800" fill="#1B3A5C" font-family="'IBM Plex Sans Condensed',sans-serif">N</text>`;
}

/* ==========================================================
   PLAN VIEW  (shared by buried + aerial)
   ========================================================== */
const PLAN_DW = 720;
function drawPlanView(geom) {
  const scX  = PLAN_DW / geom.totalSpan;
  const MAR  = { left: 140, right: 60, top: 50, bottom: 60 };

  /* keep the plan view landscape (wide, short) so it prints compactly */
  const roadLenFt = Math.max(geom.totalSpan * 1.1, geom.rowWidth * 2.2, 50);
  const drawW = roadLenFt * scX;
  const drawH = geom.totalSpan * scX;
  const VBW = MAR.left + MAR.right + drawW;
  const VBH = MAR.top  + MAR.bottom + drawH;

  const cH = MAR.left + drawW / 2;
  const cV = MAR.top  + drawH / 2;

  /* Road axis from bearing (north = –y in SVG, east = +x).
     Crossing angle rotates the cable relative to that road axis. */
  const bearingRad = geom.bearing * Math.PI / 180;
  const perpDir    = { x: Math.sin(bearingRad), y: -Math.cos(bearingRad) };
  const roadNormal = { x: -perpDir.y, y: perpDir.x };
  const skewRad    = (90 - (geom.crossAngDeg ?? 90)) * Math.PI / 180;
  const cableDir   = {
    x: Math.cos(skewRad) * roadNormal.x + Math.sin(skewRad) * perpDir.x,
    y: Math.cos(skewRad) * roadNormal.y + Math.sin(skewRad) * perpDir.y,
  };
  const perpAngle  = Math.atan2(perpDir.y, perpDir.x) * 180 / Math.PI;

  /* cap the road/ROW band thickness so it never swallows the whole crossing
     span on the page — purely cosmetic since the drawing is NOT TO SCALE.
     clampF is saved so setback/poleSetback depths scale the same way. */
  let roadHW = (geom.roadWidth / 2) * scX;
  let rowHW  = (geom.rowWidth  / 2) * scX;
  const maxRowHW = drawH * 0.45;
  let clampF = 1;
  if (rowHW > maxRowHW) {
    clampF  = maxRowHW / rowHW;
    rowHW  *= clampF;
    roadHW *= clampF;
  }

  /* Road/ROW edge reference points — always perpendicular to road direction.
     These drive the road polygon shape and ROW/Road Width dimension lines. */
  const nearEdge = { x: cH - roadNormal.x * roadHW, y: cV - roadNormal.y * roadHW };
  const farEdge  = { x: cH + roadNormal.x * roadHW, y: cV + roadNormal.y * roadHW };
  const rowNear  = { x: cH - roadNormal.x * rowHW,  y: cV - roadNormal.y * rowHW };
  const rowFar   = { x: cH + roadNormal.x * rowHW,  y: cV + roadNormal.y * rowHW };

  /* Bore intersection with road/ROW edges — where the cable actually crosses
     each edge line. cableDir · roadNormal = cos(skewRad). Clamped away from 0
     so a nearly-parallel bore doesn't produce infinite offsets. */
  const dotCD_RN    = Math.max(Math.cos(skewRad), 0.1);
  const boreRoadNear = { x: cH - cableDir.x * roadHW / dotCD_RN, y: cV - cableDir.y * roadHW / dotCD_RN };
  const boreRoadFar  = { x: cH + cableDir.x * roadHW / dotCD_RN, y: cV + cableDir.y * roadHW / dotCD_RN };
  const boreRowNear  = { x: cH - cableDir.x * rowHW  / dotCD_RN, y: cV - cableDir.y * rowHW  / dotCD_RN };
  const boreRowFar   = { x: cH + cableDir.x * rowHW  / dotCD_RN, y: cV + cableDir.y * rowHW  / dotCD_RN };

  /* Visual setback depth uses the same clampF so the green band stays
     proportional to the road band (not inflated when road is clamped). */
  const entrySetbackPx = geom.entrySetback * scX * clampF;
  const exitSetbackPx  = geom.exitSetback  * scX * clampF;

  /* Pits are set back from the bore-road-edge intersection along the bore direction.
     Using boreRoadNear (not boreRowNear) keeps the setback zone flush with the road polygon. */
  const entryPitPlan = {
    x: boreRoadNear.x - cableDir.x * entrySetbackPx,
    y: boreRoadNear.y - cableDir.y * entrySetbackPx,
  };
  const exitPitPlan = {
    x: boreRoadFar.x + cableDir.x * exitSetbackPx,
    y: boreRoadFar.y + cableDir.y * exitSetbackPx,
  };

  const dirLabels = DIR_LABELS[geom.roadDirSelect];
  const rightLbl  = dirLabels ? dirLabels.pos : `${geom.bearing.toFixed(0)}°`;
  const leftLbl   = dirLabels ? dirLabels.neg : `${((geom.bearing+180)%360).toFixed(0)}°`;

  const compassCx = VBW - 60, compassCy = 80;

  const isAerial     = geom.type === 'aerial';
  const isCanal      = geom.type === 'canal';
  const isAerialType = isAerial || (isCanal && geom.method === 'aerial');

  /* Aerial / Canal-aerial poles sit outside the canal/road edge along the bore path.
     poleSetback also uses clampF so poles stay proportional to the visual band. */
  const poleSetbackPx = geom.poleSetback * scX * clampF;
  const poleL = isAerialType
    ? { x: boreRoadNear.x - cableDir.x * poleSetbackPx, y: boreRoadNear.y - cableDir.y * poleSetbackPx }
    : entryPitPlan;
  const poleR = isAerialType
    ? { x: boreRoadFar.x  + cableDir.x * poleSetbackPx, y: boreRoadFar.y  + cableDir.y * poleSetbackPx }
    : exitPitPlan;

  /* Setback dims — projected onto roadNormal so the dim LINE is always perpendicular
     to the road regardless of crossing angle. The label shows the actual setback value. */
  const dimNearPit  = { x: cH - roadNormal.x * (roadHW + entrySetbackPx), y: cV - roadNormal.y * (roadHW + entrySetbackPx) };
  const dimFarPit   = { x: cH + roadNormal.x * (roadHW + exitSetbackPx),  y: cV + roadNormal.y * (roadHW + exitSetbackPx)  };
  const dimNearPole = { x: cH - roadNormal.x * (roadHW + poleSetbackPx),  y: cV - roadNormal.y * (roadHW + poleSetbackPx)  };
  const dimFarPole  = { x: cH + roadNormal.x * (roadHW + poleSetbackPx),  y: cV + roadNormal.y * (roadHW + poleSetbackPx)  };

  const pitLbl1 = isAerialType
    ? dimAlong(dimNearPole, nearEdge, 400, `Pole Setback: ${fmtLen(geom.poleSetback,   geom.units)}`, false, 0, 20)
    : dimAlong(dimNearPit,  nearEdge, 400, `Entry Setback: ${fmtLen(geom.entrySetback, geom.units)}`, false, 0, 20);
  const pitLbl2 = isAerialType
    ? dimAlong(farEdge, dimFarPole, 400, `Pole Setback: ${fmtLen(geom.poleSetback,  geom.units)}`, false, 0, 20)
    : dimAlong(farEdge, dimFarPit,  400, `Exit Setback: ${fmtLen(geom.exitSetback,  geom.units)}`, false, 0, 20);

  /* cable / bore representation */
  const cableStroke = isAerialType
    ? `<line x1="${poleL.x.toFixed(1)}" y1="${poleL.y.toFixed(1)}" x2="${poleR.x.toFixed(1)}" y2="${poleR.y.toFixed(1)}" stroke="#CC00AA" stroke-width="4" stroke-linecap="round"/>`
    : `<line x1="${entryPitPlan.x.toFixed(1)}" y1="${entryPitPlan.y.toFixed(1)}" x2="${exitPitPlan.x.toFixed(1)}" y2="${exitPitPlan.y.toFixed(1)}" stroke="#CC00AA" stroke-width="6" stroke-linecap="round"/>
       <line x1="${entryPitPlan.x.toFixed(1)}" y1="${entryPitPlan.y.toFixed(1)}" x2="${exitPitPlan.x.toFixed(1)}" y2="${exitPitPlan.y.toFixed(1)}" stroke="#1B3A5C" stroke-width="1.2" stroke-dasharray="1 6"/>`;

  /* pit label positions — offset along cable direction so they sit
     outside the setback zone (N/S for E–W road, E/W for N–S road) */
  const pitLblOff = 36;
  const entryLblX = (entryPitPlan.x - cableDir.x * pitLblOff).toFixed(1);
  const entryLblY = (entryPitPlan.y - cableDir.y * pitLblOff).toFixed(1);
  const exitLblX  = (exitPitPlan.x  + cableDir.x * pitLblOff).toFixed(1);
  const exitLblY  = (exitPitPlan.y  + cableDir.y * pitLblOff).toFixed(1);

  /* endpoint markers */
  const poleMark = `
    <circle cx="${poleL.x.toFixed(1)}" cy="${poleL.y.toFixed(1)}" r="7" fill="#5D4037" stroke="#1B3A5C" stroke-width="1.2"/>
    <circle cx="${poleL.x.toFixed(1)}" cy="${poleL.y.toFixed(1)}" r="2.5" fill="#fff"/>
    <text x="${poleL.x.toFixed(1)}" y="${(poleL.y+20).toFixed(1)}" text-anchor="middle" class="pole-label">POLE A</text>
    <circle cx="${poleR.x.toFixed(1)}" cy="${poleR.y.toFixed(1)}" r="7" fill="#5D4037" stroke="#1B3A5C" stroke-width="1.2"/>
    <circle cx="${poleR.x.toFixed(1)}" cy="${poleR.y.toFixed(1)}" r="2.5" fill="#fff"/>
    <text x="${poleR.x.toFixed(1)}" y="${(poleR.y-14).toFixed(1)}" text-anchor="middle" class="pole-label">POLE B</text>`;
  const endMarkers = isAerialType ? poleMark : `
    <rect x="${(entryPitPlan.x-14).toFixed(1)}" y="${(entryPitPlan.y-8).toFixed(1)}" width="28" height="16" fill="#fff" stroke="#1B3A5C" stroke-width="1.5" rx="2"/>
    <text x="${entryLblX}" y="${entryLblY}" text-anchor="middle" dominant-baseline="middle" class="pit-label">ENTRY PIT</text>
    <rect x="${(exitPitPlan.x-14).toFixed(1)}" y="${(exitPitPlan.y-8).toFixed(1)}" width="28" height="16" fill="#fff" stroke="#1B3A5C" stroke-width="1.5" rx="2"/>
    <text x="${exitLblX}" y="${exitLblY}" text-anchor="middle" dominant-baseline="middle" class="pit-label">EXIT PIT</text>`;

  const crossAngDisplay = geom.crossAngDeg ?? 90;

  /* angle of road direction (perpDir) in degrees — for rotating road-aligned text */
  /* find where a ray from (ox,oy) in direction (dx,dy) first hits the viewport edge */
  function rayEdgePt(ox, oy, dx, dy) {
    const ts = [];
    if (Math.abs(dx) > 1e-9) ts.push(dx > 0 ? (VBW - ox) / dx : -ox / dx);
    if (Math.abs(dy) > 1e-9) ts.push(dy > 0 ? (VBH - oy) / dy : -oy / dy);
    const t = Math.min(...ts.filter(t => t > 1)) * 0.90;
    return { x: (ox + t * dx).toFixed(1), y: (oy + t * dy).toFixed(1) };
  }
  const roadEnd1 = rayEdgePt(cH, cV,  perpDir.x,  perpDir.y);
  const roadEnd2 = rayEdgePt(cH, cV, -perpDir.x, -perpDir.y);

  const svg = `
    ${sharedSvgStyle()}
    ${sharedDefs()}
    <!-- setback/bank zones -->
    ${isAerialType ? `
    <polygon points="${(boreRoadNear.x-perpDir.x*900).toFixed(1)},${(boreRoadNear.y-perpDir.y*900).toFixed(1)} ${(boreRoadNear.x+perpDir.x*900).toFixed(1)},${(boreRoadNear.y+perpDir.y*900).toFixed(1)} ${(poleL.x+perpDir.x*900).toFixed(1)},${(poleL.y+perpDir.y*900).toFixed(1)} ${(poleL.x-perpDir.x*900).toFixed(1)},${(poleL.y-perpDir.y*900).toFixed(1)}" fill="#5CB85C" fill-opacity="0.40"/>
    <polygon points="${(boreRoadFar.x-perpDir.x*900).toFixed(1)},${(boreRoadFar.y-perpDir.y*900).toFixed(1)} ${(boreRoadFar.x+perpDir.x*900).toFixed(1)},${(boreRoadFar.y+perpDir.y*900).toFixed(1)} ${(poleR.x+perpDir.x*900).toFixed(1)},${(poleR.y+perpDir.y*900).toFixed(1)} ${(poleR.x-perpDir.x*900).toFixed(1)},${(poleR.y-perpDir.y*900).toFixed(1)}" fill="#5CB85C" fill-opacity="0.40"/>` : `
    <polygon points="${(entryPitPlan.x-perpDir.x*900).toFixed(1)},${(entryPitPlan.y-perpDir.y*900).toFixed(1)} ${(entryPitPlan.x+perpDir.x*900).toFixed(1)},${(entryPitPlan.y+perpDir.y*900).toFixed(1)} ${(boreRoadNear.x+perpDir.x*900).toFixed(1)},${(boreRoadNear.y+perpDir.y*900).toFixed(1)} ${(boreRoadNear.x-perpDir.x*900).toFixed(1)},${(boreRoadNear.y-perpDir.y*900).toFixed(1)}" fill="#5CB85C" fill-opacity="0.40"/>
    <polygon points="${(boreRoadFar.x-perpDir.x*900).toFixed(1)},${(boreRoadFar.y-perpDir.y*900).toFixed(1)} ${(boreRoadFar.x+perpDir.x*900).toFixed(1)},${(boreRoadFar.y+perpDir.y*900).toFixed(1)} ${(exitPitPlan.x+perpDir.x*900).toFixed(1)},${(exitPitPlan.y+perpDir.y*900).toFixed(1)} ${(exitPitPlan.x-perpDir.x*900).toFixed(1)},${(exitPitPlan.y-perpDir.y*900).toFixed(1)}" fill="#5CB85C" fill-opacity="0.40"/>`}
    <!-- canal water / pavement (rotated with crossing angle) -->
    <polygon points="${(nearEdge.x-perpDir.x*900).toFixed(1)},${(nearEdge.y-perpDir.y*900).toFixed(1)} ${(nearEdge.x+perpDir.x*900).toFixed(1)},${(nearEdge.y+perpDir.y*900).toFixed(1)} ${(farEdge.x+perpDir.x*900).toFixed(1)},${(farEdge.y+perpDir.y*900).toFixed(1)} ${(farEdge.x-perpDir.x*900).toFixed(1)},${(farEdge.y-perpDir.y*900).toFixed(1)}" fill="${isCanal ? '#4AABDC' : `url(#${pavementFillId(geom.pavementType)})`}" fill-opacity="${isCanal ? '0.75' : '1'}" stroke="${isCanal ? '#1A6E9F' : '#1B3A5C'}" stroke-width="1.4"/>
    ${isCanal ? `
    <!-- water wave lines inside canal -->
    <line x1="${(nearEdge.x-perpDir.x*800).toFixed(1)}" y1="${(nearEdge.y-perpDir.y*800).toFixed(1)}" x2="${(nearEdge.x+perpDir.x*800).toFixed(1)}" y2="${(nearEdge.y+perpDir.y*800).toFixed(1)}" stroke="#1A6E9F" stroke-width="1.2" stroke-dasharray="12 8" opacity="0.5"/>
    <line x1="${(farEdge.x-perpDir.x*800).toFixed(1)}" y1="${(farEdge.y-perpDir.y*800).toFixed(1)}" x2="${(farEdge.x+perpDir.x*800).toFixed(1)}" y2="${(farEdge.y+perpDir.y*800).toFixed(1)}" stroke="#1A6E9F" stroke-width="1.2" stroke-dasharray="12 8" opacity="0.5"/>` : `
    <!-- road center line -->
    <line x1="${(cH-perpDir.x*900).toFixed(1)}" y1="${(cV-perpDir.y*900).toFixed(1)}" x2="${(cH+perpDir.x*900).toFixed(1)}" y2="${(cV+perpDir.y*900).toFixed(1)}" stroke="#fff" stroke-width="1.6" stroke-dasharray="14 10"/>`}
    <!-- ROW / easement boundary lines -->
    <line x1="${(rowNear.x-perpDir.x*900).toFixed(1)}" y1="${(rowNear.y-perpDir.y*900).toFixed(1)}" x2="${(rowNear.x+perpDir.x*900).toFixed(1)}" y2="${(rowNear.y+perpDir.y*900).toFixed(1)}" stroke="#1B3A5C" stroke-width="1" stroke-dasharray="3 4"/>
    <line x1="${(rowFar.x-perpDir.x*900).toFixed(1)}" y1="${(rowFar.y-perpDir.y*900).toFixed(1)}" x2="${(rowFar.x+perpDir.x*900).toFixed(1)}" y2="${(rowFar.y+perpDir.y*900).toFixed(1)}" stroke="#1B3A5C" stroke-width="1" stroke-dasharray="3 4"/>
    <!-- road/canal name -->
    <text x="${(cH - perpDir.x * drawW * 0.32).toFixed(1)}" y="${(cV - perpDir.y * drawW * 0.32 + 6).toFixed(1)}" text-anchor="middle" class="callout" transform="rotate(${perpAngle.toFixed(1)},${(cH - perpDir.x * drawW * 0.32).toFixed(1)},${(cV - perpDir.y * drawW * 0.32).toFixed(1)})">${esc(geom.roadName.toUpperCase())}</text>
    <text x="${roadEnd1.x}" y="${roadEnd1.y}" text-anchor="middle" class="road-end">${esc(rightLbl)}</text>
    <text x="${roadEnd2.x}" y="${roadEnd2.y}" text-anchor="middle" class="road-end">${esc(leftLbl)}</text>
    <!-- cable / bore -->
    ${cableStroke}
    ${endMarkers}
    <!-- dimensions -->
    ${pitLbl1}
    ${pitLbl2}
    ${dimAlong(rowNear, rowFar, 95, `${isCanal ? 'Easement' : 'ROW Width'}: ${fmtLen(geom.rowWidth, geom.units)}`, true)}
    ${dimAlong(nearEdge, farEdge, 40, `${isCanal ? 'Canal Width' : 'Road Width'}: ${fmtLen(geom.roadWidth, geom.units)}`, true)}
    <text x="${MAR.left}" y="${(VBH-18).toFixed(1)}" font-family="'IBM Plex Sans',sans-serif" font-size="20" fill="#1B3A5C">${isCanal ? `Canal / Ditch Crossing` : `Pavement: ${pavementLabel(geom.pavementType)}`} · Crossing Angle: ${crossAngDisplay}°${crossAngDisplay===90?' (perpendicular)':' (skewed)'} · NOT TO SCALE</text>
    <!-- north -->
    ${northArrow(compassCx, compassCy)}`;

  els.planSvg.setAttribute('viewBox', `0 0 ${VBW.toFixed(0)} ${VBH.toFixed(0)}`);
  els.planSvg.innerHTML = svg;
  animate(els.planSvg);
}

/* ==========================================================
   BURIED BORE — PROFILE VIEW
   ========================================================== */
const PVB_W = 860, PVB_H = 355;
const PM    = { left: 90, right: 40, top: 75 };
const PDW   = PVB_W - PM.left - PM.right;
const DEPTH_PX = 125;
const GY    = PM.top;
const FY    = GY + DEPTH_PX;

function drawBuriedProfileView(geom) {
  const { units } = geom;
  const scX = PDW / geom.totalSpan;
  const scY = DEPTH_PX / geom.boreDepth;
  const exag = (scY / scX).toFixed(1);

  const px = x => PM.left + x * scX;

  const P0 = { x: px(0),                                     y: GY };
  const P1 = { x: px(geom.entryRun),                         y: FY };
  const P2 = { x: px(geom.entryRun + geom.flatRun),          y: FY };
  const P3 = { x: px(geom.entryRun + geom.flatRun + geom.exitRun), y: GY };

  const roadX1 = px(geom.entrySetback);
  const roadX2 = px(geom.entrySetback + geom.roadWidth);
  const surfH = 8, baseH = 12, subH = 16;
  const totalRoadH = surfH + baseH + subH;
  const roadTopY   = GY - totalRoadH;
  const surfBotY   = roadTopY + surfH;
  const baseBotY   = surfBotY + baseH;
  const shoulderW  = 50;

  const eRad = geom.entryAngleDeg * Math.PI / 180;
  const xRad = geom.exitAngleDeg  * Math.PI / 180;
  const aR   = 30;
  const entryArc = arcPath(P0.x, P0.y, {x:1,y:0}, {x:Math.cos(eRad),y:Math.sin(eRad)}, aR);
  const entryBis = bisector({x:1,y:0}, {x:Math.cos(eRad),y:Math.sin(eRad)});
  const exitArc  = arcPath(P3.x, P3.y, {x:-1,y:0}, {x:-Math.cos(xRad),y:Math.sin(xRad)}, aR);
  const exitBis  = bisector({x:-1,y:0}, {x:-Math.cos(xRad),y:Math.sin(xRad)});

  const midX = (P1.x + P2.x) / 2;
  const row1Y = FY + 56, row2Y = FY + 90, row3Y = FY + 120;
  const depX = 44;

  const svg = `
    ${sharedSvgStyle()}
    ${sharedDefs()}

    <!-- soil fill — stops 40px below the deepest bore point -->
    <rect x="${PM.left}" y="${GY}" width="${PDW}" height="${DEPTH_PX + 40}" fill="url(#soilHatch)"/>

    <!-- grass (outside shoulder toes) -->
    <rect x="${PM.left}" y="${(GY-8).toFixed(1)}" width="${(Math.max(0,roadX1-shoulderW-PM.left)).toFixed(1)}" height="8" fill="url(#grassFill)"/>
    <rect x="${(roadX2+shoulderW).toFixed(1)}" y="${(GY-8).toFixed(1)}" width="${(Math.max(0,PVB_W-PM.right-roadX2-shoulderW)).toFixed(1)}" height="8" fill="url(#grassFill)"/>

    <!-- existing grade lines (either side of road) -->
    <line x1="${PM.left}" y1="${GY}" x2="${(Math.max(PM.left,roadX1-shoulderW)).toFixed(1)}" y2="${GY}" stroke="#1B3A5C" stroke-width="2"/>
    <line x1="${(Math.min(PVB_W-PM.right,roadX2+shoulderW)).toFixed(1)}" y1="${GY}" x2="${(PVB_W-PM.right).toFixed(1)}" y2="${GY}" stroke="#1B3A5C" stroke-width="2"/>

    <!-- setback zones (green fill beside road) -->
    <rect x="${P0.x.toFixed(1)}" y="${roadTopY}" width="${(Math.max(0,roadX1-P0.x)).toFixed(1)}" height="${(GY-roadTopY)}" fill="#5CB85C" fill-opacity="0.25"/>
    <rect x="${roadX2.toFixed(1)}" y="${roadTopY}" width="${(Math.max(0,P3.x-roadX2)).toFixed(1)}" height="${(GY-roadTopY)}" fill="#5CB85C" fill-opacity="0.25"/>

    <!-- road: subbase trapezoid with shoulder slopes -->
    <polygon points="${(roadX1-shoulderW).toFixed(1)},${GY} ${roadX1.toFixed(1)},${roadTopY} ${roadX2.toFixed(1)},${roadTopY} ${(roadX2+shoulderW).toFixed(1)},${GY}"
      fill="url(#subbase)" stroke="none"/>

    <!-- road: base course -->
    <rect x="${roadX1.toFixed(1)}" y="${surfBotY}" width="${(roadX2-roadX1).toFixed(1)}" height="${baseH}" fill="url(#baseCourse)" stroke="none"/>

    <!-- road: surface course -->
    <rect x="${roadX1.toFixed(1)}" y="${roadTopY}" width="${(roadX2-roadX1).toFixed(1)}" height="${surfH}" fill="url(#${pavementFillId(geom.pavementType)})" stroke="none"/>

    <!-- road perimeter + layer dividers -->
    <polyline points="${(roadX1-shoulderW).toFixed(1)},${GY} ${roadX1.toFixed(1)},${roadTopY} ${roadX2.toFixed(1)},${roadTopY} ${(roadX2+shoulderW).toFixed(1)},${GY}"
      fill="none" stroke="#1B3A5C" stroke-width="1.5" stroke-linejoin="round"/>
    <text x="${((roadX1+roadX2)/2).toFixed(1)}" y="${((roadTopY+GY)/2+4).toFixed(1)}" text-anchor="middle" class="pave-label" fill="${paveLabelFill(geom.pavementType)}">${pavementLabel(geom.pavementType)}</text>

    <!-- road width dimension -->
    ${hDim(roadX1, roadX2, roadTopY - 16, `Road Width: ${fmtLen(geom.roadWidth, units)}`)}

    <!-- bore path (tube) -->
    <path d="M${P0.x.toFixed(1)} ${P0.y.toFixed(1)} L${P1.x.toFixed(1)} ${P1.y.toFixed(1)} L${P2.x.toFixed(1)} ${P2.y.toFixed(1)} L${P3.x.toFixed(1)} ${P3.y.toFixed(1)}"
          fill="none" stroke="#CC00AA" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/>
    <path d="M${P0.x.toFixed(1)} ${P0.y.toFixed(1)} L${P1.x.toFixed(1)} ${P1.y.toFixed(1)} L${P2.x.toFixed(1)} ${P2.y.toFixed(1)} L${P3.x.toFixed(1)} ${P3.y.toFixed(1)}"
          fill="none" stroke="#1B3A5C" stroke-width="1.3" stroke-dasharray="1 7" stroke-linejoin="round"/>

    <!-- knee dots -->
    <circle cx="${P1.x.toFixed(1)}" cy="${P1.y.toFixed(1)}" r="3.5" fill="#1B3A5C"/>
    <circle cx="${P2.x.toFixed(1)}" cy="${P2.y.toFixed(1)}" r="3.5" fill="#1B3A5C"/>

    <!-- pit markers -->
    <rect x="${(P0.x-14).toFixed(1)}" y="${(GY-8).toFixed(1)}" width="28" height="16" fill="#fff" stroke="#1B3A5C" stroke-width="1.5" rx="2"/>
    <text x="${P0.x.toFixed(1)}" y="${(GY-22).toFixed(1)}" text-anchor="middle" class="pit-label">ENTRY PIT</text>
    <rect x="${(P3.x-14).toFixed(1)}" y="${(GY-8).toFixed(1)}" width="28" height="16" fill="#fff" stroke="#1B3A5C" stroke-width="1.5" rx="2"/>
    <text x="${P3.x.toFixed(1)}" y="${(GY-22).toFixed(1)}" text-anchor="middle" class="pit-label">EXIT PIT</text>

    <!-- angle arcs -->
    <path d="${entryArc}" fill="none" stroke="#1B3A5C" stroke-width="1.2"/>
    <text x="${(P0.x+entryBis.x*(aR+18)).toFixed(1)}" y="${(P0.y+entryBis.y*(aR+18)+12).toFixed(1)}" text-anchor="middle" class="angle-label">${geom.entryAngleDeg}°</text>
    <path d="${exitArc}" fill="none" stroke="#1B3A5C" stroke-width="1.2"/>
    <text x="${(P3.x+exitBis.x*(aR+18)).toFixed(1)}" y="${(P3.y+exitBis.y*(aR+18)+12).toFixed(1)}" text-anchor="middle" class="angle-label">${geom.exitAngleDeg}°</text>

    <!-- bore spec leader -->
    <line x1="${midX.toFixed(1)}" y1="${FY.toFixed(1)}" x2="${midX.toFixed(1)}" y2="${(FY-60).toFixed(1)}" stroke="#1B3A5C" stroke-width="1"/>
    <circle cx="${midX.toFixed(1)}" cy="${FY.toFixed(1)}" r="2.5" fill="#1B3A5C"/>
    <text x="${midX.toFixed(1)}" y="${(FY-72).toFixed(1)}" text-anchor="middle" class="leader-lbl">⌀ ${fmtSmall(geom.bitDiaRaw, units)} BORE HOLE</text>
    ${geom.condDiaRaw > 0 ? `<text x="${midX.toFixed(1)}" y="${(FY-57).toFixed(1)}" text-anchor="middle" class="leader-lbl">⌀ ${fmtSmall(geom.condDiaRaw, units)} CONDUIT (HDPE)</text>` : ''}

    <!-- depth dimension -->
    ${vDim(depX, GY, FY, `Depth: ${fmtLen(geom.boreDepth, units)}`, 1)}

    <!-- setback + span dims -->
    ${hDim(P0.x, roadX1, row1Y, `Entry Setback: ${fmtLen(geom.entrySetback, units)}`)}
    ${hDim(roadX2, P3.x,  row1Y, `Exit Setback: ${fmtLen(geom.exitSetback, units)}`)}
    ${hDim(P0.x, P3.x,   row2Y, `Overall Span: ${fmtLen(geom.totalSpan, units)}`)}

    <!-- bore length callout -->
    <text x="${PM.left}" y="${row3Y}" class="callout" style="fill:#000">TOTAL BORE LENGTH (computed): ${fmtLen(geom.boreLength, units)}</text>
    ${geom.overlap ? `<text x="${PM.left}" y="${row3Y+18}" class="dim-label" fill="#B23A2E">⚠ transitions overlap — see warning</text>` : ''}

    <!-- not to scale note -->
    <text x="${PM.left}" y="${PVB_H - 8}" class="plan-note" style="font-size:11px">NOT TO SCALE — FOR ILLUSTRATION PURPOSES ONLY</text>`;

  els.profileSvg.setAttribute('viewBox', `0 0 ${PVB_W} ${PVB_H}`);
  els.profileSvg.innerHTML = svg;
  animate(els.profileSvg);
}

/* ==========================================================
   AERIAL CROSSING — PROFILE VIEW
   ========================================================== */
const APH = 420;   /* aerial profile height */

function drawAerialProfileView(geom) {
  const { units } = geom;

  /* layout */
  const AM = { left: 90, right: 40, top: 44 };
  const ADW = PVB_W - AM.left - AM.right;

  /* scale: horizontal = total span, vertical = tallest pole + 35% buffer */
  const scX = ADW / geom.span;
  const maxPoleHeight = Math.max(geom.poleHeightA, geom.poleHeightB);
  const vertExtent = maxPoleHeight * 1.35;
  const skyH = APH * 0.60;
  const scY = skyH / vertExtent;

  const gY   = AM.top + skyH;                         /* ground Y */
  const ptYA = gY - geom.poleHeightA * scY;           /* Pole A top Y */
  const ptYB = gY - geom.poleHeightB * scY;           /* Pole B top Y */
  const sagPx = geom.cableSag * scY;

  const roadX1 = AM.left + geom.poleSetback * scX;
  const roadX2 = roadX1 + geom.roadWidth * scX;
  const poleLx = AM.left;
  const poleRx = AM.left + geom.span * scX;
  const poleW  = 10;
  const armW   = 20;

  /* Q-bezier control point so mid-span cable droops by sagPx below chord mid */
  const midX    = (poleLx + poleRx) / 2;
  const chordMidY = (ptYA + ptYB) / 2;
  const cblCtrlY  = (chordMidY + 2 * sagPx).toFixed(1);
  const midCblY   = chordMidY + sagPx;                /* lowest cable point Y */
  const clrPx     = gY - midCblY;

  const surfH_r = 8, baseH_r = 12, subH_r = 16;
  const totalRoadH_r = surfH_r + baseH_r + subH_r;
  const roadTopY_r   = gY - totalRoadH_r;
  const surfBotY_r   = roadTopY_r + surfH_r;
  const baseBotY_r   = surfBotY_r + baseH_r;
  const shoulderW_r  = 50;
  const row1Y = gY + 48, row2Y = gY + 78;

  const svg = `
    ${sharedSvgStyle()}
    ${sharedDefs()}

    <!-- sky gradient -->
    <rect x="0" y="0" width="${PVB_W}" height="${gY}" fill="url(#skyGrad)"/>

    <!-- ground / soil below -->
    <rect x="${AM.left}" y="${gY}" width="${ADW}" height="${APH-gY-10}" fill="url(#soilHatch)"/>

    <!-- grass strip (outside road shoulders) -->
    <rect x="${AM.left}" y="${(gY-8).toFixed(1)}" width="${(Math.max(0,roadX1-shoulderW_r-AM.left)).toFixed(1)}" height="8" fill="url(#grassFill)"/>
    <rect x="${(roadX2+shoulderW_r).toFixed(1)}" y="${(gY-8).toFixed(1)}" width="${(Math.max(0,PVB_W-AM.right-roadX2-shoulderW_r)).toFixed(1)}" height="8" fill="url(#grassFill)"/>

    <!-- existing grade lines -->
    <line x1="${AM.left}" y1="${gY}" x2="${(Math.max(AM.left,roadX1-shoulderW_r)).toFixed(1)}" y2="${gY}" stroke="#1B3A5C" stroke-width="2"/>
    <line x1="${(Math.min(PVB_W-AM.right,roadX2+shoulderW_r)).toFixed(1)}" y1="${gY}" x2="${(PVB_W-AM.right).toFixed(1)}" y2="${gY}" stroke="#1B3A5C" stroke-width="2"/>

    <!-- road: subbase trapezoid with shoulder slopes -->
    <polygon points="${(roadX1-shoulderW_r).toFixed(1)},${gY} ${roadX1.toFixed(1)},${roadTopY_r} ${roadX2.toFixed(1)},${roadTopY_r} ${(roadX2+shoulderW_r).toFixed(1)},${gY}"
      fill="url(#subbase)" stroke="none"/>

    <!-- road: base course -->
    <rect x="${roadX1.toFixed(1)}" y="${surfBotY_r}" width="${(roadX2-roadX1).toFixed(1)}" height="${baseH_r}" fill="url(#baseCourse)" stroke="none"/>

    <!-- road: surface course -->
    <rect x="${roadX1.toFixed(1)}" y="${roadTopY_r}" width="${(roadX2-roadX1).toFixed(1)}" height="${surfH_r}" fill="url(#${pavementFillId(geom.pavementType)})" stroke="none"/>

    <!-- road perimeter -->
    <polyline points="${(roadX1-shoulderW_r).toFixed(1)},${gY} ${roadX1.toFixed(1)},${roadTopY_r} ${roadX2.toFixed(1)},${roadTopY_r} ${(roadX2+shoulderW_r).toFixed(1)},${gY}"
      fill="none" stroke="#1B3A5C" stroke-width="1.5" stroke-linejoin="round"/>
    <text x="${((roadX1+roadX2)/2).toFixed(1)}" y="${((roadTopY_r+gY)/2+4).toFixed(1)}" text-anchor="middle" class="pave-label" fill="${paveLabelFill(geom.pavementType)}">${pavementLabel(geom.pavementType)}</text>

    <!-- left pole (Pole A) -->
    <rect x="${(poleLx-poleW/2).toFixed(1)}" y="${ptYA.toFixed(1)}" width="${poleW}" height="${(gY-ptYA).toFixed(1)}" fill="#5D4037" stroke="#3E2723" stroke-width="1"/>
    <line x1="${(poleLx-armW).toFixed(1)}" y1="${(ptYA+6).toFixed(1)}" x2="${(poleLx+armW).toFixed(1)}" y2="${(ptYA+6).toFixed(1)}" stroke="#3E2723" stroke-width="4" stroke-linecap="round"/>

    <!-- right pole (Pole B) -->
    <rect x="${(poleRx-poleW/2).toFixed(1)}" y="${ptYB.toFixed(1)}" width="${poleW}" height="${(gY-ptYB).toFixed(1)}" fill="#5D4037" stroke="#3E2723" stroke-width="1"/>
    <line x1="${(poleRx-armW).toFixed(1)}" y1="${(ptYB+6).toFixed(1)}" x2="${(poleRx+armW).toFixed(1)}" y2="${(ptYB+6).toFixed(1)}" stroke="#3E2723" stroke-width="4" stroke-linecap="round"/>

    <!-- fiber cable (parabolic sag, asymmetric poles) -->
    <path d="M${poleLx.toFixed(1)} ${ptYA.toFixed(1)} Q${midX.toFixed(1)} ${cblCtrlY} ${poleRx.toFixed(1)} ${ptYB.toFixed(1)}"
          fill="none" stroke="#CC00AA" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M${poleLx.toFixed(1)} ${ptYA.toFixed(1)} Q${midX.toFixed(1)} ${cblCtrlY} ${poleRx.toFixed(1)} ${ptYB.toFixed(1)}"
          fill="none" stroke="#fff" stroke-width="0.8" stroke-dasharray="4 5" opacity=".6"/>

    <!-- cable spec leader -->
    <line x1="${midX.toFixed(1)}" y1="${midCblY.toFixed(1)}" x2="${midX.toFixed(1)}" y2="${(midCblY-40).toFixed(1)}" stroke="#1B3A5C" stroke-width="1"/>
    <circle cx="${midX.toFixed(1)}" cy="${midCblY.toFixed(1)}" r="2.5" fill="#1B3A5C"/>
    <text x="${midX.toFixed(1)}" y="${(midCblY-50).toFixed(1)}" text-anchor="middle" class="leader-lbl">FIBER OPTIC CABLE</text>
    ${geom.condDiaRaw > 0 ? `<text x="${midX.toFixed(1)}" y="${(midCblY-36).toFixed(1)}" text-anchor="middle" class="leader-lbl">⌀ ${fmtSmall(geom.condDiaRaw, units)} MESSENGER / CONDUIT</text>` : ''}

    <!-- clearance vertical dim (midspan) -->
    ${vDim(midX + 30, midCblY, gY, `Clearance: ${fmtLen(geom.clearance, units)}`, 1)}

    <!-- Pole A height dim — vertical label, left of left pole -->
    ${vDimV(poleLx - poleW - 12, ptYA, gY, `Pole A: ${fmtLen(geom.poleHeightA, units)}`, -1)}

    <!-- Pole B height dim — vertical label, left of right pole (stays inside SVG) -->
    ${vDimV(poleRx - poleW - 12, ptYB, gY, `Pole B: ${fmtLen(geom.poleHeightB, units)}`, -1)}

    <!-- cable sag dim (chord midpoint → cable low point); label placed below cable to avoid overlap -->
    <line x1="${(midX-38).toFixed(1)}" y1="${chordMidY.toFixed(1)}" x2="${(midX-22).toFixed(1)}" y2="${chordMidY.toFixed(1)}" class="ext-line"/>
    <line x1="${(midX-38).toFixed(1)}" y1="${midCblY.toFixed(1)}"   x2="${(midX-22).toFixed(1)}" y2="${midCblY.toFixed(1)}"   class="ext-line"/>
    <line x1="${(midX-30).toFixed(1)}" y1="${(chordMidY+3).toFixed(1)}" x2="${(midX-30).toFixed(1)}" y2="${(midCblY-3).toFixed(1)}" class="dim-line" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
    <text x="${(midX-40).toFixed(1)}" y="${(midCblY+16).toFixed(1)}" text-anchor="end" class="dim-label">Sag: ${fmtLen(geom.cableSag, units)}</text>

    <!-- road width dim -->
    ${hDim(roadX1, roadX2, roadTopY_r - 16, `Road Width: ${fmtLen(geom.roadWidth, units)}`)}

    <!-- pole-to-pole span dim -->
    ${hDim(poleLx, poleRx, row1Y, `Pole-to-Pole Span: ${fmtLen(geom.span, units)}`)}

    <!-- setback dims -->
    ${hDim(poleLx, roadX1, row2Y, `Pole Setback: ${fmtLen(geom.poleSetback, units)}`)}
    ${hDim(roadX2, poleRx, row2Y, `Pole Setback: ${fmtLen(geom.poleSetback, units)}`)}

    <!-- not to scale note -->
    <text x="${AM.left}" y="${APH - 8}" class="plan-note" style="font-size:11px">NOT TO SCALE — FOR ILLUSTRATION PURPOSES ONLY</text>`;

  els.profileSvg.setAttribute('viewBox', `0 0 ${PVB_W} ${APH}`);
  els.profileSvg.innerHTML = svg;
  animate(els.profileSvg);
}

/* ==========================================================
   CANAL / DITCH — PROFILE VIEW
   ========================================================== */
const CPH = 420;   /* canal profile height */

function drawCanalProfileView(geom) {
  const { units } = geom;

  const CM  = { left: 90, right: 40, top: 44 };
  const CDW = PVB_W - CM.left - CM.right;

  /* horizontal scale: span fills drawing width */
  const scX = CDW / geom.span;

  /* vertical scale: tallest item is poleHeight + waterDepth, give 35% headroom */
  const vertExtent = (geom.poleHeight + geom.waterDepth) * 1.35;
  const skyH = CPH * 0.55;
  const scY  = skyH / vertExtent;

  const gY   = CM.top + skyH;                    /* bank / ground Y */
  const ptY  = gY - geom.poleHeight * scY;       /* pole top Y */
  const sagPx = geom.cableSag * scY;

  const poleLx = CM.left;
  const poleRx = CM.left + geom.span * scX;
  const poleW  = 10;
  const armW   = 20;

  /* canal position */
  const canalLx = poleLx + geom.poleSetback * scX;
  const canalRx = poleRx - geom.poleSetback * scX;
  const canalDepthPx = geom.waterDepth * scY;
  const slopeW = Math.min(canalDepthPx * 0.5, (canalRx - canalLx) * 0.25);
  const canalBotY = gY + canalDepthPx;

  /* cable parabola */
  const midX      = (poleLx + poleRx) / 2;
  const midCblY   = ptY + sagPx;
  const cblCtrlY  = (ptY + 2 * sagPx).toFixed(1);
  const clearancePx = gY - midCblY;   /* above bank */

  const row1Y = canalBotY + 44;
  const row2Y = row1Y + 30;

  /* grass width outside poles */
  const grassL = CM.left;
  const grassR = PVB_W - CM.right;

  const svg = `
    ${sharedSvgStyle()}
    ${sharedDefs()}

    <!-- sky gradient -->
    <rect x="0" y="0" width="${PVB_W}" height="${gY}" fill="url(#skyGrad)"/>

    <!-- soil fill on each bank -->
    <rect x="${CM.left}" y="${gY}" width="${(canalLx - CM.left).toFixed(1)}" height="${CPH - gY}" fill="url(#soilHatch)"/>
    <rect x="${canalRx.toFixed(1)}" y="${gY}" width="${(PVB_W - CM.right - canalRx).toFixed(1)}" height="${CPH - gY}" fill="url(#soilHatch)"/>

    <!-- soil below canal bed -->
    <polygon points="${canalLx.toFixed(1)},${gY} ${canalRx.toFixed(1)},${gY} ${(canalRx-slopeW).toFixed(1)},${canalBotY.toFixed(1)} ${(canalLx+slopeW).toFixed(1)},${canalBotY.toFixed(1)}" fill="url(#soilHatch)" stroke="none"/>

    <!-- grass strips on each bank (outside poles) -->
    <rect x="${CM.left}" y="${(gY-8).toFixed(1)}" width="${(Math.max(0,poleLx-CM.left+poleW)).toFixed(1)}" height="8" fill="url(#grassFill)"/>
    <rect x="${(poleRx-poleW).toFixed(1)}" y="${(gY-8).toFixed(1)}" width="${(Math.max(0,PVB_W-CM.right-poleRx+poleW)).toFixed(1)}" height="8" fill="url(#grassFill)"/>

    <!-- ground lines (bank tops) -->
    <line x1="${CM.left}" y1="${gY}" x2="${canalLx.toFixed(1)}" y2="${gY}" stroke="#1B3A5C" stroke-width="2"/>
    <line x1="${canalRx.toFixed(1)}" y1="${gY}" x2="${(PVB_W-CM.right)}" y2="${gY}" stroke="#1B3A5C" stroke-width="2"/>

    <!-- canal water fill (trapezoid) -->
    <polygon points="${canalLx.toFixed(1)},${gY} ${canalRx.toFixed(1)},${gY} ${(canalRx-slopeW).toFixed(1)},${canalBotY.toFixed(1)} ${(canalLx+slopeW).toFixed(1)},${canalBotY.toFixed(1)}"
      fill="#4AABDC" fill-opacity="0.75" stroke="#1A6E9F" stroke-width="1.5" stroke-linejoin="round"/>

    <!-- water surface ripple lines -->
    <line x1="${(canalLx+4).toFixed(1)}" y1="${(gY+2).toFixed(1)}" x2="${(canalRx-4).toFixed(1)}" y2="${(gY+2).toFixed(1)}" stroke="#fff" stroke-width="1.2" stroke-dasharray="10 7" opacity="0.6"/>
    <line x1="${(canalLx+slopeW*0.25+4).toFixed(1)}" y1="${(gY+canalDepthPx*0.4).toFixed(1)}" x2="${(canalRx-slopeW*0.25-4).toFixed(1)}" y2="${(gY+canalDepthPx*0.4).toFixed(1)}" stroke="#fff" stroke-width="1" stroke-dasharray="8 6" opacity="0.4"/>

    <!-- canal outline -->
    <polyline points="${canalLx.toFixed(1)},${gY} ${(canalLx+slopeW).toFixed(1)},${canalBotY.toFixed(1)} ${(canalRx-slopeW).toFixed(1)},${canalBotY.toFixed(1)} ${canalRx.toFixed(1)},${gY}"
      fill="none" stroke="#1A6E9F" stroke-width="1.5" stroke-linejoin="round"/>

    <!-- left pole (Pole A) -->
    <rect x="${(poleLx-poleW/2).toFixed(1)}" y="${ptY.toFixed(1)}" width="${poleW}" height="${(gY-ptY).toFixed(1)}" fill="#5D4037" stroke="#3E2723" stroke-width="1"/>
    <line x1="${(poleLx-armW).toFixed(1)}" y1="${(ptY+6).toFixed(1)}" x2="${(poleLx+armW).toFixed(1)}" y2="${(ptY+6).toFixed(1)}" stroke="#3E2723" stroke-width="4" stroke-linecap="round"/>

    <!-- right pole (Pole B) -->
    <rect x="${(poleRx-poleW/2).toFixed(1)}" y="${ptY.toFixed(1)}" width="${poleW}" height="${(gY-ptY).toFixed(1)}" fill="#5D4037" stroke="#3E2723" stroke-width="1"/>
    <line x1="${(poleRx-armW).toFixed(1)}" y1="${(ptY+6).toFixed(1)}" x2="${(poleRx+armW).toFixed(1)}" y2="${(ptY+6).toFixed(1)}" stroke="#3E2723" stroke-width="4" stroke-linecap="round"/>

    <!-- fiber cable (parabolic sag) -->
    <path d="M${poleLx.toFixed(1)} ${ptY.toFixed(1)} Q${midX.toFixed(1)} ${cblCtrlY} ${poleRx.toFixed(1)} ${ptY.toFixed(1)}"
          fill="none" stroke="#CC00AA" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M${poleLx.toFixed(1)} ${ptY.toFixed(1)} Q${midX.toFixed(1)} ${cblCtrlY} ${poleRx.toFixed(1)} ${ptY.toFixed(1)}"
          fill="none" stroke="#fff" stroke-width="0.8" stroke-dasharray="4 5" opacity=".6"/>

    <!-- cable spec leader -->
    <line x1="${midX.toFixed(1)}" y1="${midCblY.toFixed(1)}" x2="${midX.toFixed(1)}" y2="${(midCblY-40).toFixed(1)}" stroke="#1B3A5C" stroke-width="1"/>
    <circle cx="${midX.toFixed(1)}" cy="${midCblY.toFixed(1)}" r="2.5" fill="#1B3A5C"/>
    <text x="${midX.toFixed(1)}" y="${(midCblY-50).toFixed(1)}" text-anchor="middle" class="leader-lbl">FIBER OPTIC CABLE</text>
    ${geom.condDiaRaw > 0 ? `<text x="${midX.toFixed(1)}" y="${(midCblY-36).toFixed(1)}" text-anchor="middle" class="leader-lbl">⌀ ${fmtSmall(geom.condDiaRaw, units)} MESSENGER / CONDUIT</text>` : ''}

    <!-- clearance above bank (midspan) -->
    ${clearancePx > 4 ? vDim(midX + 30, midCblY, gY, `Clearance: ${fmtLen(geom.clearanceAboveBank, units)}`, 1) : ''}

    <!-- pole height dim — vertical label left of each pole -->
    ${vDimV(poleLx - poleW - 12, ptY, gY, `Pole: ${fmtLen(geom.poleHeight, units)}`, -1)}

    <!-- cable sag dim -->
    <line x1="${(midX-38).toFixed(1)}" y1="${ptY.toFixed(1)}" x2="${(midX-22).toFixed(1)}" y2="${ptY.toFixed(1)}" class="ext-line"/>
    <line x1="${(midX-38).toFixed(1)}" y1="${midCblY.toFixed(1)}" x2="${(midX-22).toFixed(1)}" y2="${midCblY.toFixed(1)}" class="ext-line"/>
    <line x1="${(midX-30).toFixed(1)}" y1="${(ptY+3).toFixed(1)}" x2="${(midX-30).toFixed(1)}" y2="${(midCblY-3).toFixed(1)}" class="dim-line" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
    <text x="${(midX-40).toFixed(1)}" y="${(midCblY+16).toFixed(1)}" text-anchor="end" class="dim-label">Sag: ${fmtLen(geom.cableSag, units)}</text>

    <!-- water depth dim -->
    ${canalDepthPx > 6 ? vDim(canalRx + 30, gY, canalBotY, `Water Depth: ${fmtLen(geom.waterDepth, units)}`, 1) : ''}

    <!-- canal width dim -->
    ${hDim(canalLx, canalRx, gY - 16, `Canal Width: ${fmtLen(geom.canalWidth, units)}`)}

    <!-- pole-to-pole span dim -->
    ${hDim(poleLx, poleRx, row1Y, `Pole-to-Pole Span: ${fmtLen(geom.span, units)}`)}

    <!-- pole setback dims -->
    ${hDim(poleLx, canalLx, row2Y, `Pole Setback: ${fmtLen(geom.poleSetback, units)}`)}
    ${hDim(canalRx, poleRx, row2Y, `Pole Setback: ${fmtLen(geom.poleSetback, units)}`)}

    <text x="${CM.left}" y="${CPH - 8}" class="plan-note" style="font-size:11px">NOT TO SCALE — FOR ILLUSTRATION PURPOSES ONLY</text>`;

  els.profileSvg.setAttribute('viewBox', `0 0 ${PVB_W} ${CPH}`);
  els.profileSvg.innerHTML = svg;
  animate(els.profileSvg);
}

/* ==========================================================
   CANAL BURIED BORE — PROFILE VIEW
   ========================================================== */
const CBPH = 420;

function drawCanalBuriedProfileView(geom) {
  const { units } = geom;
  const CBM = { left: 90, right: 40, top: 75 };
  const CBDW = PVB_W - CBM.left - CBM.right;

  const scX = CBDW / geom.totalSpan;
  const depthPx = CBPH - CBM.top - 140;   /* pixels for bore depth — reserve 140 px for dim rows below */
  const scY = depthPx / geom.boreDepth;

  const px = x => CBM.left + x * scX;

  const gY = CBM.top;                                        /* bank / ground level */
  const FY = gY + depthPx;                                   /* bore centerline Y */

  const P0 = { x: px(0),                                          y: gY };
  const P1 = { x: px(geom.entryRun),                              y: FY };
  const P2 = { x: px(geom.entryRun + geom.flatRun),               y: FY };
  const P3 = { x: px(geom.entryRun + geom.flatRun + geom.exitRun), y: gY };

  const canalLx   = px(geom.entrySetback);
  const canalRx   = px(geom.entrySetback + geom.canalWidth);
  const canalDepthPx = geom.waterDepth * scY;
  const canalBedY = gY + canalDepthPx;
  const slopeW    = Math.min(canalDepthPx * 0.5, (canalRx - canalLx) * 0.25);
  const shoulderW = 50;

  const midX  = (P1.x + P2.x) / 2;
  const row1Y = FY + 28, row2Y = FY + 56, row3Y = FY + 84;
  const depX  = 44;

  const eRad = geom.entryAngleDeg * Math.PI / 180;
  const xRad = geom.exitAngleDeg  * Math.PI / 180;
  const aR   = 26;
  const entryArc = arcPath(P0.x, P0.y, {x:1,y:0}, {x:Math.cos(eRad),y:Math.sin(eRad)}, aR);
  const entryBis = bisector({x:1,y:0}, {x:Math.cos(eRad),y:Math.sin(eRad)});
  const exitArc  = arcPath(P3.x, P3.y, {x:-1,y:0}, {x:-Math.cos(xRad),y:Math.sin(xRad)}, aR);
  const exitBis  = bisector({x:-1,y:0}, {x:-Math.cos(xRad),y:Math.sin(xRad)});

  const svg = `
    ${sharedSvgStyle()}
    ${sharedDefs()}

    <!-- soil background -->
    <rect x="${CBM.left}" y="${gY}" width="${CBDW}" height="${CBPH - gY}" fill="url(#soilHatch)"/>

    <!-- grass strips on outer banks -->
    <rect x="${CBM.left}" y="${(gY-8).toFixed(1)}" width="${(Math.max(0,canalLx-shoulderW-CBM.left)).toFixed(1)}" height="8" fill="url(#grassFill)"/>
    <rect x="${(canalRx+shoulderW).toFixed(1)}" y="${(gY-8).toFixed(1)}" width="${(Math.max(0,PVB_W-CBM.right-canalRx-shoulderW)).toFixed(1)}" height="8" fill="url(#grassFill)"/>

    <!-- ground lines on each bank -->
    <line x1="${CBM.left}" y1="${gY}" x2="${(Math.max(CBM.left,canalLx-shoulderW)).toFixed(1)}" y2="${gY}" stroke="#1B3A5C" stroke-width="2"/>
    <line x1="${(Math.min(PVB_W-CBM.right,canalRx+shoulderW)).toFixed(1)}" y1="${gY}" x2="${(PVB_W-CBM.right)}" y2="${gY}" stroke="#1B3A5C" stroke-width="2"/>

    <!-- canal water fill (trapezoid, excavated below bank) -->
    <polygon points="${canalLx.toFixed(1)},${gY} ${canalRx.toFixed(1)},${gY} ${(canalRx-slopeW).toFixed(1)},${canalBedY.toFixed(1)} ${(canalLx+slopeW).toFixed(1)},${canalBedY.toFixed(1)}"
      fill="#4AABDC" fill-opacity="0.80" stroke="#1A6E9F" stroke-width="1.5" stroke-linejoin="round"/>

    <!-- canal bank slopes (soil visible on canal sides) -->
    <polygon points="${(canalLx-shoulderW).toFixed(1)},${gY} ${canalLx.toFixed(1)},${gY} ${(canalLx+slopeW).toFixed(1)},${canalBedY.toFixed(1)} ${(canalLx-shoulderW+slopeW).toFixed(1)},${canalBedY.toFixed(1)}"
      fill="url(#soilHatch)" stroke="none"/>
    <polygon points="${canalRx.toFixed(1)},${gY} ${(canalRx+shoulderW).toFixed(1)},${gY} ${(canalRx+shoulderW-slopeW).toFixed(1)},${canalBedY.toFixed(1)} ${(canalRx-slopeW).toFixed(1)},${canalBedY.toFixed(1)}"
      fill="url(#soilHatch)" stroke="none"/>

    <!-- canal outline lines -->
    <polyline points="${(canalLx-shoulderW).toFixed(1)},${gY} ${canalLx.toFixed(1)},${gY} ${(canalLx+slopeW).toFixed(1)},${canalBedY.toFixed(1)} ${(canalRx-slopeW).toFixed(1)},${canalBedY.toFixed(1)} ${canalRx.toFixed(1)},${gY} ${(canalRx+shoulderW).toFixed(1)},${gY}"
      fill="none" stroke="#1A6E9F" stroke-width="1.5" stroke-linejoin="round"/>

    <!-- water surface ripple -->
    <line x1="${(canalLx+4).toFixed(1)}" y1="${(gY+3).toFixed(1)}" x2="${(canalRx-4).toFixed(1)}" y2="${(gY+3).toFixed(1)}" stroke="#fff" stroke-width="1.3" stroke-dasharray="10 7" opacity="0.7"/>

    <!-- CANAL label -->
    <text x="${((canalLx+canalRx)/2).toFixed(1)}" y="${(gY+canalDepthPx*0.5+5).toFixed(1)}" text-anchor="middle" class="pave-label" fill="#fff">CANAL / DITCH</text>

    <!-- bore path: conduit -->
    <polyline points="${P0.x.toFixed(1)},${P0.y.toFixed(1)} ${P1.x.toFixed(1)},${P1.y.toFixed(1)} ${P2.x.toFixed(1)},${P2.y.toFixed(1)} ${P3.x.toFixed(1)},${P3.y.toFixed(1)}"
      fill="none" stroke="#CC00AA" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="${P0.x.toFixed(1)},${P0.y.toFixed(1)} ${P1.x.toFixed(1)},${P1.y.toFixed(1)} ${P2.x.toFixed(1)},${P2.y.toFixed(1)} ${P3.x.toFixed(1)},${P3.y.toFixed(1)}"
      fill="none" stroke="#fff" stroke-width="1.2" stroke-dasharray="4 5" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>

    <!-- entry pit marker -->
    <rect x="${(P0.x-14).toFixed(1)}" y="${(gY-10).toFixed(1)}" width="28" height="16" fill="#fff" stroke="#1B3A5C" stroke-width="1.5" rx="2"/>
    <text x="${(P0.x-22).toFixed(1)}" y="${(gY-15).toFixed(1)}" text-anchor="middle" class="pit-label">ENTRY PIT</text>

    <!-- exit pit marker -->
    <rect x="${(P3.x-14).toFixed(1)}" y="${(gY-10).toFixed(1)}" width="28" height="16" fill="#fff" stroke="#1B3A5C" stroke-width="1.5" rx="2"/>
    <text x="${(P3.x+22).toFixed(1)}" y="${(gY-15).toFixed(1)}" text-anchor="middle" class="pit-label">EXIT PIT</text>

    <!-- fiber cable spec leader (points upward into soil zone, keeps dim rows clear) -->
    <line x1="${midX.toFixed(1)}" y1="${FY.toFixed(1)}" x2="${midX.toFixed(1)}" y2="${(FY-18).toFixed(1)}" stroke="#1B3A5C" stroke-width="1"/>
    <circle cx="${midX.toFixed(1)}" cy="${FY.toFixed(1)}" r="2.5" fill="#1B3A5C"/>
    <text x="${midX.toFixed(1)}" y="${(FY-26).toFixed(1)}" text-anchor="middle" class="leader-lbl">FIBER OPTIC CABLE</text>
    ${geom.condDiaRaw > 0 ? `<text x="${midX.toFixed(1)}" y="${(FY-40).toFixed(1)}" text-anchor="middle" class="leader-lbl">⌀ ${fmtSmall(geom.condDiaRaw, units)} CONDUIT</text>` : ''}

    <!-- bore depth dim (left margin) -->
    ${vDim(depX, gY, FY, `Bore Depth: ${fmtLen(geom.boreDepth, units)}`, 1)}

    <!-- canal water depth dim (right of canal) -->
    ${canalDepthPx > 6 ? vDim(canalRx + 32, gY, canalBedY, `Water Depth: ${fmtLen(geom.waterDepth, units)}`, 1) : ''}

    <!-- clearance below canal bed dim -->
    ${(FY - canalBedY) > 6 ? vDim(canalRx + 32, canalBedY, FY, `Clr: ${fmtLen(geom.clearanceBelowBed, units)}`, 1) : ''}

    <!-- canal bed line extension for dim -->
    <line x1="${canalRx.toFixed(1)}" y1="${canalBedY.toFixed(1)}" x2="${(canalRx+46).toFixed(1)}" y2="${canalBedY.toFixed(1)}" stroke="#1A6E9F" stroke-width="0.8" stroke-dasharray="3 3"/>
    <line x1="${canalRx.toFixed(1)}" y1="${FY.toFixed(1)}" x2="${(canalRx+46).toFixed(1)}" y2="${FY.toFixed(1)}" stroke="#1B3A5C" stroke-width="0.8" stroke-dasharray="3 3"/>

    <!-- angle arcs -->
    <path d="${entryArc}" fill="none" stroke="#1B3A5C" stroke-width="1"/>
    <text x="${(P0.x + entryBis.x * (aR+10)).toFixed(1)}" y="${(P0.y + entryBis.y * (aR+10) + 4).toFixed(1)}" class="dim-label">${geom.entryAngleDeg}°</text>
    <path d="${exitArc}" fill="none" stroke="#1B3A5C" stroke-width="1"/>
    <text x="${(P3.x + exitBis.x * (aR+10)).toFixed(1)}" y="${(P3.y + exitBis.y * (aR+10) + 4).toFixed(1)}" class="dim-label">${geom.exitAngleDeg}°</text>

    <!-- canal width dim -->
    ${hDim(canalLx, canalRx, gY - 18, `Canal Width: ${fmtLen(geom.canalWidth, units)}`)}

    <!-- horizontal dims row 1: total bore length -->
    <text x="${CBM.left}" y="${row1Y}" class="callout" style="fill:#000">TOTAL BORE LENGTH (computed): ${fmtLen(geom.boreLength, units)}</text>

    <!-- horizontal dims row 2: entry/exit slant + flat section -->
    ${hDim(P0.x, P1.x, row2Y, `Entry Slant: ${fmtLen(geom.entrySlant, units)}`)}
    ${hDim(P1.x, P2.x, row2Y, `Flat Section: ${fmtLen(geom.flatRun, units)}`)}
    ${hDim(P2.x, P3.x, row2Y, `Exit Slant: ${fmtLen(geom.exitSlant, units)}`)}

    <!-- setback dims -->
    ${hDim(P0.x, canalLx, row3Y, `Entry Setback: ${fmtLen(geom.entrySetback, units)}`)}
    ${hDim(canalRx, P3.x, row3Y, `Exit Setback: ${fmtLen(geom.exitSetback, units)}`)}

    <text x="${CBM.left}" y="${CBPH - 8}" class="plan-note" style="font-size:11px">NOT TO SCALE — FOR ILLUSTRATION PURPOSES ONLY</text>`;

  els.profileSvg.setAttribute('viewBox', `0 0 ${PVB_W} ${CBPH}`);
  els.profileSvg.innerHTML = svg;
  animate(els.profileSvg);
}

/* ==========================================================
   RESULT STRIP
   ========================================================== */
function renderResultStrip(geom) {
  const { units } = geom;
  let stats;
  if (geom.type === 'aerial') {
    stats = [
      { label: 'Pole-to-Pole Span',   value: fmtLen(geom.span,        units) },
      { label: 'Pole A Height',         value: fmtLen(geom.poleHeightA, units) },
      { label: 'Pole B Height',         value: fmtLen(geom.poleHeightB, units) },
      { label: 'Cable Sag',            value: fmtLen(geom.cableSag,    units) },
      { label: 'Mid-Span Clearance',   value: fmtLen(geom.clearance,   units), warn: geom.clearance < 18, ok: geom.clearance >= 18 },
      { label: 'Road Width',           value: fmtLen(geom.roadWidth,   units) },
      { label: 'Pole Setback',         value: fmtLen(geom.poleSetback,    units) },
    ];
  } else if (geom.type === 'canal' && geom.method === 'aerial') {
    stats = [
      { label: 'Pole-to-Pole Span',    value: fmtLen(geom.span,                units) },
      { label: 'Canal Width',           value: fmtLen(geom.canalWidth,          units) },
      { label: 'Water Depth',           value: fmtLen(geom.waterDepth,          units) },
      { label: 'Pole Height',           value: fmtLen(geom.poleHeight,          units) },
      { label: 'Cable Sag',             value: fmtLen(geom.cableSag,            units) },
      { label: 'Clearance Above Water', value: fmtLen(geom.clearanceAboveWater, units), warn: geom.clearanceAboveWater < 18, ok: geom.clearanceAboveWater >= 18 },
      { label: 'Pole Setback',          value: fmtLen(geom.poleSetback,         units) },
    ];
  } else if (geom.type === 'canal' && geom.method === 'buried') {
    stats = [
      { label: 'Bore Depth (from bank)',  value: fmtLen(geom.boreDepth,         units) },
      { label: 'Bore Length (computed)',  value: fmtLen(geom.boreLength,         units) },
      { label: 'Canal Width',             value: fmtLen(geom.canalWidth,         units) },
      { label: 'Water Depth',             value: fmtLen(geom.waterDepth,         units) },
      { label: 'Clr. Below Canal Bed',    value: fmtLen(geom.clearanceBelowBed,  units), warn: geom.clearanceBelowBed < 2, ok: geom.clearanceBelowBed >= 2 },
      { label: 'Entry Slant Length',      value: fmtLen(geom.entrySlant,         units) },
      { label: 'Exit Slant Length',       value: fmtLen(geom.exitSlant,          units) },
    ];
  } else {
    stats = [
      { label: 'Bore Depth (entered)', value: fmtLen(geom.boreDepth,   units) },
      { label: 'Bore Length (computed)', value: fmtLen(geom.boreLength, units) },
      { label: 'Entry Slant Length',   value: fmtLen(geom.entrySlant,  units) },
      { label: 'Flat Section Length',  value: fmtLen(geom.flatRun,     units), warn: geom.overlap },
      { label: 'Exit Slant Length',    value: fmtLen(geom.exitSlant,   units) },
      { label: 'Overall Span',         value: fmtLen(geom.totalSpan,   units) },
    ];
  }
  els.resultStrip.innerHTML = stats.map(s => `
    <div class="stat${s.warn ? ' is-warning' : s.ok ? ' is-success' : ''}">
      <span class="stat-label">${esc(s.label)}</span>
      <span class="stat-value">${esc(s.value)}</span>
    </div>`).join('');
}

/* ==========================================================
   ANIMATE helper
   ========================================================== */
function animate(el) {
  el.classList.remove('revealing');
  requestAnimationFrame(() => el.classList.add('revealing'));
}

/* ==========================================================
   MAIN GENERATE
   ========================================================== */
function generate() {
  const geom = currentType === 'aerial'                        ? computeAerialGeometry()
             : currentType === 'canal' && canalMethod === 'buried' ? computeCanalBuriedGeometry()
             : currentType === 'canal'                             ? computeCanalGeometry()
             :                                                       computeBuriedGeometry();
  if (!geom) return;

  /* First time: swap empty state for drawing content */
  if (!profileGenerated) {
    profileGenerated = true;
    els.emptyState.hidden     = true;
    els.drawingContent.hidden = false;
  }

  /* Update toolbar label */
  if (els.profileTypeLabel) {
    els.profileTypeLabel.textContent = currentType === 'aerial' ? 'Aerial Pole Crossing'
      : currentType === 'canal' && canalMethod === 'buried' ? 'Canal / Ditch — Buried HDD'
      : currentType === 'canal' ? 'Canal / Ditch — Aerial'
      : 'Buried Bore Crossing';
  }

  drawPlanView(geom);
  if (geom.type === 'aerial')                           drawAerialProfileView(geom);
  else if (geom.type === 'canal' && geom.method === 'buried') drawCanalBuriedProfileView(geom);
  else if (geom.type === 'canal')                       drawCanalProfileView(geom);
  else                                                  drawBuriedProfileView(geom);
  renderResultStrip(geom);
  updateTitleBlock(geom);
}

/* Generate button */
els.btnGenerate.addEventListener('click', generate);

/* ==========================================================
   EXPORT — SVG
   ========================================================== */
function downloadSvg(svgEl, filename) {
  const xml  = new XMLSerializer().serializeToString(svgEl);
  const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], { type: 'image/svg+xml;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
document.getElementById('btnDownloadSvgPlan').addEventListener('click',    () => downloadSvg(els.planSvg,    'bore-plan-view.svg'));
document.getElementById('btnDownloadSvgProfile').addEventListener('click', () => downloadSvg(els.profileSvg, 'bore-profile-view.svg'));

/* ==========================================================
   EXPORT — PNG (both views stacked)
   ========================================================== */
document.getElementById('btnDownloadPng').addEventListener('click', () => {
  const planVB    = els.planSvg.viewBox.baseVal;
  const planXml   = new XMLSerializer().serializeToString(els.planSvg);
  const profXml   = new XMLSerializer().serializeToString(els.profileSvg);
  const profVB    = els.profileSvg.viewBox.baseVal;
  const SCALE     = 2;
  const GAP       = 24;

  const planImg = new Image();
  const profImg = new Image();
  const planUrl = URL.createObjectURL(new Blob([planXml], { type: 'image/svg+xml;charset=utf-8' }));
  const profUrl = URL.createObjectURL(new Blob([profXml], { type: 'image/svg+xml;charset=utf-8' }));

  let loaded = 0;
  function tryRender() {
    if (++loaded < 2) return;
    const targetW  = Math.max(planVB.width, profVB.width) * SCALE;
    const planHpx  = planVB.height  * (targetW / planVB.width);
    const profHpx  = profVB.height  * (targetW / profVB.width);

    const canvas   = document.createElement('canvas');
    canvas.width   = targetW;
    canvas.height  = planHpx + GAP * SCALE + profHpx;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FBFAF6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(planImg, 0, 0, targetW, planHpx);
    ctx.drawImage(profImg, 0, planHpx + GAP * SCALE, targetW, profHpx);

    canvas.toBlob(blob => {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'bore-crossing.png' });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
    URL.revokeObjectURL(planUrl);
    URL.revokeObjectURL(profUrl);
  }

  planImg.onload = tryRender;
  profImg.onload = tryRender;
  planImg.src = planUrl;
  profImg.src = profUrl;
});

/* ==========================================================
   PRINT
   ========================================================== */
document.getElementById('btnPrint').addEventListener('click', () => window.print());

document.getElementById('chkPrintStats').addEventListener('change', function () {
  document.body.classList.toggle('no-print-stats', !this.checked);
});

/* ==========================================================
   INIT — empty state shown; drawing generated only on button click
   ========================================================== */
