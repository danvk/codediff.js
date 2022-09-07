/**
 * @param text Possibly multiline text containing spans that cross
 *     line breaks.
 * @return An array of individual lines, each of which has
 *     entirely balanced <span> tags.
 */
export function distributeSpans(text: string): string[] {
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
 * Adds soft wrap markers between all characters in a DOM element.
 */
export function addSoftBreaks(el: HTMLElement) {
  var softBreak = '\u200B';
  walkTheDOM(el, function(node) {
    if (node.nodeType !== 3) return;
    var text = (node as Text).data;
    text = text.split('').join(softBreak);
    node.nodeValue = text;
  });
}

function walkTheDOM(node: Node, func: (n: Node) => void) {
  func(node);
  let n = node.firstChild;
  while (n) {
    walkTheDOM(n, func);
    n = n.nextSibling;
  }
}
