// @flow

import _ from 'lodash';
import { getNonEmptyChildren, number, parseHtml, isElement, isTextNode, isOptional } from './utils';
import type { DomNode, ElementDomNode } from './utils';
import { untemplate } from './untemplate';

// constants
const TIE_BREAKER = 1.000001; // biases the optimization to more intuitive templates

// types
type AddInstruction = {
  type: 'add a' | 'add b',
  source: number,
};
type JoinInstruction = {
  type: 'join',
  source: number,
  target: number,
};
type ModifyInstruction = {
  type: 'modify',
  source: number,
  target: number,
  script: Script,
};
type Instruction = AddInstruction | JoinInstruction | ModifyInstruction;
type Script = Instruction[];
type NormalMove = { direction: 'none' | 'left' | 'above' };
type DiagonalMove = {
  direction: 'diagonal',
  script: Script,
};
type Move = NormalMove | DiagonalMove;
type AnnotatedTree = {
  type: string,
  children: AnnotatedTree[],
};
type LossAndScript = {
  loss: number,
  script: Script,
};
type VerboseDslInfo = {
  maximalDsl: string,
  consolidatedValues: { [string]: string },
  dslWithLiterals: string,
};

export function deduceTemplate(examples: string[]): string {
  const info = deduceTemplateVerbose((examples: string[]));
  return info.dslWithLiterals;
}

export function deduceTemplateVerbose(examples: string[]): VerboseDslInfo {
  const trees = examples.map(ex => {
    return number(countDescendants(annotateTree(parseHtml(ex))));
  });
  const deducedStructure = reconcileTrees(trees);
  const structureWithProperties = treeWithPropertySelectors(deducedStructure);
  const maximalDsl = convertTreeToString(structureWithProperties);
  const exampleValues = examples.map(ex => parseHtml(ex)).filter(dom => isElement(dom)).map(dom => {
    const dom_: ElementDomNode = (dom: any);
    return untemplate(maximalDsl, dom_);
  });
  const consolidatedValues = consolidateValues(
    exampleValues.map(value => {
      // assumption: maximalDsl matches exactly once in each example
      return value[0];
    })
  );
  const template = insertValuesIntoProperties(structureWithProperties, consolidatedValues);
  const dslWithLiterals = convertTreeToString(template);
  return { maximalDsl, consolidatedValues, dslWithLiterals };
}

function annotateTree(element): AnnotatedTree {
  const element_: ElementDomNode = (element: any);
  const children = getNonEmptyChildren(element_).filter(a => isElement(a)).map(annotateTree);
  return {
    type: element_.tagName.toLowerCase(),
    children: children,
  };
}

// postcondition: returns a new tree that's a copy with the following field
// - numDescendants: number of nodes with this node as an ancestor
function countDescendants(tree: AnnotatedTree) {
  const treeWithDescendants = _.clone(tree);
  treeWithDescendants.children = treeWithDescendants.children.map(countDescendants);
  if (treeWithDescendants.children.length === 0) {
    treeWithDescendants.numDescendants = 0;
  } else {
    treeWithDescendants.numDescendants = treeWithDescendants.children.reduce((total, child) => {
      return total + child.numDescendants;
    }, treeWithDescendants.children.length);
  }
  return treeWithDescendants;
}

// postconditions:
// - returns a tree
// - throws UnresolveableExamplesError if the supplied trees are irreconcilable
function reconcileTrees(trees: AnnotatedTree[]) {
  if (trees.length === 0) throw new UnresolveableExamplesError();
  if (trees.length === 1) return trees[0];

  return trees.reduce(reconcileTwoTrees);
}

function reconcileTwoTrees(treeA: AnnotatedTree, treeB: AnnotatedTree) {
  // low hanging fruit
  const A = _.cloneDeep(treeA);
  const B = _.cloneDeep(treeB);
  if (treesAreSame(A, B)) {
    return A;
  } else if (!hasSameRoot(A, B)) {
    throw new UnresolveableExamplesError();
  } else {
    // much higher hanging fruit
    const minLossAndEditScript = getLoss(A, B);
    const reconciliation = applyScriptToTrees(A, B, minLossAndEditScript.script);
    return reconciliation;
  }
}

