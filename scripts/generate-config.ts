// scripts/generate-config.ts
// Run with: npx tsx scripts/generate-config.ts
import fs from 'fs';
import path from 'path';

const STUDY_NAME = 'to-link-or-not';
const GRAPHS_DIR = path.join(process.cwd(), 'public', STUDY_NAME, 'graphs');
const CONFIG_OUT = path.join(process.cwd(), 'public', STUDY_NAME, 'config.json');

type Condition = 'traditional' | 'no-link' | 'on-demand' | 'stubs';
type TaskType = 'T1' | 'T2' | 'T3';

type LfrConditionDir = 'condition_1' | 'condition_2' | 'condition_3' | 'condition_4';

const LFR_CONDITION_TO_STUDY_CONDITION: Record<LfrConditionDir, Condition> = {
  condition_1: 'traditional',
  condition_2: 'no-link',
  condition_3: 'on-demand',
  condition_4: 'stubs',
};

const TASK_PROMPTS: Record<TaskType, string> = {
  T1: 'Which node do you think is the most important (well-connected) in this network?',
  T2: 'Select all nodes that are common neighbors of the two highlighted (orange) nodes.',
  T3: 'Click all nodes that you perceive as belonging to the same group or cluster.',
};

const TASKS: TaskType[] = ['T1', 'T2', 'T3'];
const LFR_CONDITION_DIRS = ['condition_1', 'condition_2', 'condition_3', 'condition_4'] as const;

function nodeLinkTrialResponses() {
  return [
    { id: 'task-answer', prompt: 'Your answer', type: 'reactive' },
    { id: 'isCorrect', prompt: 'Correct answer?', type: 'reactive', hidden: true, required: false },
    { id: 'responseTimeMs', prompt: 'Response time (ms)', type: 'reactive', hidden: true, required: false },
    { id: 'condition', prompt: 'Link visibility condition', type: 'reactive', hidden: true, required: false },
    { id: 'task', prompt: 'Task', type: 'reactive', hidden: true, required: false },
    { id: 'graphId', prompt: 'Graph ID', type: 'reactive', hidden: true, required: false },
    { id: 'selectedNodes', prompt: 'Selected nodes', type: 'reactive', hidden: true, required: false },
    { id: 'selectedNodeCount', prompt: 'Selected node count', type: 'reactive', hidden: true, required: false },
    { id: 'groundTruthSnapshot', prompt: 'Ground truth snapshot', type: 'reactive', hidden: true, required: false },
    { id: 'metrics', prompt: 'Task metrics', type: 'reactive', hidden: true, required: false },
    { id: 'interactionsUsed', prompt: 'Interactions used', type: 'reactive', hidden: true, required: false },
    {
      id: 'comment',
      prompt: 'Describe your reasoning or mental image of the network.',
      type: 'longText',
      placeholder: 'Type your thoughts here...',
      required: false,
    },
  ];
}

function nodeLinkTrainingResponses() {
  return nodeLinkTrialResponses().filter((response) => response.id !== 'comment');
}

function getGraphFiles(conditionDir: LfrConditionDir): string[] {
  const dir = path.join(GRAPHS_DIR, 'lfr', conditionDir);
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
    .map((f) => `${STUDY_NAME}/graphs/lfr/${conditionDir}/${f}`);
}

function loadGraph(graphRelPath: string): Record<string, unknown> {
  const absPath = path.join(process.cwd(), 'public', graphRelPath);
  return JSON.parse(fs.readFileSync(absPath, 'utf-8'));
}

function graphPlaceholder(graphRelPath: string): object {
  const graph = loadGraph(graphRelPath);
  return {
    id: graph.id ?? path.basename(graphRelPath, '.json'),
    nodes: [],
    edges: [],
    groundTruth: graph.groundTruth,
    stubLengthFraction: graph.stubLengthFraction,
  };
}

function trialComponent(graphRelPath: string, task: TaskType, condition: Condition) {
  const graphId = path.basename(graphRelPath, '.json');
  const key = `${condition}-${task}-${graphId}`;
  return {
    key,
    def: {
      baseComponent: 'node-link-trial',
      parameters: {
        condition,
        graph: graphPlaceholder(graphRelPath),
        task,
        taskPrompt: TASK_PROMPTS[task],
        graphPath: graphRelPath,
      },
    },
  };
}

function conditionBlock(conditionDir: LfrConditionDir): { componentDefs: Record<string, object>; inlineBlock: object } {
  const condition = LFR_CONDITION_TO_STUDY_CONDITION[conditionDir];
  const graphFiles = getGraphFiles(conditionDir);
  const componentDefs: Record<string, object> = {};
  const graphGroups: object[] = [];

  for (const graphRelPath of graphFiles) {
    const taskComponentKeys: string[] = [];

    for (const task of TASKS) {
      const { key, def } = trialComponent(graphRelPath, task, condition);
      componentDefs[key] = def;
      taskComponentKeys.push(key);
    }

    graphGroups.push({ order: 'random', components: taskComponentKeys });
  }

  const inlineBlock = {
    order: 'fixed',
    components: [
      `intro-${condition}`,
      { order: 'random', numSamples: 3, components: graphGroups },
      `nasa-tlx-${condition}`,
    ],
  };

  return { componentDefs, inlineBlock };
}

