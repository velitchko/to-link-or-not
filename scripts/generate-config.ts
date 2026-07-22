// scripts/generate-config.ts
// Run with: npx tsx scripts/generate-config.ts
import fs from 'fs';
import path from 'path';

const STUDY_NAME = 'to-link-or-not';
const GRAPHS_DIR = path.join(process.cwd(), 'public', STUDY_NAME, 'graphs');
const CONFIG_OUT = path.join(process.cwd(), 'public', STUDY_NAME, 'config.json');

type Condition = 'traditional' | 'no-link' | 'on-demand' | 'stubs';
type TaskType = 'T1' | 'T2' | 'T3';
type RevisitCorrectAnswer = { id: string; answer: string };

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
  T3: 'Identify and select the largest cluster you see',
};

const TASKS: TaskType[] = ['T1', 'T2', 'T3'];
const LFR_CONDITION_DIRS = ['condition_1', 'condition_2', 'condition_3', 'condition_4'] as const;

function nodeLinkTrialResponses() {
  return [
    {
      id: 'task-answer', prompt: 'Your answer', type: 'reactive',
    },
    {
      id: 'isCorrect', prompt: 'Correct answer?', type: 'reactive', hidden: true, required: false,
    },
    {
      id: 'responseTimeMs', prompt: 'Response time (ms)', type: 'reactive', hidden: true, required: false,
    },
    {
      id: 'condition', prompt: 'Link visibility condition', type: 'reactive', hidden: true, required: false,
    },
    {
      id: 'task', prompt: 'Task', type: 'reactive', hidden: true, required: false,
    },
    {
      id: 'graphId', prompt: 'Graph ID', type: 'reactive', hidden: true, required: false,
    },
    {
      id: 'selectedNodes', prompt: 'Selected nodes', type: 'reactive', hidden: true, required: false,
    },
    {
      id: 'selectedNodeCount', prompt: 'Selected node count', type: 'reactive', hidden: true, required: false,
    },
    {
      id: 'groundTruthSnapshot', prompt: 'Ground truth snapshot', type: 'reactive', hidden: true, required: false,
    },
    {
      id: 'metrics', prompt: 'Task metrics', type: 'reactive', hidden: true, required: false,
    },
    {
      id: 'interactionsUsed', prompt: 'Interactions used', type: 'reactive', hidden: true, required: false,
    },
    {
      id: 'study-trial-note',
      prompt: 'No feedback is shown during real study trials. After submitting, click Next to continue.',
      type: 'textOnly',
    },
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
  return [
    ...nodeLinkTrialResponses().filter((response) => response.id !== 'comment' && response.id !== 'study-trial-note'),
    {
      id: 'training-feedback-note',
      prompt: 'Training task: after you submit, the diagram will show feedback so you can learn the interaction.',
      type: 'textOnly',
    },
  ];
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

function correctAnswerForTask(graph: Record<string, unknown>, task: TaskType): RevisitCorrectAnswer[] {
  const groundTruth = graph.groundTruth as Record<TaskType, { correctAnswer?: RevisitCorrectAnswer[] }> | undefined;
  const correctAnswer = groundTruth?.[task]?.correctAnswer;
  if (!correctAnswer) {
    throw new Error(`Missing ReVISit correctAnswer metadata for ${String(graph.id)} ${task}`);
  }
  return correctAnswer;
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
  const graph = loadGraph(graphRelPath);
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
      correctAnswer: correctAnswerForTask(graph, task),
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
      `condition-debrief-${condition}`,
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

const NASA_TLX_MARKS = Array.from({ length: 21 }, (_, index) => {
  const value = index * 5;
  return {
    label: value === 0 ? 'Low' : value === 100 ? 'High' : '',
    value,
  };
});

function nasaTlxItems(condition: Condition) {
  const dimensions = [
    {
      id: 'mental-demand',
      prompt: 'Mental Demand',
      secondaryText: 'How much mental and perceptual effort did you spend?',
      options: NASA_TLX_MARKS,
    },
    {
      id: 'physical-demand',
      prompt: 'Physical Demand',
      secondaryText: 'How much physical effort did you spend?',
      options: NASA_TLX_MARKS,
    },
    {
      id: 'temporal-demand',
      prompt: 'Temporal Demand',
      secondaryText: 'How much time pressure did you feel in order to complete this?',
      options: NASA_TLX_MARKS,
    },
    {
      id: 'performance',
      prompt: 'Performance',
      secondaryText: 'How successful do you think you were in accomplishing what you were asked to do? (notice the direction of this scale)',
      options: NASA_TLX_MARKS.map((option) => ({
        ...option,
        label: option.value === 0 ? 'Good' : option.value === 100 ? 'Poor' : option.label,
      })),
    },
    {
      id: 'effort',
      prompt: 'Effort',
      secondaryText: 'How hard did you have to work to accomplish your level of performance?',
      options: NASA_TLX_MARKS,
    },
    {
      id: 'frustration',
      prompt: 'Frustration',
      secondaryText: 'How irritated, stressed, discouraged, and annoyed were you?',
      options: NASA_TLX_MARKS,
    },
  ];

  return dimensions.map((dimension) => ({
    id: `${condition}-${dimension.id}`,
    type: 'slider',
    tlxStyle: true,
    withBar: false,
    prompt: dimension.prompt,
    secondaryText: dimension.secondaryText,
    options: dimension.options,
    step: 1,
    startingValue: 50,
    required: true,
  }));
}

function nasaTlxComponent(condition: Condition): object {
  const conditionReminder = CONDITION_REMINDERS[condition];

  return {
    type: 'markdown',
    path: 'libraries/nasa-tlx/assets/tlx.md',
    response: nasaTlxItems(condition),
    description: `NASA-TLX workload evaluation for ${conditionReminder}`,
  };
}

function conditionDebriefComponent(condition: Condition): object {
  const conditionReminder = CONDITION_REMINDERS[condition];

  return {
    type: 'questionnaire',
    description: `Strategy debrief for ${conditionReminder}`,
    response: [
      {
        id: `${condition}-strategy`,
        prompt: `For ${CONDITION_LABELS[condition]}, could you step me through exactly how you solved the tasks?`,
        type: 'longText',
        placeholder: 'Describe what you looked for, how you made selections, and anything that changed across the three task types.',
        required: true,
      },
    ],
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
        id: 'age-group',
        prompt: 'What is your age group?',
        type: 'dropdown',
        options: [
          '18-24',
          '25-34',
          '35-44',
          '45-54',
          '55-64',
          '65 or older',
          'Prefer not to say',
        ],
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
        prompt: 'How often do you use or read network/graph visualizations?',
        type: 'likert',
        numItems: 5,
        leftLabel: '1 - I do not use them at all',
        rightLabel: '5 - I use them daily',
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
    correctAnswer: correctAnswerForTask(trainingGraphData, 'T1'),
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
    correctAnswer: correctAnswerForTask(trainingGraphData, 'T1'),
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
    correctAnswer: correctAnswerForTask(trainingGraphData, 'T1'),
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
    correctAnswer: correctAnswerForTask(trainingGraphData, 'T1'),
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
  'condition-debrief-traditional': conditionDebriefComponent('traditional'),
  'condition-debrief-no-link': conditionDebriefComponent('no-link'),
  'condition-debrief-on-demand': conditionDebriefComponent('on-demand'),
  'condition-debrief-stubs': conditionDebriefComponent('stubs'),
  'nasa-tlx-traditional': nasaTlxComponent('traditional'),
  'nasa-tlx-no-link': nasaTlxComponent('no-link'),
  'nasa-tlx-on-demand': nasaTlxComponent('on-demand'),
  'nasa-tlx-stubs': nasaTlxComponent('stubs'),
  debrief: {
    type: 'questionnaire',
    response: [
      {
        id: 'reflection',
        prompt: 'Final thoughts',
        type: 'longText',
        placeholder: 'Share anything else you noticed about the representations, tasks, or study.',
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
