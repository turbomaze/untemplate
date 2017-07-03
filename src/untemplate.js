// @flow

import sha1 from 'object-hash';
import {
  parseTemplate, getNonEmptyChildren, number,
  parseHtml, isElement, isTextNode, isOptional
} from './utils';
import type {
  DomNode, ElementDomNode, TextDomNode, AnnotatedTree
} from './utils';

// types
type AnnotatedDomNode = {
  type: string,
  dom: DomNode,
  children: AnnotatedDomNode[],
  hash: string
};
type AnnotatedTemplate = {
  type: string,
  children: AnnotatedTemplate[],
  optionalNumber: number
};

// preconditions:
// - dsl is a well-formatted template string
// postconditions:
// - return list of objects from template properties to values
export function untemplate (dsl: string, element: ElementDomNode): {}[] {
  const template = parseTemplate(dsl);
  return find(template, element);
}

function find (template: DomNode, element: ElementDomNode): {}[] {
  // iterate all possible combinations of optionals in O(n * 2^numOptionals)
  // NOTE: it's possible to get rid of the factor of n if necessary
  const numOptionals = countOptionals(template);
  const labeledTemplate = labelOptionals(template);
  const annotatedTemplate_: AnnotatedTemplate = (
    annotateTemplate(labeledTemplate): any
  );
  const needles = {};
  for (let i = 0; i < Math.pow(2, numOptionals); i++) {
    const hidden = {};
    for (let j = 0; j < numOptionals; j++) hidden[j] = (i >> j) % 2 === 1;
    const hiddenTemplateHash = hashAnnotatedTemplate(
      annotatedTemplate_, hidden
    );
    needles[hiddenTemplateHash] = hidden;
  }

  // search the tree in O(n) where n is number of nodes
  const annotatedElement: AnnotatedTree = (annotateDom(element): any);
  const haystack = number(annotatedElement);
  return findWithHashes(labeledTemplate, needles, haystack);
}

function countOptionals (template): number {
  let numOptionals = (isElement(template) && isOptional(template)) ? 1 : 0;
  numOptionals += Array.from(template.childNodes || [])
    .map(countOptionals)
    .reduce((a, b) => { return a + b; }, 0);
  return numOptionals;
}

function labelOptionals (template): ElementDomNode {
  const labeledTemplate_: ElementDomNode = (template.cloneNode(true): any);
  let index = 0;
  let stack = [labeledTemplate_];
  while (stack.length > 0) {
    const node = stack.shift();
    if (isElement(node)) {
      const node_: ElementDomNode = (node: any);
      if (isOptional(node_)) {
        node_.setAttribute('optionalNumber', index++);
      }
      stack = getNonEmptyChildren(node_).concat(stack);
    }
  }
  return labeledTemplate_;
}

// produce an abstract repr of the template, including optional numbers
// preconditions:
// - template has its optionals labeled; isElement(template) === true
function annotateTemplate (template): AnnotatedTemplate {
  const template_: ElementDomNode = (template: any);
  const type = template_.tagName.toLowerCase();
  const children = getNonEmptyChildren(template_)
    .filter(a => isElement(a))
    .map(annotateTemplate)
  const optionalNumber = parseInt(template_.getAttribute('optionalNumber'));
  return { type, children, optionalNumber };
}

// precondition: annotatedTemplate is not optional
function hashAnnotatedTemplate (
  annotatedTemplate: AnnotatedTemplate,
  hidden: { [key: number]: boolean }
): string {
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
function annotateDom (dom: ElementDomNode): AnnotatedDomNode {
  const type = dom.tagName.toLowerCase();
  const children = getNonEmptyChildren(dom)
    .filter(a => { return isElement(a) && !isHidden(a); })
    .map(dom => {
      const dom_: ElementDomNode = (dom: any);
      return annotateDom(dom_);
    });
  const hash = sha1({
    type: type,
    childHashes: children.map(child => child.hash)
  });
  return { type, dom, children, hash};
}

function findWithHashes (template, needles, haystack): {}[] {
  if (haystack.hash in needles) {
    // 1. if haystack matches a needle, apply the needle and return
    const hiddenTemplate = hideOptionals(template, needles[haystack.hash]);
    const annotatedTemplate = annotateDom(hiddenTemplate);
    if (treesMatch(annotatedTemplate, haystack)) {
      return [applyTemplate(hiddenTemplate, haystack.dom)];
    }
  }

  // 2. else, recurse on children, returning the concatenation of their results
  return haystack.children.reduce((results, child) => {
    return results.concat(findWithHashes(template, needles, child));
  }, []);
}

function treesMatch (a, b): boolean {
  if (a.type !== b.type) return false;
  if (a.children.length !== b.children.length) return false;

  for (let i = 0; i < a.children.length; i++) {
    if (!treesMatch(a.children[i], b.children[i])) return false;
  }
  
  return true;
}

function applyTemplate (template, element): {} {
  const state = {};
  _applyTemplate(template, element, state);
  return state;
}

// precondition: the template subtree matches the element subtree
function _applyTemplate (template, element, state): void {
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
      const templateKid_: TextDomNode = (templateKid: any);
      const elementKid_: TextDomNode = (elementKid: any);
      const keyMatch = templateKid_.nodeValue.match(/{{(.+)}}/);
      const keyName = !!keyMatch ? keyMatch[1].trim() : false;
      if (keyName) addProperty(state, keyName, elementKid_.nodeValue.trim());
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

function hideOptionals(template: ElementDomNode, pattern): ElementDomNode {
  const hiddenTemplate_: ElementDomNode = (template.cloneNode(true): any);
  let stack = [hiddenTemplate_];
  while (stack.length > 0) {
    const node = stack.shift();
    if (isElement(node) && isOptional(node)) {
      const optionalNumber = parseInt(node.getAttribute('optionalNumber'));
      const hiddenValue = pattern[optionalNumber] ? 'true' : 'false';
      node.setAttribute('optionalHidden', hiddenValue);
    }
    const node_: ElementDomNode = (node: any);
    stack = getNonEmptyChildren(node_).concat(stack);
  }
  return hiddenTemplate_;
}

function addProperty(state: {}, key: string, value: any): void {
  if (state.hasOwnProperty(key)) {
    if (!Array.isArray(state[key])) state[key] = [state[key]];
    state[key].push(value);
  } else {
    state[key] = value;
  }
}

function isHidden(element): boolean {
  const isElementNode = isElement(element);
  return isElementNode && element.getAttribute('optionalHidden') === 'true';
}
