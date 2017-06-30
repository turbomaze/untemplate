// @flow

import { DOMParser } from 'xmldom';
import _ from 'lodash';

// constants
const PARSER = new DOMParser();
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

// types
type BasicDomNode = {
  childNodes: DomNode[],
  cloneNode: (deep: boolean) => DomNode,
  getAttribute: (name: string) => ?string,
  setAttribute: (name: string, value: string | number | boolean) => ?string,
};
export type TextDomNode = BasicDomNode & {
  nodeType: 3, // TEXT_NODE
  nodeValue: string
};
export type ElementDomNode = BasicDomNode & {
  nodeType: 1, // ELEMENT_NODE
  tagName: string
};
export type DomNode = TextDomNode | ElementDomNode;
export type AnnotatedTree = {
  type: string,
  children: AnnotatedTree[]
};

export function templatesMatch(a: DomNode, b: DomNode): boolean {
  if (isElement(a) && isElement(b)) {
    const a_: ElementDomNode = (a: any);
    const b_: ElementDomNode = (b: any);
    if (a_.tagName !== b_.tagName) return false;
    if (isOptional(a) !== isOptional(b)) return false;

    const aChildren = getNonEmptyChildren(a);
    const bChildren = getNonEmptyChildren(b);
    if (aChildren.length !== bChildren.length) return false;

    for (let i = 0; i < aChildren.length; i++) {
      if (!templatesMatch(aChildren[i], bChildren[i])) return false;
    }

    return true;
  } else if (isTextNode(a) && isTextNode(b)) {
    const a_: TextDomNode = (a: any);
    const b_: TextDomNode = (b: any);
    return a_.nodeValue.trim() === b_.nodeValue.trim();
  } else {
    return false;
  }
}

export function parseTemplate(dsl: string): DomNode {
  return parseHtml(desugar(dsl));  
}

function desugar(dsl: string): string {
  return dsl.trim()
    .replace(/\?>/g, ' optional="true">')
    .replace(/\?\/>/g, ' optional="true"\/>');
}

export function getNonEmptyChildren(element: DomNode): DomNode[] {
  return Array.from(element.childNodes || []).filter((child) => {
    if (isTextNode(child)) {
      const child_: TextDomNode = (child: any);
      return child_ && child_.nodeValue.trim() !== '';
    } else {
      return true;
    }
  });
}

// postcondition: return new tree with same nodes but numbered on the `index` key
export function number(tree: AnnotatedTree) {
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

export function parseHtml(html: string): DomNode {
  return PARSER.parseFromString(html.trim(), 'text/xml').firstChild;
}

export function isElement(element: DomNode): boolean {
  return element.nodeType === ELEMENT_NODE;
}

export function isTextNode(element: DomNode): boolean {
  return element.nodeType === TEXT_NODE;
}

export function isOptional(element: DomNode): boolean {
  if (element.getAttribute) {
    return element.getAttribute('optional') === 'true';
  } else {
    return false;
  }
}
