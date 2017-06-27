import { XMLSerializer } from 'xmldom';
import Combinatorics from 'js-combinatorics';
import { _ } from 'lodash';
import {
  getNonEmptyChildren, number,
  parseHtml, isElement, isTextNode, isOptional
} from './utils';

// constants
const SERIALIZER = new XMLSerializer();

export function deduceTemplate(examples) {
  const trees = examples.map((ex) => {
    return number(annotateTree(parseHtml(ex)));
  });
  try {
    const deducedTemplate = reconcileTrees(trees);
    const dsl = convertTreeToString(deducedTemplate);
    console.log(dsl);
    return dsl;
  } catch (e) {
    return false;
  }
}

// postcondition: returns a json object with the following fields:
// - type: the tagname of the element
// - children: child nodes, recursive
// - numDescendants: number of nodes with this node as an ancestor
function annotateTree (element) {
  if (!isElement(element)) return false;

  if (!element.firstChild) {
    return { type: element.tagName.toLowerCase(), numDescendants: 0 };
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

// TODO:
// - limitations
//   - trees.length === 2
//   - all nodes must have the same type
// throws UnresolveableExamplesException if the supplied trees are irreconcilable
function reconcileTrees(trees) {
  if (trees.length === 1) {
    return {tree: trees[0], loss: 0};
  } else if (trees.length !== 2) {
    throw new UnresolveableExamplesException(trees);
  }

  // low hanging fruit
  const A = _.cloneDeep(trees[0]);
  const B = _.cloneDeep(trees[1]);
  if (treesAreSame(A, B)) {
    return {tree: A, loss: 0};
  } else if (!hasSameRoot(A, B)) {
    throw new UnresolveableExamplesException(trees);
  } else {
    // same root, different children, begin reconciliation
    if (A.children.length > B.children.length) {
      // requires assumption that trees[1] has more children
      return reconcileTrees([B, A]);
    }

    const numOptionals = B.length - A.length;
    const optionalChoices = Combinatorics.combination(B.children, numOptionals);
    let choice = optionalChoices.next();
    let minLoss = Infinity;
    let bestChoice = null;
    while (choice) {
      const loss = getLoss(A, B, choice);
      if (loss < minLoss) {
        minLoss = loss;
        bestChoice = choice;
      }
      choice = optionalChoices.next();
    }

    for (var i = 0; i < bestChoice.length; i++) {
      bestChoice[i].optional = true;
    }

    return {tree: B, loss: minLoss};
  }
}

function getLoss(A, B, beta) {
  let mainLoss = beta.reduce((sum, b) => {
    return sum + b.numDescendants + 1;
  }, 0);
  let optionalSet = {};
  for (var i = 0; i < beta.length; i++) {
    optionalSet[beta[i].index] = true;
  }
  let auxiliarlyLoss = 0;
  for (let i = 0, j = 0; i < B.children.length; i++) {
    if (!optionalSet[B.children[i].index]) {
      try {
        auxiliarlyLoss += reconcileTrees(A.children[j], B.children[i]).loss;
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
  if (!a.children !== !b.children) return false;

  if (!!a.children) { // if a has children, then
    if (!b.children) return false; // b must too
    if (a.children.length !== b.children.length) return false;

    for (var i = 0; i < a.children; i++) {
      if (!treesAreSame(a.children[i], b.children[i])) return false;
    }
  }

  return true;
}

function hasSameRoot(a, b) {
  return a.type === b.type;
}

function convertTreeToString(tree) {
  return JSON.stringify(tree, true, 2);
  // const templateDom = treeToDom(tree);
  // return SERIALIZER.serializeToString(templateDom, 'text/html');
}

function treeToDom(tree) {
  return parseHtml('<div></div>');
}

class UnresolveableExamplesException {
  constructor(examples) {
    this.value = examples;
    this.message = 'could not resolve the supplied examples';
    this.toString = () => {
      return this.message;
    };
  }
}
