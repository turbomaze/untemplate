var untemplate = require('../src/index');
var html_beautify = require('js-beautify').html;

var TemplaterDemo = (function() {
  // constants
  var PREVIEW_LENGTH = 100;

  // state
  var examples = [];
    
  function initTemplaterDemo() {
    $('#example-html').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        addExample();
        $('#example-html').value = '';
        return false;
      }
    });

    $('#add-example-btn').addEventListener('click', function() {
      addExample();
    });

    $('#clear-btn').addEventListener('click', clear);

    $('#generate-template-btn').addEventListener('click', function() {
      generateTemplate();
    });
  }

  function addExample() {
    var example = $('#example-html').value;
    if (example.trim() !== '') {
      examples.push(example.trim());
      $('#example-html').value = '';
      render();
    }
  }

  // render example prefixes on the page
  function render() {
    $('#examples').innerHTML = '';
    examples.forEach(function(example) {
      var li = document.createElement('li'); 
      li.className = 'example';
      li.title = example;
      li.innerHTML = escapeHtml(example.substring(0, PREVIEW_LENGTH));
      if (example.length > PREVIEW_LENGTH) {
        li.innerHTML += ' ...';
      }
      $('#examples').appendChild(li);
    });
  }

  // clear the examples and rerender the page
  function clear() {
    examples = [];
    $('#example-html').value = '';
    render();
  }

  function generateTemplate() {
    if (examples.length > 0) {
      addExample();
      var template = untemplate.deduceTemplate(examples);
      var longhandTemplate = template.replace(/\?>/g, ' optional="true">');
      var beautifiedTemplate = html_beautify(longhandTemplate, {indent_size: 2});
      var escapedTemplate = escapeHtml(beautifiedTemplate);
      var prettyTemplate = escapedTemplate
        .split('\n')
        .map(function(line) {
          var numSpaces = (line.match(/^ +/g) || [''])[0].length;
          var nbsps = '';
          for (var i = 0; i < numSpaces; i++) nbsps += '&nbsp;';
          return line.replace(/^ +/g, nbsps);
        })
        .join('<br>')
        .replace(/<br><br>/g, '<br>')
        .replace(/ optional="true"/g, '<b style="margin-left: 0.5rem">?</b>');
      $('#template').innerHTML = prettyTemplate;
      hljs.highlightBlock($('#template'));
    }
  }

  // from https://stackoverflow.com/questions/6234773
  //   /can-i-escape-html-special-chars-in-javascript
  function escapeHtml(html) {
    var text = document.createTextNode(html);
    var div = document.createElement('div');
    div.appendChild(text);
    return div.innerHTML;
  }

  function $(id) {
    return document.getElementById(id.substring(1));
  }

  return {
    init: initTemplaterDemo
  };
})();

window.addEventListener('DOMContentLoaded', TemplaterDemo.init);