const CONDITION_LABELS: Record<Condition, string> = {
  traditional: 'Traditional links',
  'no-link': 'No links',
  'on-demand': 'On-demand links',
  stubs: 'Link stubs',
};

const CONDITION_DESCRIPTIONS: Record<Condition, string> = {
  traditional: 'All connections are shown as solid lines throughout the task.',
  'no-link': 'No connection lines are drawn; use the node positions and layout alone.',
  'on-demand': 'Connections are hidden by default and appear only when hovering over a node.',
  stubs: 'Short partial edge stubs show the number and direction of connections without drawing full links.',
};

const CONDITION_REMINDERS: Record<Condition, string> = {
  traditional: `${CONDITION_LABELS.traditional}: ${CONDITION_DESCRIPTIONS.traditional}`,
  'no-link': `${CONDITION_LABELS['no-link']}: ${CONDITION_DESCRIPTIONS['no-link']}`,
  'on-demand': `${CONDITION_LABELS['on-demand']}: ${CONDITION_DESCRIPTIONS['on-demand']}`,
  stubs: `${CONDITION_LABELS.stubs}: ${CONDITION_DESCRIPTIONS.stubs}`,
};

function nasaTlxItems(condition: Condition) {
  const conditionReminder = CONDITION_REMINDERS[condition];
  const dimensions = [
    { id: 'mental-demand', label: 'Mental Demand' },
    { id: 'temporal-demand', label: 'Temporal Demand' },
    { id: 'performance', label: 'Performance' },
    { id: 'effort', label: 'Effort' },
    { id: 'frustration', label: 'Frustration' },
  ];
  return [
    ...dimensions.map((d) => ({
      id: `${condition}-${d.id}`,
      prompt: `${d.label}: How much ${d.id.replace('-', ' ')} was required?`,
      type: 'likert',
      numItems: 7,
      leftLabel: 'Very Low',
      rightLabel: 'Very High',
      required: true,
    })),
    {
      id: `${condition}-open-comment`,
      prompt: `Any thoughts about this representation condition (${conditionReminder})?`,
      type: 'longText',
      required: false,
    },
  ];
}

function nasaTlxComponent(condition: Condition): object {
  return {
    type: 'questionnaire',
    response: nasaTlxItems(condition),
    description: `Condition: ${CONDITION_LABELS[condition]}. ${CONDITION_DESCRIPTIONS[condition]}`,
  };
}

const allComponentDefs: Record<string, object> = {};
const conditionInlineBlocks: object[] = [];

for (const conditionDir of LFR_CONDITION_DIRS) {
  const { componentDefs, inlineBlock } = conditionBlock(conditionDir);
  Object.assign(allComponentDefs, componentDefs);
  conditionInlineBlocks.push(inlineBlock);
}

const trainingGraphData = loadGraph(`${STUDY_NAME}/graphs/training/training-g01.json`);

