QUnit.test('basic functionality', function(assert) {
  var html = 'foo<span>bar</span>baz';
  var text = $('<div>').html(html).text();
  var map = new diffview.htmlTextMapper(text, html);

  assert.equal(map.getHtmlSubstring(0, 0), '');
  assert.equal(map.getHtmlSubstring(0, 1), 'f');
  assert.equal(map.getHtmlSubstring(0, 2), 'fo');
  assert.equal(map.getHtmlSubstring(0, 3), 'foo');
  assert.equal(map.getHtmlSubstring(0, 4), 'foo<span>b');
  assert.equal(map.getHtmlSubstring(0, 5), 'foo<span>ba');
  assert.equal(map.getHtmlSubstring(0, 6), 'foo<span>bar');
  assert.equal(map.getHtmlSubstring(0, 7), 'foo<span>bar</span>b');
  assert.equal(map.getHtmlSubstring(0, 8), 'foo<span>bar</span>ba');
  assert.equal(map.getHtmlSubstring(0, 9), 'foo<span>bar</span>baz');
});

QUnit.test('leading/trailing html', function(assert) {
  var html = '<p>foo<span>bar</span>baz</p>';
  var text = $('<div>').html(html).text();
  var map = new diffview.htmlTextMapper(text, html);

  assert.equal(map.getHtmlSubstring(0, 0), '');
  assert.equal(map.getHtmlSubstring(0, 1), '<p>f');
  assert.equal(map.getHtmlSubstring(0, 2), '<p>fo');
  assert.equal(map.getHtmlSubstring(0, 3), '<p>foo');
  assert.equal(map.getHtmlSubstring(0, 4), '<p>foo<span>b');
  assert.equal(map.getHtmlSubstring(0, 5), '<p>foo<span>ba');
  assert.equal(map.getHtmlSubstring(0, 6), '<p>foo<span>bar');
  assert.equal(map.getHtmlSubstring(0, 7), '<p>foo<span>bar</span>b');
  assert.equal(map.getHtmlSubstring(0, 8), '<p>foo<span>bar</span>ba');
  assert.equal(map.getHtmlSubstring(0, 9), '<p>foo<span>bar</span>baz</p>');
});

QUnit.test('leading/trailing html, fixed right', function(assert) {
  var html = '<p>foo<span>bar</span>baz</p>';
  var text = $('<div>').html(html).text();
  var map = new diffview.htmlTextMapper(text, html);

  assert.equal(map.getHtmlSubstring(0, 9), '<p>foo<span>bar</span>baz</p>');
  assert.equal(map.getHtmlSubstring(1, 9),     'oo<span>bar</span>baz</p>');
  assert.equal(map.getHtmlSubstring(2, 9),      'o<span>bar</span>baz</p>');
  assert.equal(map.getHtmlSubstring(3, 9),       '<span>bar</span>baz</p>');
  assert.equal(map.getHtmlSubstring(4, 9),              'ar</span>baz</p>');
  assert.equal(map.getHtmlSubstring(5, 9),               'r</span>baz</p>');
  assert.equal(map.getHtmlSubstring(6, 9),                '</span>baz</p>');
  assert.equal(map.getHtmlSubstring(7, 9),                        'az</p>');
  assert.equal(map.getHtmlSubstring(8, 9),                         'z</p>');
  assert.equal(map.getHtmlSubstring(9, 9),                              '');
});

QUnit.test('small html', function(assert) {
  var html = '<q>xx</q>';
  var text = $('<div>').html(html).text();
  var map = new diffview.htmlTextMapper(text, html);

  assert.equal(map.getHtmlSubstring(0, 0), '');
  assert.equal(map.getHtmlSubstring(0, 1), '<q>x');
  assert.equal(map.getHtmlSubstring(0, 2), '<q>xx</q>');
  assert.equal(map.getHtmlSubstring(1, 2), 'x</q>');
  assert.equal(map.getHtmlSubstring(2, 2), '');
});
