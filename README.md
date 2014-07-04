# codediff.js
[![Build Status](https://travis-ci.org/danvk/codediff.js.svg?branch=master)](https://travis-ci.org/danvk/codediff.js)

codediff.js is a two-column JavaScript diff visualization with syntax highlighting and character-by-character differences.

It was originally based on [jsdifflib](https://github.com/cemerick/jsdifflib), but has been rewritten almost entirely.

![Screenshot of webdiff in action](http://www.danvk.org/webdiff.png)

codediff.js is used by [webdiff](https://github.com/danvk/webdiff).

## Usage

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
            /*options*/
        }));
    </script>

## Development

To iterate on the project locally, open one of the `test*.html` files.

To run the tests, run:

    npm install
    grunt test

