QUnit.test('adds soft breaks to DOM', function(assert) {
  var div = document.createElement('div');
  div.innerHTML = 'foo<b>bar</b>baz';
  codediff.addSoftBreaks(div);
  var html = div.innerHTML.replace(/\u200B/g, '-');  // for legibility
  assert.deepEqual('f-o-o<b>b-a-r</b>b-a-z', html);
});
