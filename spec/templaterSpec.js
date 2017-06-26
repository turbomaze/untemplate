import { deduceTemplate } from '../src/index.js';
import { parseHtml } from '../src/utils.js';

function templatesMatch(a, b) {
  return false;
}

describe ('untemplate',  () => {
  describe ('#deduceTemplate',  () => {
    fit ('should deduce from identical examples',  () => {
      const examples = [`
          <div><span> example 1 </span></div>
        `, `
          <div><span> example 2 </span></div>
        `
      ];
      const templateString = deduceTemplate(examples);
      const template = parseHtml(templateString);
      const expectedTemplate = parseHtml(`
        <div><span> {{ property0 }} </span></div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });
  });
});
