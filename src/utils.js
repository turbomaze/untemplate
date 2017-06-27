import { DOMParser } from 'xmldom';
import { _ } from 'lodash';

// constants
const PARSER = new DOMParser();
const DIV = PARSER.parseFromString('<div> text </div>').firstChild;
const ELEMENT_NODE = DIV.nodeType;
const TEXT_NODE = DIV.firstChild.nodeType;

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
