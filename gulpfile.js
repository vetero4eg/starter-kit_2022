let preprocessor = 'sass', // Preprocessor (sass, less, styl); 'sass' also work with the Scss syntax in blocks/ folder.
		fileswatch   = 'txt,json,md,woff2' //'html,htm,txt,json,md,woff2' // List of files extensions for watching & hard reload

import pkg from 'gulp'
const { gulp, src, dest, parallel, series, watch } = pkg

import browserSync   																from 'browser-sync'
import pug                                          from 'gulp-pug'
import webpackStream 																from 'webpack-stream'
import webpack       																from 'webpack'
import TerserPlugin  																from 'terser-webpack-plugin'
import gulpSass      																from 'gulp-sass'
import dartSass      																from 'sass'
import sassglob      																from 'gulp-sass-glob'
const  sass          																= gulpSass(dartSass)
import postCss       																from 'gulp-postcss'
import cssnano       																from 'cssnano'
import autoprefixer  																from 'autoprefixer'
import imagemin, {gifsicle, mozjpeg, optipng, svgo} from 'gulp-imagemin';
import svgSprite                                    from 'gulp-svg-sprite';
// import changed       																from 'gulp-changed'
import concat        																from 'gulp-concat'
// import rsync        															 from 'gulp-rsync'
import {deleteAsync} 																from 'del'

function browsersync() {
	browserSync.init({
		server: {
			baseDir: 'dist/',
		},
		ghostMode: { clicks: false },
		notify: false,
		online: true,
		// tunnel: 'yousutename', // Attempt to use the URL https://yousutename.loca.lt
	})
}

function scripts() {
	return src(['app/js/*.js', '!app/js/*.min.js'])
		.pipe(webpackStream({
			mode: 'production',
			performance: { hints: false },
			plugins: [
				// new webpack.ProvidePlugin({ $: 'jquery', jQuery: 'jquery', 'window.jQuery': 'jquery' }), // jQuery (npm i jquery)
			],
			module: {
				rules: [
					{
						test: /\.m?js$/,
						exclude: /(node_modules)/,
						use: {
							loader: 'babel-loader',
							options: {
								presets: ['@babel/preset-env'],
								plugins: ['babel-plugin-root-import']
							}
						}
					}
				]
			},
			optimization: {
				minimize: true,
				minimizer: [
					new TerserPlugin({
						terserOptions: { format: { comments: false } },
						extractComments: false
					})
				]
			},
		}, webpack)).on('error', (err) => {
			this.emit('end')
		})
		.pipe(concat('app.min.js'))
		.pipe(dest('dist/js'))
		.pipe(browserSync.stream())
}

function styles() {
	return src([`app/styles/${preprocessor}/*.*`, `!app/styles/${preprocessor}/_*.*`])
		.pipe(eval(`${preprocessor}glob`)())
		.pipe(eval(preprocessor)({ 'include css': true }))
		.pipe(postCss([
			autoprefixer({ grid: 'autoplace' }),
			cssnano({ preset: ['default', { discardComments: { removeAll: true } }] })
		]))
		.pipe(concat('app.min.css'))
		.pipe(dest('dist/css'))
		.pipe(browserSync.stream())
}

function images() {
	return src(['app/images/src/**/*'])
		// .pipe(changed('app/images/src/'))
		.pipe(imagemin([
      gifsicle({interlaced: true}),
      mozjpeg({quality: 85, progressive: true}),
      optipng({optimizationLevel: 5}),
      svgo({
        plugins: [
          {removeViewBox: false},
          {cleanupIDs: false}
        ]
      })
    ]))
		.pipe(dest('dist/images/src'))
		.pipe(browserSync.stream())
}

function svg() {
  return src('app/images/svg/*.svg')
		// .pipe(changed('app/images/svg/'))
		.pipe(svgSprite({
			mode: {
				symbol: {
					sprite: 'sprite.svg',
					dest: '.'
				},
				}
			}))
		.pipe(dest('dist/images'));
}

function copy() {
	return src([
		// '{app/js,app/css}/*.min.*',
		'app/images/**/*.*',
		'!app/images/src/**/*',
		// '!app/images/svg/**/*',
		'app/fonts/**/*'
	], { base: 'app/' })
	.pipe(dest('dist'))
}


function html() {
	return src('app/pug/views/\*.pug')
		.pipe(pug({pretty: true,}))
		.pipe(dest('dist'))
}

async function cleandist() {
	await deleteAsync('dist/**/*', { force: true })
}

// function deploy() {
// 	return src('dist/')
// 		.pipe(rsync({
// 			root: 'dist/',
// 			hostname: 'username@yousite.com',
// 			destination: 'yousite/public_html/',
// 			// clean: true, // Mirror copy with file deletion
// 			include: [/* '*.htaccess' */], // Included files to deploy,
// 			exclude: [ '**/Thumbs.db', '**/*.DS_Store' ],
// 			recursive: true,
// 			archive: true,
// 			silent: false,
// 			compress: true
// 		}))
// }

function startwatch() {
	watch(`app/styles/${preprocessor}/**/*`, { usePolling: true }, styles)
	watch(['app/js/**/*.js', '!app/js/**/*.min.js'], { usePolling: true }, scripts)
	watch('app/pug/**/*.pug', html)
	watch('app/images/src/**/*', { usePolling: true }, images)
	watch(`app/**/*.{${fileswatch}}`, { usePolling: true }).on('change', browserSync.reload)
}

export { scripts, styles, images, svg /*, deploy */ }
export let assets = series(scripts, styles, images, svg)
export let build = series(cleandist, html, images, scripts, svg, styles, copy)

export default series(html, scripts, images, svg, styles, copy, parallel(browsersync, startwatch))
