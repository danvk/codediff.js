var codediff = (function() {

var differ = function(beforeText, afterText, userParams) {
  var defaultParams = {
    contextSize: 3,
    language: null,
    beforeName: "Before",
    afterName: "After"
  };

  this.params = $.extend({}, defaultParams, userParams);

  this.beforeLines = beforeText ? difflib.stringAsLines(beforeText) : [];
  this.afterLines = afterText ? difflib.stringAsLines(afterText) : [];
  var sm = new difflib.SequenceMatcher(this.beforeLines, this.afterLines);
  this.opcodes = sm.get_opcodes();

  if (this.params.language) {
    var lang = this.params.language;
    this.beforeLinesHighlighted = differ.highlightText_(beforeText, lang);
    this.afterLinesHighlighted = differ.highlightText_(afterText, lang);
  }
};

differ.prototype.maxLineNumber = function() {
  return Math.max(this.beforeLines.length, this.afterLines.length);
};

/**
 * @param {string} text Possibly multiline text containing spans that cross
 *     line breaks.
 * @return {Array.<string>} An array of individual lines, each of which has
 *     entirely balanced <span> tags.
 */
differ.distributeSpans_ = function(text) {
  var lines = difflib.stringAsLines(text);
  var spanRe = /(<span[^>]*>)|(<\/span>)/;

  var outLines = [];
  var liveSpans = [];
  lines.forEach(function(line) {
    var groups = line.split(spanRe);
    var i = 0;
    var outLine = liveSpans.join('');
    while (i < groups.length) {
      var g = groups[i];
      if (g === undefined) {
        // close span
        outLine += groups[i + 1];
        liveSpans.pop();
        i += 2;
      } else if (g.substr(0, 5) == '<span') {
        // open span
        i += 2;
        outLine += g;
        liveSpans.push(g);
      } else {
        // plain text
        outLine += g;
        i++;
      }
    }
    liveSpans.forEach(function() { outLine += '</span>'; });
    outLines.push(outLine);
  });
  if (liveSpans.length) throw "Unbalanced <span>s in " + text;
  return outLines;
};

/**
 * @param {string} text The lines to highlight.
 * @param {?string} opt_language Language to pass to highlight.js. If not
 *     specified, then the language will be auto-detected.
 * @return {Array.<string>} Lines marked up with syntax <span>s. The <span>
 *     tags will be balanced within each line.
 */
differ.highlightText_ = function(text, opt_language) {
  if (text === null) return [];

  // TODO(danvk): look into suppressing highlighting if .relevance is low.
  var html;
  if (opt_language) {
    html = hljs.highlight(opt_language, text, true).value;
  } else {
    return null;
    // This produces a lot of false positives:
    // html = hljs.highlightAuto(text).value;
    // There is a relevance number but it's hard to threshold. The file
    // extension is probably a good enough heuristic.
  }

  // Some of the <span>s might cross lines, which won't work for our diff
  // structure. We convert them to single-line only <spans> here.
  return differ.distributeSpans_(html);
}

/**
 * Attach event listeners, notably for the "show more" links.
 */
differ.prototype.attachHandlers_ = function(el) {
  var this_differ = this;
  $(el).on('click', '.skip a', function(e) {
    e.preventDefault();
    var skipData = $(this).closest('.skip').data();
    var beforeIdx = skipData.beforeStartIndex;
    var afterIdx = skipData.afterStartIndex;
    var jump = skipData.jumpLength;
    var beforeEnd = beforeIdx + jump;
    var afterEnd = afterIdx + jump;
    var change = "equal";
    var newTrs = [];
    for (var i = 0; i < jump; i++) {
      var data = this_differ.buildRow_(beforeIdx, beforeEnd, afterIdx, afterEnd, change);
      beforeIdx = data.newBeforeIdx;
      afterIdx = data.newAfterIdx;
      var row = data.row;
      var $tr = $('<tr>');
      $tr.append(row);
      newTrs.push($tr.get(0));
    }

    // Replace the "skip" rows with real code.
    var $skipTr = $(this).closest('tr');
    $skipTr.replaceWith(newTrs);
  });

  // Hooks for single-column text selection.
  // See http://stackoverflow.com/a/27530627/388951 for details.
  $(el).on('mousedown', function(e) {
    var $td = $(e.target).closest('td'),
        isLeft = $td.is('.before'),
        isRight = $td.is('.after');
    if (!isLeft && !isRight) return;

    el.removeClass('selecting-left selecting-right')
      .addClass('selecting-' + (isLeft ? 'left' : 'right'));
  }).on('copy', function(e) {
    var isLeft = el.is('.selecting-left'),
        idx = isLeft ? 1 : 2;  // index of <td> within <tr>

    var sel = window.getSelection(),
        range = sel.getRangeAt(0),
        doc = range.cloneContents(),
        nodes = doc.querySelectorAll('td.' + (isLeft ? 'before' : 'after')),
        text = '';

    if (nodes.length === 0) {
      text = doc.textContent;
    } else {
      [].forEach.call(nodes, function(td, i) {
        text += (i ? '\n' : '') + td.textContent;
      });
    }
    text = text.replace(/\u200B/g, '');  // remove soft breaks

    var clipboardData = e.originalEvent.clipboardData;
    clipboardData.setData('text', text);
    e.preventDefault();
  });
};

differ.prototype.buildRow_ = function(beforeIdx, beforeEnd, afterIdx, afterEnd, change) {
  // TODO(danvk): move this logic into addCells() or get rid of it.
  var beforeLines = this.params.language ? this.beforeLinesHighlighted : this.beforeLines;
  var afterLines = this.params.language ? this.afterLinesHighlighted : this.afterLines;

  var els = [];
  beforeIdx = addCells(els, beforeIdx, beforeEnd, this.params.language, beforeLines, 'before', change, beforeIdx + 1);
  afterIdx = addCells(els, afterIdx, afterEnd, this.params.language, afterLines, 'after', change, afterIdx + 1);

  if (change == 'replace') {
    differ.addCharacterDiffs_(els[1], els[3], this.params.language);
  }

  return {
    row: els,
    newBeforeIdx: beforeIdx,
    newAfterIdx: afterIdx
  };
};


differ.prototype.buildView_ = function() {
  var contextSize = this.params.contextSize;
  var rows = [];

  for (var opcodeIdx = 0; opcodeIdx < this.opcodes.length; opcodeIdx++) {
    var opcode = this.opcodes[opcodeIdx];
    var change = opcode[0];  // "equal", "replace", "delete", "insert"
    var beforeIdx = opcode[1];
    var beforeEnd = opcode[2];
    var afterIdx = opcode[3];
    var afterEnd = opcode[4];
    var rowCount = Math.max(beforeEnd - beforeIdx, afterEnd - afterIdx);
    var topRows = [];

    for (var i = 0; i < rowCount; i++) {
      // Jump
      if (contextSize && this.opcodes.length > 1 && change == 'equal' &&
          ((opcodeIdx > 0 && i == contextSize) ||
           (opcodeIdx == 0 && i == 0))) {
        var jump = rowCount - ((opcodeIdx == 0 ? 1 : 2) * contextSize);
        var isEnd = (opcodeIdx + 1 == this.opcodes.length);
        if (isEnd) {
          jump += (contextSize - 1);
        }
        if (jump > 1) {
          var els = [];
          topRows.push(els);

          var $skipEl = $('<td colspan="2" class="skip code"><a href="#">Show ' + jump + ' more lines</a></div>');
          $skipEl.data({
            'beforeStartIndex': beforeIdx,
            'afterStartIndex': afterIdx,
            'jumpLength': jump,
          });

          els.push($('<td class=line-no>&hellip;</div>').get(0));
          els.push($skipEl.get(0));
          els.push($('<td class=line-no>&hellip;</div>').get(0));

          beforeIdx += jump;
          afterIdx += jump;
          i += jump - 1;

          // skip last lines if they're all equal
          if (isEnd) {
            break;
          } else {
            continue;
          }
        }
      }

      var data = this.buildRow_(beforeIdx, beforeEnd, afterIdx, afterEnd, change);
      beforeIdx = data.newBeforeIdx;
      afterIdx = data.newAfterIdx;
      topRows.push(data.row);
    }

    for (var i = 0; i < topRows.length; i++) rows.push(topRows[i]);
  }

  var $container = $('<div class="diff">');
  var $table = $('<table class="diff">');

  rows.forEach(function(row) {
    if (row.length != 3 && row.length != 4) {
      throw "Invalid row: " + row;
    }

    var $tr = $('<tr>');
    $tr.append(row);
    $table.append($tr);
  });
  $container.append($table);

  // Attach event handlers & apply char diffs.
  this.attachHandlers_($container);

  $table.find('.code').each(function(_, el) {
    differ.addSoftBreaks(el);
  });

  return $container.get(0);
};

function addCells(row, tidx, tend, isHtml, textLines, side, change, line_no) {
  var newIdx = 0,
      lineNoTd, codeTd;
  if (tidx < tend) {
    var txt = textLines[tidx].replace(/\t/g, "\u00a0\u00a0\u00a0\u00a0");
    lineNoTd = $('<td class=line-no>')
                  .text(tidx + 1)
                  .get(0);
    var $code = $('<td>').addClass(side + ' ' + change + ' code');
    if (isHtml) {
      $code.html(txt);
    } else {
      $code.text(txt);
    }
    codeTd = $code.get(0);
    newIdx = tidx + 1;
  } else {
    var lineNoTd = $('<td class=line-no>').get(0),
        codeTd = $('<td class="empty code ' + side + '">').get(0);
    newIdx = tidx;
  }
  if (side == 'before') {
    row.push(lineNoTd)
    row.push(codeTd)
  } else {
    row.push(codeTd)
    row.push(lineNoTd)
  }
  return newIdx;
}

function walkTheDOM(node, func) {
  func(node);
  node = node.firstChild;
  while (node) {
    walkTheDOM(node, func);
    node = node.nextSibling;
  }
}

/**
 * Adds soft wrap markers between all characters in a DOM element.
 */
differ.addSoftBreaks = function(el) {
  var softBreak = '\u200B';
  walkTheDOM(el, function(node) {
    if (node.nodeType !== 3) return;
    var text = node.data;
    text = text.split('').join(softBreak);
    node.nodeValue = text;
  });
};

differ.htmlTextMapper = function(text, html) {
  this.text_ = text;
  this.html_ = html;
};

// Get the substring of HTML corresponding to text.substr(start, len).
// Leading markup is included with index 0, trailing with the last char.
differ.htmlTextMapper.prototype.getHtmlSubstring = function(start, limit) {
  var count = limit - start;
  return html_substr(this.html_, start, count);
};

// Returns the HTML corresponding to text in positions [start, start+count).
// This includes any HTML in that character range, or enclosing it.
// cobbled together from:
// http://stackoverflow.com/questions/6003271/substring-text-with-html-tags-in-javascript?rq=1
// http://stackoverflow.com/questions/16856928/substring-text-with-javascript-including-html-tags
function html_substr(html, start, count) {
  var div = document.createElement('div');
  div.innerHTML = html;
  var consumed = 0;

  walk(div, track);

  function track(el) {
    if (count > 0) {
      var len = el.data.length;
      if (start <= len) {
        el.data = el.substringData(start, len);
        start = 0;
      } else {
        start -= len;
        el.data = '';
      }
      len = el.data.length;
      count -= len;
      consumed += len;
      if (count <= 0) {
        el.data = el.substringData(0, el.data.length + count);
      }
    } else {
      el.data = '';
    }
  }

  function walk(el, fn) {
    var node = el.firstChild, oldNode;
    var elsToRemove = [];
    do {
      if (node.nodeType === 3) {
        fn(node);
      } else if (node.nodeType === 1 && node.childNodes && node.childNodes[0]) {
        walk( node, fn );
      }
      if (consumed == 0 && node.nodeType == 1) {
        elsToRemove.push(node);
      }
    } while ((node = node.nextSibling) && (count > 0));

    // remove remaining nodes
    while (node){
      oldNode = node;
      node = node.nextSibling;
      el.removeChild(oldNode);
    }

    for (var i = 0; i < elsToRemove.length; i++) {
      var el = elsToRemove[i];
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }
  }

  return div.innerHTML;
}

/**
 * @param {string} line The line to be split
 * @return {Array.<string>} Component words in the line. An invariant is that
 *     splitIntoWords_(line).join('') == line.
 */
differ.splitIntoWords_ = function(line) {
  var LC = 0, UC = 2, NUM = 3, WS = 4, SYM = 5;
  var charType = function(c) {
    if (c.match(/[a-z]/)) return LC;
    if (c.match(/[A-Z]/)) return UC;
    if (c.match(/[0-9]/)) return NUM;
    if (c.match(/\s/)) return WS;
    return SYM;
  };

  // Single words can be [A-Z][a-z]+, [A-Z]+, [a-z]+, [0-9]+ or \s+.
  var words = [];
  var lastType = -1;
  for (var i = 0; i < line.length; i++) {
    var c = line.charAt(i);
    var ct = charType(c);
    if (ct == lastType && ct != SYM && ct != WS ||
        ct == LC && lastType == UC && words[words.length - 1].length == 1) {
      words[words.length - 1] += c;
    } else {
      words.push(c);
    }
    lastType = ct;
  }
  return words;
};

/**
 * Compute an intra-line diff.
 * @param {string} beforeText
 * @param {string} afterText
 * @return {?Array.<Array>} [before codes, after codes], where each element is a
 *     list of ('change type', start idx, stop idx) triples. Returns null if
 *     character differences are not appropriate for this line pairing.
 */
differ.computeCharacterDiffs_ = function(beforeText, afterText) {
  var beforeWords = differ.splitIntoWords_(beforeText),
      afterWords = differ.splitIntoWords_(afterText);

  // TODO: precompute two arrays; this does too much work.
  var wordToIdx = function(isBefore, idx) {
    var words = isBefore ? beforeWords : afterWords;
    var charIdx = 0;
    for (var i = 0; i < idx; i++) {
      charIdx += words[i].length;
    }
    return charIdx;
  };

  var sm = new difflib.SequenceMatcher(beforeWords, afterWords);
  var opcodes = sm.get_opcodes();

  // Suppress char-by-char diffs if there's less than 50% character overlap.
  // The one exception is pure whitespace diffs, which should always be shown.
  var minEqualFrac = 0.5;
  var equalCount = 0, charCount = 0;
  var beforeDiff = '', afterDiff = '';
  opcodes.forEach(function(opcode) {
    var change = opcode[0];
    var beforeIdx = wordToIdx(true, opcode[1]);
    var beforeEnd = wordToIdx(true, opcode[2]);
    var afterIdx = wordToIdx(false, opcode[3]);
    var afterEnd = wordToIdx(false, opcode[4]);
    var beforeLen = beforeEnd - beforeIdx;
    var afterLen = afterEnd - afterIdx;
    var count = beforeLen + afterLen;
    if (change == 'equal') {
      equalCount += count;
    } else {
      beforeDiff += beforeText.substring(beforeIdx, beforeEnd);
      afterDiff += afterText.substring(afterIdx, afterEnd);
    }
    charCount += count;
  });
  if (equalCount < minEqualFrac * charCount &&
      !(beforeDiff.match(/^\s*$/) && afterDiff.match(/^\s*$/))) {
    return null;
  }

  var beforeOut = [], afterOut = [];  // (span class, start, end) triples
  opcodes.forEach(function(opcode) {
    var change = opcode[0];
    var beforeIdx = wordToIdx(true, opcode[1]);
    var beforeEnd = wordToIdx(true, opcode[2]);
    var afterIdx = wordToIdx(false, opcode[3]);
    var afterEnd = wordToIdx(false, opcode[4]);
    if (change == 'equal') {
      beforeOut.push([null, beforeIdx, beforeEnd]);
      afterOut.push([null, afterIdx, afterEnd]);
    } else if (change == 'delete') {
      beforeOut.push(['delete', beforeIdx, beforeEnd]);
    } else if (change == 'insert') {
      afterOut.push(['insert', afterIdx, afterEnd]);
    } else if (change == 'replace') {
      beforeOut.push(['delete', beforeIdx, beforeEnd]);
      afterOut.push(['insert', afterIdx, afterEnd]);
    } else {
      throw "Invalid opcode: " + opcode[0];
    }
  });
  beforeOut = differ.simplifyCodes_(beforeOut);
  afterOut = differ.simplifyCodes_(afterOut);

  return [beforeOut, afterOut];
};


// Add character-by-character diffs to a row (if appropriate).
differ.addCharacterDiffs_ = function(beforeCell, afterCell) {
  var beforeText = $(beforeCell).text(),
      afterText = $(afterCell).text();
  var codes = differ.computeCharacterDiffs_(beforeText, afterText);
  if (codes == null) return;
  beforeOut = codes[0];
  afterOut = codes[1];

  // Splice in "insert", "delete" and "replace" tags.
  // This is made more difficult by the presence of syntax highlighting, which
  // has its own set of tags. The two can co-exists if we're careful to only
  // wrap complete (balanced) DOM trees.
  var beforeHtml = $(beforeCell).html(),
      afterHtml = $(afterCell).html();
  var beforeMapper = new differ.htmlTextMapper(beforeText, beforeHtml);
  var afterMapper = new differ.htmlTextMapper(afterText, afterHtml);

  $(beforeCell).empty().html(differ.codesToHtml_(beforeMapper, beforeOut));
  $(afterCell).empty().html(differ.codesToHtml_(afterMapper, afterOut));
};

// codes are (span class, start, end) triples.
// This merges consecutive runs with the same class, which simplifies the HTML.
differ.simplifyCodes_ = function(codes) {
  var newCodes = [];
  for (var i = 0; i < codes.length; i++) {
    var code = codes[i];
    if (i == 0) {
      newCodes.push(code);
      continue;
    }

    var lastIndex = newCodes.length - 1;
    var lastCodeClass = newCodes[lastIndex][0];
    if (lastCodeClass == code[0]) {
      newCodes[lastIndex][2] = code[2];  // extend last run.
    } else {
      newCodes.push(code);
    }
  }

  return newCodes;
};

// codes are (span class, start, end) triples.
// This wraps html[start..end] in appropriate <span>..</span>s.
differ.codesToHtml_ = function(mapper, codes) {
  var html = '';
  for (var i = 0; i < codes.length; i++) {
    var code = codes[i],
        type = code[0],
        start = code[1],
        limit = code[2];
    var thisHtml = mapper.getHtmlSubstring(start, limit);
    if (type == null) {
      html += thisHtml;
    } else {
      html += '<span class="char-' + type + '">' + thisHtml + '</span>';
    }
  }
  return html;
}


differ.buildView = function(beforeText, afterText, userParams) {
  var d = new differ(beforeText, afterText, userParams);
  return d.buildView_();
};

/**
 * Returns a valid HighlightJS language based on a file name/path.
 * If it can't guess a language, returns null.
 */
differ.guessLanguageUsingFileName = function(name) {
  var lang = (function() {
    var m = /\.([^.]+)$/.exec(name);
    if (m) {
      var ext = m[1];
      if (ext == 'py') return 'python';
      if (ext == 'sh') return 'bash';
      if (ext == 'md') return 'markdown';
      return m[1].toLowerCase();
    };

    // Highlighting based purely on file name, e.g. "Makefile".
    m = /(?:.*\/)?([^\/]*)$/.exec(name);
    if (m && m[1] == 'Makefile') {
      return 'makefile';
    }
    return null;
  })();
  if (!lang || !hljs.getLanguage(lang)) {
    return null;
  } else {
    return lang;
  }
};

/**
 * Guess a language based on a file's contents.
 * This always returns a valid HighlightJS language. It considers the shebang
 * line (if present) and then falls back to HighlightJS's keyword-based
 * guessing.
 */
differ.guessLanguageUsingContents = function(contents) {
  // First check for a shebang line.
  var firstLine = contents.substring(0, contents.indexOf('\n'));
  if (firstLine.substring(0, 2) == '#!') {
    var processor = firstLine.substring(2);
    if (processor == '/bin/bash') return 'bash';
    if (processor == '/bin/sh') return 'bash';

    var options = {
        'python': 'python',
        'perl': 'perl',
        'ruby': 'ruby',
        'node': 'javascript'
    };
    for (var interpreter in options) {
      var lang = options[interpreter];
      if (processor.indexOf(interpreter) >= 0) {
        return lang;
      }
    }
  }

  // Now let HighlightJS guess.
  var guess = hljs.highlightAuto(contents);
  var lang = guess.language;
  return lang;
};

return differ;

})();
