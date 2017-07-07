import _ from 'lodash';
import {
  templatesMatch, parseTemplate, getNonEmptyChildren, number,
  parseHtml, isElement, isTextNode, isOptional
} from '../src/utils';

describe ('untemplate',  () => {
  describe ('#templatesMatch',  () => {
    it ('should accept identical templates',  () => {
      const template1 = parseTemplate('<div><span></span></div>');
      const template2 = parseTemplate('<div><span></span></div>');
      const matches = templatesMatch(template1, template2);
      expect(matches).toEqual(true);
    });

    it ('should accept templates that differ in whitespace',  () => {
      const template1 = parseTemplate('<div>\t\t\t<span></span>  </div>');
      const template2 = parseTemplate('<div><span>\n\n\n   </span></div>');
      const matches = templatesMatch(template1, template2);
      expect(matches).toEqual(true);
    });

    it ('should reject templates that differ in text content',  () => {
      const template1 = parseTemplate('<div>\t\t\t<span> hello </span>  </div>');
      const template2 = parseTemplate('<div><span>\n\n\n   </span></div>');
      const matches = templatesMatch(template1, template2);
      expect(matches).toEqual(false);
    });

    it ('should accept templates that have the same trimmed text content',  () => {
      const template1 = parseTemplate('<div><span></span><a>  123  </a></div>');
      const template2 = parseTemplate('<div><span></span><a>123</a></div>');
      const matches = templatesMatch(template1, template2);
      expect(matches).toEqual(true);
    });

    it ('should accept templates that include the same optionals',  () => {
      const template1 = parseTemplate('<div><span></span><a?></a></div>');
      const template2 = parseTemplate('<div><span></span><a optional="true"></a></div>');
      const matches = templatesMatch(template1, template2);
      expect(matches).toEqual(true);
    });

    it ('should reject templates with different optionals',  () => {
      const template1 = parseTemplate('<div><span?></span><a?></a></div>');
      const template2 = parseTemplate('<div><span></span><a optional="true"></a></div>');
      const matches = templatesMatch(template1, template2);
      expect(matches).toEqual(false);
    });

    it ('should match templates with the same attributes',  () => {
      const template1 = parseTemplate('<div><a href="1" class="2"></a></div>');
      const template2 = parseTemplate('<div><a href="1" class="2"></a></div>');
      const matches = templatesMatch(template1, template2);
      expect(matches).toEqual(true);
    });

    it ('should reject templates with different attributes',  () => {
      const template1 = parseTemplate('<div><a href="1"></a></div>');
      const template2 = parseTemplate('<div><a href="2"></a></div>');
      const matches = templatesMatch(template1, template2);
      expect(matches).toEqual(false);
    });

    it ('should reject templates with inconsistent attributes',  () => {
      const template1 = parseTemplate('<div><a></a></div>');
      const template2 = parseTemplate('<div><a href="1"></a></div>');
      const matches = templatesMatch(template1, template2);
      expect(matches).toEqual(false);
    });

    it ('should match templates with the same trimmed attributes',  () => {
      const template1 = parseTemplate('<div><a href=" a  "></a></div>');
      const template2 = parseTemplate('<div><a href="a\t"></a></div>');
      const matches = templatesMatch(template1, template2);
      expect(matches).toEqual(true);
    });
  });

  // NOTE: *white-box testing for #parseTemplate*
  // - implementation just calls #parseHtml; don't duplicate work of testing it
  // - the dsl is basically just html at this point
  // - just test for the differences
  describe ('#parseTemplate',  () => {
    it ('should parse simple templates correctly',  () => {
      const dsl = '<div><span></span></div>';
      const template = parseTemplate(dsl);
      expect(template.tagName).toEqual('div');
      expect(isOptional(template)).not.toEqual(true);
      expect(template.childNodes.length).toEqual(1);
      expect(template.childNodes[0].tagName).toEqual('span');
      expect(isOptional(template.childNodes[0])).not.toEqual(true);
    });

    it ('should parse templates with verbose optional syntax', () => {
      const dsl = '<ul><li></li><li optional="true"></li></ul>';
      const template = parseTemplate(dsl);
      expect(template.tagName).toEqual('ul');
      expect(isOptional(template)).not.toEqual(true);
      expect(template.childNodes.length).toEqual(2);
      expect(template.childNodes[0].tagName).toEqual('li');
      expect(isOptional(template.childNodes[0])).not.toEqual(true);
      expect(template.childNodes[1].tagName).toEqual('li');
      expect(isOptional(template.childNodes[1])).toEqual(true);
    });

    it ('should parse templates with shorthand optional syntax', () => {
      const dsl = '<ul><li></li><li?></li></ul>';
      const template = parseTemplate(dsl);
      expect(template.tagName).toEqual('ul');
      expect(isOptional(template)).not.toEqual(true);
      expect(template.childNodes.length).toEqual(2);
      expect(template.childNodes[0].tagName).toEqual('li');
      expect(isOptional(template.childNodes[0])).not.toEqual(true);
      expect(template.childNodes[1].tagName).toEqual('li');
      expect(isOptional(template.childNodes[1])).toEqual(true);
    });

    it ('should support nested optionals', () => {
      const dsl = '<section?><div></div><span?></span></section>';
      const template = parseTemplate(dsl);
      expect(template.tagName).toEqual('section');
      expect(isOptional(template)).toEqual(true);
      expect(template.childNodes.length).toEqual(2);
      expect(template.childNodes[0].tagName).toEqual('div');
      expect(isOptional(template.childNodes[0])).not.toEqual(true);
      expect(template.childNodes[1].tagName).toEqual('span');
      expect(isOptional(template.childNodes[1])).toEqual(true);
    });

    it ('should support shorthand syntax for self-closing nodes', () => {
      const dsl = '<section><img?/></section>';
      const template = parseTemplate(dsl);
      expect(template.tagName).toEqual('section');
      expect(isOptional(template)).not.toEqual(true);
      expect(template.childNodes.length).toEqual(1);
      expect(template.childNodes[0].tagName).toEqual('img');
      expect(isOptional(template.childNodes[0])).toEqual(true);
    });

    it ('should parse template attributes', () => {
      const dsl = '<div class="1"><a href="2"></a></div>';
      const template = parseTemplate(dsl);
      expect(template.tagName).toEqual('div');
      expect(template.attributes.length).toEqual(1);
      expect(template.attributes[0].name).toEqual('class');
      expect(template.attributes[0].value).toEqual('1');
      expect(isOptional(template)).not.toEqual(true);
      expect(template.childNodes.length).toEqual(1);
      expect(template.childNodes[0].tagName).toEqual('a');
      expect(template.childNodes[0].attributes.length).toEqual(1);
      expect(template.childNodes[0].attributes[0].name).toEqual('href');
      expect(template.childNodes[0].attributes[0].value).toEqual('2');
      expect(isOptional(template.childNodes[0])).not.toEqual(true);
    });
  });

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

    it ('should always skip over comments',  () => {
      const html = '<header><!-- comment 1 -->nonempty<div></div></header>';
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
