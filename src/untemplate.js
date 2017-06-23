import { DOMParser } from 'xmldom';

// constants
const PARSER = new DOMParser();
const DIV = PARSER.parseFromString('<div> text </div>').firstChild;
const ELEMENT_NODE = DIV.nodeType;
const TEXT_NODE = DIV.firstChild.nodeType;

// preconditions:
// - dsl is a well-formatted template string
// - element is a dom node
// postconditions:
// - return list of assoc arrays from template properties to values
export function untemplate (dsl, element) {
  const desugaredDsl = desugar(dsl);
  const template = PARSER.parseFromString(desugaredDsl, 'text/xml').firstChild;
  return find(template, element);
}

function desugar(dsl) {
  return dsl.trim().replace(/\?>/g, ' optional="true">');
}

function find(template, element) {
  const numOptionals = countOptionals(template);
  const labeledTemplate = labelOptionals(template);
  const haystack = number(measure(annotateTree(element)));
  const preHaystack = preorder(haystack);
  const inHaystack = inorder(haystack);
  let allMatches = {};
  for (let i = 0; i < Math.pow(2, numOptionals); i++) {
    const hidden = {};
    for (let j = 0; j < numOptionals; j++) hidden[j] = (i >> j) % 2;
    const hiddenTemplate = hideOptionals(labeledTemplate, hidden);
    allMatches = union(
      allMatches,
      findWithHiddenNodes(hiddenTemplate, preHaystack, inHaystack)
    );
  }
  return Object.keys(allMatches).map((key) => { return allMatches[key]; });
}

function countOptionals(template) {
  let numOptionals = (isElement(template) && isOptional(template)) ? 1 : 0;
  numOptionals += Array.from(template.childNodes || [])
    .map(countOptionals)
    .reduce((a, b) => { return a + b; }, 0);
  return numOptionals;
}

function labelOptionals(template) {
  const labeledTemplate = template.cloneNode(true);
  let index = 0;
  let stack = [labeledTemplate];
  while (stack.length > 0) {
    const node = stack.shift();
    if (isElement(node) && isOptional(node)) {
      node.setAttribute('optionalNumber', index++);
    }
    stack = getNonEmptyChildren(node).concat(stack);
  }
  return labeledTemplate;
}

function findWithHiddenNodes(template, preHaystack, inHaystack) {
  const needle = number(measure(annotateTree(template)));
  const preNeedle = preorder(needle), inNeedle = inorder(needle);
  const preMatches = findInArray(preNeedle, preHaystack);
  const inMatches = findInArray(inNeedle, inHaystack);
  const matches = intersect(preMatches, inMatches);
  return Object.keys(matches).reduce((allMatches, key) => {
    allMatches[key] = applyTemplate(template, matches[key].dom);
    return allMatches;
  }, {});
}

function findInArray(needle, haystack) {
  const matches = {};
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let matched = true, rootMatch = null;
    for (let j = 0; j < needle.length; j++) {
      if (!nodesMatch(needle[j], haystack[i + j])) {
        matched = false;
        break;
      } else if (needle[j].index === 0) rootMatch = haystack[i + j];
    }
    if (matched) matches[rootMatch.index] = cloneTree(rootMatch);
  }
  return matches;
}

function applyTemplate(template, element) {
  const state = {};
  _applyTemplate(template, element, state);
  return state;
}

// precondition: the template subtree matches the element subtree
function _applyTemplate(template, element, state) {
  let tempPtr = 0, elementPtr = 0;
  const templateKids = getNonEmptyChildren(template)
    .filter((child) => { return isTextNode(child) || !isHidden(child); });
  const elementKids = getNonEmptyChildren(element);
  while (tempPtr < templateKids.length && elementPtr < elementKids.length) {
    const templateKid = templateKids[tempPtr];
    const elementKid = elementKids[elementPtr];
    const templateIsText = isTextNode(templateKid);
    const elementIsText = isTextNode(elementKid);
    if (templateIsText && elementIsText) { // both text
      const keyMatch = templateKid.nodeValue.match(/{{(.+)}}/);
      const keyName = !!keyMatch ? keyMatch[1].trim() : false;
      if (keyName) addProperty(state, keyName, elementKid.nodeValue.trim());
      tempPtr++, elementPtr++;
    } else if (!templateIsText && !elementIsText) { // both nodes
      _applyTemplate(templateKid, elementKid, state);
      tempPtr++, elementPtr++;
    } else if (!templateIsText && elementIsText) { // element has excess text
      elementPtr++;
    } else { // template has excess text
      tempPtr++;
    }
  }
}

