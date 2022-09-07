import { DiffRange, opcodesToDiffRanges } from './codes';
import { addSoftBreaks, distributeSpans } from './dom-utils';
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
    this.diffRanges = opcodesToDiffRanges(
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
        addSoftBreaks(el);
      });
    }

    var $container = $('<div class="diff">');
    $container.append($table);
    // Attach event handlers & apply char diffs.
    this.attachHandlers_($container);
    return $container.get(0);
  };

  static buildView(beforeText: string, afterText: string, userParams: DifferOptions) {
    var d = new differ(beforeText, afterText, userParams);
    return d.buildView_();
  }
}

(window as any).codediff = differ;
(window as any).htmlTextMapper = htmlTextMapper;