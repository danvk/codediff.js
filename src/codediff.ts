import {
  addCharacterDiffs,
  codesToHtml,
  computeCharacterDiffs,
  simplifyCodes,
  splitIntoWords,
} from './char-diffs';
import {DiffRange, addSkips} from './codes';
import {distributeSpans} from './dom-utils';
import {htmlTextMapper} from './html-text-mapper';
import {guessLanguageUsingContents, guessLanguageUsingFileName} from './language';
import {buildRowTr, buildSkipTr} from './table-utils';

export interface PatchOptions {
  minJumpSize: number;
  language: string | null;
  beforeName: string;
  afterName: string;
  wordWrap: boolean;
}

export interface DiffOptions {
  contextSize: number;
  minJumpSize: number;
}

export class differ {
  params: PatchOptions;
  beforeLines: string[];
  afterLines: string[];
  diffRanges: DiffRange[];
  beforeLinesHighlighted: string[] | null | undefined;
  afterLinesHighlighted: string[] | null | undefined;

  constructor(
    beforeText: string | null,
    beforeLines: string[],
    afterText: string | null,
    afterLines: string[],
    ops: DiffRange[],
    params: Partial<PatchOptions>
  ) {
    const defaultParams: PatchOptions = {
      minJumpSize: 10,
      language: null,
      beforeName: 'Before',
      afterName: 'After',
      wordWrap: false,
    };

    this.params = {...defaultParams, ...params};

    this.beforeLines = beforeLines;
    this.afterLines = afterLines;
    this.diffRanges = ops;

    const {language} = this.params;
    if (language) {
      this.beforeLinesHighlighted = highlightText(beforeText ?? '', language);
      this.afterLinesHighlighted = highlightText(afterText ?? '', language);
    }
    // TODO: from this point on language shouldn't need to be used.
  }

  maxLineNumber() {
    return Math.max(this.beforeLines.length, this.afterLines.length);
  }