// postconditions:
// - clean annotated abstract tree
// - terminal values: {type: div|*|0, dom: corresp DOM node}
// - node values: same but with a key for children
function annotateTree (element) {
  if (!isElement(element)) return false;
  else if (isHidden(element)) return false;

  if (!element.firstChild) {
    return { type: element.tagName.toLowerCase(), dom: element };
  } else {
    const annotatedKids = getNonEmptyChildren(element).map(annotateTree)
      .filter((a) => { return !!a; });
    const children = forceBinary(annotatedKids);
    return {
      type: element.tagName.toLowerCase(),
      dom: element,
      children: children
    };
  }
}

// postcondition: return new tree with same nodes but numbered on the `index` key
//                nodes are numbered 'in order' by height and then left-to-right
function number(tree) {
  const numberedTree = cloneTree(tree);
  let index = 0;
  let stack = [numberedTree];
  while (stack.length > 0) {
    const node = stack.shift();
    node.index = index++;
    stack = (node.children || []).concat(stack);
  }
  return numberedTree;
}

// precondition: tree is a binary tree
// postcondition: all nodes have a height
function measure(tree) {
  const measuredTree = shallowCloneTree(tree);
  const kids = (measuredTree.children || []).map(measure);
  measuredTree.children = kids;
  measuredTree.height = 1 + getChildrenHeight(kids);
  return measuredTree;
}

function forceBinary (children) {
  if (children.length === 1) {
    return [cloneTree(children[0]), { type: '0' }];
  } else if (children.length > 2) {
    const rightTree = forceBinary(children.slice(1));
    return [cloneTree(children[0]), { type: '*', children: rightTree }];
  } else {
    return children.map(cloneTree);
  }
}

function getChildrenHeight(children) {
  return children.reduce((maxHeight, value) => {
    return value === false ? -1 : Math.max(maxHeight, value.height);
  }, -1);
}

function hideOptionals(template, pattern) {
  const hiddenTemplate = template.cloneNode(true);
  let stack = [hiddenTemplate];
  while (stack.length > 0) {
    const node = stack.shift();
    if (isElement(node) && isOptional(node)) {
      const optionalNumber = parseInt(node.getAttribute('optionalNumber'));
      const hiddenValue = pattern[optionalNumber] ? 'true' : 'false';
      node.setAttribute('optionalHidden', hiddenValue);
    }
    stack = getNonEmptyChildren(node).concat(stack);
  }
  return hiddenTemplate;
}

function nodesMatch(templateNode, elementNode) {
  const typesMatch = templateNode.type === elementNode.type;
  const heightsMatch = templateNode.height === elementNode.height;
  return typesMatch && heightsMatch;
}

function preorder(tree) {
  if (!tree.children || tree.children.length === 0) {
    return [cloneTree(tree)];
  } else {
    return tree.children.reduce((arr, value) => {
      return arr.concat(preorder(value));
    }, [cloneTree(tree)]);
  }
}

function inorder(tree) {
  if (!tree.children || tree.children.length === 0) {
    return [cloneTree(tree)];
  } else {
    return inorder(tree.children[0])
      .concat(cloneTree(tree))
      .concat(inorder(tree.children[1]));
  }
}

function getNonEmptyChildren(element) {
  return Array.from(element.childNodes || []).filter((child) => {
    const isNonEmptyText = isTextNode(child) && child.nodeValue.trim() !== '';
    return isElement(child) || isNonEmptyText;
  });
}

function intersect(a, b) {
  const matches = {};
  Object.keys(a).forEach((aKey) => {
    if (b.hasOwnProperty(aKey)) matches[aKey] = a[aKey];
  });
  return matches;
}

function union(base, addition) {
  const union = {};
  Object.keys(base).forEach((key) => { union[key] = base[key]; });
  Object.keys(addition).forEach((key) => { union[key] = addition[key]; });
  return union;
}

function addProperty(state, key, value) {
  if (state.hasOwnProperty(key)) {
    if (!Array.isArray(state[key])) state[key] = [state[key]];
    state[key].push(value);
  } else {
    state[key] = value;
  }
}

function cloneTree(tree) {
  const clone = {};
  for (const k in tree) {
    clone[k] = Array.isArray(tree[k]) ? tree[k].map(cloneTree) : tree[k];
  }
  return clone;
}

function shallowCloneTree(tree) {
  const clone = {};
  for (const k in tree) clone[k] = tree[k];
  return clone;
}

function isElement(element) {
  return element.nodeType === ELEMENT_NODE;
}

function isTextNode(element) {
  return element.nodeType === TEXT_NODE;
}

function isOptional(element) {
  return element.getAttribute('optional') === 'true';
}

function isHidden(element) {
  return isElement(element) && element.getAttribute('optionalHidden') === 'true';
}
