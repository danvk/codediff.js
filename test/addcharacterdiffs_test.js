QUnit.test('simplifyCodes', function(assert) {
  assert.deepEqual(
    codediff.simplifyCodes_([[null, 0, 2], ['x', 2, 4]]),
                            [[null, 0, 2], ['x', 2, 4]]);
  assert.deepEqual(
    codediff.simplifyCodes_([['x', 0, 2], ['x', 2, 4]]),
                            [['x', 0, 4]]);
  assert.deepEqual(
    codediff.simplifyCodes_([['x', 0, 2], ['x', 2, 4], ['y', 4, 6]]),
                            [['x', 0, 4],              ['y', 4, 6]]);
});

QUnit.test('codesToHtml', function(assert) {
  var str = 'hello';
  var map = { getHtmlSubstring: function(a, b) { return str.substring(a, b) } };
  var codes = [[null, 0, 1], ['x', 1, 3], ['y', 3, 5]];
  assert.equal(codediff.codesToHtml_(map, codes),
    'h<span class="char-x">el</span><span class="char-y">lo</span>');
});

QUnit.test('char diffs -- simple', function(assert) {
  var before = $('<div>').text("    return '' + date.getFullYear();").get(0);
  var after =  $('<div>').text("    return 'xx' + date.getFullYear();").get(0);

  var beforeText = $(before).text(),
      afterText = $(after).text();

  codediff.addCharacterDiffs_(before, after);
  assert.equal($(before).text(), beforeText);
  assert.equal($(after).text(), afterText);
  assert.equal($(before).html(), "    return '' + date.getFullYear();");
  assert.equal($(after).html(), "    return '<span class=\"char-insert\">xx</span>' + date.getFullYear();");
});

QUnit.test('char diffs with trailing markup', function(assert) {
  var before = $('<div>').html("<q>''</q>").get(0);
  var after =  $('<div>').html("<q>'xx'</q>").get(0);

  var beforeText = $(before).text(),
      afterText = $(after).text();

  codediff.addCharacterDiffs_(before, after);
  assert.equal($(before).text(), beforeText);
  assert.equal($(after).text(), afterText);
  assert.equal($(before).html(), "<q>''</q>");
  assert.equal($(after).html(), "<q>'</q><span class=\"char-insert\"><q>xx</q></span><q>'</q>");
});

QUnit.test('char diffs with markup', function(assert) {
  var before = $('<div>').html("    <kw>return</kw> <q>''</q> + date.getFullYear();").get(0);
  var after =  $('<div>').html("    <kw>return</kw> <q>'xx'</q> + date.getFullYear();").get(0);

  var beforeText = $(before).text(),
      afterText = $(after).text();

  codediff.addCharacterDiffs_(before, after);
  assert.equal($(before).text(), beforeText);
  assert.equal($(after).text(), afterText);
  assert.equal($(before).html(), "    <kw>return</kw> <q>''</q> + date.getFullYear();");
  assert.equal($(after).html(), "    <kw>return</kw> <q>'</q><span class=\"char-insert\"><q>xx</q></span><q>'</q> + date.getFullYear();");
});

QUnit.test('mixed inserts and markup', function(assert) {
  var beforeCode = '<span class="hljs-string">"q"</span>, s';
  var afterCode =  '<span class="hljs-string">"q"</span><span class="hljs-comment">/*, s*/</span>';
  var beforeEl = $('<div>').html(beforeCode).get(0);
  var afterEl =  $('<div>').html(afterCode).get(0);

  // XXX this is strange -- is this just asserting that there are no exceptions?
  codediff.addCharacterDiffs_(beforeEl, afterEl);
  assert.equal(true, true);
});

// See https://github.com/danvk/github-syntax/issues/17
QUnit.test('pure character add', function(assert) {
  var beforeCode = 'output.writeBytes(obj.sequence)';
  var afterCode =  'output.writeBytes(obj.sequence.toArray)';
  var beforeEl = $('<div>').html(beforeCode).get(0);
  var afterEl =  $('<div>').html(afterCode).get(0);

  codediff.addCharacterDiffs_(beforeEl, afterEl);
  assert.equal($(beforeEl).html(), 'output.writeBytes(obj.sequence)');
  assert.equal($(afterEl).html(),  'output.writeBytes(obj.sequence<span class="char-insert">.toArray</span>)');
});
