type OpType = difflib.OpCode[0];

export interface DiffRange {
  type: OpType | 'skip';
  before: [start: number, limit: number];
  after: [start: number, limit: number];
}

// Input is a list of opcodes, as output by difflib (e.g. 'equal', 'replace',
// 'delete', 'insert').
// Output is a list of diff ranges which corresponds precisely to the view, e.g.
// 'skip', 'insert', 'replace', 'delete' and 'equal'.
// Outputs are {type, before:[start,limit], after:[start,limit]} tuples.
export function opcodesToDiffRanges(opcodes: difflib.OpCode[], contextSize: number, minJumpSize: number): DiffRange[] {
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
