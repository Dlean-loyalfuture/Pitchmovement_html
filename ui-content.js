/**
 * ui-content.js — 静态 UI 文本配置
 *
 * 所有面向用户的文字、描述、图例标签都集中在这里。
 * 修改界面文字时只需编辑此文件，不需要动 renderers.js 或 app.js。
 *
 * 结构说明：
 *   INSTRUCTIONS      — 页面顶部操作提示
 *   CONTROLS          — 播放控制区按钮文字
 *   CONCEPT_PANEL     — 概念面板（thought group 说明 + pitch movement 类型）
 *   PITCH_TOOLTIPS    — 每种 pitch 类型的通用 hover 描述
 *   LEGEND            — 图例文字
 */

'use strict';

/* ─── 页面顶部操作提示 ──────────────────────────────────────────── */
export const INSTRUCTIONS =
  'Press <strong>Play all</strong> to hear the full passage, ' +
  'or <strong>click any thought group</strong> to hear just that part.';

/* ─── 播放控制区 ────────────────────────────────────────────────── */
export const CONTROLS = {
  playAll:  'Play all',
  pause:    'Pause',
  replay:   'Replay',
};

/* ─── 概念面板 ──────────────────────────────────────────────────── */
export const CONCEPT_PANEL = {

  // Section 1 — What is a thought group
  thoughtGroup: {
    title: 'What is a thought group?',
    description:
      'A <strong>thought group</strong> is a meaningful chunk of speech — words that belong ' +
      'together and are processed as one unit. Each thought group is spoken in a continuous ' +
      'line of melody and ends with a <strong>pitch movement</strong>. ' +
      'Pauses between thought groups signal boundaries between ideas.',
    facts: [
      {
        icon: '⏸',
        text: 'Pauses of ½–2 seconds between groups — longer pauses draw more attention to content.',
      },
      {
        icon: '📏',
        text: 'Usually 1–15 words. Shorter groups = more important or unfamiliar content.',
      },
      {
        icon: '🎵',
        text: 'No break in melody within a group; the pitch movement comes at the end.',
      },
    ],
  },

  // Section 2 — Pitch movement types
  pitchMovement: {
    title: 'Pitch movement at the end of thought groups',
    types: [
      {
        key:   'falling',
        badge: '↓ falling',
        desc:  'Signals conclusion or certainty. Used at the end of statements, ' +
               'completed ideas, and answers that are definitive.',
      },
      {
        key:   'rising',
        badge: '↑ rising  (low)',
        desc:  'Signals continuation or uncertainty — the thought is not yet complete. ' +
               'Common before a pause mid-sentence or in lists.',
      },
      {
        key:   'rising',
        badge: '↑ rising  (high)',
        desc:  "Signals a question, strong emotion, or an appeal for the listener's response. " +
               'Typical in yes/no questions.',
      },
      {
        key:   'level',
        badge: '— level',
        desc:  'Pitch stays relatively flat. Often heard mid-thought, in hesitations, ' +
               'or when reading lists without strong emphasis.',
      },
    ],
  },
};

/* ─── Hover Tooltip 描述（按 pitch 类型） ───────────────────────── */
export const PITCH_TOOLTIPS = {
  rising:
    'Pitch moves upward — common in yes/no questions, list continuations, and non-final clauses.',
  falling:
    'Pitch moves downward — signals completion or certainty. ' +
    'Typical at the end of declarative sentences.',
  level:
    'Pitch stays relatively flat — often signals continuation or a list.',
};

/* ─── 图例 ──────────────────────────────────────────────────────── */
export const LEGEND = [
  { type: 'swatch', color: '#e07b00', label: 'Rising'      },
  { type: 'swatch', color: '#1a6b36', label: 'Falling'     },
  { type: 'swatch', color: '#888780', label: 'Level'       },
  { type: 'box',                      label: 'Active group' },
  { type: 'click',                    label: 'Click to replay' },
];
