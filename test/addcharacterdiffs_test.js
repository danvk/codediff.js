QUnit.test('char diffs -- simple', function(assert) {
  var before = $('<div>').text("    return '' + date.getFullYear();").get(0);
  var after =  $('<div>').text("    return 'xx' + date.getFullYear();").get(0);

  var beforeText = $(before).text(),
      afterText = $(after).text();

  diffview.addCharacterDiffs_(before, after);
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

  diffview.addCharacterDiffs_(before, after, true);
  assert.equal($(before).text(), beforeText);
  assert.equal($(after).text(), afterText);
  assert.equal($(before).html(), "<q>''</q>");
  assert.equal($(after).html(), "<q>'<span class=\"char-insert\">xx</span>'</q>");
});

QUnit.test('char diffs with markup', function(assert) {
  var before = $('<div>').html("    <kw>return</kw> <q>''</q> + date.getFullYear();").get(0);
  var after =  $('<div>').html("    <kw>return</kw> <q>'xx'</q> + date.getFullYear();").get(0);

  var beforeText = $(before).text(),
      afterText = $(after).text();

  diffview.addCharacterDiffs_(before, after, true);
  assert.equal($(before).text(), beforeText);
  assert.equal($(after).text(), afterText);
  assert.equal($(before).html(), "    <kw>return</kw> <q>''</q> + date.getFullYear();");
  assert.equal($(after).html(), "    <kw>return</kw> <q>'<span class=\"char-insert\">xx</span>'</q> + date.getFullYear();");
});
