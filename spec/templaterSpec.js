import { deduceTemplate } from '../src/index.js';
import {
  templatesMatch, parseTemplate, getNonEmptyChildren, isOptional, isElement
} from '../src/utils.js';

describe ('untemplate',  () => {
  describe ('#deduceTemplate',  () => {
    it ('should deduce from identical examples',  () => {
      const examples = [`
          <div><span> example 1 </span></div>
        `, `
          <div><span> example 2 </span></div>
        `
      ];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div><span> ['example 1', 'example 2'] </span></div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });

    it ('should deduce from examples with one unambiguous difference',  () => {
      const examples = [`
          <div><span> example 1 </span></div>
        `, `
          <div><span> example 2 </span><div> example 3</div></div>
        `
      ];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div>
          <span> ['example 1', 'example 2'] </span>
          <div optional="true"> ['example 3'] </div>
        </div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });

    fit ('should assign optionals in BFS order',  () => {
      const examples = [`
          <div><span> example 1 </span></div>
        `, `
          <div><span> example 2 </span><span> example 3</span></div>
        `
      ];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div>
          <span> ['example 1', 'example 2'] </span>
          <span optional="true"> ['example 3'] </span>
        </div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });

    it ('should consider children when assigning optionals',  () => {
      const examples = [`
          <div><span><div> example 1 </div></span></div>
        `, `
          <div><span> example 2 </span><span><div> example 3</div></span></div>
        `
      ];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div>
          <span> ['example 2'] </span>
          <span optional="true"><div> ['example 1', 'example 3'] </div></span>
        </div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });

    it ('should consider children regardless of argument order',  () => {
      const examples = [`
          <div><span> example 2 </span><span><div> example 3</div></span></div>
        `, `
          <div><span><div> example 1 </div></span></div>
        `
      ];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div>
          <span> ['example 2'] </span>
          <span optional="true"><div> ['example 1', 'example 3'] </div></span>
        </div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });
  });
});
