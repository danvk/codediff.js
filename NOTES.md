codediff.js is the really old, grungy bit of webdiff!

This is the structure:

class differ {
  params: object;
  beforeLines: string[];
  afterLines: string[];
  diffRanges: ???[];  // return type of opcodesToDiffRanges
  beforeLinesHighlighted?: string[]
  afterLinesHighlighted?: string[]

  maxLineNumber(): number;
  attachHandlers_(el: HTMLElement): void;
  buildView_(): HTMLElement;

  static distributeSpans_(text: string): string[];
  static highlightText_(text: string, language?: string): string[];
  static buildRowTr_(type: ??, beforeLineNum: number, beforeTextOrHtml, afterLineNum, afterTextOrHtml, language): HTMLElement;
  static buildSkipTr_(beforeIdx, afterIdx, numRowsSkipped): HTMLElement;
  static opcodesToDiffRanges(opcodes, contextSize, minJumpSize): {type, before:[start,limit], after:[start,limit]}[]
  static addSoftBreaks(el: HTMLElement): void;
  static splitIntoWords_(line: string): string[];
  static computeCharacterDiffs_(beforeText: string, afterText: string): [any[], any[]];
  static addCharacterDiffs_(beforeCell, afterCell): void;
  static simplifyCodes_(codes: any[]): any[];
  static codesToHtml_(mapper: differ.htmlTextMapper, codes): string;
  static buildView(beforeText, afterText, userParams): HTMLElement;
  static guessLanguageUsingFileName(name: string): string | null;
  static guessLanguageUsingContents(contents: string): string | null;
}

class differ.htmlTextMapper {
  text_: string;
  html_: string;
  getHtmlSubstring(start: number, limit: number): string;
}

To run the tests, you open test/index.html in your browser.
This is really a transitional project between dygraphs and knowing what I was doing!

I can see the appeal of browser-based testing if your app is heavily dependent on jQuery.

Next steps…

- [ ] Split codediff.ts into multiple modules
- [ ] Set up a bundler or get ESM working