function getLoss(A, B): LossAndScript {
  // init pi table
  const { pi, moves } = initEditScriptDpTables(A, B);

  // populate the pi table
  const m = A.children.length;
  const n = B.children.length;
  for (let i = 0; i < m; i++) {
    const aChild = A.children[i];
    for (let j = 0; j < n; j++) {
      const bChild = B.children[j];
      const updateLossAndScript = getLoss(aChild, bChild);
      // TODO: don't recurse if pi[i][j] === Infinity
      const lossFromUpdating = pi[i][j] + TIE_BREAKER * updateLossAndScript.loss;
      const lossFromAddingA = pi[i][j + 1] + aChild.numDescendants + 1;
      const lossFromAddingB = pi[i + 1][j] + bChild.numDescendants + 1;
      pi[i + 1][j + 1] = Math.min(lossFromUpdating, lossFromAddingA, lossFromAddingB);
      if (lossFromUpdating < Math.min(lossFromAddingA, lossFromAddingB)) {
        moves[i + 1][j + 1] = { direction: 'diagonal', script: updateLossAndScript.script };
      } else if (lossFromAddingA < lossFromAddingB) {
        moves[i + 1][j + 1] = { direction: 'above' };
      } else {
        moves[i + 1][j + 1] = { direction: 'left' };
      }
    }
  }

  return { loss: pi[m][n], script: recoverEditScriptFromTables(pi, moves) };
}

function initEditScriptDpTables(A, B) {
  const m = A.children.length;
  const n = B.children.length;
  const pi = []; // pi_ij = ith in A and jth in B
  const moves = []; // predecessors of the pi table
  for (let i = 0; i < m + 1; i++) {
    pi.push([]), moves.push([]);
    for (let j = 0; j < n + 1; j++) {
      pi[i].push(0);
      moves[i].push({ direction: 'none' });
    }
  }
  if (A.type !== B.type) pi[0][0] = Infinity;

  for (let i = 0; i < m; i++) {
    pi[i + 1][0] = pi[i][0] + A.children[i].numDescendants + 1;
    moves[i + 1][0] = { direction: 'above' };
  }
  for (let j = 0; j < n; j++) {
    pi[0][j + 1] = pi[0][j] + B.children[j].numDescendants + 1;
    moves[0][j + 1] = { direction: 'left' };
  }
  return { pi: pi, moves: moves };
}

function recoverEditScriptFromTables(pi, moves: Move[][]): Script {
  // recover the edit script from the predecessor tables
  const script: Instruction[] = [];
  let I = pi.length - 1,
    J = pi[0].length - 1;
  while (I !== 0 || J !== 0) {
    const predecessor: Move = moves[I][J];
    if (predecessor.direction === 'above') {
      script.unshift(makeEditScriptStep('add a', --I));
    } else if (predecessor.direction === 'left') {
      script.unshift(makeEditScriptStep('add b', --J));
    } else if (predecessor.direction === 'diagonal') {
      const diagonalMove: DiagonalMove = (predecessor: any);
      script.unshift(makeEditScriptStep('modify', --I, --J, diagonalMove.script));
    } else {
      throw new Error('unexpected movement direction');
    }
  }

  return script;
}

function makeEditScriptStep(type, source: number, target?: number, script?): Instruction {
  if (arguments.length === 4) {
    const target_: number = (target: any);
    const script_: Script = (script: any);
    if (script_.length === 0) {
      return makeJoinInstruction(source, target_);
    } else {
      const optimizedScript = optimizeScript(script_);
      if (optimizedScript.length === 0) {
        return makeJoinInstruction(source, target_);
      } else {
        return makeModifyInstruction(source, target_, script_);
      }
    }
  } else {
    return makeAddInstruction(type, source);
  }
}

function makeAddInstruction(type, source): AddInstruction {
  if (type === 'add a' || type === 'add b') {
    return { type, source };
  } else {
    throw new Error('unexpected add instruction type');
  }
}

function makeJoinInstruction(source, target): JoinInstruction {
  return { type: 'join', source, target };
}

function makeModifyInstruction(source, target, script): ModifyInstruction {
  return { type: 'modify', source, target, script };
}

function optimizeScript(script) {
  const numNonJoins = script.filter(x => x.type !== 'join').length;
  return numNonJoins === 0 ? [] : script;
}

// preconditions:
// - treeA.type === treeB.type
// - script was created for the context of treeA and treeB
function applyScriptToTrees(treeA, treeB, script: Script) {
  const A = _.cloneDeep(treeA);
  const B = _.cloneDeep(treeB);
  const children = [];
  const reconciliation = {
    type: A.type,
    children: [],
    optional: A.optional || B.optional,
  };
  for (let i = 0; i < script.length; i++) {
    _applyScriptInstruction(reconciliation, A, B, script[i]);
  }
  return number(countDescendants(reconciliation));
}

