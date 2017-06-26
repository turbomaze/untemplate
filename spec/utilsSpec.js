import { parseHtml, isElement, isTextNode, isOptional } from '../src/utils';

describe ('untemplate',  () => {
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
