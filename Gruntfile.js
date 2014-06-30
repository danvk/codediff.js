/*global module*/
module.exports = function(grunt) {
  'use strict';

  var jsSources = [
    'Gruntfile.js',
    '*.js',
    'test/**/*.js'
  ];

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    qunit: {
      src: ['test/index.html']
    },
  });

  grunt.loadNpmTasks('grunt-contrib-qunit');

  grunt.registerTask('test', 'qunit:src');
  grunt.registerTask('travis', ['test']);
};