// NOTE: this should be used exclusively as a helper for #applyScriptToTrees
// postconditions:
// - modifies the input tree** by the given instruction
// - also modifies trees A and B**
function _applyScriptInstruction(tree, A, B, instruction: Instruction) {
  if (instruction.type === 'add a') {
    A.children[instruction.source].optional = true;
    tree.children.push(A.children[instruction.source]);
  } else if (instruction.type === 'add b') {
    B.children[instruction.source].optional = true;
    tree.children.push(B.children[instruction.source]);
  } else if (instruction.type === 'join') {
    tree.children.push(A.children[instruction.source]);
  } else if (instruction.type === 'modify') {
    // always issued with a `.script`
    tree.children.push(
      applyScriptToTrees(
        A.children[instruction.source],
        B.children[instruction.target],
        instruction.script
      )
    );
  } else {
    throw new Error('unexpected instruction type');
  }

  return false;
}

function treesAreSame(a, b): boolean {
  if (!hasSameRoot(a, b)) return false;
  if (a.children.length !== b.children.length) return false;

  for (let i = 0; i < a.children.length; i++) {
    if (!treesAreSame(a.children[i], b.children[i])) return false;
  }

  return true;
}

function hasSameRoot(a, b) {
  return a.type === b.type;
}

// precondition: tree has no nodes of type 'text'
function treeWithPropertySelectors(tree) {
  const copy = _.clone(tree);
  const children = [];
  const base = `property-${copy.index}-`;
  for (let i = 0; i < copy.children.length; i++) {
    children.push({ type: 'text', value: `{{ ${base + i} }}` });
    children.push(treeWithPropertySelectors(copy.children[i]));
  }
  children.push({ type: 'text', value: `{{ ${base + copy.children.length} }}` });
  copy.children = children;
  return copy;
}

// postconditions:
// - merges list of objects into one object, by key
// - text values are coerced into arrays, and then arrays are concatenated
// - the returned object's properties are all comma-separated lists
function consolidateValues(values) {
  const union = {};
  values.forEach(value => {
    Object.keys(value).forEach(key => {
      if (!union.hasOwnProperty(key)) union[key] = [];
      const valueToInsert = Array.isArray(value[key]) ? value[key] : [value[key]];
      union[key].push(valueToInsert.join(', '));
    });
  });
  return union;
}

// postconditions:
// - throws NoPropertiesError if tree is a textnode whose property is !in values
function insertValuesIntoProperties(tree, values) {
  const copy = _.clone(tree);

  if (copy.type === 'text') {
    const keyMatch = copy.value.match(/{{(.+)}}/);
    if (!!keyMatch) {
      const keyName = keyMatch[1].trim();
      if (values[keyName]) {
        copy.value = values[keyName];
        return copy;
      }
    }

    throw new NoPropertiesError();
  } else {
    const children = [];
    for (let i = 0; i < tree.children.length; i++) {
      const child = tree.children[i];
      try {
        children.push(insertValuesIntoProperties(child, values));
      } catch (e) {
        if (e.name !== 'NoPropertiesError') throw e;
      }
    }
    copy.children = children;
    return copy;
  }
}

function convertTreeToString(tree): string {
  if (tree.type === 'text') {
    return tree.value;
  } else {
    const start = `\n<${tree.type + (tree.optional ? '?' : '')}>`;
    const end = `</${tree.type}>`;
    const children =
      tree.children
        .reduce((concatenation, child) => {
          return concatenation + convertTreeToString(child);
        }, '')
        .replace(/^/g, '  ')
        .replace(/\n/g, '\n  ') + '\n';
    if (children.trim().length === 0) {
      return start + end + '\n';
    } else {
      return start + '\n' + children + end + '\n';
    }
  }
}

export class UnresolveableExamplesError extends Error {
  constructor(...args: any) {
    super(...args);
    this.name = 'UnresolveableExamplesError';
    Error.captureStackTrace(this, UnresolveableExamplesError);
  }
}

class NoPropertiesError extends Error {
  constructor(...args) {
    super(...args);
    this.name = 'NoPropertiesError';
    Error.captureStackTrace(this, NoPropertiesError);
  }
}
