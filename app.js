/**
 * app.js — main application controller.
 * Contour reveal: stroke-dashoffset (no clipPath).
 */

'use strict';

import { renderLesson } from './renderers.js';
import { chipId, clamp, SVG_LAYOUT } from './utils.js';
import { INSTRUCTIONS } from './ui-content.js';

/* ── JSON adapter ─────────────────────────────────────────────── */
function adaptLesson(raw) {
  const sentences = (raw.sentences ?? []).map((sent, sIdx) => {
    const sentenceId = sent.sentenceId ?? `s${sIdx + 1}`;
    const thoughtGroups = (sent.groups ?? []).map((g, gIdx) => {
      const pm = g.pitchMovement ?? {};
      return {
        groupId:  g.groupId ?? `${sentenceId}-g${gIdx + 1}`,
        index:    g.index   ?? gIdx,
        text:     g.text    ?? '',
        audio:    g.audio   ?? null,
        pitchMovement: {
          label:  pm.label  ?? 'level',
          reason: pm.reason ?? null,
          points: pm.points ?? null,
        },
      };
    });
    return {
      sentenceId,
      order: sIdx + 1,
      badge: sent.badge ?? `S${sIdx + 1}`,
      thoughtGroups,
    };
  });

  return {
    lessonId: raw.lessonId ?? 'lesson-001',
    title:    raw.title    ?? 'Pitch movement in English',
    instructions: INSTRUCTIONS,   // ← 来自 ui-content.js
    ui: { showLegend: true, showGroupLabels: true, showMovementLabels: true },
    sentences,
  };
}

/* ── State ────────────────────────────────────────────────────── */
const state = {
  lesson:               null,
  currentSentenceIndex: 0,
  currentGroupIndex:    0,
  isPlaying:            false,
  mode:                 'idle',
  playScope:            'all',
  clockStart:           null,
  clockOffset:          0,
  clockDuration:        0,
  clockStopAt:          null,
  raf:                  null,
  audio:                new Audio(),
  audioAvailable:       false,
};

