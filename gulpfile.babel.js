import gulp from 'gulp';
import tsify from 'tsify';
import browserify from 'browserify';
import source from 'vinyl-source-stream';
import del from 'del';
import ts from 'gulp-typescript';
import Jasmine from 'jasmine';
import decache from 'decache';
import Jimp from 'jimp';

const bgSrc = ['src/background.ts', 'src/shared.ts'];
const csSrc = ['src/content-script.ts', 'src/shared.ts'];
const testSrc = ['spec/**/*.ts'];
const assets = ['assets/**/*'];
const outDir = './extension';
const originalIconPath = 'assets/images/icon.png'; // png scale better than jpeg for resizing purposes.

const compileBgScript = () => {
    return browserify()
        .add(bgSrc)
        .plugin(tsify, { noImplicitAny: true, target: 'es6' })
        .bundle()
        .on('error', (err) => { console.error(err) })
        .pipe(source('background.js'))
        .pipe(gulp.dest(outDir))
}
const compileContentScript = () => {
    return browserify()
        .add(csSrc)
        .plugin(tsify, { noImplicitAny: true, target: 'es6' })
        .bundle()
        .on('error', (err) => { console.error(err) })
        .pipe(source('content-script.js'))
        .pipe(gulp.dest(outDir))
}

const compileTests = () => {
    return gulp.src(testSrc)
        .pipe(ts({
            noImplicitAny: true,
        }))
        .pipe(gulp.dest('spec'));
}

const watchBackgroundScript = () => {
    gulp.watch(bgSrc, gulp.parallel(compileBgScript));
}

const watchContentScript = () => {
    gulp.watch(csSrc, gulp.parallel(compileContentScript));
}

const watchAssets = () => {
    gulp.watch(assets, copyAssets);
}

export const generateIcons = () => {
    return new Promise((resolve, reject) => {
        Jimp.read(originalIconPath, (err, icon) => {
            if (err) {
                reject();
            }
            for (let size of [16, 24, 32, 48, 128]) {
                const colorIcon = icon.clone();
                colorIcon.resize(size, size)
                    .write(`assets/images/icon-${size}x${size}.png`);
                const grayIcon = icon.clone();
                grayIcon.resize(size, size)
                    .greyscale()
                    .write(`assets/images/icon-gray-${size}x${size}.png`);
            }
            resolve();
        });
    });
}

export const copyAssets = () => {
    return gulp.src(assets)
        .pipe(gulp.dest(outDir));
}

export const watchTests = () => {
    return gulp.watch(testSrc, gulp.series(compileTests, runTest));
}

export const runTest = () => {
    return new Promise((resolve, reject) => {
        const jasmine = new Jasmine();
        jasmine.loadConfig({
            spec_files: ['spec/**/*.js'],
            random: false,
        });
        jasmine.onComplete(passed => {
            // multiple execute calls on jasmine env errors. See https://github.com/jasmine/jasmine/issues/1231#issuecomment-26404527
            jasmine.specFiles.forEach(f => decache(f));
            resolve();
        });
        jasmine.execute();
    });
}

export const clean = () => del([outDir]);
clean.description = 'clean the output directory'

export const build = gulp.parallel(copyAssets, compileBgScript, compileContentScript);
build.description = 'compile all sources'

export const test = gulp.series(compileTests, runTest);

const defaultTask = gulp.series(clean, build, gulp.parallel(watchBackgroundScript, watchContentScript, watchAssets))
defaultTask.description = 'start watching for changes to all source'
export default defaultTask