const staticComponents: Record<string, object> = {
  consent: {
    type: 'markdown',
    path: `${STUDY_NAME}/consent.md`,
    nextButtonText: 'I Agree',
    response: [],
  },
  demographics: {
    type: 'questionnaire',
    response: [
      {
        id: 'age',
        prompt: 'What is your age?',
        type: 'numerical',
        min: 18,
        max: 99,
        required: true,
      },
      {
        id: 'gender',
        prompt: 'What is your gender?',
        type: 'dropdown',
        options: ['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Other'],
        required: true,
      },
      {
        id: 'education',
        prompt: 'What is your highest level of education?',
        type: 'dropdown',
        options: [
          'High school',
          'Bachelor\'s degree',
          'Master\'s degree',
          'PhD or higher',
          'Other',
        ],
        required: true,
      },
      {
        id: 'vis-experience',
        prompt: 'How experienced are you with reading network/graph visualizations?',
        type: 'likert',
        numItems: 5,
        leftLabel: 'No experience',
        rightLabel: 'Expert',
        required: true,
      },
    ],
  },
  'study-overview': {
    type: 'markdown',
    path: `${STUDY_NAME}/overview.md`,
    response: [],
  },
  'training-traditional': {
    type: 'react-component',
    path: `${STUDY_NAME}/assets/NodeLinkDiagram.tsx`,
    recordAudio: false,
    parameters: {
      condition: 'traditional',
      graph: trainingGraphData,
      task: 'T1',
      taskPrompt: '[TRAINING] Traditional view: all connections shown as lines. Which node looks most connected?',
      isTraining: true,
    },
    response: nodeLinkTrainingResponses(),
  },
  'training-no-link': {
    type: 'react-component',
    path: `${STUDY_NAME}/assets/NodeLinkDiagram.tsx`,
    recordAudio: false,
    parameters: {
      condition: 'no-link',
      graph: trainingGraphData,
      task: 'T1',
      taskPrompt: '[TRAINING] No-link view: only nodes shown. Which node looks most important?',
      isTraining: true,
    },
    response: nodeLinkTrainingResponses(),
  },
  'training-on-demand': {
    type: 'react-component',
    path: `${STUDY_NAME}/assets/NodeLinkDiagram.tsx`,
    recordAudio: false,
    parameters: {
      condition: 'on-demand',
      graph: trainingGraphData,
      task: 'T1',
      taskPrompt: '[TRAINING] On-demand view: hover over a node to see its connections. Which node looks most connected?',
      isTraining: true,
    },
    response: nodeLinkTrainingResponses(),
  },
  'training-stubs': {
    type: 'react-component',
    path: `${STUDY_NAME}/assets/NodeLinkDiagram.tsx`,
    recordAudio: false,
    parameters: {
      condition: 'stubs',
      graph: trainingGraphData,
      task: 'T1',
      taskPrompt: '[TRAINING] Stub view: short lines indicate connections. Which node has most stubs?',
      isTraining: true,
    },
    response: nodeLinkTrainingResponses(),
  },
  'intro-traditional': {
    type: 'markdown',
    path: `${STUDY_NAME}/intro-traditional.md`,
    response: [],
  },
  'intro-no-link': {
    type: 'markdown',
    path: `${STUDY_NAME}/intro-no-link.md`,
    response: [],
  },
  'intro-on-demand': {
    type: 'markdown',
    path: `${STUDY_NAME}/intro-on-demand.md`,
    response: [],
  },
  'intro-stubs': {
    type: 'markdown',
    path: `${STUDY_NAME}/intro-stubs.md`,
    response: [],
  },
  'nasa-tlx-traditional': nasaTlxComponent('traditional'),
  'nasa-tlx-no-link': nasaTlxComponent('no-link'),
  'nasa-tlx-on-demand': nasaTlxComponent('on-demand'),
  'nasa-tlx-stubs': nasaTlxComponent('stubs'),
  debrief: {
    type: 'questionnaire',
    response: [
      {
        id: 'preference-1st',
        prompt: 'Which representation did you find most useful overall?',
        type: 'dropdown',
        options: [
          'Traditional (all links)',
          'No-link (nodes only)',
          'On-demand (hover)',
          'Stubs',
        ],
        required: true,
      },
      {
        id: 'preference-least',
        prompt: 'Which representation did you find least useful overall?',
        type: 'dropdown',
        options: [
          'Traditional (all links)',
          'No-link (nodes only)',
          'On-demand (hover)',
          'Stubs',
        ],
        required: true,
      },
      {
        id: 'reflection',
        prompt: 'Any final thoughts or comments about the representations?',
        type: 'longText',
        required: false,
      },
    ],
  },
  'screen-recording-permission': {
    description: 'Get permission to start screen recording',
    type: 'react-component',
    path: 'libraries/screen-recording/assets/ScreenRecording.tsx',
    nextButtonLocation: 'belowStimulus',
    nextButtonText: 'Continue',
    recordAudio: false,
    response: [
      {
        hidden: true,
        type: 'reactive',
        id: 'screenRecordingPermission',
        prompt: 'Screen recording enabled',
      },
    ],
  },
};

const config = {
  $schema: 'https://raw.githubusercontent.com/revisit-studies/study/main/src/parser/StudyConfigSchema.json',
  studyMetadata: {
    title: 'To Link or Not',
    version: '1.0.0',
    authors: ['Velitchko Filipov'],
    date: '2026-04-22',
    description: 'How does link visibility affect cognitive maps of node-link diagrams?',
    organizations: ['TU Wien'],
  },
  uiConfig: {
    contactEmail: 'velitchko.filipov@tuwien.ac.at',
    helpTextPath: `${STUDY_NAME}/help.md`,
    logoPath: `${STUDY_NAME}/logo.svg`,
    withProgressBar: true,
    autoDownloadStudy: false,
    withSidebar: false,
    recordAudio: true,
    recordScreen: true,
    recordScreenFPS: 8,
  },
  baseComponents: {
    'node-link-trial': {
      type: 'react-component',
      path: `${STUDY_NAME}/assets/NodeLinkDiagram.tsx`,
      recordAudio: true,
      recordScreen: true,
      parameters: {
        condition: 'traditional',
        graph: {},
        task: 'T1',
        taskPrompt: '',
      },
      response: nodeLinkTrialResponses(),
    },
  },
  components: {
    ...staticComponents,
    ...allComponentDefs,
  },
  sequence: {
    order: 'fixed',
    components: [
      'consent',
      'demographics',
      'study-overview',
      'screen-recording-permission',
      {
        order: 'fixed',
        components: ['training-traditional', 'training-no-link', 'training-on-demand', 'training-stubs'],
      },
      {
        order: 'latinSquare',
        components: conditionInlineBlocks,
      },
      'debrief',
    ],
  },
};

fs.writeFileSync(CONFIG_OUT, `${JSON.stringify(config, null, 2)}\n`);
console.warn(`Config written to ${CONFIG_OUT}`);
console.warn(`Total component definitions: ${Object.keys(config.components).length}`);
