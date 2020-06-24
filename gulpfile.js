var gulp = require('gulp');
var serve = require('gulp-serve');

var less = require('gulp-less');
var path = require('path');

const rollup = require('rollup');
const babel = require('rollup-plugin-babel');
const commonjs = require('rollup-plugin-commonjs');
const nodeResolve = require('rollup-plugin-node-resolve');
const json = require('rollup-plugin-json');

var dependencies = [];

gulp.task('less', () => {
  return gulp.src('./src/**/*.less')
    .pipe(less({
      paths: [path.join(__dirname, 'less', 'includes')]
    }))
    .pipe(gulp.dest('./build/css'));
});

const plugins = [
  nodeResolve({
    preferBuiltins: false
  }), commonjs(), json(), babel()
];

gulp.task('build', () => {
  return rollup.rollup({
    input: './src/index.js',
    plugins
  }).then(bundle => {
    return bundle.write({
      file: './dist/app.js',
      format: 'iife',
      name: 'mosrings',
      sourcemap: false
    });
  });
});


gulp.task('watch', () => {
  return rollup.watch({
    input: './src/index.js',
    plugins,
    output: {
      file: './dist/app.js',
      format: 'iife',
      name: 'mosrings',
      sourcemap: true
    }
  }).on('end', (a) => console.log(a));
});


gulp.task('scripts', () => bundleApp(true));

gulp.task('serve', serve({
  root: ['.'],
  port: 3001
}));

gulp.task('watch-less', function () {
  return gulp.watch('./src/**/*.less', gulp.series('less'));
});

gulp.task('default', gulp.parallel('watch', 'watch-less', 'serve'));

gulp.task('production', gulp.parallel('build', 'less'));
