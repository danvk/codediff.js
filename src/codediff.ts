import { distributeSpans } from './dom-utils';
import {htmlTextMapper} from './html-text-mapper';
import { buildRowTr, buildSkipTr } from './table-utils';

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

export class differ {
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
    return distributeSpans(html);
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
        newTrs.push(buildRowTr(
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
          buildSkipTr(range.before[0], range.after[0], numRows)
        );
      } else {
        for (var j = 0; j < numRows; j++) {
          var beforeIdx = (j < numBeforeRows) ? range.before[0] + j : null,
              afterIdx = (j < numAfterRows) ? range.after[0] + j : null;
          $table.append(buildRowTr(
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

export const codediff = differ;

(window as any).codediff = codediff;
(window as any).htmlTextMapper = htmlTextMapper;
