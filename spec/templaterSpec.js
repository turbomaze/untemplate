import { deduceTemplate } from '../src/index.js';
import {
  templatesMatch, parseTemplate, getNonEmptyChildren, isOptional, isElement
} from '../src/utils.js';

describe ('untemplate',  () => {
  fdescribe ('#deduceTemplate',  () => {
    it ('should deduce from identical examples',  () => {
      const examples = [`
        <div><span> example 1 </span></div>
      `, `
        <div><span> example 2 </span></div>
      `];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div><span> example 1,example 2 </span></div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });

    it ('should deduce from examples with one unambiguous difference',  () => {
      const examples = [`
        <div><span> example 1 </span></div>
      `, `
        <div><span> example 2 </span><div> example 3</div></div>
      `];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div>
          <span> example 1,example 2 </span>
          <div optional="true"> example 3 </div>
        </div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });

    it ('should assign optionals in BFS order',  () => {
      const examples = [`
        <div><span> example 1 </span></div>
      `, `
        <div><span> example 2 </span><span> example 3</span></div>
      `];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div>
          <span> example 1,example 2 </span>
          <span optional="true"> example 3 </span>
        </div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });

    it ('should consider children when assigning optionals',  () => {
      const examples = [`
        <div><span><div> example 1 </div></span></div>
      `, `
        <div><span> example 2 </span><span><div> example 3</div></span></div>
      `];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div>
          <span optional="true"> example 2 </span>
          <span><div> example 1,example 3 </div></span>
        </div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });

    it ('should consider children regardless of argument order',  () => {
      const examples = [`
        <div><span> example 2 </span><span><div> example 3</div></span></div>
      `, `
        <div><span><div> example 1 </div></span></div>
      `];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div>
          <span optional="true"> example 2 </span>
          <span><div> example 3,example 1 </div></span>
        </div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });

    fit ('should consider more than three children',  () => {
      const examples = [`
        <div>
          <span> example 1 </span>
          <span><div> example 2 </div></span>
          <span><div><div> example 3 </div></div></span>
          <span> example 4 </span>
        </div>
      `, `
        <div>
          <span><div> example 5 </div></span>
          <span> example 6 </span>
        </div>
      `];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div>
          <span?> example 1 </span>
          <span><div> example 2,example 5 </div></span>
          <span?><div><div> example 3 </div></div></span>
          <span> example 4,example 6 </span>
        </div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });
  });
});