  /**
   * Attach event listeners, notably for the "show more" links.
   */
  attachHandlers_(el: JQuery) {
    // TODO: gross duplication with buildView_
    var language = this.params.language,
      beforeLines = language ? this.beforeLinesHighlighted! : this.beforeLines,
      afterLines = language ? this.afterLinesHighlighted! : this.afterLines;
    $(el).on('click', '.skip a', function (e) {
      e.preventDefault();
      var skipData = $(this).closest('.skip').data();
      var beforeIdx = skipData.beforeStartIndex;
      var afterIdx = skipData.afterStartIndex;
      var jump = skipData.jumpLength;
      var newTrs = [];
      for (var i = 0; i < jump; i++) {
        newTrs.push(
          buildRowTr(
            'equal',
            beforeIdx + i + 1,
            beforeLines[beforeIdx + i],
            afterIdx + i + 1,
            afterLines[afterIdx + i],
            language,
          ),
        );
      }

      // Replace the "skip" rows with real code.
      var $skipTr = $(this).closest('tr');
      $skipTr.replaceWith(newTrs as HTMLElement[]);
    });

    // Hooks for single-column text selection.
    // See http://stackoverflow.com/a/27530627/388951 for details.
    $(el)
      .on('mousedown', function (e) {
        var $td = $(e.target).closest('td'),
          isLeft = $td.is('.before'),
          isRight = $td.is('.after');
        if (!isLeft && !isRight) return;

        el.removeClass('selecting-left selecting-right').addClass(
          'selecting-' + (isLeft ? 'left' : 'right'),
        );
      })
      .on('copy', function (e) {
        var isLeft = el.is('.selecting-left');

        var sel = window.getSelection()!,
          range = sel.getRangeAt(0),
          doc = range.cloneContents(),
          nodes = doc.querySelectorAll('td.' + (isLeft ? 'before' : 'after')),
          text = '';

        if (nodes.length === 0) {
          text = doc.textContent!;
        } else {
          [].forEach.call(nodes, function (td: Element, i) {
            text += (i ? '\n' : '') + td.textContent;
          });
        }

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
    $table.append(
      $('<tr>').append(
        $('<th class="diff-header" colspan=2>').text(this.params.beforeName),
        $('<th class="diff-header" colspan=2>').text(this.params.afterName),
      ),
    );

    for (var i = 0; i < this.diffRanges.length; i++) {
      var range = this.diffRanges[i],
        type = range.type,
        numBeforeRows = range.before[1] - range.before[0],
        numAfterRows = range.after[1] - range.after[0],
        numRows = Math.max(numBeforeRows, numAfterRows);

      if (type == 'skip') {
        $table.append(buildSkipTr(range.before[0], range.after[0], numRows));
      } else {
        for (var j = 0; j < numRows; j++) {
          var beforeIdx = j < numBeforeRows ? range.before[0] + j : null,
            afterIdx = j < numAfterRows ? range.after[0] + j : null;
          $table.append(
            buildRowTr(
              type,
              beforeIdx != null ? 1 + beforeIdx : null,
              beforeIdx != null ? beforeLines[beforeIdx] : undefined,
              afterIdx != null ? 1 + afterIdx : null,
              afterIdx != null ? afterLines[afterIdx] : undefined,
              language,
            ),
          );
        }
      }
    }

    if (this.params.wordWrap) {
      $table.addClass('word-wrap');
    }

    var $container = $('<div class="diff">');
    $container.append($table);
    // Attach event handlers & apply char diffs.
    this.attachHandlers_($container);
    return $container.get(0);
  }

  static buildView(beforeText: string | null, afterText: string | null, userParams: Partial<DiffOptions & PatchOptions>) {
    const params: DiffOptions = {contextSize: 3, minJumpSize: 10, wordWrap: false, ...userParams};
    const beforeLines = beforeText ? difflib.stringAsLines(beforeText) : [];
    const afterLines = afterText ? difflib.stringAsLines(afterText) : [];
    const sm = new difflib.SequenceMatcher(beforeLines, afterLines);
    const opcodes = sm.get_opcodes();
    const diffRanges = addSkips(opcodes, params.contextSize, params.minJumpSize);
    var d = new differ(beforeText, beforeLines, afterText, afterLines, diffRanges, params);
    return d.buildView_();
  }

  static buildViewFromOps(beforeText: string, afterText: string, ops: DiffRange[], params: Partial<PatchOptions>) {
    const beforeLines = beforeText ? difflib.stringAsLines(beforeText) : [];
    const afterLines = afterText ? difflib.stringAsLines(afterText) : [];
    var d = new differ(beforeText, beforeLines, afterText, afterLines, ops, params);
    return d.buildView_();
  }
}

/**
 * @return Lines marked up with syntax <span>s. The <span>
 *     tags will be balanced within each line.
 */
function highlightText(text: string, language: string): string[] | null {
  if (text === null) return [];

  // TODO(danvk): look into suppressing highlighting if .relevance is low.
  const html = hljs.highlight(text, {language, ignoreIllegals: true}).value;

  // Some of the <span>s might cross lines, which won't work for our diff
  // structure. We convert them to single-line only <spans> here.
  return distributeSpans(html);
}

(window as any).codediff = {
  ...differ,
  // These are exported for testing
  distributeSpans_: distributeSpans,
  simplifyCodes_: simplifyCodes,
  codesToHtml_: codesToHtml,
  addCharacterDiffs_: addCharacterDiffs,
  computeCharacterDiffs_: computeCharacterDiffs,
  splitIntoWords_: splitIntoWords,
  guessLanguageUsingFileName,
  guessLanguageUsingContents,
  opcodesToDiffRanges: addSkips,
  htmlTextMapper,
  buildView: differ.buildView,
  buildViewFromOps: differ.buildViewFromOps,
};
