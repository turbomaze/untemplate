import { DOMParser } from 'xmldom';
import _ from 'lodash';

// constants
const PARSER = new DOMParser();
const DIV = PARSER.parseFromString('<div> text </div>').firstChild;
const ELEMENT_NODE = DIV.nodeType;
const TEXT_NODE = DIV.firstChild.nodeType;

export function templatesMatch(a, b) {
  if (isElement(a) !== isElement(b)) return false;
  if (isElement(a)) {
    if (a.tagName !== b.tagName) return false;
    if (isOptional(a) !== isOptional(b)) return false;

    const aChildren = getNonEmptyChildren(a);
    const bChildren = getNonEmptyChildren(b);
    if (aChildren.length !== bChildren.length) return false;

    for (let i = 0; i < aChildren.length; i++) {
      if (!templatesMatch(aChildren[i], bChildren[i])) return false;
    }

    return true;
  } else {
    return a.nodeValue.trim() === b.nodeValue.trim();
  }
}

export function parseTemplate(dsl) {
  return parseHtml(desugar(dsl));  
}

function desugar(dsl) {
  return dsl.trim()
    .replace(/\?>/g, ' optional="true">')
    .replace(/\?\/>/g, ' optional="true"\/>');
}

export function getNonEmptyChildren(element) {
  return Array.from(element.childNodes || []).filter((child) => {
    const isNonEmptyText = isTextNode(child) && child.nodeValue.trim() !== '';
    return isElement(child) || isNonEmptyText;
  });
}

// postcondition: return new tree with same nodes but numbered on the `index` key
export function number(tree) {
  const numberedTree = _.cloneDeep(tree);
  let index = 0;
  let stack = [numberedTree];
  while (stack.length > 0) {
    const node = stack.shift();
    node.index = index++;
    stack = (node.children || []).concat(stack);
  }
  return numberedTree;
}

export function parseHtml(html) {
  return PARSER.parseFromString(html.trim(), 'text/xml').firstChild;
}

export function isElement(element) {
  return element.nodeType === ELEMENT_NODE;
}

export function isTextNode(element) {
  return element.nodeType === TEXT_NODE;
}

export function isOptional(element) {
  return element.getAttribute('optional') === 'true';
}
