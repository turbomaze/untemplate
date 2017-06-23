import { DOMParser } from 'xmldom';
import { extract } from '../src/untemplate.js';

function getDomFromHtml(html) {
  return (new DOMParser()).parseFromString(html.trim(), 'text/xml').firstChild;
}

describe ('scraper',  () => {
  describe ('#extract',  () => {
    it ('should match simple exact templates',  () => {
      let page = getDomFromHtml('<div> hello </div>');
      let template = '<div> {{ greeting }} </div>';
      let structuredData = extract(template, page);

      expect(structuredData.length).toEqual(1);
      expect(structuredData[0]).toEqual({greeting: 'hello'});
    });

    it ('should match single element templates with some depth',  () => {
      let page = getDomFromHtml('<div><span> goodbye </span></div>');
      let template = '<span> {{ farewell }} </span>';
      let structuredData = extract(template, page);

      expect(structuredData.length).toEqual(1);
      expect(structuredData[0]).toEqual({farewell: 'goodbye'});
    });

    it ('should match single element templates multiple times',  () => {
      let page = getDomFromHtml(`
        <ul>
          <li> lasagna </li>
          <li> mofongo </li>
        </ul>
      `);
      let template = '<li> {{ food }} </li>';
      let structuredData = extract(template, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({food: 'lasagna'});
      expect(structuredData[1]).toEqual({food: 'mofongo'});
    });

    it ('should match single element templates at different tree depths',  () => {
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
      let structuredData = extract(template, page);

      expect(structuredData.length).toEqual(3);
      expect(structuredData[0]).toEqual({linkName: 'google'});
      expect(structuredData[1]).toEqual({linkName: 'twitter'});
      expect(structuredData[2]).toEqual({linkName: 'foodler'});
    });

    it ('should match complex exact templates',  () => {
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
      let structuredData = extract(template, page);

      expect(structuredData.length).toEqual(1);
      expect(structuredData[0]).toEqual({
        welcomeMessage: 'welcome',
        linkName: 'login',
        value: 'content'
      });
    });

    it ('should match complex templates with textnodes',  () => {
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
      let structuredData = extract(template, page);

      expect(structuredData.length).toEqual(1);
      expect(structuredData[0]).toEqual({
        message: 'login',
        title: 'homepage',
        content: 'this is my cool site'
      });
    });

    it ('should match complex templates ignoring textnodes',  () => {
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
      let structuredData = extract(template, page);

      expect(structuredData.length).toEqual(1);
      expect(structuredData[0]).toEqual({
        title: 'homepage',
      });
    });

    it ('should match complex templates at different depths',  () => {
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
      let structuredData = extract(template, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({ first: 'alpha', second: 'beta' });
      expect(structuredData[1]).toEqual({ first: 'gamma', second: 'delta' });
    });

    it ('should accumulate repeated properties in complex templates',  () => {
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
      let structuredData = extract(template, page);

      expect(structuredData.length).toEqual(1);
      expect(structuredData[0]).toEqual({
        fruits: ['apples', 'bananas', 'cantaloupe', 'dates']
      });
    });

    it ('should match templates with one optional component',  () => {
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
      let structuredData = extract(template, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({
        school: 'Massachusetts Institute of Technology',
        year: '2014',
        degree: 'Bachelors in Computer Science'
      });
      expect(structuredData[1]).toEqual({
        school: 'Harvard University',
        year: '2019'
      });
    });

    it ('should match templates with many optional components',  () => {
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
      let structuredData = extract(template, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({
        features: 'Wi-Fi connectivity'
      });
      expect(structuredData[1]).toEqual({
        features: [
          'Wi-Fi connectivity', 'Spam-bot filtering', 'Redundant storage'
        ]
      });
    });

    it ('should match templates with doubly-optional components',  () => {
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
      let structuredData = extract(template, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({
        title: 'Administrator',
        name: 'Morty'
      });
      expect(structuredData[1]).toEqual({
        title: 'Superintendent'
      });
    });

    it ('should match templates using the shorthand optional syntax',  () => {
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
      let structuredData = extract(template, page);

      expect(structuredData.length).toEqual(2);
      expect(structuredData[0]).toEqual({
        sectionTitle: 'i make shortfilms',
        linkName: 'most recent film',
        buttonValue: 'donate'
      });
      expect(structuredData[1]).toEqual({
        sectionTitle: 'filler',
      });
    });

    it ('should not match elements of a different tag type',  () => {
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
      let structuredData = extract(template, page);

      expect(structuredData.length).toEqual(1);
      expect(structuredData[0]).toEqual({
        content: 'wingspan'
      });
    });

    it ('should not match complex templates with more/fewer children',  () => {
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
      let structuredData = extract(template, page);

      expect(structuredData.length).toEqual(0);
    });

    it ('should not match templates with additional non-text children',  () => {
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
      let structuredData = extract(template, page);

      expect(structuredData.length).toEqual(0);
    });
  });
});
