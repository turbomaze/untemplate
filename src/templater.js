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

export function deduceTemplate(examples) {
  const trees = examples.map((ex) => {
    return number(annotateTree(parseHtml(ex)));
  });
  try {
    const deducedStructure = reconcileTrees(trees).tree;
    const structureWithAllProperties = treeWithPropertySelectors(deducedStructure);
    const maximalDsl = convertTreeToString(structureWithAllProperties);
    const exampleValues = examples.map((ex) => {
      return untemplate(maximalDsl, parseHtml(ex));
    });
    const consolidatedValues = consolidateValues(exampleValues.map((value) => {
      // assumption: maximalDsl matches exactly once in each example
      return value[0];
    }));
    const template = insertValuesIntoProperties(
      structureWithAllProperties, consolidatedValues
    );
    const dsl = convertTreeToString(template);
    return dsl;
  } catch (e) {
    if (e.name === 'UnresolveableExamplesError') {
      return false;
    } else {
      throw e;
    }
  }
}

// postcondition: returns a json object with the following fields:
// - type: the tagname of the element
// - children: child nodes, recursive
// - numDescendants: number of nodes with this node as an ancestor
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

// preconditions:
// TODO: these preconditions are limitations
// - trees.length === 2
// postconditions:
// - returns a tree
// - throws UnresolveableExamplesError if the supplied trees are irreconcilable
function reconcileTrees(trees) {
  if (trees.length === 1) {
    return {tree: trees[0], loss: 0};
  } else if (trees.length !== 2) {
    throw new UnresolveableExamplesError();
  }

  // low hanging fruit
  const A = _.cloneDeep(trees[0]);
  const B = _.cloneDeep(trees[1]);
  if (treesAreSame(A, B)) {
    return {tree: A, loss: 0};
  } else if (!hasSameRoot(A, B)) {
    throw new UnresolveableExamplesError();
  } else {
    // much higher hanging fruit
    const bestChoiceAndLoss = getLoss(A, B);
    const choiceSet = {};
    for (let i = 0; i < bestChoiceAndLoss.choice.length; i++) {
      choiceSet[bestChoiceAndLoss.choice[i]] = true;
    }
    for (let i = 0, j = 0; i < B.children.length; i++) {
      if (choiceSet[i]) {
        B.children[i].optional = true;
      } else {
        // invariant: |choiceSet| + A.children.length == B.children.length
        B.children[i] = reconcileTrees([A.children[j], B.children[i]]).tree;
        j++;
      }
    }
    return {tree: number(B), loss: bestChoiceAndLoss.loss};
  }
}

function getLoss(A, B) {
  if (A.children.length > B.children.length) {
    return getLoss(B, A);
  }

  const numOptionals = B.children.length - A.children.length;
  const optionalChoices = Combinatorics.combination(
    range(B.children.length), numOptionals
  );
  let choice = optionalChoices.next();
  let minLoss = null;
  let bestChoice = null;
  while (choice) {
    const loss = getSpecificLoss(A, B, choice);
    if (minLoss === null || loss <= minLoss) {
      minLoss = loss;
      bestChoice = choice;
    }
    choice = optionalChoices.next();
  }

  return {loss: minLoss, choice: bestChoice};
}

function getSpecificLoss(A, B, beta) {
  let mainLoss = beta.reduce((sum, b) => {
    return sum + B.children[b].numDescendants + 1;
  }, 0);
  let optionalSet = {};
  for (let i = 0; i < beta.length; i++) {
    optionalSet[B.children[beta[i]].index] = true;
  }
  let auxiliarlyLoss = 0;
  for (let i = 0, j = 0; i < B.children.length; i++) {
    if (!optionalSet[B.children[i].index]) {
      try {
        auxiliarlyLoss += getLoss(A.children[j], B.children[i]).loss;
      } catch (e) {
        auxiliarlyLoss += Infinity;
      }
      j++;
    }
  }
  return mainLoss + auxiliarlyLoss;
}

function treesAreSame(a, b) {
  if (!hasSameRoot(a, b)) return false;
  if (a.children.length !== b.children.length) return false;

  for (let i = 0; i < a.children; i++) {
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
    const start = `<${tree.type + (tree.optional ? '?' : '')}>`;
    const end = `</${tree.type}>`;
    const children = tree.children.reduce((concatenation, child) => {
      return concatenation + convertTreeToString(child);
    }, '');
    return start + children + end;
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

class UnresolveableExamplesError extends Error {
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
