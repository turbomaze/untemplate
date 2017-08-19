// @flow

import { DOMParser } from 'xmldom';
import _ from 'lodash';

// constants
const PARSER = new DOMParser();
const DIV = PARSER.parseFromString('<div> hello </div>', 'text/xml').firstChild;
const ELEMENT_NODE = DIV.nodeType;
const TEXT_NODE = DIV.firstChild.nodeType;

// types
type BasicDomNode = {
  firstChild: DomNode,
  childNodes: DomNode[],
  cloneNode: (deep: boolean) => DomNode,
  getAttribute: (name: string) => ?string,
  setAttribute: (name: string, value: string | number | boolean) => ?string,
};
export type TextDomNode = BasicDomNode & {
  nodeType: TEXT_NODE,
  nodeValue: string,
};
export type ElementDomNode = BasicDomNode & {
  nodeType: ELEMENT_NODE,
  tagName: string,
  attributes: NamedNodeMap,
};
export type DomNode = TextDomNode | ElementDomNode;
export type AnnotatedTree = {
  type: string,
  children: AnnotatedTree[],
};

export function templatesMatch(a: DomNode[], b: DomNode[]): boolean {
  if (a.length !== b.length) return false;

  return a.map((part, i) => singleTemplatesMatch(part, b[i])).every(bool => bool);
}

function singleTemplatesMatch(a: DomNode, b: DomNode): boolean {
  if (isElement(a) && isElement(b)) {
    const a_: ElementDomNode = (a: any);
    const b_: ElementDomNode = (b: any);
    if (a_.tagName !== b_.tagName) return false;
    if (isOptional(a_) !== isOptional(b_)) return false;
    if (!attributesMatch(a_, b_)) return false;

    const aChildren = getNonEmptyChildren(a_);
    const bChildren = getNonEmptyChildren(b_);
    if (aChildren.length !== bChildren.length) return false;

    for (let i = 0; i < aChildren.length; i++) {
      if (!singleTemplatesMatch(aChildren[i], bChildren[i])) return false;
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

function attributesMatch(a: ElementDomNode, b: ElementDomNode): boolean {
  const attributesA = a.attributes;
  const attributesB = b.attributes;
  if (attributesA.length !== attributesB.length) return false;

  for (let i = 0; i < attributesA.length; i++) {
    const valueA = attributesA[i].value.trim();
    const valueB = attributesB.getNamedItem(attributesA[i].name).value.trim();
    if (valueA !== valueB) return false;
  }

  return true;
}

export function parseTemplate(dsl: string): DomNode[] {
  return Array.from(parseHtml(desugar(dsl)).childNodes).filter(isElement);
}

function desugar(dsl: string): string {
  return dsl.trim().replace(/\?>/g, ' optional="true">').replace(/\?\/>/g, ' optional="true"/>');
}

export function getNonEmptyChildren(element: DomNode): DomNode[] {
  return Array.from(element.childNodes || []).filter(child => {
    if (isTextNode(child)) {
      const child_: TextDomNode = (child: any);
      return child_ && child_.nodeValue.trim() !== '';
    } else if (isElement(child)) {
      return true;
    } else {
      // html comment nodes, etc
      return false;
    }
  });
}

export function flattenNodes(tags: string[], element: DomNode): DomNode {
  return element;
}

// postconditions:
// - return new tree with same nodes but numbered on the `index` key
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
  return PARSER.parseFromString(html.trim(), 'text/xml');
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
