/// reference types="highlightjs"
/// reference types="jquery"

interface DifferOptions {
  contextSize: number;
  minJumpSize: number;
  language: string | null;
  beforeName: string;
  afterName: string;
  wordWrap?: boolean;
}

type OpType = difflib.OpCode[0];

interface DiffRange {
  type: OpType | 'skip';
  before: [start: number, limit: number];
  after: [start: number, limit: number];
}

type CharacterDiff = [OpType | 'skip' | null, number, number];

class differ {
  params: DifferOptions;
  beforeLines: string[];
  afterLines: string[];
  diffRanges: DiffRange[];
  beforeLinesHighlighted: string[] | null | undefined;
  afterLinesHighlighted: string[] | null | undefined;

  constructor(beforeText: string, afterText: string, userParams: DifferOptions) {
    const defaultParams = {
      contextSize: 3,
      minJumpSize: 10,
      language: null,
      beforeName: "Before",
      afterName: "After"
    };

    this.params = {...defaultParams, ...userParams};

    this.beforeLines = beforeText ? difflib.stringAsLines(beforeText) : [];
    this.afterLines = afterText ? difflib.stringAsLines(afterText) : [];
    var sm = new difflib.SequenceMatcher(this.beforeLines, this.afterLines);
    var opcodes = sm.get_opcodes();

    // TODO: don't store the diff ranges -- they're only used once in buildView.
    this.diffRanges = differ.opcodesToDiffRanges(
        opcodes, this.params.contextSize, this.params.minJumpSize);

    if (this.params.language) {
      var lang = this.params.language;
      this.beforeLinesHighlighted = differ.highlightText_(beforeText, lang);
      this.afterLinesHighlighted = differ.highlightText_(afterText, lang);
    }
    // TODO: from this point on language shouldn't need to be used.
  };

  maxLineNumber() {
    return Math.max(this.beforeLines.length, this.afterLines.length);
  };

