namespace difflib {
    function stringAsLines(text: string): string[];

    type OpCode = [
        type: 'replace' | 'delete' | 'insert' | 'equal',
        beforeIdx: number,
        beforeEnd: number,
        afterIdx: number,
        afterEnd: number,
    ];

    class SequenceMatcher {
        constructor(beforeLines: string[], afterLines: string[]);
        get_opcodes(): OpCode[]
    }
}
