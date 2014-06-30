var diffview = (function() {

var differ = function(beforeText, afterText, params) {
  if (!'beforeText' in userParams) throw "need beforeText";
  if (!'afterText' in userParams) throw "need afterText";

  var defaultParams = {
    contextSize: 3,
    syntaxHighlighting: false,
    beforeName: "Before",
    afterName: "After"
  };

  this.params = $.extend({}, defaultParams, userParams);

  this.beforeLines = difflib.stringAsLines(beforeText);
  this.afterLines = difflib.stringAsLines(afterText);
  var sm = new difflib.SequenceMatcher(beforeLines, afterLines);
  this.opcodes = sm.get_opcodes();

  if (params.syntaxHighlighting) {
    this.beforeLinesHighlighted = this.highlightText_(beforeText);
    this.afterLinesHighlighted = this.highlightText_(afterText);
  }
};

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
 * @return {Array.<string>} Lines marked up with syntax <span>s.
 */
differ.highlightText_ = function(text) {
  // Create an unattached DOM element to mark up.
  var $wrapper = $('<div>').text(text);
  hljs.highlightBlock($wrapper.get(0));

  // Some of the <span>s might cross lines, which won't work for our diff
  // structure. We convert them to single-line only <spans> here.
}

differ.buildView = function(beforeText, afterText, userParams) {

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
           (opcodeIdx == 0 && i == 0))) {
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

      if (change == 'replace') {
        addCharacterDiffs(els[1], els[3]);
      }
    }

    for (var i = 0; i < topRows.length; i++) rows.push(topRows[i]);
    for (var i = 0; i < botRows.length; i++) rows.push(botRows[i]);
  }

  var $container = $('<div class="diff">');

  $container.append(
      $('<div class=diff-header>').text(params.beforeName),
      $('<div class=diff-header>').text(params.afterName),
      $('<br>'));

  $container.append(
      $('<div class=diff-wrapper>').append($leftLineDiv, $leftContent),
      $('<div class=diff-wrapper>').append($rightLineDiv, $rightContent));

  // TODO(danvk): append each element of rows to the appropriate div here.
  rows.forEach(function(row) {
    if (row.length != 4) throw "Invalid row: " + row;

    $leftLineDiv.append(row[0]);
    $leftContent.append(row[1]);
    $rightLineDiv.append(row[2]);
    $rightContent.append(row[3]);
  });

  var $wrapperDivs = $container.find('.diff-wrapper');
  $wrapperDivs.on('scroll', function(e) {
    var otherDiv = $wrapperDivs.not(this).get(0);
    otherDiv.scrollLeft = this.scrollLeft;
  });

  return $container.get(0);
};

function addCells(row, tidx, tend, textLines, change) {
  if (tidx < tend) {
    var txt = textLines[tidx].replace(/\t/g, "\u00a0\u00a0\u00a0\u00a0");
    row.push($('<div class=line-no>').text(tidx + 1).get(0));
    row.push($('<div>')
        .addClass(change + ' code')
        .text(txt)
        .get(0));
    return tidx + 1;
  } else {
    row.push($('<div class=line-no>').get(0));
    row.push($('<div class="empty code">').get(0));
    return tidx;
  }
}

function addCharacterDiffs(beforeCell, afterCell) {
  var beforeText = $(beforeCell).text(), afterText = $(afterCell).text();
  var sm = new difflib.SequenceMatcher(beforeText.split(''), afterText.split(''));
  var opcodes = sm.get_opcodes();
  var minEqualFrac = 0.5;  // suppress character-by-character diffs if there's less than this much overlap.
  var equalCount = 0, charCount = 0;
  opcodes.forEach(function(opcode) {
    var change = opcode[0];
    var beforeLen = opcode[2] - opcode[1];
    var afterLen = opcode[4] - opcode[3];
    var count = beforeLen + afterLen;
    if (change == 'equal') equalCount += count;
    charCount += count;
  });
  if (equalCount < minEqualFrac * charCount) return;

  var beforeEls = [], afterEls = [];
  opcodes.forEach(function(opcode) {
    var change = opcode[0];
    var beforeIdx = opcode[1];
    var beforeEnd = opcode[2];
    var afterIdx = opcode[3];
    var afterEnd = opcode[4];
    var beforeSubstr = beforeText.substring(beforeIdx, beforeEnd);
    var afterSubstr = afterText.substring(afterIdx, afterEnd);
    if (change == 'equal') {
      beforeEls.push(beforeSubstr);
      afterEls.push(afterSubstr);
    } else if (change == 'delete') {
      beforeEls.push($('<span class=char-delete>').text(beforeSubstr));
    } else if (change == 'insert') {
      afterEls.push($('<span class=char-insert>').text(afterSubstr));
    } else if (change == 'replace') {
      beforeEls.push($('<span class=char-replace>').text(beforeSubstr));
      afterEls.push($('<span class=char-replace>').text(afterSubstr));
    } else {
      throw "Invalid opcode: " + opcode[0];
    }
  });
  $(beforeCell).empty().append(beforeEls);
  $(afterCell).empty().append(afterEls);
}

return differ;

})();