/* ── Boot ─────────────────────────────────────────────────────── */
async function init() {
  const root = document.getElementById('app');
  showLoading(root, true);
  try {
    const manifest    = await loadJSON('data/manifest.json');
    const firstLesson = manifest.lessons?.[0];
    if (!firstLesson?.data) throw new Error('Manifest missing lesson data path.');
    const lesson = adaptLesson(await loadJSON(firstLesson.data));
    state.lesson = lesson;
    renderLesson(lesson, { onChipClick }, root);
    wireControls();
    wireAudio();
    syncUI();
    showLoading(root, false);
  } catch (err) {
    showError(document.getElementById('app'), err.message);
  }
}

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load "${path}" (${res.status})`);
  return res.json();
}

/* ── Controls ─────────────────────────────────────────────────── */
function wireControls() {
  document.getElementById('btn-play').addEventListener('click',   playAll);
  document.getElementById('btn-pause').addEventListener('click',  pausePlayback);
  document.getElementById('btn-replay').addEventListener('click', replayAll);
}

function wireAudio() {
  state.audio.addEventListener('canplay', () => { state.audioAvailable = true; });
  state.audio.addEventListener('error',   () => { state.audioAvailable = false; });
}

/* ── Virtual clock ────────────────────────────────────────────── */
function clockNow() {
  if (!state.isPlaying || state.clockStart === null) return state.clockOffset;
  return state.clockOffset + (performance.now() - state.clockStart) / 1000;
}
function clockResume(offset, duration, stopAt) {
  state.clockOffset   = offset;
  state.clockDuration = duration;
  state.clockStopAt   = stopAt ?? duration;
  state.clockStart    = performance.now();
  state.isPlaying     = true;
}
function clockPause() {
  state.clockOffset = clockNow();
  state.clockStart  = null;
  state.isPlaying   = false;
}
function clockReset() {
  state.clockOffset = 0; state.clockStart = null;
  state.clockDuration = 0; state.clockStopAt = null;
  state.isPlaying = false;
}

/* ── Play all ─────────────────────────────────────────────────── */
function playAll() {
  if (!state.lesson) return;
  state.mode = 'all'; state.playScope = 'all';
  startGroup(0, 0);
}

function startGroup(sentIdx, grpIdx) {
  const sentence = state.lesson.sentences[sentIdx];
  if (!sentence) { endPlayback(); return; }
  if (grpIdx >= sentence.thoughtGroups.length) { startGroup(sentIdx + 1, 0); return; }

  const group    = sentence.thoughtGroups[grpIdx];
  const duration = group.audio?.duration ?? 1;

  state.currentSentenceIndex = sentIdx;
  state.currentGroupIndex    = grpIdx;

  resetChipsForSentence(sentence, grpIdx);
  activateCard(sentence.sentenceId);
  clockResume(0, duration, duration);
  loadAndPlayGroupAudio(group);
  syncUI();
  startRaf();
}

function advanceGroup() {
  const sentence = state.lesson.sentences[state.currentSentenceIndex];
  if (!sentence) { endPlayback(); return; }
  const next = state.currentGroupIndex + 1;
  if (next < sentence.thoughtGroups.length) {
    startGroup(state.currentSentenceIndex, next);
  } else {
    startGroup(state.currentSentenceIndex + 1, 0);
  }
}

/* ── Pause / Replay ───────────────────────────────────────────── */
function pausePlayback() {
  if (!state.isPlaying) return;
  clockPause(); state.audio.pause(); stopRaf(); draw(); syncUI();
}

function replayAll() {
  clockReset(); state.audio.pause(); state.audioAvailable = false;
  state.mode = 'all'; state.playScope = 'all';
  stopRaf(); resetAllVisuals(); syncUI();
  setTimeout(() => startGroup(0, 0), 30);
}

/* ── Click chip ───────────────────────────────────────────────── */
function onChipClick(sentenceId, groupId) {
  const lesson   = state.lesson;
  if (!lesson) return;
  const sentIdx  = lesson.sentences.findIndex(s => s.sentenceId === sentenceId);
  const sentence = lesson.sentences[sentIdx];
  if (!sentence) return;
  const grpIdx   = sentence.thoughtGroups.findIndex(g => g.groupId === groupId);
  const group    = sentence.thoughtGroups[grpIdx];
  if (!group) return;

  clockReset(); state.audio.pause(); stopRaf();

  const chipEl = document.getElementById(chipId(sentenceId, groupId));
  if (chipEl) { chipEl.classList.remove('is-pulsing'); void chipEl.offsetWidth; chipEl.classList.add('is-pulsing'); }

  state.mode = 'tg'; state.playScope = 'tg';
  state.currentSentenceIndex = sentIdx;
  state.currentGroupIndex    = grpIdx;

  resetChipsForSentence(sentence, grpIdx);
  setGroupReveal(sentence, grpIdx, 0);   // hide active group's line
  resetGroupReveals(sentence, grpIdx);   // fully reveal all before it
  showDividersUpTo(sentence, grpIdx);
  revealLabelsUpTo(sentence, grpIdx);
  activateCard(sentenceId);

  clockResume(0, group.audio?.duration ?? 1, group.audio?.duration ?? 1);
  loadAndPlayGroupAudio(group);
  syncUI(); startRaf();
}

/* ── Audio ────────────────────────────────────────────────────── */
function loadAndPlayGroupAudio(group) {
  const src = group.audio?.src ?? '';
  state.audioAvailable = false;
  if (!src) return;
  if (state.audio.src !== new URL(src, location.href).href) state.audio.src = src;
  state.audio.currentTime = 0;
  state.audio.play().catch(() => { state.audioAvailable = false; });
}

/* ── RAF loop ─────────────────────────────────────────────────── */
function startRaf() {
  stopRaf();
  function tick() {
    const sentence = state.lesson?.sentences[state.currentSentenceIndex];
    const group    = sentence?.thoughtGroups[state.currentGroupIndex];
    if (!group) { endPlayback(); return; }

    const duration = group.audio?.duration ?? 1;
    let t;
    if (state.audioAvailable && !state.audio.paused && state.audio.readyState >= 2) {
      t = state.audio.currentTime;
      state.clockOffset = t; state.clockStart = performance.now();
    } else {
      t = clockNow();
    }

    const stopAt = state.clockStopAt ?? duration;
    if (t >= stopAt) {
      drawGroupAt(sentence, group, stopAt, duration);
      if (state.playScope === 'tg') {
        clockPause(); state.audio.pause(); state.playScope = 'all'; endPlayback();
      } else {
        advanceGroup();
      }
      return;
    }

    drawGroupAt(sentence, group, t, duration);
    state.raf = requestAnimationFrame(tick);
  }
  state.raf = requestAnimationFrame(tick);
}

function stopRaf() {
  if (state.raf) { cancelAnimationFrame(state.raf); state.raf = null; }
}

/* ── Draw ─────────────────────────────────────────────────────── */
function draw() {
  const sentence = state.lesson?.sentences[state.currentSentenceIndex];
  const group    = sentence?.thoughtGroups[state.currentGroupIndex];
  if (!group) return;
  drawGroupAt(sentence, group, clockNow(), group.audio?.duration ?? 1);
}

function drawGroupAt(sentence, group, t, duration) {
  // Progress bar
  const total  = state.lesson.sentences.length;
  const nGrps  = sentence.thoughtGroups.length;
  const globalP = state.currentSentenceIndex / total
                + (state.currentGroupIndex + clamp(t / duration, 0, 1)) / nGrps / total;
  const progEl = document.getElementById('progress-fill');
  if (progEl) progEl.style.width = (globalP * 100) + '%';

  updateGroupVisualState(sentence, t, duration);
}

function updateGroupVisualState(sentence, t, duration) {
  const sid    = sentence.sentenceId;
  const groups = sentence.thoughtGroups;
  const grpIdx = state.currentGroupIndex;
  const frac   = clamp(t / duration, 0, 1);

  // Dashoffset reveal for active group
  setGroupReveal(sentence, grpIdx, frac);
  // Ensure all previous groups are fully revealed
  for (let i = 0; i < grpIdx; i++) setGroupReveal(sentence, i, 1);

  activateCard(sid);

  groups.forEach((g, idx) => {
    const chipEl = document.getElementById(chipId(sid, g.groupId));
    if (chipEl) {
      chipEl.classList.toggle('is-active', idx === grpIdx);
      chipEl.classList.toggle('is-spoken', idx < grpIdx);
    }
    if (idx > 0) {
      const divEl = document.getElementById(`div-${sid}-${idx}`);
      if (divEl) divEl.style.opacity = idx <= grpIdx ? '1' : '0';
    }
    const lblEl = document.getElementById(`lbl-${sid}-${idx}`);
    if (lblEl) {
      const show = idx < grpIdx || (idx === grpIdx && frac >= 0.5);
      lblEl.style.opacity = show ? '1' : '0';
    }
  });
}

/* ── Dashoffset helpers ───────────────────────────────────────── */
function setGroupReveal(sentence, grpIdx, fraction) {
  const sid    = sentence.sentenceId;
  const lineEl = document.getElementById(`line-${sid}-${grpIdx}`);
  if (!lineEl) return;
  const pathLen = parseFloat(lineEl.dataset.pathLen ?? 0);
  lineEl.setAttribute('stroke-dashoffset', String(pathLen * (1 - fraction)));

  // End dot and mid dots appear when nearly complete
  const endDot = document.getElementById(`dot-end-${sid}-${grpIdx}`);
  if (endDot) endDot.setAttribute('opacity', fraction >= 0.95 ? '1' : '0');
  let i = 0;
  while (true) {
    const midDot = document.getElementById(`dot-mid-${sid}-${grpIdx}-${i}`);
    if (!midDot) break;
    midDot.setAttribute('opacity', fraction >= 0.95 ? '0.7' : '0');
    i++;
  }
}

function resetGroupReveals(sentence, activeGrpIdx) {
  sentence.thoughtGroups.forEach((_, idx) => {
    if (idx < activeGrpIdx) setGroupReveal(sentence, idx, 1.0);
    else if (idx > activeGrpIdx) setGroupReveal(sentence, idx, 0.0);
  });
}

/* ── Visual helpers ───────────────────────────────────────────── */
function activateCard(activeSid) {
  state.lesson?.sentences.forEach(s => {
    const card = document.getElementById(`card-${s.sentenceId}`);
    if (card) card.classList.toggle('is-active', s.sentenceId === activeSid);
  });
}

function resetAllVisuals() {
  state.lesson?.sentences.forEach(sentence => {
    const card = document.getElementById(`card-${sentence.sentenceId}`);
    if (card) card.classList.remove('is-active');
    sentence.thoughtGroups.forEach((_, idx) => {
      setGroupReveal(sentence, idx, 0);
      const chipEl = document.getElementById(chipId(sentence.sentenceId, sentence.thoughtGroups[idx].groupId));
      if (chipEl) chipEl.classList.remove('is-active', 'is-spoken', 'is-pulsing');
      if (idx > 0) {
        const divEl = document.getElementById(`div-${sentence.sentenceId}-${idx}`);
        if (divEl) divEl.style.opacity = '0';
      }
      const lblEl = document.getElementById(`lbl-${sentence.sentenceId}-${idx}`);
      if (lblEl) { lblEl.style.transition = 'none'; lblEl.style.opacity = '0'; setTimeout(() => { lblEl.style.transition = 'opacity 0.55s'; }, 30); }
    });
  });
  const progEl = document.getElementById('progress-fill');
  if (progEl) progEl.style.width = '0%';
}

function setContourClipToGroupStart(sentence, grpIdx) {
  resetGroupReveals(sentence, grpIdx);
  setGroupReveal(sentence, grpIdx, 0);
}

function showDividersUpTo(sentence, grpIdx) {
  sentence.thoughtGroups.forEach((_, idx) => {
    if (idx === 0) return;
    const divEl = document.getElementById(`div-${sentence.sentenceId}-${idx}`);
    if (divEl) divEl.style.opacity = idx <= grpIdx ? '1' : '0';
  });
}

function revealLabelsUpTo(sentence, grpIdx) {
  sentence.thoughtGroups.forEach((_, idx) => {
    const lblEl = document.getElementById(`lbl-${sentence.sentenceId}-${idx}`);
    if (!lblEl) return;
    lblEl.style.transition = 'none';
    lblEl.style.opacity    = idx < grpIdx ? '1' : '0';
    setTimeout(() => { lblEl.style.transition = 'opacity 0.55s'; }, 30);
  });
}

function resetChipsForSentence(sentence, activeIdx) {
  sentence.thoughtGroups.forEach((g, idx) => {
    const chipEl = document.getElementById(chipId(sentence.sentenceId, g.groupId));
    if (!chipEl) return;
    chipEl.classList.toggle('is-spoken', idx < activeIdx);
    chipEl.classList.toggle('is-active', idx === activeIdx);
    if (idx > activeIdx) chipEl.classList.remove('is-spoken', 'is-active');
  });
}

/* ── Lifecycle ────────────────────────────────────────────────── */
function endPlayback() {
  clockReset(); state.isPlaying = false; state.mode = 'idle'; stopRaf();
  state.lesson?.sentences.forEach(sentence => {
    const card = document.getElementById(`card-${sentence.sentenceId}`);
    if (card) card.classList.remove('is-active');
    sentence.thoughtGroups.forEach(g => {
      const chipEl = document.getElementById(chipId(sentence.sentenceId, g.groupId));
      if (chipEl) chipEl.classList.remove('is-active', 'is-spoken', 'is-pulsing');
    });
  });
  syncUI();
}

function syncUI() {
  const p = state.isPlaying;
  const btnPlay  = document.getElementById('btn-play');
  const btnPause = document.getElementById('btn-pause');
  if (btnPlay)  btnPlay.disabled  = p;
  if (btnPause) btnPause.disabled = !p;
}

function showLoading(root, show) {
  let el = document.getElementById('loading-msg');
  if (!el && show) {
    el = document.createElement('p');
    el.id = 'loading-msg'; el.className = 'loading-msg';
    el.textContent = 'Loading lesson…'; root.appendChild(el);
  }
  if (el) el.style.display = show ? '' : 'none';
}

function showError(root, msg) {
  if (root) root.innerHTML = `<p id="error-msg" class="error-msg">⚠ ${msg}</p>`;
}

document.addEventListener('DOMContentLoaded', init);