untemplate.js
==

This node module provides a way to scrape structured information from websites based on HTML templates.

### tl;dr
Templating engines like handlebars/jade:

`{ structured: 'info' } + {{ template }} = <html>`

This module:

`<html> - {{ template }} = { structured: 'info' }`

## Usage

```js
import { untemplate } from <this module>;

// obtain a DOM element from somewhere
let element = _getDomFromHtml(`
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
    <span?> {{ country }} </span>
  </div>
`;
let data = untemplate(template, page);
// data: [{ region: 'alberta' }, { region: 'bc', country: 'canada' }]
```

## Features

Refer to the specs file at `spec/untemplateSpec.js` for examples of each of these features.

- given a page like `<div> hello </div>` and a template like `<div> {{ greeting }} </div>`, produces the associative array `{ greeting: 'hello' }`
- the templates can contain arbitrary HTML elements
- they can occur zero, one, or many times in the target page
- they can appear anywhere on the page, all occurrences at different levels of nesting
- robust to unexpected additions / removals of textnodes in the DOM
- all `{{ property }}` captures are optional to simplify template creation
- can mark DOM nodes in the template as optionally occurring
- can have nested optional DOM nodes

## API

### `#untemplate(dsl, element)`

* arguments
  * `dsl`: the template as a string; valid templates are valid HTML, sans attributes, with one notable exception: `optional="true"`. This makes the node it's attached to optional in the template. Some sugar: `<div optional="true"></div>` <=> `<div?></div>`.
  * `element`: the root DOM element to search for the template in. This must be a proper DOM element, either output from some library like `xmldom` or from the browser
* returns
  * a list of associative arrays containing the structured information contained in `element`
  * each matching of the template corresponds to one associative array in the returned list
  * the returned list is in left-to-right BFS order

## License

MIT &copy; fin ventures