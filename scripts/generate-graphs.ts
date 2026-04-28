// scripts/generate-graphs.ts
// Run with: npx tsx scripts/generate-graphs.ts
import fs from 'fs';
import path from 'path';

interface Node { id: string; label: string; }
interface Edge { source: string; target: string; }
interface GraphData {
  id: string;
  nodes: Node[];
  edges: Edge[];
  groundTruth: {
    T1: { answer: string; rationale: string };
    T2: { nodeA: string; nodeB: string; commonNeighbors: string[] };
    T3: { communities: string[][] };
  };
  stubLengthFraction: number;
}

function generateGraph(id: string, seed: number): GraphData {
  let s = seed;
  function rand(): number {
    // eslint-disable-next-line no-bitwise
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    // eslint-disable-next-line no-bitwise
    return (s >>> 0) / 0xffffffff;
  }

  const comm1Size = 4 + Math.floor(rand() * 3); // 4-6
  const comm2Size = 4 + Math.floor(rand() * 3);

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const comm1: string[] = [];
  const comm2: string[] = [];

  const hubId = 'hub';
  nodes.push({ id: hubId, label: 'H' });

  for (let i = 0; i < comm1Size; i += 1) {
    const nid = `a${i}`;
    nodes.push({ id: nid, label: `A${i}` });
    comm1.push(nid);
  }
  for (let i = 0; i < comm2Size; i += 1) {
    const nid = `b${i}`;
    nodes.push({ id: nid, label: `B${i}` });
    comm2.push(nid);
  }

  // Dense intra-community edges
  for (let i = 0; i < comm1.length; i += 1) {
    for (let j = i + 1; j < comm1.length; j += 1) {
      if (rand() > 0.3) edges.push({ source: comm1[i], target: comm1[j] });
    }
  }
  for (let i = 0; i < comm2.length; i += 1) {
    for (let j = i + 1; j < comm2.length; j += 1) {
      if (rand() > 0.3) edges.push({ source: comm2[i], target: comm2[j] });
    }
  }

  // Hub connects to all nodes in both communities
  [...comm1, ...comm2].forEach((nid) => {
    edges.push({ source: hubId, target: nid });
  });

  // One sparse bridge edge between communities
  const bridgeA = comm1[Math.floor(rand() * comm1.length)];
  const bridgeB = comm2[Math.floor(rand() * comm2.length)];
  edges.push({ source: bridgeA, target: bridgeB });

  const nodeA = comm1[0];
  const nodeB = comm2[0];
  const commonNeighbors = [hubId];

  return {
    id,
    nodes,
    edges,
    groundTruth: {
      T1: {
        answer: hubId,
        rationale: `Hub node connected to all ${comm1Size + comm2Size} other nodes`,
      },
      T2: { nodeA, nodeB, commonNeighbors },
      T3: { communities: [comm1, comm2] },
    },
    stubLengthFraction: 0.25,
  };
}

const POOLS = ['pool-a', 'pool-b', 'pool-c', 'pool-d'] as const;
const GRAPHS_PER_POOL = 15;
const BASE_DIR = path.join(process.cwd(), 'public', 'to-link-or-not', 'graphs');

const trainingGraph = generateGraph('training-g01', 999);
const trainingDir = path.join(BASE_DIR, 'training');
fs.mkdirSync(trainingDir, { recursive: true });
fs.writeFileSync(
  path.join(trainingDir, 'training-g01.json'),
  JSON.stringify(trainingGraph, null, 2),
);
// eslint-disable-next-line no-console
console.log('Written: training/training-g01.json');

POOLS.forEach((pool, poolIdx) => {
  const poolDir = path.join(BASE_DIR, pool);
  fs.mkdirSync(poolDir, { recursive: true });

  for (let i = 0; i < GRAPHS_PER_POOL; i += 1) {
    const graphId = `${pool}-g${String(i + 1).padStart(2, '0')}`;
    const seed = poolIdx * 1000 + i * 37 + 1;
    const graph = generateGraph(graphId, seed);
    const filePath = path.join(poolDir, `${graphId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(graph, null, 2));
    // eslint-disable-next-line no-console
    console.log(`Written: ${pool}/${graphId}.json`);
  }
});

// eslint-disable-next-line no-console
console.log('\nDone. 60 graphs generated across 4 pools.');
