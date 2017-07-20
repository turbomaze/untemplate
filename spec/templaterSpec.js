import { deduceTemplate, deduceTemplateVerbose } from '../src/index.js';
import {
  templatesMatch,
  parseTemplate,
  getNonEmptyChildren,
  isOptional,
  isElement,
} from '../src/utils.js';

describe('untemplate', () => {
  describe('#deduceTemplate', () => {
    it('should deduce from identical examples', () => {
      const examples = [
        `
        <div><span> example 1 </span></div>
      `,
        `
        <div><span> example 2 </span></div>
      `,
      ];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div><span> example 1,example 2 </span></div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });

    it('should deduce from examples with one unambiguous difference', () => {
      const examples = [
        `
        <div><span> example 1 </span></div>
      `,
        `
        <div><span> example 2 </span><div> example 3</div></div>
      `,
      ];
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

    it('should assign optionals in BFS order', () => {
      const examples = [
        `
        <div><span> example 1 </span></div>
      `,
        `
        <div><span> example 2 </span><span> example 3</span></div>
      `,
      ];
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

    it('should consider children when assigning optionals', () => {
      const examples = [
        `
        <div><span><div> example 1 </div></span></div>
      `,
        `
        <div><span> example 2 </span><span><div> example 3</div></span></div>
      `,
      ];
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

    it('should consider children regardless of argument order', () => {
      const examples = [
        `
        <div><span> example 2 </span><span><div> example 3</div></span></div>
      `,
        `
        <div><span><div> example 1 </div></span></div>
      `,
      ];
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

    it('should consider more than three children', () => {
      const examples = [
        `
        <div>
          <span> example 1 </span>
          <span><div> example 2 </div></span>
          <span><div><div> example 3 </div></div></span>
          <span> example 4 </span>
        </div>
      `,
        `
        <div>
          <span><div> example 5 </div></span>
          <span> example 6 </span>
        </div>
      `,
      ];
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

    it('should support self closing dom nodes', () => {
      const examples = [
        `
        <header>
          <span> example 1 </span>
          <span>
            <img/>
            <img/>
            <img/>
            <img/>
            <img/>
          </span>
        </header>
      `,
        `
        <header>
          <span> example 5 </span>
          <span>
            <img/>
            <img/>
          </span>
        </header>
      `,
      ];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <header>
          <span> example 1,example 5 </span>
          <span>
            <img/>
            <img/>
            <img?/>
            <img?/>
            <img?/>
          </span>
        </header>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });

    it('should throw UnresolveableExamplesError for inconsistent examples', () => {
      const examples = [
        `
        <div>
          <p> example 1 </p>
        </div>
      `,
        `
        <span>
          <p> example 2 </p>
        </span>
      `,
      ];
      try {
        const templateString = deduceTemplate(examples);
        fail();
      } catch (e) {
        if (e.name !== 'UnresolveableExamplesError') {
          fail();
        }
      }
    });

    it('should ignore classnames when matching templates', () => {
      const examples = [
        `
        <div class="dog">
          <ul>
            <li class="trex"> example 1 </li>
            <li class="dinosaur"> example 2 </li>
          </ul>
        </div>
      `,
        `
        <div class="cat">
          <ul>
            <li class="leopard"> example 3 </li>
            <li> example 4 </li>
            <li class="lion"> example 5 </li>
            <li> example 6 </li>
          </ul>
        </div>
      `,
      ];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div>
          <ul>
            <li> example 1,example 3 </li>
            <li> example 2,example 4 </li>
            <li?> example 5 </li>
            <li?> example 6 </li>
          </ul>
        </div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });

    it('should correctly match highly nested, low-degree nodes', () => {
      const examples = [
        `
        <div>
          <span>
            example 1
            <p>
              <a>
                <b>
                  <i> example 2 </i>
                </b>
              </a>
            </p>
          </span>
        </div>
      `,
        `
        <div>
          <span>
            example 3
            <p>
              <a> </a>
            </p>
          </span>
        </div>
      `,
      ];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div>
          <span>
            example 1,example 3
            <p>
              <a>
                <b?>
                  <i> example 2 </i>
                </b>
              </a>
            </p>
          </span>
        </div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });

    it('should correctly reconcile more than 2 examples together #1', () => {
      const examples = [
        `
        <div>
          <span> example 1 </span>
          <div> example 2 </div>
        </div>
      `,
        `
        <div>
          <span> example 3 </span>
          <p> example 4 </p>
        </div>
      `,
        `
        <div>
          <span> example 5 </span>
          <a> example 6 </a>
        </div>
      `,
      ];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div>
          <span> example 1,example 3,example 5 </span>
          <div?> example 2 </div>
          <p?> example 4 </p>
          <a?> example 6 </a>
        </div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });

    it('should correctly reconcile more than 2 examples together #2', () => {
      const examples = [
        `
        <div>
          <span> example 1 </span>
          <span><div> example 2 </div></span>
          <span><div><div> example 3 </div></div></span>
          <span> example 4 </span>
        </div>
      `,
        `
        <div>
          <span><div> example 5 </div></span>
          <span> example 6 </span>
        </div>
      `,
        `
        <div>
          <span><div><div> example 6 </div></div></span>
          <span> example 7 </span>
        </div>
      `,
        `
        <div>
          <span> example 8 </span>
          <span><div><div> </div></div></span>
          <span> </span>
        </div>
      `,
      ];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div>
          <span?> example 1,example 8 </span>
          <span?><div> example 2,example 5 </div></span>
          <span?><div><div> example 3,example 6 </div></div></span>
          <span> example 4,example 6,example 7 </span>
        </div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });

    it('should reject more than 2 examples if any are inconsistent', () => {
      const examples = [
        `
        <div>
          <span> example 1 </span>
          <span><div> example 2 </div></span>
          <span><div><div> example 3 </div></div></span>
          <span> example 4 </span>
        </div>
      `,
        `
        <section>
          <span><div> example 5 </div></span>
          <span> example 6 </span>
        </section>
      `,
        `
        <div>
          <span> example 8 </span>
          <span><div><div> </div></div></span>
          <span> </span>
        </div>
      `,
      ];
      try {
        const templateString = deduceTemplate(examples);
        fail();
      } catch (e) {
        if (e.name !== 'UnresolveableExamplesError') {
          fail();
        }
      }
    });

    it('should correctly accumulate example text among > 2 examples', () => {
      const examples = [
        `
        <div>
          example 1
          <span> example 2 </span>
          example 3
          <span> example 4 </span>
        </div>
      `,
        `
        <div>
          <span> example 5 </span>
          example 6
          <span> example 7 </span>
          example 8
        </div>
      `,
        `
        <div>
          example 9
          <span> example 10 </span>
          <span> example 11 </span>
          example 12
        </div>
      `,
      ];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div>
          example 1,example 9
          <span> example 2,example 5,example 10 </span>
          example 3,example 6
          <span> example 4,example 7,example 11 </span>
          example 8,example 12
        </div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });

    it('should be able to deduce nested optionals', () => {
      const examples = [
        `
        <div>
          example 1
        </div>
      `,
        `
        <div>
          example 2
          <div> example 3 </div>
        </div>
      `,
        `
        <div>
          example 4
          <div>
            example 5
            <span> example 6 </span>
          </div>
        </div>
      `,
      ];
      const templateString = deduceTemplate(examples);
      const template = parseTemplate(templateString);
      const expectedTemplate = parseTemplate(`
        <div>
          example 1,example 2,example 4
          <div?>
            example 3,example 5
            <span?> example 6 </span>
          </div>
        </div>
      `);
      expect(templatesMatch(expectedTemplate, template)).toEqual(true);
    });
  });

  // whitebox testing: deduceTemplate uses this under the hood, so only test differences
  describe('#deduceTemplateVerbose', () => {
    it('should be able to produce correct dsl info for simple templates', () => {
      const examples = [
        `
        <div><span> example 1 </span></div>
      `,
        `
        <div><span> example 2 </span></div>
      `,
      ];
      const dslInfo = deduceTemplateVerbose(examples);
      const maximalTemplate = parseTemplate(dslInfo.maximalDsl);
      const expectedMaximalTemplate = parseTemplate(`
        <div>
          {{ property-0-0 }}
          <span>{{ property-1-0 }}</span>
          {{ property-0-1 }}
        </div>
      `);
      const expectedConsolidatedValues = {
        'property-1-0': ['example 1', 'example 2'],
      };
      const literalsTemplate = parseTemplate(dslInfo.dslWithLiterals);
      const expectedLiteralsTemplate = parseTemplate(`
        <div><span> example 1,example 2 </span></div>
      `);
      expect(templatesMatch(expectedMaximalTemplate, maximalTemplate)).toEqual(true);
      expect(dslInfo.consolidatedValues).toEqual(expectedConsolidatedValues);
      expect(templatesMatch(expectedLiteralsTemplate, literalsTemplate)).toEqual(true);
    });

    it('should be able to produce correct dsl info for templates with optionals', () => {
      const examples = [
        `
        <div><span><div> example 1 </div></span></div>
      `,
        `
        <div><span> example 2 </span><span><div> example 3</div></span></div>
      `,
      ];
      const dslInfo = deduceTemplateVerbose(examples);
      const maximalTemplate = parseTemplate(dslInfo.maximalDsl);
      const expectedMaximalTemplate = parseTemplate(`
        <div>
          {{ property-0-0 }}
          <span optional="true"> {{ property-1-0 }} </span>
          {{ property-0-1 }}
          <span>
            {{ property-2-0 }}
            <div> {{ property-3-0 }} </div>
            {{ property-2-1 }}
          </span>
          {{ property-0-2 }}
        </div>
      `);
      const expectedConsolidatedValues = {
        'property-1-0': ['example 2'],
        'property-3-0': ['example 1', 'example 3'],
      };
      const literalsTemplate = parseTemplate(dslInfo.dslWithLiterals);
      const expectedLiteralsTemplate = parseTemplate(`
        <div>
          <span optional="true"> example 2 </span>
          <span><div> example 1,example 3 </div></span>
        </div>
      `);
      expect(templatesMatch(expectedMaximalTemplate, maximalTemplate)).toEqual(true);
      expect(dslInfo.consolidatedValues).toEqual(expectedConsolidatedValues);
      expect(templatesMatch(expectedLiteralsTemplate, literalsTemplate)).toEqual(true);
    });
  });
});
