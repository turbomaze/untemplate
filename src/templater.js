import { XMLSerializer } from 'xmldom';
import {
  getNonEmptyChildren,
  parseHtml, isElement, isTextNode, isOptional
} from './utils';

// constants
const SERIALIZER = new XMLSerializer();

export function deduceTemplate(examples) {
  const trees = examples.map((ex) => {
    const template = parseHtml(ex);
    return annotateTree(template); 
  });
	console.log(trees[0])
  const dsl = convertTreeToString(trees[0]);
  return dsl;
}

function annotateTree (element) {
  if (!isElement(element)) return false;

  if (!element.firstChild) {
    return { type: element.tagName.toLowerCase(), dom: element };
  } else {
    return {
      type: element.tagName.toLowerCase(),
      children: getNonEmptyChildren(element).map(annotateTree)
    };
  }
}

function convertTreeToString(tree) {
  const templateDom = treeToDom(tree);
  return SERIALIZER.serializeToString(templateDom);
}

function treeToDom(tree) {
  return parseHtml('<div></div>');
}
