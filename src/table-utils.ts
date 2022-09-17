import {addCharacterDiffs} from './char-diffs';

/**
 * Create a single row in the table. Adds character diffs if required.
 */
export function buildRowTr(
  type: 'replace' | 'delete' | 'insert' | 'equal',
  beforeLineNum: number | null,
  beforeTextOrHtml: string | null | undefined,
  afterLineNum: number | null,
  afterTextOrHtml: string | null | undefined,
  language: string | null,
): HTMLElement {
  var $makeCodeTd = function (textOrHtml: string | null | undefined) {
    if (textOrHtml == null) {
      return $('<td class="empty code">');
    }
    textOrHtml = textOrHtml.replace(/\t/g, '\u00a0\u00a0\u00a0\u00a0');
    var $td = $('<td class="code">').addClass(type);
    if (language) {
      $td.html(textOrHtml);
    } else {
      $td.text(textOrHtml);
    }
    return $td;
  };

  var cells = [
    $('<td class=line-no>')
      .text(beforeLineNum || '')
      .get(0)!,
    $makeCodeTd(beforeTextOrHtml).addClass('before').get(0)!,
    $makeCodeTd(afterTextOrHtml).addClass('after').get(0)!,
    $('<td class=line-no>')
      .text(afterLineNum || '')
      .get(0)!,
  ];
  if (type == 'replace') {
    addCharacterDiffs(cells[1], cells[2]);
  }

  return $('<tr>').append(cells).get(0)!;
}

/**
 * Create a "skip" row with a link to expand.
 * beforeIdx and afterIdx are the indices of the first lines skipped.
 */
export function buildSkipTr(
  beforeIdx: number,
  afterIdx: number,
  numRowsSkipped: number,
): HTMLElement {
  var $tr = $(
    '<tr>' +
      '<td class="line-no">&hellip;</td>' +
      '<td colspan="2" class="skip code">' +
      '<a href="#">Show ' +
      numRowsSkipped +
      ' more lines</a>' +
      '</td>' +
      '<td class="line-no">&hellip;</td>' +
      '</tr>',
  );
  $tr.find('.skip').data({
    beforeStartIndex: beforeIdx,
    afterStartIndex: afterIdx,
    jumpLength: numRowsSkipped,
  });
  return $tr.get(0)!;
}
