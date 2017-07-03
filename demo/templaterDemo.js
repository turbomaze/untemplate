// @flow

const untemplate = require('../src/index');
const html_beautify = require('js-beautify').html;

const TemplaterDemo = (function() {
  // constants
  const PREVIEW_LENGTH: number = 100;

  // state
  const examples = [];
    
  function initTemplaterDemo(): void {
    const exampleInput: HTMLInputElement = ($('example-html'): any);
    exampleInput.addEventListener('keydown', function(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        addExample();
        const exampleInput: HTMLInputElement = ($('example-html'): any);
        exampleInput.value = '';
        return false;
      }
    });

    const exampleButton: HTMLButtonElement = ($('add-example-btn'): any);
    exampleButton.addEventListener('click', function() {
      addExample();
    });

    const clearButton: HTMLButtonElement = ($('clear-btn'): any);
    clearButton.addEventListener('click', clear);

    const generateButton: HTMLButtonElement = ($('generate-template-btn'): any);
    generateButton.addEventListener('click', function() {
      generateTemplate();
    });
  }

  function addExample() {
    const exampleInput: HTMLInputElement = ($('example-html'): any);
    const example = exampleInput.value;
    if (example.trim() !== '') {
      examples.push(example.trim());
      exampleInput.value = '';
      render();
    }
  }

  // render example prefixes on the page
  function render() {
    const examplesList: HTMLElement = ($('examples'): any);
    examplesList.innerHTML = '';
    examples.forEach(function(example) {
      const li = document.createElement('li'); 
      li.className = 'example';
      li.title = example;
      li.innerHTML = escapeHtml(example.substring(0, PREVIEW_LENGTH));
      if (example.length > PREVIEW_LENGTH) {
        li.innerHTML += ' ...';
      }
      examplesList.appendChild(li);
    });
  }

  // clear the examples and rerender the page
  function clear() {
    examples.splice(0, examples.length);
    const exampleInput: HTMLInputElement = ($('example-html'): any);
    exampleInput.value = '';
    render();
  }

  function generateTemplate() {
    if (examples.length > 0) {
      addExample();
      const template = untemplate.deduceTemplate(examples);
      const longhandTemplate = template.replace(/\?>/g, ' optional="true">');
      const beautifiedTemplate = html_beautify(longhandTemplate, {indent_size: 2});
      const escapedTemplate = escapeHtml(beautifiedTemplate);
      const prettyTemplate = escapedTemplate
        .split('\n')
        .map(function(line) {
          const numSpaces = (line.match(/^ +/g) || [''])[0].length;
          let nbsps = '';
          for (let i = 0; i < numSpaces; i++) nbsps += '&nbsp;';
          return line.replace(/^ +/g, nbsps);
        })
        .join('<br>')
        .replace(/<br><br>/g, '<br>')
        .replace(/ optional="true"/g, '<b style="margin-left: 0.5rem">?</b>');
      const templateNode: HTMLElement = ($('template'): any);
      templateNode.innerHTML = prettyTemplate;

      // $FlowFixMe
      hljs.highlightBlock($('template')); // included via `index.html`
    }
  }

  // from https://stackoverflow.com/questions/6234773
  //   /can-i-escape-html-special-chars-in-javascript
  function escapeHtml(html) {
    const text = document.createTextNode(html);
    const div = document.createElement('div');
    div.appendChild(text);
    return div.innerHTML;
  }

  function $(id: string): ?HTMLElement {
    return document.getElementById(id);
  }

  return {
    init: initTemplaterDemo
  };
})();

window.addEventListener('DOMContentLoaded', TemplaterDemo.init);
