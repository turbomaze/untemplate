untemplate.js
==

This node module provides a way to scrape structured information from websites based on HTML templates.

### tl;dr
Templating engines like handlebars/jade:

`{ structured: 'info' } + {{ template }} = <html>`

This module:

`<html> - {{ template }} = { structured: 'info' }`

Alternatively, you can think of `untemplate.js` as a declarative DSL for web scraping.

## Usage

```js
import { untemplate } from 'untemplate';

// obtain a DOM element from somewhere
let element = get-dom-from-html(`
  <div>
    <div>
      <span> alberta </span>
    </div>
    <div>
      <span> bc </span>
      <span> canada </span>
    </div>
  </div>
`;
let template = `
  <div>
    <span> {{ region }} </span>
    <span ?> {{ country }} </span>
  </div>
`;
let data = untemplate(template, element);
// data: [{ region: 'alberta' }, { region: 'bc', country: 'canada' }]
```

How do you make templates you ask? See the API section below for details on the `deduceTemplate` function.

## Features

Refer to the specs file at `spec/untemplateSpec.js` for examples of each of these features.

- given a page like `<div> hello </div>` and a template like `<div> {{ greeting }} </div>`, produces the associative array `{ greeting: 'hello' }`
- the templates can contain arbitrary HTML elements
- they can occur zero, one, or many times in the target page
- they can appear anywhere on the page, all occurrences at different levels of nesting
- robust to unexpected additions / removals of textnodes in the DOM
- all `{{ property }}` captures are optional to simplify template creation
- can mark DOM nodes in the template as "optional", which means they don't need to occur for the template to match
- can have nested optional DOM nodes
- can deduce the optimal template given a list of dom nodes

## API

### `#untemplate(dsl, element[, cb, rate])`

* arguments
  * `dsl`: the template as a string; valid templates are valid HTML, sans attributes, with one notable exception: `optional="true"`. This makes the node it's attached to optional in the template. Some sugar: `<div optional="true"></div>` <=> `<div?></div>`.
  * `element`: the root DOM element to search for the template in. This must be a proper DOM element, either output from some library like `xmldom` or from the browser
  * `cb`: (optional) a progress callback that is periodically called with the approximate completion percentage (first argument) and a stop function (second argument) that causes `untemplate` to terminate early if called
  * `rate`: (optional) the approximate percent of progress that occurs between each call of `cb`
* returns
  * a list of associative arrays containing the structured information contained in `element`
  * each matching of the template corresponds to one associative array in the returned list
  * the returned list is in left-to-right BFS order
* throws
  * `EarlyStopException`: thrown if the `cb` function calls its `stop` argument

### `#precomputeNeedles(dsl[, cb, rate])`

* arguments
  * `dsl`: the template as a string; valid templates are valid HTML, sans attributes, with one notable exception: `optional="true"`. This makes the node it's attached to optional in the template. Some sugar: `<div optional="true"></div>` <=> `<div?></div>`.
  * `cb`: (optional) a progress callback that is periodically called with the precomputation completion percentage (first argument) and a stop function (second argument) that causes `precomputeNeedles` to terminate early if called
  * `rate`: (optional) the approximate percent of progress that occurs between each call of `cb`
* returns
  * a JSON object containing information that allows you to call `#untemplateWithNeedles` instead of `#untemplate` for a drastic performance increase
* throws
  * `EarlyStopException`: thrown if the `cb` function calls its `stop` argument

### `#deduceTemplate(elements[, cb, rate])`

* arguments
  * `examples`: a list of HTML nodes as strings. These nodes should all represent the same "type of thing" in the page you'd like to apply the template to. For instance, the HTML for each search result in a long list of search results. These nodes must all share the same outermost tag.
  * `cb`: (optional) a progress callback that is periodically called with the approximate completion percentage (first argument) and a stop function (second argument) that causes `deduceTemplate` to terminate early if called
  * `rate`: (optional) the approximate percent of progress that occurs between each call of `cb`
* returns
  * a string representing the minimum template that matches all of the provided examples
    * minimum means: fewest number of optional nodes in the template (this count includes the descendants of optional nodes)
  * this string all of the text in the provided examples in an aggregated form to communicate which portions of the template correspond to what
* throws
  * `UnresolveableExamplesError`: thrown if the input examples cannot be reconciled for any reason (usually just because they do not share a common outermost tag)
  * `EarlyStopException`: thrown if the `cb` function calls its `stop` argument

### `#deduceTemplateVerbose(elements[, prefix, cb, rate])`

* arguments
  * `examples`: see arguments for `#deduceTemplate`
  * `prefix`: (optional) a string to prefix all of the generated property selectors with
  * `cb`: (optional) a progress callback that is periodically called with the approximate completion percentage (first argument) and a stop function (second argument) that causes `deduceTemplateVerbose` to terminate early if called
  * `rate`: (optional) the approximate percent of progress that occurs between each call of `cb`
* returns
  * an object literal conaining the following keys
    * `maximalDsl`: a template to match the examples with property selectors in all possible positions
    * `consolidatedValues`: an object literal mapping the property selectors in `maximalDsl` to the literal values in `dslWithLiterals`
    * `dslWithLiterals`: the same minimum template returned by `#deduceTemplate`
* throws
  * `UnresolveableExamplesError`: thrown in same cases as `#deduceTemplate`
  * `EarlyStopException`: thrown if the `cb` function calls its `stop` argument

## Running locally

This project uses Webpack to generate a bundle file and Flow to check types. The following commands will use `yarn`, but you can use `npm` or `npm run` interchangeably.

1. `yarn install` to grab the dependencies.
2. `yarn flow` to check the types
3. `yarn test` to run tests (this project uses jasmine)
4. `yarn build` to create a bundle file in `lib/`

For a front-end interface to the `#deduceTemplate` function, open the `index.html` file in a browser. This will allow you to paste in HTML and deduce the template the minimally matches those html examples.

## License

MIT &copy; fin ventures
