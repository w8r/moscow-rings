var gulp = require('gulp');

var browserify = require('browserify');
var watchify = require('watchify');
var babelify = require('babelify');

var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var merge = require('utils-merge');

var rename = require('gulp-rename');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var serve = require('gulp-serve');


/* nicer browserify errors */
var gutil = require('gulp-util');
var chalk = require('chalk');

var less = require('gulp-less');
var path = require('path');

gulp.task('less', function () {
  return gulp.src('./src/**/*.less')
    .pipe(less({
      paths: [ path.join(__dirname, 'less', 'includes') ]
    }))
    .pipe(gulp.dest('./build/css'));
});

function map_error(err) {
  if (err.fileName) {
    // regular error
    gutil.log(chalk.red(err.name)
      + ': '
      + chalk.yellow(err.fileName.replace(__dirname + '/src/', ''))
      + ': '
      + 'Line '
      + chalk.magenta(err.lineNumber)
      + ' & '
      + 'Column '
      + chalk.magenta(err.columnNumber || err.column)
      + ': '
      + chalk.blue(err.description))
  } else {
    // browserify error..
    gutil.log(chalk.red(err.name)
      + ': '
      + chalk.yellow(err.message))
  }
}
/* */

gulp.task('watchify', function () {
  var args = merge(watchify.args, { debug: true });
  var bundler = watchify(
    browserify('./src/index.js', args)
    .external('leaflet')
  ).transform(babelify, { optional: ['runtime'] });
  bundle_js(bundler);

  bundler.on('update', function () {
    bundle_js(bundler)
  });
});

function bundle_js(bundler) {
  return bundler.bundle()
    .on('error', map_error)
    .pipe(source('app.js'))
    .pipe(buffer())
    .pipe(gulp.dest('./build/'))
    .pipe(rename('app.min.js'))
    .pipe(sourcemaps.init({ loadMaps: true }))
      // capture sourcemaps from transforms
      .pipe(uglify())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('./build/'));
}

// Without watchify
gulp.task('browserify', function () {
  var bundler = browserify('./src/index.js', { debug: true })
  .external('leaflet')
  .transform(babelify, { optional: ['runtime'] });

  return bundle_js(bundler);
});

// Without sourcemaps
gulp.task('browserify-production', function () {
  var bundler = browserify('./src/index.js')
    .transform(babelify, { optional: ['runtime'] });

  return bundler.bundle()
    .on('error', map_error)
    .pipe(source('app.js'))
    .pipe(buffer())
    .pipe(rename('app.min.js'))
    .pipe(uglify())
    .pipe(gulp.dest('./build/'));
});

gulp.task('serve', serve({
  root: ['.'],
  port: 3001
}));

gulp.task('watch-less', function() {
  return gulp.watch('./src/**/*.less', ['less']);
});

gulp.task('default', ['watchify', 'watch-less', 'serve']);

gulp.task('build', ['browserify-production', 'less']);
