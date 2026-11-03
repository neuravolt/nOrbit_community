import { parseJsonResponse } from './parse-json-response';

describe('parseJsonResponse', () => {
  it('parses clean JSON unchanged', () => {
    expect(parseJsonResponse('{"a":1,"b":"two"}')).toEqual({ a: 1, b: 'two' });
  });

  it('strips a ```json fence', () => {
    expect(parseJsonResponse('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('strips a bare ``` fence', () => {
    expect(parseJsonResponse('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  // Confirmed live: LongCat's ai.generate.content fallback response failed with "Bad control
  // character in string literal in JSON at position 737" — a raw newline typed straight into a
  // multi-paragraph "notes" field instead of the escaped "\n".
  it('repairs a raw newline inside a string value', () => {
    const malformed = '{"notes":"Line one.\nLine two."}';
    expect(parseJsonResponse(malformed)).toEqual({ notes: 'Line one.\nLine two.' });
  });

  it('repairs a raw tab and carriage return inside a string value', () => {
    const malformed = '{"code":"a\tb\rc"}';
    expect(parseJsonResponse(malformed)).toEqual({ code: 'a\tb\rc' });
  });

  // Confirmed live: "Bad escaped character in JSON at position 6982" — a Windows-style path or
  // a currency symbol like \$ typed into a string, which JSON never accepts as an escape.
  it('repairs an invalid backslash escape inside a string value', () => {
    const malformed = '{"path":"C:\\Users\\dev","price":"\\$5"}';
    expect(parseJsonResponse(malformed)).toEqual({ path: 'C:\\Users\\dev', price: '\\$5' });
  });

  it('leaves valid escapes (\\n, \\", \\\\, \\u00e9) untouched', () => {
    const valid = '{"a":"line1\\nline2","b":"quote:\\"x\\"","c":"back\\\\slash","d":"caf\\u00e9"}';
    expect(parseJsonResponse(valid)).toEqual({
      a: 'line1\nline2',
      b: 'quote:"x"',
      c: 'back\\slash',
      d: 'café',
    });
  });

  it('handles both defects together in one realistic multi-field payload', () => {
    // Note: a backslash followed by one of b/f/n/r/t/u (e.g. "\temp", "\file") is inherently
    // indistinguishable from a genuine JSON escape at the character level — that ambiguity is
    // unresolvable by any text-only repair, not a defect in this function, so this fixture
    // deliberately avoids those letters in favor of ones JSON never treats as an escape.
    const malformed =
      '{"notes":"Paragraph one.\nParagraph two with a path C:\\Apps\\Code.","cheatsheet":"tip: use \\$PATH"}';
    expect(parseJsonResponse(malformed)).toEqual({
      notes: 'Paragraph one.\nParagraph two with a path C:\\Apps\\Code.',
      cheatsheet: 'tip: use \\$PATH',
    });
  });

  it('does not mask a genuinely malformed structure (unbalanced braces)', () => {
    expect(() => parseJsonResponse('{"a":1')).toThrow();
  });

  it('does not mask genuinely malformed structure with a trailing comma', () => {
    expect(() => parseJsonResponse('{"a":1,}')).toThrow();
  });
});
