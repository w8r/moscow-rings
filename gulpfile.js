var gulp = require('gulp');

var browserify = require('browserify');
var watchify = require('watchify');
var babel = require('babelify');

var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var merge = require('utils-merge');

var rename = require('gulp-rename');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var serve = require('gulp-serve');
var rename = require('gulp-rename')


/* nicer browserify errors */
var gutil = require('gulp-util');
var chalk = require('chalk');

var less = require('gulp-less');
var path = require('path');

var dependencies = [];

gulp.task('less', function () {
  return gulp.src('./src/**/*.less')
    .pipe(less({
      paths: [ path.join(__dirname, 'less', 'includes') ]
    }))
    .pipe(gulp.dest('./build/css'));
});

function compile(watch) {
  var browserified = browserify('./src/index.js', {
      require: dependencies,
      debug: true,
      'ignore-missing': true
    })
    .transform(
      babel.configure({
        optional: ['runtime']
      })
    );

  var bundler = browserified;

  if (watch) {
    dependencies.forEach(function(dep) {
      browserified.external(dep);
    });
    bundler = watchify(browserified);
  }

  function rebundle() {
    var stream = bundler.bundle()
      .on('error', function(err) {
        gutil.log(
          gutil.colors.red('Watchify:'),
          gutil.colors.white(err)
        );
        this.emit('end');
      })
      .pipe(source('app.js'))
      .pipe(buffer())
      .pipe(gulp.dest('./build'))
      .pipe(sourcemaps.init({
        loadMaps: true
      }))
      .pipe(rename('app.min.js'))
      .pipe(sourcemaps.init({
        loadMaps: true
      }));

    if (watch) {
      stream
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('./build'));
    } else {
      stream
         .pipe(uglify())
         .pipe(sourcemaps.write('.'))
         .pipe(gulp.dest('./build'));
    }
  }

  if (watch) {
    bundler
      .on('update', function() {
        rebundle();
      })
      .on('log', function(msg) {
        gutil.log(
          gutil.colors.green('Watchify:'),
          gutil.colors.white(msg)
        );
      });
  }

  rebundle();
}

function watch() {
  return compile(true);
}

gulp.task('build', function() {
  return compile();
});

gulp.task('scripts', function() {
  bundleApp(true);
});

gulp.task('watch', function() {
  watch();
});

gulp.task('serve', serve({
  root: ['.'],
  port: 3001
}));

gulp.task('watch-less', function() {
  return gulp.watch('./src/**/*.less', ['less']);
});

gulp.task('default', ['watch', 'watch-less', 'serve']);

gulp.task('production', ['build', 'less']);
