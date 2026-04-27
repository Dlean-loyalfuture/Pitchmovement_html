/**
 * ui-content.js — 静态 UI 文本配置
 * 4.21 更新：精简概念区、新增 LEARNING_STEPS、TASK_PROMPT
 */

'use strict';

export const INSTRUCTIONS =
  'Listen to each thought group. Notice where the pitch moves — and why.';

export const CONTROLS = {
  playAll:  'Play all',
  pause:    'Pause',
  continue: 'Continue',
};

export const LEARNING_STEPS = {
  heading: 'How to use this page',
  steps: [
    {
      number: '1',
      label: 'Review key ideas',
      detail: 'Skim the quick reference below — thought groups, pitch movement, focus words.',
    },
    {
      number: '2',
      label: 'Listen to the passage',
      detail: 'Press <strong>Play all</strong> and follow the pitch contours as they animate.',
    },
    {
      number: '3',
      label: 'Analyse 3–4 thought groups',
      detail: 'Click any group to replay it. Hover to see start / focus / end breakdown.',
    },
  ],
};

export const LEARNING_STEPS_SIDEBAR = [
  { number: '1', label: 'Review' },
  { number: '2', label: 'Listen' },
  { number: '3', label: 'Analyse' },
];

export const CONCEPT_PANEL = {
  thoughtGroup: {
    title: 'Quick reference',
    items: [
      {
        term: 'Thought group',
        def: 'A chunk of words spoken as one unit of meaning, separated by a brief pause.',
      },
      {
        term: 'Focus word',
        def: 'The most prominent word in a thought group — where emphasis lands.',
      },
      {
        term: 'Pitch movement',
        def: 'How pitch changes at the end of a thought group: falling signals completion; rising signals continuation or a question.',
      },
    ],
  },
  pitchMovement: {
    title: '',
    types: [
      { key: 'falling', badge: '↓ falling', desc: '' },
      { key: 'rising',  badge: '↑ rising',  desc: '' },
      { key: 'level',   badge: '— level',   desc: '' },
    ],
  },
};

export const PITCH_TOOLTIPS = {
  rising:  'Pitch moves upward — yes/no questions, list continuations, non-final clauses.',
  falling: 'Pitch moves downward — signals completion or certainty.',
  level:   'Pitch stays relatively flat — often signals continuation.',
};

export const ANALYSIS_LABELS = {
  start: 'Start',
  focus: 'Focus',
  end:   'End',
};

export const TASK_PROMPT = {
  heading: 'Your task',
  body:
    'Choose <strong>3–4 thought groups</strong> from the passage. ' +
    'For each one, think about its the pitch movement and why the speaker made that choice. And then hover on each thought group and reply to test your idea.',
};

export const SOURCE_CONTEXT = {
  heading: 'About this passage',
  body:
    '<strong>Emotional intelligence</strong> (EQ) is the ability to recognise, understand, and manage your own emotions — and to read and influence the emotions of others. ' +
    'This excerpt is from a TEDx talk by Ramona Hacker: ' +
    '<a href="https://youtu.be/D6_J7FfgWVc?si=EBaVGK5bH85_sX58" target="_blank" rel="noopener"><em>6 Steps to Improve Your Emotional Intelligence</em> · TEDxTUM</a>.',
};

export const LEGEND = [
 
];