  /**
   * @param text Possibly multiline text containing spans that cross
   *     line breaks.
   * @return An array of individual lines, each of which has
   *     entirely balanced <span> tags.
   */
  static distributeSpans_(text: string): string[] {
    const lines = difflib.stringAsLines(text);
    const spanRe = /(<span[^>]*>)|(<\/span>)/;

    const outLines = [];
    const liveSpans = [];
    for (const line of lines) {
      const groups = line.split(spanRe);
      let i = 0;
      let outLine = liveSpans.join('');
      while (i < groups.length) {
        const g = groups[i];
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
    }
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
  static highlightText_(text: string, opt_language?: string): string[] | null {
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
  attachHandlers_(el: JQuery) {
    // TODO: gross duplication with buildView_
    var language = this.params.language,
        beforeLines = language ? this.beforeLinesHighlighted! : this.beforeLines,
        afterLines = language ? this.afterLinesHighlighted! : this.afterLines;
    $(el).on('click', '.skip a', function(e) {
      e.preventDefault();
      var skipData = $(this).closest('.skip').data();
      var beforeIdx = skipData.beforeStartIndex;
      var afterIdx = skipData.afterStartIndex;
      var jump = skipData.jumpLength;
      var change = "equal";
      var newTrs = [];
      for (var i = 0; i < jump; i++) {
        newTrs.push(differ.buildRowTr_(
          'equal',
          beforeIdx + i + 1,
          beforeLines[beforeIdx + i],
          afterIdx + i + 1,
          afterLines[afterIdx + i],
          language));
      }

      // Replace the "skip" rows with real code.
      var $skipTr = $(this).closest('tr');
      $skipTr.replaceWith(newTrs as HTMLElement[]);
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

      var sel = window.getSelection()!,
          range = sel.getRangeAt(0),
          doc = range.cloneContents(),
          nodes = doc.querySelectorAll('td.' + (isLeft ? 'before' : 'after')),
          text = '';

      if (nodes.length === 0) {
        text = doc.textContent!;
      } else {
        [].forEach.call(nodes, function(td: Element, i) {
          text += (i ? '\n' : '') + td.textContent;
        });
      }
      text = text.replace(/\u200B/g, '');  // remove soft breaks

      var clipboardData = (e.originalEvent as ClipboardEvent).clipboardData;
      clipboardData?.setData('text', text);
      e.preventDefault();
    });
  }

  /**
   * Create a single row in the table. Adds character diffs if required.
   */
  static buildRowTr_(
    type: 'replace' | 'delete' | 'insert' | 'equal',
    beforeLineNum: number | null,
    beforeTextOrHtml: string | null | undefined,
    afterLineNum: number | null,
    afterTextOrHtml: string | null | undefined,
    language: string | null
  ): HTMLElement {
    var $makeCodeTd = function(textOrHtml: string | null | undefined) {
      if (textOrHtml == null) {
        return $('<td class="empty code">');
      }
      textOrHtml = textOrHtml.replace(/\t/g, "\u00a0\u00a0\u00a0\u00a0");
      var $td = $('<td class="code">').addClass(type);
      if (language) {
        $td.html(textOrHtml);
      } else {
        $td.text(textOrHtml);
      }
      return $td;
    };

    var cells = [
      $('<td class=line-no>').text(beforeLineNum || '').get(0)!,
      $makeCodeTd(beforeTextOrHtml).addClass('before').get(0)!,
      $makeCodeTd(afterTextOrHtml).addClass('after').get(0)!,
      $('<td class=line-no>').text(afterLineNum || '').get(0)!
    ];
    if (type == 'replace') {
      differ.addCharacterDiffs_(cells[1], cells[2]);
    }

    return $('<tr>').append(cells).get(0)!;
  }

  /**
   * Create a "skip" row with a link to expand.
   * beforeIdx and afterIdx are the indices of the first lines skipped.
   */
  static buildSkipTr_(beforeIdx: number, afterIdx: number, numRowsSkipped: number): HTMLElement {
    var $tr = $(
      '<tr>' +
        '<td class="line-no">&hellip;</td>' +
        '<td colspan="2" class="skip code">' +
          '<a href="#">Show ' + numRowsSkipped + ' more lines</a>' +
        '</td>' +
        '<td class="line-no">&hellip;</td>' +
      '</tr>');
    $tr.find('.skip').data({
      'beforeStartIndex': beforeIdx,
      'afterStartIndex': afterIdx,
      'jumpLength': numRowsSkipped
    });
    return $tr.get(0)!;
  };

  buildView_() {
    // TODO: is this distinction necessary?
    var language = this.params.language,
        beforeLines = language ? this.beforeLinesHighlighted! : this.beforeLines,
        afterLines = language ? this.afterLinesHighlighted! : this.afterLines;

    var $table = $('<table class="diff">');
    $table.append($('<tr>').append(
        $('<th class="diff-header" colspan=2>').text(this.params.beforeName),
        $('<th class="diff-header" colspan=2>').text(this.params.afterName)));

    for (var i = 0; i < this.diffRanges.length; i++) {
      var range = this.diffRanges[i],
          type = range.type,
          numBeforeRows = range.before[1] - range.before[0],
          numAfterRows = range.after[1] - range.after[0],
          numRows = Math.max(numBeforeRows, numAfterRows);

      if (type == 'skip') {
        $table.append(
          differ.buildSkipTr_(range.before[0], range.after[0], numRows)
        );
      } else {
        for (var j = 0; j < numRows; j++) {
          var beforeIdx = (j < numBeforeRows) ? range.before[0] + j : null,
              afterIdx = (j < numAfterRows) ? range.after[0] + j : null;
          $table.append(differ.buildRowTr_(
              type,
              (beforeIdx != null) ? 1 + beforeIdx : null,
              beforeIdx != null ? beforeLines[beforeIdx] : undefined,
              (afterIdx != null) ? 1 + afterIdx : null,
              afterIdx != null ? afterLines[afterIdx] : undefined,
              language));
        }
      }
    }

    // TODO: move into buildRowTr_?
    if (!this.params.wordWrap) {
      $table.find('.code').each(function(_, el) {
        differ.addSoftBreaks(el);
      });
    }

    var $container = $('<div class="diff">');
    $container.append($table);
    // Attach event handlers & apply char diffs.
    this.attachHandlers_($container);
    return $container.get(0);
  };

  // Input is a list of opcodes, as output by difflib (e.g. 'equal', 'replace',
  // 'delete', 'insert').
  // Output is a list of diff ranges which corresponds precisely to the view, e.g.
  // 'skip', 'insert', 'replace', 'delete' and 'equal'.
  // Outputs are {type, before:[start,limit], after:[start,limit]} tuples.
  static opcodesToDiffRanges(opcodes: difflib.OpCode[], contextSize: number, minJumpSize: number): DiffRange[] {
    var ranges: DiffRange[] = [];

    for (var i = 0; i < opcodes.length; i++) {
      var opcode = opcodes[i];
      const change = opcode[0];  // "equal", "replace", "delete", "insert"
      var beforeIdx = opcode[1];
      var beforeEnd = opcode[2];
      var afterIdx = opcode[3];
      var afterEnd = opcode[4];
      var range: DiffRange = {
            type: change,
            before: [beforeIdx, beforeEnd],
            after: [afterIdx, afterEnd]
          };
      if (change != 'equal') {
        ranges.push(range);
        continue;
      }

      // Should this "equal" range have a jump inserted?
      // First remove `contextSize` lines from either end.
      // If this leaves more than minJumpSize rows, then splice in a jump.
      var rowCount = beforeEnd - beforeIdx,  // would be same for after{End,Idx}
          isStart = (i == 0),
          isEnd = (i == opcodes.length - 1),
          firstSkipOffset = isStart ? 0 : contextSize,
          lastSkipOffset = rowCount - (isEnd ? 0 : contextSize),
          skipLength = lastSkipOffset - firstSkipOffset;

      if (skipLength == 0 || skipLength < minJumpSize) {
        ranges.push(range);
        continue;
      }

      // Convert the 'equal' block to an equal-skip-equal sequence.
      if (firstSkipOffset > 0) {
        ranges.push({
          type: 'equal',
          before: [beforeIdx, beforeIdx + firstSkipOffset],
          after: [afterIdx, afterIdx + firstSkipOffset]
        });
      }
      ranges.push({
        type: 'skip',
        before: [beforeIdx + firstSkipOffset, beforeIdx + lastSkipOffset],
        after: [afterIdx + firstSkipOffset, afterIdx + lastSkipOffset]
      });
      if (lastSkipOffset < rowCount) {
        ranges.push({
          type: 'equal',
          before: [beforeIdx + lastSkipOffset, beforeEnd],
          after: [afterIdx + lastSkipOffset, afterEnd]
        });
      }
    }

    return ranges;
  }

  /**
   * Adds soft wrap markers between all characters in a DOM element.
   */
  static addSoftBreaks(el: HTMLElement) {
    var softBreak = '\u200B';
    walkTheDOM(el, function(node) {
      if (node.nodeType !== 3) return;
      var text = (node as Text).data;
      text = text.split('').join(softBreak);
      node.nodeValue = text;
    });
  }

  /**
   * @param {string} line The line to be split
   * @return {Array.<string>} Component words in the line. An invariant is that
   *     splitIntoWords_(line).join('') == line.
   */
  static splitIntoWords_(line: string): Array<string> {
    var LC = 0, UC = 2, NUM = 3, WS = 4, SYM = 5;
    var charType = function(c: string) {
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
  }

  /**
   * Compute an intra-line diff.
   * @param {string} beforeText
   * @param {string} afterText
   * @return {?Array.<Array>} [before codes, after codes], where each element is a
   *     list of ('change type', start idx, stop idx) triples. Returns null if
   *     character differences are not appropriate for this line pairing.
   */
  static computeCharacterDiffs_(beforeText: string, afterText: string): [
    CharacterDiff[],
    CharacterDiff[],
  ] | null {
    var beforeWords = differ.splitIntoWords_(beforeText),
        afterWords = differ.splitIntoWords_(afterText);

    // TODO: precompute two arrays; this does too much work.
    var wordToIdx = function(isBefore: boolean, idx: number) {
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

    var beforeOut: CharacterDiff[] = [],
        afterOut: CharacterDiff[] = [];  // (span class, start, end) triples
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
  }

  // Add character-by-character diffs to a row (if appropriate).
  static addCharacterDiffs_(beforeCell: HTMLElement, afterCell: HTMLElement) {
    var beforeText = $(beforeCell).text(),
        afterText = $(afterCell).text();
    var codes = differ.computeCharacterDiffs_(beforeText, afterText);
    if (codes == null) return;
    const beforeOut = codes[0];
    const afterOut = codes[1];

    // Splice in "insert", "delete" and "replace" tags.
    // This is made more difficult by the presence of syntax highlighting, which
    // has its own set of tags. The two can co-exists if we're careful to only
    // wrap complete (balanced) DOM trees.
    var beforeHtml = $(beforeCell).html(),
        afterHtml = $(afterCell).html();
    var beforeMapper = new htmlTextMapper(beforeText, beforeHtml);
    var afterMapper = new htmlTextMapper(afterText, afterHtml);

    $(beforeCell).empty().html(differ.codesToHtml_(beforeMapper, beforeOut));
    $(afterCell).empty().html(differ.codesToHtml_(afterMapper, afterOut));
  }

  // codes are (span class, start, end) triples.
  // This merges consecutive runs with the same class, which simplifies the HTML.
  static simplifyCodes_(codes: CharacterDiff[]): CharacterDiff[] {
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
  }

  // codes are (span class, start, end) triples.
  // This wraps html[start..end] in appropriate <span>..</span>s.
  static codesToHtml_(mapper: htmlTextMapper, codes: [string | null, number, number][]) {
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


  static buildView(beforeText: string, afterText: string, userParams: DifferOptions) {
    var d = new differ(beforeText, afterText, userParams);
    return d.buildView_();
  }

  /**
   * Returns a valid HighlightJS language based on a file name/path.
   * If it can't guess a language, returns null.
   */
  static guessLanguageUsingFileName(name: string) {
    var lang = (function() {
      var m = /\.([^.]+)$/.exec(name);
      if (m) {
        var ext = m[1];
        if (ext == 'py') return 'python';
        if (ext == 'sh') return 'bash';
        if (ext == 'md') return 'markdown';
        if (ext == 'js') return 'javascript';
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
  static guessLanguageUsingContents(contents: string) {
    // First check for a shebang line.
    var firstLine = contents.substring(0, contents.indexOf('\n'));
    if (firstLine.substring(0, 2) == '#!') {
      var processor = firstLine.substring(2);
      if (processor == '/bin/bash') return 'bash';
      if (processor == '/bin/sh') return 'bash';

      const options = {
          'python': 'python',
          'perl': 'perl',
          'ruby': 'ruby',
          'node': 'javascript'
      };
      let interpreter: keyof typeof options;
      for (interpreter in options) {
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
}

function walkTheDOM(node: Node, func: (n: Node) => void) {
  func(node);
  let n = node.firstChild;
  while (n) {
    walkTheDOM(n, func);
    n = n.nextSibling;
  }
}

class htmlTextMapper {
  text_: string;
  html_: string;
  constructor(text: string, html: string) {
    this.text_ = text;
    this.html_ = html;
  };

  // Get the substring of HTML corresponding to text.substr(start, len).
  // Leading markup is included with index 0, trailing with the last char.
  getHtmlSubstring(start: number, limit: number) {
    var count = limit - start;
    return html_substr(this.html_, start, count);
  };
}


// Returns the HTML corresponding to text in positions [start, start+count).
// This includes any HTML in that character range, or enclosing it.
// cobbled together from:
// http://stackoverflow.com/questions/6003271/substring-text-with-html-tags-in-javascript?rq=1
// http://stackoverflow.com/questions/16856928/substring-text-with-javascript-including-html-tags
function html_substr(html: string, start: number, count: number) {
  var div = document.createElement('div');
  div.innerHTML = html;
  var consumed = 0;

  walk(div, track);

  function track(el: Text) {
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

  function walk(el: Node, fn: (node: Text) => void) {
    var node = el.firstChild, oldNode;
    var elsToRemove = [];
    do {
      if (node?.nodeType === 3) {
        fn(node as Text);
      } else if (node?.nodeType === 1 && node.childNodes && node.childNodes[0]) {
        walk( node, fn );
      }
      if (consumed == 0 && node?.nodeType == 1) {
        elsToRemove.push(node);
      }
    } while ((node = node?.nextSibling ?? null) && (count > 0));

    // remove remaining nodes
    while (node){
      oldNode = node;
      node = node.nextSibling;
      el.removeChild(oldNode);
    }

    for (var i = 0; i < elsToRemove.length; i++) {
      const el = elsToRemove[i];
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }
  }

  return div.innerHTML;
}

const codediff = differ;
