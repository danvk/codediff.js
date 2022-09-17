# codediff.js
[![Build Status](https://travis-ci.org/danvk/codediff.js.svg?branch=master)](https://travis-ci.org/danvk/codediff.js)

codediff.js is a two-column JavaScript diff visualization with syntax highlighting and character-by-character differences.

It was originally based on [jsdifflib](https://github.com/cemerick/jsdifflib), but has been rewritten almost entirely.

[Try the online demo!](http://rawgit.com/danvk/codediff.js/master/testcode.html)

![Screenshot of webdiff in action](http://www.danvk.org/webdiff.png)

codediff.js is used by [webdiff](https://github.com/danvk/webdiff).

## Usage

```html
<!-- Third-party dependencies -->
<script src="jquery.min.js"></script>
<script src="highlight.min.js"></script>
<link rel="stylesheet" href="googlecode.css">  <!-- highlight.js theme -->

<!-- codediff -->
<script src="difflib.js"></script>
<script src="codediff.js"></script>
<link rel="stylesheet" href="codediff.css">

<!-- DOM -->
<p>Here's the diff!</p>
<div id="diffview"></div>

<!-- Usage -->
<script type="text/javascript">
$('#diffview').append(
    codediff.buildView(codeBefore, codeAfter, {
        /* options -- see below */
    }));

// or provide your own diff:
codediff.buildViewFromOps(codeBefore, codeAfter, diffOps, options)
</script>
```

## Options

Here are possible keys you can pass through the options parameter:

* `language`: Language to use for syntax highlighting. This parameter is passed through to highlight.js, which does the highlighting. Any value it will accept is fine. You can do `hljs.getLanguage(language)` to see if a language code is valid. A null value (the default) will disable syntax highlighting. Example values include "python" or "javascript". (default: _null_)
* `beforeName`: Text to place above the left side of the diff.
* `afterName`: Text to place above the right side of the diff.
* `contextSize`: Minimum number of lines of context to show around each diff hunk. (default: _3_).
* `minJumpSize`: Minimum number of equal lines to collapse into a "Show N more lines" link. (default: _10_)
* `wordWrap`: By default, code will go all the way to the right margin of the diff. If there are 60 characters of space, character 61 will wrap to the next line, even mid-word. To wrap at word boundaries instead, set this option.

Here's an example usage with a filled-out options parameter:

```javascript
$('#diffview').append(
    codediff.buildView(codeBefore, codeAfter, {
        language: 'python',
        beforeName: 'oldfilename.py',
        afterName: 'newfilename.py',
        contextSize: 8,
        minJumpSize: 5,
        wordWrap: true
    }));
```

## Development

To iterate on the project locally, open one of the `test*.html` files.

To run the tests, run:

    npm install
    npm run watch
    open test/index.html

To build, run:

    npm run build
