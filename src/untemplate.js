import { DOMParser } from 'xmldom';
import _ from 'lodash';
import sha1 from 'object-hash';
import {
  parseTemplate, getNonEmptyChildren, number,
  parseHtml, isElement, isTextNode, isOptional
} from './utils';

// preconditions:
// - dsl is a well-formatted template string
// - element is a dom node
// postconditions:
// - return list of assoc arrays from template properties to values
export function untemplate (dsl, element) {
  const template = parseTemplate(dsl);
  return find(template, element);
}

function find(template, element) {
  // iterate all possible combinations of optionals in O(2^numOptionals)
  const numOptionals = countOptionals(template);
  const labeledTemplate = labelOptionals(template);
  const annotatedTemplate = annotateTemplate(labeledTemplate);
  const needles = {};
  for (let i = 0; i < Math.pow(2, numOptionals); i++) {
    const hidden = {};
    for (let j = 0; j < numOptionals; j++) hidden[j] = (i >> j) % 2;
    const hiddenTemplateHash = hashAnnotatedTemplate(annotatedTemplate, hidden);
    needles[hiddenTemplateHash] = hidden;
  }

  // search the tree in O(n) where n is number of nodes
  const haystack = number(annotateDom(element));
  const allMatches = findWithHashes(labeledTemplate, needles, haystack);

  return Object.keys(allMatches).map((key) => { return allMatches[key]; });
}

function countOptionals(template) {
  let numOptionals = (isElement(template) && isOptional(template)) ? 1 : 0;
  numOptionals += Array.from(template.childNodes || [])
    .map(countOptionals)
    .reduce((a, b) => { return a + b; }, 0);
  return numOptionals;
}

function labelOptionals (template) {
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

// produce an abstract representation of the template, including optional numbers
// preconditions: template has its optionals labeled
function annotateTemplate (template) {
  if (!isElement(template)) return false;

  const type = template.tagName.toLowerCase();
  const children = getNonEmptyChildren(template).map(annotateTemplate)
    .filter((a) => { return !!a; });
  const optionalNumber = parseInt(template.getAttribute('optionalNumber'));
  return { type, children, optionalNumber };
}

// precondition: annotatedTemplate is not optional
function hashAnnotatedTemplate (annotatedTemplate, hidden) {
  const childHashes = annotatedTemplate.children
    .filter(child => !hidden[child.optionalNumber])
    .map(child => hashAnnotatedTemplate(child, hidden));
  return sha1({
    type: annotatedTemplate.type,
    childHashes: childHashes
  });
}

// postconditions:
// - clean annotated abstract tree representing the input dom node
// - terminal values: {
//   type: div|*|0,
//   dom: corresp DOM node,
//   hash: its hash,
//   children: child nodes
// }
function annotateDom (dom) {
  if (!isElement(dom)) return false;
  else if (isHidden(dom)) return false;

  const type = dom.tagName.toLowerCase();
  const children = getNonEmptyChildren(dom).map(annotateDom)
    .filter((a) => { return !!a; });
  const hash = sha1({
    type: type,
    childHashes: children.map(child => child.hash)
  });
  return { type, dom, children, hash};
}

function findWithHashes (template, needles, haystack) {
  if (haystack.hash in needles) {
    // 1. if haystack matches a needle, apply the needle and return
    const hiddenTemplate = hideOptionals(template, needles[haystack.hash]);
    const annotatedTemplate = annotateDom(hiddenTemplate);
    if (treesMatch(annotatedTemplate, haystack)) {
      return [applyTemplate(hiddenTemplate, haystack.dom)];
    }
  } else {
    // 2. else, recurse on children, returning the concatenation of their results
    return haystack.children.reduce((results, child) => {
      return results.concat(findWithHashes(template, needles, child));
    }, []);
  }
}

function treesMatch (a, b) {
  if (a.type !== b.type) return false;
  if (a.children.length !== b.children.length) return false;

  for (let i = 0; i < a.children.length; i++) {
    if (!treesMatch(a.children[i], b.children[i])) return false;
  }
  
  return true;
}

function applyTemplate (template, element) {
  const state = {};
  _applyTemplate(template, element, state);
  return state;
}

// precondition: the template subtree matches the element subtree
function _applyTemplate (template, element, state) {
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

function addProperty(state, key, value) {
  if (state.hasOwnProperty(key)) {
    if (!Array.isArray(state[key])) state[key] = [state[key]];
    state[key].push(value);
  } else {
    state[key] = value;
  }
}

function isHidden(element) {
  return isElement(element) && element.getAttribute('optionalHidden') === 'true';
}
