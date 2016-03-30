var gulp = require('gulp');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var shell = require('gulp-shell');
var colors = require('colors/safe');

// Gulp task to generate development documentation;
gulp.task('doc_alt', function(done) {
  console.log('Generating documentation... (this exec stuff does not really work)');
  exec('node_modules/.bin/jsdoc -R readme.md -d docs src/*', function(err, stdout, stderr) {
    if (err) return done(err);
    console.log('Documentation generated in "docs" directory');
    done();
  });
});

gulp.task('doc', [], shell.task([
  'node_modules/.bin/jsdoc -R README.md -d docs src/**'
]));

// Task and dependencies to distribute for all environments;
var babel = require('babelify');
var browserify = require('browserify');
var source = require('vinyl-source-stream');

gulp.task('build', function() {
  var bundler = browserify('./src/mn/MatrixMN.js',
  {
    standalone: 'MatrixMN',
    debug: false
  }).transform(babel);
  // exclude modules that are included directly in the implementation
  bundler.exclude('websocket');
  bundler.exclude('http');
  bundler.exclude('finalhandler');
  bundler.exclude('serve-static');
  bundler.exclude('matrix-js-sdk');
  bundler.exclude('matrix-appservice');
  bundler.exclude('matrix-appservice-bridge');

  var stubBundler = browserify('./src/stub/MatrixProtoStub.js',
  {
    standalone: 'MatrixProtoStub',
    debug: false
  }).transform(babel);

  function rebundle() {
    bundler.bundle()
      .on('error', function(err) {
        console.error(err);
        this.emit('end');
      })
      .pipe(source('MatrixMN.js'))
      .pipe(gulp.dest('./dist'));

    stubBundler.bundle()
      .on('error', function(err) {
        console.error(err);
        this.emit('end');
      })
      .pipe(source('MatrixProtoStub.js'))
      .pipe(gulp.dest('./dist'));
  }

  rebundle();
});

gulp.task('dist', ['build'], shell.task([
  'mkdir -p dist',
  'cd ./dist && cp -r ../src/docker .',
  'cd ./dist && cp -r ../src/mn/config.js .',
  'cd ./dist && cp -r ../src/mn/rethink-mn-registration.yaml .',
  'cd ./dist && mkdir -p node_modules',
  // 'cd ./dist/node_modules && cp -r ../../node_modules/matrix-js-sdk .',
  // 'cd ./dist/node_modules && cp -r ../../node_modules/matrix-appservice .',
  // 'cd ./dist/node_modules && cp -r ../../node_modules/matrix-appservice-bridge .',
  // 'cd ./dist/node_modules && cp -r ../../node_modules/promise .',
  // 'cd ./dist/node_modules && cp -r ../../node_modules/url .',
  // 'cd ./dist/node_modules && cp -r ../../node_modules/websocket .',
  // 'cd ./dist/node_modules && cp -r ../../node_modules/request .',
  'cd ./dist/node_modules && cp -r ../../node_modules/* .',
]))

gulp.task('builddocker', ['dist'], function (callback) {
  var domain = process.argv[3] ? process.argv[3] : "matrix1.rethink";
  if ( domain.charAt(0)=='-' && domain.charAt(1)=='-' )
    domain = domain.substring(2);
  console.log("building docker image for "+domain);
  var cmd = spawn('dist/docker/build-docker-image.sh',[domain],{stdio:'inherit'});
  cmd.on('close',  function (code) {
    callback(code);
  });
});

gulp.task('startdevelopment', [], function (callback) {
  var cmd = spawn('dist/docker/startdevelopment.sh',{stdio:'inherit'});
  cmd.on('close',  function (code) {
    callback(code);
  });
});

gulp.task('startmn', [], shell.task([
  'cd dist && node MatrixMN -p 8011'
]));

gulp.task('startregistry', [], shell.task([
  'dist/docker/startregistry.sh'
]));

gulp.task('start', [], shell.task([
  'cd dist/docker && ./start.sh'
]));

gulp.task('stop', [], shell.task([
  'cd dist/docker && ./stop.sh'
]));

gulp.task('test', [], shell.task([
  'karma start'
]));

gulp.task('autotest', [], function () {
  var bd = spawn('gulp',['builddocker'],{stdio:'inherit'});
  bd.on('close',  function (code) {
    var registry = spawn('gulp',['startregistry']);
    const grep = spawn('grep', ['Started ServerConnector@']);
    const grepstart = spawn('grep', ['Synapse now listening']);

    registry.stdout.on('data', function () {
      grep.stdin.write(data);
    });

    grep.stdout.on('data', (data) => {
      var docker = spawn('gulp', ['start']);
      var dockerwatch =  spawn('watch', ['-e', '"docker logs dev-msg-node-matrix 2>&1|grep \"Total database time\""']);
    });

    callback(code);
  });

  shell.task(['karma start'])
});

gulp.task('help', function() {
  console.log('\nThe following gulp tasks are available:\n');
  console.log('gulp' + ' ' + 'help\t\t\t' + '# show this help');
  console.log('gulp' + ' ' + 'helpdev\t\t\t' + '# show the help for development functions');
  console.log('gulp' + ' ' + 'doc\t\t\t' + '# generates documentation in docs folder');
  console.log('gulp' + ' ' + 'build\t\t\t' + '# transpile and bundle the MatrixMN and MatrixProtoStub');
  console.log('gulp' + ' ' + 'dist\t\t\t' + '# creates dist folder with transpiled code and executes build');
  console.log('gulp' + ' ' + 'builddocker ' + colors.grey('domain.tld\t') + '# builds a docker image with a MatrixHS and MatrixMN for ' + colors.grey('domain.tld') + ' and executes build and dist');
  console.log('gulp' + ' ' + 'start\t\t\t' + '# starts the docker image');
  console.log('gulp' + ' ' + 'stop\t\t\t' + '# stops the docker image');
//  console.log('gulp' + ' ' + 'autotest\t\t\t' + '# executes the test cases');
  console.log('gulp' + ' ' + 'test\t\t\t' + '# executes the test cases');
})

gulp.task('helpdev', function() {
  console.log('\nThe following gulp tasks are available for development:\n');
  console.log('gulp' + ' ' + 'startdevelopment\t\t' + '# removes the MatrixMN from docker; use gulp startmn to start the node externally');
  console.log('gulp' + ' ' + 'startmn\t\t\t' + '# starts the MatrixMN from dist folder (depends on dist)');
})
