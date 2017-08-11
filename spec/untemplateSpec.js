import { DOMParser } from 'xmldom';
import { untemplate, untemplateWithNeedles, precomputeNeedles } from '../src/index.js';

function getDomFromHtml(html) {
  return new DOMParser().parseFromString(html.trim(), 'text/xml').firstChild;
}

describe('untemplate', () => {
  describe('#untemplate', () => {
    it('should match simple exact templates', () => {
      let page = getDomFromHtml('<div> hello </div>');
      let template = '<div> {{ greeting }} </div>';
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(1);
      expect(structuredData[0]).toEqual({ greeting: 'hello' });
    });

    it('should match single element templates with some depth', () => {
      let page = getDomFromHtml('<div><span> goodbye </span></div>');
      let template = '<span> {{ farewell }} </span>';
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(1);
      expect(structuredData[0]).toEqual({ farewell: 'goodbye' });
    });

    it('should match single element templates multiple times', () => {
      let page = getDomFromHtml(`
        <ul>
          <li> lasagna </li>
          <li> mofongo </li>
        </ul>
      `);
      let template = '<li> {{ food }} </li>';
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({ food: 'lasagna' });
      expect(structuredData[1]).toEqual({ food: 'mofongo' });
    });

    it('should match single element templates at different tree depths', () => {
      let page = getDomFromHtml(`
        <div>
          <a href="http://google.com"> google </a>
          <div>
            <a href="http://twitter.com"> twitter </a>
          </div>
          <div>
            <div>
              <a href="http://foodler.com"> foodler </a>
            </div>
          </div>
        </div>
      `);
      let template = '<a> {{ linkName }} </a>';
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(3);
      expect(structuredData[0]).toEqual({ linkName: 'google' });
      expect(structuredData[1]).toEqual({ linkName: 'twitter' });
      expect(structuredData[2]).toEqual({ linkName: 'foodler' });
    });

    it('should match complex exact templates', () => {
      let page = getDomFromHtml(`
        <header>
          <h1> welcome </h1>
          <div>
            <a> login </a>
          </div>
          <textarea> content </textarea>
        </header>
      `);
      let template = `
        <header>
          <h1> {{ welcomeMessage }} </h1>
          <div>
            <a> {{ linkName }}</a>
          </div>
          <textarea> {{ value }} </textarea>
        </header>
      `;
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(1);
      expect(structuredData[0]).toEqual({
        welcomeMessage: 'welcome',
        linkName: 'login',
        value: 'content',
      });
    });

    it('should match complex templates with textnodes', () => {
      let page = getDomFromHtml(`
        <div>
          login
          <h1> homepage </h1>
          this is my cool site
        </div>
      `);
      let template = `
        <div>
          {{ message }}
          <h1> {{ title }} </h1>
          {{ content }}
        </div>
      `;
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(1);
      expect(structuredData[0]).toEqual({
        message: 'login',
        title: 'homepage',
        content: 'this is my cool site',
      });
    });

    it('should match complex templates ignoring textnodes', () => {
      let page = getDomFromHtml(`
        <div>
          login
          <h1> homepage </h1>
          this is my cool site
        </div>
      `);
      let template = `
        <div>
          <h1> {{ title }} </h1>
        </div>
      `;
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(1);
      expect(structuredData[0]).toEqual({
        title: 'homepage',
      });
    });

    it('should match complex templates at different depths', () => {
      let page = getDomFromHtml(`
        <section>
          <div>
            <div></div>
            <div>
              <ul>
                <li> alpha </li>
                <li> beta </li>
              </ul>
            </div>
          </div>
          <ul>
            <li> gamma </li>
            <li> delta </li>
          </ul>
        </section>
      `);
      let template = `
        <ul>
          <li> {{ first }} </li>
          <li> {{ second }} </li>
        </ul>
      `;
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({ first: 'alpha', second: 'beta' });
      expect(structuredData[1]).toEqual({ first: 'gamma', second: 'delta' });
    });

    it('should accumulate repeated properties in complex templates', () => {
      let page = getDomFromHtml(`
        <ul>
          <li> apples </li>
          <li> bananas </li>
          <li> cantaloupe </li>
          <li> dates </li>
        </ul>
      `);
      let template = `
        <ul>
          <li> {{ fruits }} </li>
          <li> {{ fruits }} </li>
          <li> {{ fruits }} </li>
          <li> {{ fruits }} </li>
        </ul>
      `;
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(1);
      expect(structuredData[0]).toEqual({
        fruits: ['apples', 'bananas', 'cantaloupe', 'dates'],
      });
    });

    it('should match templates with one optional component', () => {
      let page = getDomFromHtml(`
        <ul>
          <li>
            <div> Massachusetts Institute of Technology </div>
            <div> 2014 </div>
            <div> Bachelors in Computer Science </div>
          </li>
          <li>
            <div> Harvard University </div>
            <div> 2019 </div>
          </li>
        </ul>
      `);
      let template = `
        <li>
          <div> {{ school }}</div>
          <div> {{ year }}</div>
          <div optional="true"> {{ degree }}</div>
        </li>
      `;
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({
        school: 'Massachusetts Institute of Technology',
        year: '2014',
        degree: 'Bachelors in Computer Science',
      });
      expect(structuredData[1]).toEqual({
        school: 'Harvard University',
        year: '2019',
      });
    });

    it('should match templates with many optional components', () => {
      let page = getDomFromHtml(`
        <div>
          <div>
            <h3> Features in V1.0 </h3>
            <div> Wi-Fi connectivity </div>
          </div>
          <div>
            <h3> Features in V2.0 </h3>
            <div> Wi-Fi connectivity </div>
            <div> Spam-bot filtering </div>
            <div> Redundant storage </div>
          </div>
        </div>
      `);
      let template = `
        <div>
          <h3></h3>
          <div> {{ features }} </div>
          <div optional="true"> {{ features }} </div>
          <div optional="true"> {{ features }} </div>
        </div>
      `;
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({
        features: 'Wi-Fi connectivity',
      });
      expect(structuredData[1]).toEqual({
        features: ['Wi-Fi connectivity', 'Spam-bot filtering', 'Redundant storage'],
      });
    });

    it('should match templates with doubly-optional components', () => {
      let page = getDomFromHtml(`
        <section>
          <div>
            <h1> Administrator </h1>
            <div>
              <span> Morty </span>
            </div>
          </div>
          <div>
            <h1> Superintendent </h1>
          </div>
        </section>
      `);
      let template = `
        <div>
          <h1> {{ title }} </h1>
          <div optional="true">
            <span> {{ name }} </span>
            <span optional="true"> {{ age }} </span>
          </div>
        </div>
      `;
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({
        title: 'Administrator',
        name: 'Morty',
      });
      expect(structuredData[1]).toEqual({
        title: 'Superintendent',
      });
    });

    it('should match templates using the shorthand optional syntax', () => {
      let page = getDomFromHtml(`
        <body>
          <header> my cool homepage </header>
          <div>
            <span> i make shortfilms </span>
            <a> most recent film </a>
            <button> donate  </button>
          </div>
          <div>
            <span> filler </span>
          </div>
        </body>
      `);
      let template = `
        <div>
          <span> {{ sectionTitle }} </span>
          <a?> {{ linkName }} </a>
          <button?> {{ buttonValue }} </button>
        </div>
      `;
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({
        sectionTitle: 'i make shortfilms',
        linkName: 'most recent film',
        buttonValue: 'donate',
      });
      expect(structuredData[1]).toEqual({
        sectionTitle: 'filler',
      });
    });

    it('should not match elements of a different tag type', () => {
      let page = getDomFromHtml(`
        <body>
          <div>
            <a> sweet anchor </a>
          </div>
          <div>
            <span> wingspan </span>
          </div>
        </body>
      `);
      let template = `
        <span> {{ content }} </span>
      `;
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(1);
      expect(structuredData[0]).toEqual({
        content: 'wingspan',
      });
    });

    it('should not match complex templates with more/fewer children', () => {
      let page = getDomFromHtml(`
        <body>
          <ul>
            <li> kingdom </li>
            <li> phylum </li>
            <li> genus </li>
            <li> species </li>
          </ul>
          <ul>
            <li> family </li>
            <li> order </li>
          </ul>
        </body>
      `);
      let template = `
        <ul>
          <li> {{ bio }} </li>
          <li> {{ bio }} </li>
          <li> {{ bio }} </li>
        </ul>
      `;
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(0);
    });

    it('should not match templates with additional non-text children', () => {
      let page = getDomFromHtml(`
        <div>
          <div>
            <span> anthony </span>
          </div>
        </div>
      `);
      let template = `
        <div>
          <div> {{ content }} </li>
        </div>
      `;
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(0);
    });

    it('should match large templates with many optionals', () => {
      let page = getDomFromHtml(`
        <div>
          <div>
            <div> a </div>
            <div> b </div>
            <div> c </div>
          </div>
          <div>
            <div> d </div>
            <div> e </div>
            <div> f </div>
          </div>
          <div>
            <div> g </div>
            <div> h </div>
            <div> i </div>
          </div>
        </div>
      `);
      let template = `
        <div>
          <div>
            <div> {{ letter1 }} </div>
            <div> {{ letter2 }} </div>
            <div?> {{ letter3 }} </div>
            <div?> {{ letter4 }} </div>
          </div>
          <div?>
            <div> {{ letter5 }} </div>
            <div> {{ letter6 }} </div>
            <div?> {{ letter7 }} </div>
            <div?> {{ letter8 }} </div>
          </div>
          <div?>
            <div> {{ letter9 }} </div>
            <div> {{ letter10 }} </div>
            <div?> {{ letter11 }} </div>
            <div?> {{ letter12 }} </div>
          </div>
          <div?>
            <div> {{ letter13 }} </div>
            <div> {{ letter14 }} </div>
            <div?> {{ letter15 }} </div>
            <div?> {{ letter16 }} </div>
          </div>
        </div>
      `;
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(1);
      expect(structuredData[0]).toEqual({
        letter1: 'a',
        letter2: 'b',
        letter3: 'c',
        letter5: 'd',
        letter6: 'e',
        letter7: 'f',
        letter9: 'g',
        letter10: 'h',
        letter11: 'i',
      });
    });

    it('should ignore html comments', () => {
      let page = getDomFromHtml(`
        <body>
          <div>
            <!-- comment 1 -->
            <span> example 1 </span>
            <!-- comment 2 -->
            <!-- comment 3 -->
            <span> example 2 </span>
          </div>
          <div>
            <span> example 3 </span>
            <span> example 4 </span>
          </div>
        </body>
      `);
      let template = `
        <div>
          <span> {{ prop1 }} </span>
          <span> {{ prop2 }} </span>
        </div>
      `;
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({
        prop1: 'example 1',
        prop2: 'example 2',
      });
      expect(structuredData[1]).toEqual({
        prop1: 'example 3',
        prop2: 'example 4',
      });
    });

    it('should extract info from attributes', () => {
      let page = getDomFromHtml(`
        <body>
          <div>
            <span title="attribute 1"> example 1 </span>
          </div>
          <div>
            <span title="attribute 2"> example 2 </span>
          </div>
        </body>
      `);
      let template = `
        <div>
          <span title="{{ attribute }}"> {{ prop }} </span>
        </div>
      `;
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({
        prop: 'example 1',
        attribute: 'attribute 1',
      });
      expect(structuredData[1]).toEqual({
        prop: 'example 2',
        attribute: 'attribute 2',
      });
    });

    it('should extract info from more complex attributes', () => {
      let page = getDomFromHtml(`
        <body>
          <div class="unused 1">
            <span title="i am a title"> example 1 </span>
          </div>
          <div href="i am an href">
            <span> example 2 </span>
          </div>
        </body>
      `);
      let template = `
        <div href="{{ hrefAttribute }}">
          <span title="{{ titleAttribute }}"> {{ prop }} </span>
        </div>
      `;
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({
        prop: 'example 1',
        titleAttribute: 'i am a title',
      });
      expect(structuredData[1]).toEqual({
        prop: 'example 2',
        hrefAttribute: 'i am an href',
      });
    });

    it('should extract attributes on optional elements', () => {
      let page = getDomFromHtml(`
        <body>
          <div>
            <span> example 1 </span>
            <span class="example 2"> </span>
          </div>
          <div>
            <span> example 3 </span>
          </div>
        </body>
      `);
      let template = `
        <div>
          <span> {{ prop1 }} </span>
          <span class="{{ prop2 }}" ?> </span>
        </div>
      `;
      let structuredData = untemplate(template, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({
        prop1: 'example 1',
        prop2: 'example 2',
      });
      expect(structuredData[1]).toEqual({
        prop1: 'example 3',
      });
    });
  });

  describe('#precomputeNeedles', () => {
    it('should compute the correct hashes for simple templates', () => {
      let template = '<div> {{ greeting }} </div>';
      let needles = precomputeNeedles(template);
      expect(needles).toEqual({
        f66b8069cbb849233816cec5a787b0fd1ca88c8d: {},
      });
    });

    it('should compute the correct hashes for more complex templates', () => {
      let template = '<div> <span> </span> <a?> <i?> </i> </a> </div>';
      let needles = precomputeNeedles(template);
      expect(needles).toEqual({
        da0541aed47d67deff3f27a7b9a0426e48ca42f5: { '0': false, '1': false },
        e15e877e9cd4f08ca9f974145dba2cce17b52351: { '0': true, '1': true },
        '93e5663349ed25455036a070ca126a7c6ffa6a62': { '0': false, '1': true },
      });
    });

    it('should only base hashes on the DOM structure, not contents', () => {
      let template = `<section>
        <h1 class="heading" ?> title </h1>
        <h2 style="font-size: 10px" ?> subtitle </h2>
        <div>
          <span class="name" id="user-first-name"> much </span>
          <span class="name" id="user-last-name" ?> content </span>
        </div>
        many words
      </section>`;
      let needles = precomputeNeedles(template);
      expect(needles).toEqual({
        '87b776001fb9a441cb3c1d36779d44c3215d592f': { '0': false, '1': false, '2': false },
        f7ede8333e7afdfc97988f6caa200e102eb2a189: { '0': true, '1': false, '2': false },
        '5df89e012de7c4ae646f454a574c0cbacf0dc569': { '0': false, '1': true, '2': false },
        '6328c4d73164208a5eb208073d7d443a4bc35784': { '0': true, '1': true, '2': false },
        e1d539e88dd849282e4695c2839f0c83147d1c92: { '0': false, '1': false, '2': true },
        '43d1a619425b96650dd11530bc39eb08e986cced': { '0': true, '1': false, '2': true },
        cc1d189b6c2647ae4132d0450a91f00617d4ed97: { '0': false, '1': true, '2': true },
        eac18323d9cfe8cb1d9df96a9eb3cf3916a92b63: { '0': true, '1': true, '2': true },
      });
    });

    it('should call the progress callback the correct number of times', () => {
      // progress will go as follows:
      // 0.00, 0.06, 0.12, 0.18, 0.25, 0.31, 0.37, 0.43,
      // 0.50, 0.56, 0.62, 0.68, 0.75, 0.81, 0.87, 0.93
      let template = `<div>
        <div ?> {{ prop-0-0 }} </div>
        <div ?> {{ prop-0-1 }} </div>
        <div ?> {{ prop-0-2 }} </div>
        <div ?> {{ prop-0-3 }} </div>
      </div>`;
      const percentages = [];
      precomputeNeedles(template, progress => percentages.push(progress), 0.1);
      expect(percentages).toEqual([
        2 / 16,
        4 / 16,
        5 / 16,
        7 / 16,
        8 / 16,
        10 / 16,
        12 / 16,
        13 / 16,
        15 / 16,
      ]);
    });

    it('should stop and return false if the progress callback stops', () => {
      // progress will go as follows:
      // 0.00, 0.06, 0.12, 0.18, 0.25, 0.31, 0.37, 0.43,
      // 0.50, 0.56, 0.62, 0.68, 0.75, 0.81, 0.87, 0.93
      let template = `<div>
        <div ?> {{ prop-0-0 }} </div>
        <div ?> {{ prop-0-1 }} </div>
        <div ?> {{ prop-0-2 }} </div>
        <div ?> {{ prop-0-3 }} </div>
      </div>`;
      const percentages = [];
      const needles = precomputeNeedles(
        template,
        (progress, stop) => {
          percentages.push(progress);
          if (progress >= 0.5) stop();
        },
        0.1
      );
      expect(percentages).toEqual([2 / 16, 4 / 16, 5 / 16, 7 / 16, 8 / 16]);
      expect(needles).toEqual(false);
    });
  });

  // whitebox testing: only test the differences b/w #untemplate
  describe('#untemplateWithNeedles', () => {
    it('should match simple exact templates', () => {
      let page = getDomFromHtml('<div> hello </div>');
      let needles = { f66b8069cbb849233816cec5a787b0fd1ca88c8d: {} };
      let template = '<div> {{ greeting }} </div>';
      let structuredData = untemplateWithNeedles(template, needles, page);

      expect(structuredData.length).toEqual(1);
      expect(structuredData[0]).toEqual({ greeting: 'hello' });
    });

    it('should match templates with one optional component', () => {
      let page = getDomFromHtml(`
        <ul>
          <li>
            <div> Massachusetts Institute of Technology </div>
            <div> 2014 </div>
            <div> Bachelors in Computer Science </div>
          </li>
          <li>
            <div> Harvard University </div>
            <div> 2019 </div>
          </li>
        </ul>
      `);
      let needles = {
        '7a4e9ca7c88bf21052c02343cc9268847b15e9ef': { '0': false },
        '3d17cb2d59e752e8cbb04e3a78a2bb614b247d32': { '0': true },
      };
      let template = `
        <li>
          <div> {{ school }}</div>
          <div> {{ year }}</div>
          <div optional="true"> {{ degree }}</div>
        </li>
      `;
      let structuredData = untemplateWithNeedles(template, needles, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({
        school: 'Massachusetts Institute of Technology',
        year: '2014',
        degree: 'Bachelors in Computer Science',
      });
      expect(structuredData[1]).toEqual({
        school: 'Harvard University',
        year: '2019',
      });
    });

    it('should not match complex templates with more/fewer children', () => {
      let page = getDomFromHtml(`
        <body>
          <ul>
            <li> kingdom </li>
            <li> phylum </li>
            <li> genus </li>
            <li> species </li>
          </ul>
          <ul>
            <li> family </li>
            <li> order </li>
          </ul>
        </body>
      `);
      let needles = {
        '7c8a9440016b5dce45c0f7dc926d85a8a1f468be': {},
      };
      let template = `
        <ul>
          <li> {{ bio }} </li>
          <li> {{ bio }} </li>
          <li> {{ bio }} </li>
        </ul>
      `;
      let structuredData = untemplateWithNeedles(template, needles, page);

      expect(structuredData.length).toEqual(0);
    });

    it('should match templates using the shorthand optional syntax', () => {
      let page = getDomFromHtml(`
        <body>
          <header> my cool homepage </header>
          <div>
            <span> i make shortfilms </span>
            <a> most recent film </a>
            <button> donate  </button>
          </div>
          <div>
            <span> filler </span>
          </div>
        </body>
      `);
      let needles = {
        '76d087f9f3cd2ce6d424d7ac812dc42502339769': { '0': false, '1': false },
        '9b1eef05cfb98c44abddc27b1c07a74fe9f93b3e': { '0': true, '1': false },
        '93e5663349ed25455036a070ca126a7c6ffa6a62': { '0': false, '1': true },
        e15e877e9cd4f08ca9f974145dba2cce17b52351: { '0': true, '1': true },
      };
      let template = `
        <div>
          <span> {{ sectionTitle }} </span>
          <a?> {{ linkName }} </a>
          <button?> {{ buttonValue }} </button>
        </div>
      `;
      let structuredData = untemplateWithNeedles(template, needles, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({
        sectionTitle: 'i make shortfilms',
        linkName: 'most recent film',
        buttonValue: 'donate',
      });
      expect(structuredData[1]).toEqual({
        sectionTitle: 'filler',
      });
    });
  });
});
