var diffview = (function() {

var diffview = {};

diffview.buildView = function(beforeText, afterText, userParams) {
  if (!'beforeText' in userParams) throw "need beforeText";
  if (!'afterText' in userParams) throw "need afterText";

  var defaultParams = {
    contextSize: 3,
    baseTextName: "Before",
    newTextName: "After"
  };

  var params = $.extend({}, defaultParams, userParams);

  var beforeLines = difflib.stringAsLines(beforeText);
  var afterLines = difflib.stringAsLines(afterText);
  var sm = new difflib.SequenceMatcher(beforeLines, afterLines);
  var opcodes = sm.get_opcodes();

  var $leftLineDiv = $('<div class="diff-line-no diff-left-line-no">');
  var $leftContent = $('<div class="diff-content diff-left-content">');
  var $rightLineDiv = $('<div class="diff-line-no diff-right-line-no">');
  var $rightContent = $('<div class="diff-content diff-right-content">');

  var rows = [];

  for (var opcodeIdx = 0; opcodeIdx < opcodes.length; opcodeIdx++) {
    var opcode = opcodes[opcodeIdx];
    var change = opcode[0];  // "equal", "replace", "delete", "insert"
    var beforeIdx = opcode[1];
    var beforeEnd = opcode[2];
    var afterIdx = opcode[3];
    var afterEnd = opcode[4];
    var rowCount = Math.max(beforeEnd - beforeIdx, afterEnd - afterIdx);
    var topRows = [];
    var botRows = [];

    for (var i = 0; i < rowCount; i++) {
      // Jump
      if (params.contextSize && opcodes.length > 1 && change == 'equal' &&
          ((opcodeIdx > 0 && i == params.contextSize) ||
           (opcodeIdx == 0 && i == i == 0))) {
        var jump = rowCount - ((opcodeIdx == 0 ? 1 : 2) * params.contextSize);
        var isEnd = (opcodeIdx + 1 == opcodes.length);
        if (isEnd) {
          jump += (params.contextSize - 1);
        }
        if (jump > 1) {
          var els = [];
          topRows.push(els);

          var $skipEl = $('<div class=skip><a href="#">Show ' + jump + ' lines</a></div>');
          $skipEl.data({
            'beforeStartIndex': beforeIdx,
            'afterStartIndex': afterIdx,
            'jumpLength': jump
          });
          
          beforeIdx += jump;
          afterIdx += jump;
          i += jump - 1;
          els.push($('<div>...</div>').get(0));
          els.push($('<div class=skip>...</div>').get(0));
          els.push($('<div>...</div>').get(0));
          els.push($skipEl.get(0));
          
          // skip last lines if they're all equal
          if (isEnd) {
            break;
          } else {
            continue;
          }
        }
      }

      var els = [];
      topRows.push(els);
      beforeIdx = addCells(els, beforeIdx, beforeEnd, beforeLines, 'before line-' + (beforeIdx + 1) + ' ' + change);
      afterIdx = addCells(els, afterIdx, afterEnd, afterLines, 'after line-' + (afterIdx + 1) + ' ' + change);
    }

    for (var i = 0; i < topRows.length; i++) rows.push(topRows[i]);
    for (var i = 0; i < botRows.length; i++) rows.push(botRows[i]);
  }

  var $container = $('<div class="diff">');
  $container.append($leftLineDiv, $leftContent, $rightLineDiv, $rightContent);

  // TODO(danvk): append each element of rows to the appropriate div here.
  rows.forEach(function(row) {
    if (row.length != 4) throw "Invalid row: " + row;

    $leftLineDiv.append(row[0]);
    $leftContent.append(row[1]);
    $rightLineDiv.append(row[2]);
    $rightContent.append(row[3]);
  });

  return $container.get(0);
};

function addCells(row, tidx, tend, textLines, change) {
  if (tidx < tend) {
    row.push($('<div>').text(tidx + 1).get(0));
    row.push($('<div>')
        .addClass(change)
        .text(textLines[tidx].replace(/\t/g, "\u00a0\u00a0\u00a0\u00a0"))
        .get(0));
    return tidx + 1;
  } else {
    row.push($('<div>&nbsp;</div>').get(0));
    row.push($('<div class="empty">&nbsp;</div>').get(0));
    return tidx;
  }
}

return diffview;

})();
