import { _ } from 'lodash';
import {
  getNonEmptyChildren, number,
  parseHtml, isElement, isTextNode, isOptional
} from '../src/utils';

describe ('untemplate',  () => {
  describe ('#getNonEmptyChildren',  () => {
    it ('should return an empty array when there are no children',  () => {
      const html = '<div></div>';
      const dom = parseHtml(html);
      expect(dom.childNodes.length).toEqual(0);
      expect(getNonEmptyChildren(dom)).toEqual([]);
    });

    it ('should an empty array when all children are empty',  () => {
      const html = '<span>   \n\n\n\t\t  </span>';
      const dom = parseHtml(html);
      expect(dom.childNodes.length).toEqual(1);
      expect(getNonEmptyChildren(dom)).toEqual([]);
    });

    it ('should child nodes when there are some',  () => {
      const html = '<ul><li></li><li></li></ul>';
      const dom = parseHtml(html);
      const nonEmptyChildren = getNonEmptyChildren(dom);
      expect(nonEmptyChildren.length).toEqual(2);
      expect(nonEmptyChildren[0].tagName.toLowerCase()).toEqual('li');
      expect(nonEmptyChildren[1].tagName.toLowerCase()).toEqual('li');
    });

    it ('should skip over empty text nodes',  () => {
      const html = '<ul>\t\n<li></li> \n\n \t\t  \n\n<li></li> \n\n\t \t</ul>';
      const dom = parseHtml(html);
      const nonEmptyChildren = getNonEmptyChildren(dom);
      expect(nonEmptyChildren.length).toEqual(2);
      expect(nonEmptyChildren[0].tagName.toLowerCase()).toEqual('li');
      expect(nonEmptyChildren[1].tagName.toLowerCase()).toEqual('li');
    });

    it ('should not skip over nonempty textnodes',  () => {
      const html = '<header>nonempty<div></div></header>';
      const dom = parseHtml(html);
      const nonEmptyChildren = getNonEmptyChildren(dom);
      expect(nonEmptyChildren.length).toEqual(2);
      expect(isTextNode(nonEmptyChildren[0])).toEqual(true);
      expect(nonEmptyChildren[0].nodeValue).toEqual('nonempty');
      expect(nonEmptyChildren[1].tagName.toLowerCase()).toEqual('div');
    });
  });

  describe ('#number',  () => {
    it ('should number nodes with no children',  () => {
      const tree = {};
      const numbered = number(tree);
      const expected = {index: 0};
      expect(_.isEqual(numbered, expected)).toEqual(true);
    });

    it ('should number nodes with one layer of children',  () => {
      const tree = {children: [{}]};
      const numbered = number(tree);
      const expected = {index: 0, children: [{index: 1}]};
      expect(_.isEqual(numbered, expected)).toEqual(true);
    });

    it ('should number nodes with multiple layers of children',  () => {
      const tree = {children: [{children: [{}]}, {}]};
      const numbered = number(tree);
      const expected = {
        children: [
          {children: [{index: 2}], index: 1},
          {index: 3}
        ],
        index: 0
      };
      console.log(numbered);
      console.log(expected);
      expect(_.isEqual(numbered, expected)).toEqual(true);
    });
  });

  // NOTE: *white-box testing for #parseHtml*
  // - implementation just calls external library; don't duplicate work of testing
  //   an HTML parser
  // - just test potential problems at the interface between this method and the
  //   library
  describe ('#parseHtml',  () => {
    it ('should parse nodes with no children',  () => {
      const html = '<div></div>';
      const dom = parseHtml(html);
      expect(dom.tagName.toLowerCase()).toEqual('div');
      expect(dom.childNodes.length).toEqual(0);
    });

    it ('should parse text with a lot of whitespace before/after',  () => {
      const html = '   \n\n<span></span>\n   \t\t  ';
      const dom = parseHtml(html);
      expect(dom.tagName.toLowerCase()).toEqual('span');
      expect(dom.childNodes.length).toEqual(0);
    });
  });

  describe ('#isElement',  () => {
    it ('should correctly identify an element',  () => {
      const html = '<div></div>';
      const dom = parseHtml(html);
      const domNodeIsElement = isElement(dom);
      expect(domNodeIsElement).toEqual(true);
    });

    it ('should correctly reject comments',  () => {
      const html = '<!-- comment -->';
      const dom = parseHtml(html);
      const domNodeIsElement = isElement(dom);
      expect(domNodeIsElement).toEqual(false);
    });

    it ('should correctly reject textnodes',  () => {
      const html = '<div> hello </div>';
      const dom = parseHtml(html).firstChild;
      const domNodeIsElement = isElement(dom);
      expect(domNodeIsElement).toEqual(false);
    });
  });

  describe ('#isTextNode',  () => {
    it ('should correctly identify textnodes',  () => {
      const html = '<li> world </li>';
      const dom = parseHtml(html).firstChild;
      const domNodeIsElement = isTextNode(dom);
      expect(domNodeIsElement).toEqual(true);
    });

    it ('should correctly reject comments',  () => {
      const html = '<!-- comment -->';
      const dom = parseHtml(html);
      const domNodeIsElement = isTextNode(dom);
      expect(domNodeIsElement).toEqual(false);
    });

    it ('should correctly reject elements',  () => {
      const html = '<ul><li></li></ul>';
      const dom = parseHtml(html);
      const domNodeIsElement = isTextNode(dom);
      expect(domNodeIsElement).toEqual(false);
    });
  });

  describe ('#isOptional',  () => {
    it ('should correctly identify a node with the optional attribute',  () => {
      const html = '<section optional="true"></section>';
      const dom = parseHtml(html);
      const domNodeIsElement = isOptional(dom);
      expect(domNodeIsElement).toEqual(true);
    });

    it ('should correctly reject nodes without the attribute',  () => {
      const html = '<p></p>';
      const dom = parseHtml(html);
      const domNodeIsElement = isOptional(dom);
      expect(domNodeIsElement).toEqual(false);
    });

    it ('should correctly reject nodes without the attribute set to true',  () => {
      const html = '<span optional="false"></span>';
      const dom = parseHtml(html);
      const domNodeIsElement = isOptional(dom);
      expect(domNodeIsElement).toEqual(false);
    });
  });
});
