import { DOMParser } from 'xmldom';

// constants
const PARSER = new DOMParser();
const DIV = PARSER.parseFromString('<div> text </div>').firstChild;
const ELEMENT_NODE = DIV.nodeType;
const TEXT_NODE = DIV.firstChild.nodeType;

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
