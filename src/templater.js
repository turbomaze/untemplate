import { XMLSerializer } from 'xmldom';
import Combinatorics from 'js-combinatorics';
import { _ } from 'lodash';
import {
  getNonEmptyChildren, number,
  parseHtml, isElement, isTextNode, isOptional
} from './utils';
import { untemplate } from './untemplate';

// constants
const SERIALIZER = new XMLSerializer();
const NO_PARENT = 'none';
const DIAGONAL = 'diagonal';
const ABOVE = 'above';
const LEFT = 'left';
const ADD_A = 'add a';
const ADD_B = 'add b';
const MODIFY = 'modify';
const JOIN = 'join';
const TIE_BREAKER = 1.000001; // biases the optimization to more intuitive templates

export function deduceTemplate(examples) {
  const trees = examples.map((ex) => {
    return number(countDescendants(annotateTree(parseHtml(ex))));
  });
  const deducedStructure = reconcileTrees(trees);
  const structureWithProperties = treeWithPropertySelectors(deducedStructure);
  const maximalDsl = convertTreeToString(structureWithProperties);
  const exampleValues = examples.map((ex) => {
    return untemplate(maximalDsl, parseHtml(ex));
  });
  const consolidatedValues = consolidateValues(exampleValues.map((value) => {
    // assumption: maximalDsl matches exactly once in each example
    return value[0];
  }));
  const template = insertValuesIntoProperties(
    structureWithProperties, consolidatedValues
  );
  const dsl = convertTreeToString(template);
  return dsl;
}

// postcondition: returns a json object with the following fields:
// - type: the tagname of the element
// - children: child nodes, recursive
function annotateTree (element) {
  if (!isElement(element)) return false;

  if (!element.firstChild) {
    return {
      type: element.tagName.toLowerCase(),
      children: [],
      numDescendants: 0
    };
  } else {
    const children = getNonEmptyChildren(element).map(annotateTree)
      .filter((a) => { return !!a; });
    return {
      type: element.tagName.toLowerCase(),
      children: children,
      numDescendants: children.reduce((sum, child) => {
        return sum + child.numDescendants;  
      }, children.length)
    };
  }
}

// postcondition: returns a new tree that's a copy with the following field
// - numDescendants: number of nodes with this node as an ancestor
function countDescendants(tree) {
  const treeWithDescendants = _.cloneDeep(tree);
  treeWithDescendants.children = treeWithDescendants.children.map(countDescendants);
  if (treeWithDescendants.children.length === 0) {
    treeWithDescendants.numDescendants = 0;
  } else {
    treeWithDescendants.numDescendants = treeWithDescendants.children.reduce(
      (total, child) => { return total + child.numDescendants; },
      treeWithDescendants.children.length
    );
  }
  return treeWithDescendants;
}

// postconditions:
// - returns a tree
// - throws UnresolveableExamplesError if the supplied trees are irreconcilable
function reconcileTrees(trees) {
  if (trees.length === 0) throw new UnresolveableExamplesError();
  if (trees.length === 1) return trees[0];

  return trees.reduce(reconcileTwoTrees);
}

function reconcileTwoTrees(treeA, treeB) {
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

function getLoss(A, B) {
  // init pi table
  const { pi, nu } = initEditScriptDpTables(A, B);

  // populate the pi table
  const m = A.children.length
  const n = B.children.length;
  for (let i = 0; i < m; i++) {
    const aChild = A.children[i];
    for (let j = 0; j < n; j++) {
      const bChild = B.children[j];
      const updateLossAndScript = getLoss(aChild, bChild);
      // TODO: don't recurse if pi[i][j] === Infinity
      const lossFromUpdating = pi[i][j] + TIE_BREAKER * updateLossAndScript.loss;
      const lossFromAddingA = pi[i][j+1] + aChild.numDescendants + 1;
      const lossFromAddingB = pi[i+1][j] + bChild.numDescendants + 1;
      pi[i+1][j+1] = Math.min(lossFromUpdating, lossFromAddingA, lossFromAddingB);
      if (lossFromUpdating < Math.min(lossFromAddingA, lossFromAddingB)) {
        nu[i+1][j+1] = {direction: DIAGONAL, script: updateLossAndScript.script};
      } else if (lossFromAddingA < lossFromAddingB){
        nu[i+1][j+1] = {direction: ABOVE};
      } else {
        nu[i+1][j+1] = {direction: LEFT};
      }
    }
  }

  return {loss: pi[m][n], script: recoverEditScriptFromTables(pi, nu)};
}

function initEditScriptDpTables(A, B) {
  const m = A.children.length
  const n = B.children.length;
  const pi = []; // pi_ij = ith in A and jth in B
  const nu = []; // predecessors of the pi table
  for (let i = 0; i < m + 1; i++) {
    pi.push([]), nu.push([]);
    for (let j = 0; j < n + 1; j++) {
      pi[i].push(0);
      nu[i].push({direction: NO_PARENT});
    }
  }
  if (A.type !== B.type) pi[0][0] = Infinity;

  for (let i = 0; i < m; i++) {
    pi[i + 1][0] = pi[i][0] + A.children[i].numDescendants + 1;
    nu[i + 1][0] = {direction: ABOVE};
  }
  for (let j = 0; j < n; j++) {
    pi[0][j + 1] = pi[0][j] + B.children[j].numDescendants + 1;
    nu[0][j + 1] = {direction: LEFT};
  }
  return {pi: pi, nu: nu};
}

function recoverEditScriptFromTables(pi, nu) {
  // recover the edit script from the predecessor tables
  const script = [];
  let I = pi.length - 1, J = pi[0].length - 1;
  while (I !== 0 || J !== 0) {
    const predecessor = nu[I][J];
    if (predecessor.direction === ABOVE) {
      script.push(makeEditScriptStep(ADD_A, --I));
    } else if (predecessor.direction === LEFT) {
      script.push(makeEditScriptStep(ADD_B, --J));
    } else {
      script.push(makeEditScriptStep(MODIFY, --I, --J, predecessor.script));
    }
  }

  return script.reverse();
}

function makeEditScriptStep(type, source, target, script) {
  if (arguments.length === 4) {
    if (script.length === 0) {
      return {type: JOIN, source: source, target: target};
    } else {
      const optimizedScript = optimizeScript(script);
      if (optimizedScript.length === 0) {
        return {type: JOIN, source: source, target: target};
      } else {
        return {type: type, source: source, target: target, script: script};
      }
    }
  } else {
    return {type: type, source: source};
  }
}

function optimizeScript(script) {
  const numNonJoins = script.filter(x => x.type !== JOIN).length;
  return numNonJoins === 0 ? [] : script;
}

// preconditions:
// - treeA.type === treeB.type
// - script was created for the context of treeA and treeB
function applyScriptToTrees(treeA, treeB, script) {
  const A = _.cloneDeep(treeA);
  const B = _.cloneDeep(treeB);
  const children = [];
  const reconciliation = {type: A.type, children: []};
  for (let i = 0; i < script.length; i++) {
    _applyScriptInstruction(reconciliation, A, B, script[i]);
  }
  return number(countDescendants(reconciliation));
}

// NOTE: this should be used exclusively as a helper for #applyScriptToTrees
// postconditions:
// - modifies the input tree** by the given instruction
// - also modifies trees A and B**
function _applyScriptInstruction(tree, A, B, instruction) {
  if (instruction.type === ADD_A) {
    A.children[instruction.source].optional = true;
    tree.children.push(A.children[instruction.source]);
  } else if (instruction.type === ADD_B) {
    B.children[instruction.source].optional = true;
    tree.children.push(B.children[instruction.source]);
  } else if (instruction.type === JOIN) {
    tree.children.push(A.children[instruction.source]);
  } else {
    tree.children.push(
      applyScriptToTrees(
        A.children[instruction.source],
        B.children[instruction.target],
        instruction.script
      )
    );
  }
  return false;
}

function treesAreSame(a, b) {
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
    children.push({type: 'text', value: `{{ ${base + i} }}`});
    children.push(treeWithPropertySelectors(copy.children[i]));
  }
  children.push({type: 'text', value: `{{ ${base + copy.children.length} }}`});
  copy.children = children;
  return copy;
}

function consolidateValues(values) {
  const union = {};
  values.forEach((value) => {
    Object.keys(value).forEach((key) => {
      if (!union.hasOwnProperty(key)) union[key] = [];
      const valueToInsert = Array.isArray(value[key]) ? value[key] : [value[key]];
      union[key].push(valueToInsert.join(', '));
    })
  });
  return union;
}

// postconditions:
// - throws NoPropertiesError if tree is a textnode whose property is not in values
function insertValuesIntoProperties(tree, values) {
  const copy = _.clone(tree);

  if (copy.type === 'text') {
    const keyMatch = copy.value.match(/{{(.+)}}/);
    const keyName = !!keyMatch ? keyMatch[1].trim() : false;
    if (values[keyName]) {
      copy.value = values[keyName];
      return copy;
    } else {
      throw new NoPropertiesError();
    }
  } else {
    const children = [];
    for (let i = 0; i < tree.children.length; i++) {
      const child = tree.children[i];
      try {
        children.push(insertValuesIntoProperties(child, values));
      } catch (e) {
        if (e.name !==  'NoPropertiesError') {
          throw e;
        }
      }
    }
    copy.children = children;
    return copy;
  }
}

function convertTreeToString(tree) {
  if (tree.type === 'text') {
    return tree.value;
  } else {
    const start = `\n<${tree.type + (tree.optional ? '?' : '')}>`;
    const end = `</${tree.type}>`;
    const children = tree.children.reduce((concatenation, child) => {
      return concatenation + convertTreeToString(child);
    }, '').replace(/^/g, '  ').replace(/\n/g, '\n  ') + '\n';
    if (children.trim().length === 0) {
      return start + end + '\n';
    } else {
      return start + '\n' + children + end + '\n';
    }
  }
}

function treeToDom(tree) {
  return parseHtml('<div></div>');
}

function range(n) {
  let list = [];
  for (let i = 0; i < n; i++) list.push(i);
  return list;
}

export class UnresolveableExamplesError extends Error {
  constructor(...args) {
    super(...args)
    this.name = 'UnresolveableExamplesError';
    Error.captureStackTrace(this, UnresolveableExamplesError);
  }
}

class NoPropertiesError extends Error {
  constructor(...args) {
    super(...args)
    this.name = 'NoPropertiesError';
    Error.captureStackTrace(this, NoPropertiesError);
  }
}
