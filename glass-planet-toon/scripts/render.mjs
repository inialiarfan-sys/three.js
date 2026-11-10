#!/usr/bin/env node
// Frame-exact offline render: Vite dev server -> headless Chrome (Puppeteer) ->
// render(t) for every frame at 30 fps -> raw RGBA piped into ffmpeg (libx264) ->
// narration muxed in with -c:v copy. Writes to *.tmp.mp4 and renames on success.
//
//   npm run render:vertical | render:wide | render:all
//   options:  --from 10 --to 20   render a slice (seconds)   --fps 30   --out out
//   env:      FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe   PUPPETEER_EXECUTABLE_PATH=...
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';

const ROOT = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );
const args = process.argv.slice( 2 );
const opt = ( name, def ) => { const i = args.indexOf( '--' + name ); return i >= 0 ? args[ i + 1 ] : def; };
const target = args.find( ( a ) => ! a.startsWith( '--' ) && ! /^[\d.]+$/.test( a ) ) || 'all';
const FPS = Number( opt( 'fps', 30 ) );
const OUT = path.resolve( ROOT, opt( 'out', 'out' ) );
const SIZES = { vertical: [ 1080, 1920 ], wide: [ 1920, 1080 ] };
const modes = target === 'all' ? [ 'vertical', 'wide' ] : [ target ];
if ( ! modes.every( ( m ) => SIZES[ m ] ) ) { console.error( 'Usage: node scripts/render.mjs vertical|wide|all' ); process.exit( 1 ); }

async function findFfmpeg() {
	if ( process.env.FFMPEG_PATH ) return process.env.FFMPEG_PATH;
	try { const m = await import( 'ffmpeg-static' ); if ( m.default && fs.existsSync( m.default ) ) return m.default; } catch { /* optional */ }
	return 'ffmpeg'; // from PATH
}

function findNarration() {
	const dir = path.join( ROOT, 'public', 'narration' );
	const f = fs.readdirSync( dir ).find( ( n ) => /\.(mp3|wav)$/i.test( n ) );
	if ( ! f ) throw new Error( 'No .mp3 or .wav found in public/narration' );
	return path.join( dir, f );
}

function audioDuration( ffmpeg, file ) {
	const r = spawnSync( ffmpeg, [ '-hide_banner', '-i', file ], { encoding: 'utf8' } );
	const m = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec( r.stderr || '' );
	if ( ! m ) throw new Error( 'Could not read narration duration with ffmpeg (' + ffmpeg + ')' );
	return + m[ 1 ] * 3600 + + m[ 2 ] * 60 + + m[ 3 ];
}

function run( bin, argv ) {
	return new Promise( ( res, rej ) => {
		const p = spawn( bin, argv, { stdio: [ 'ignore', 'inherit', 'inherit' ] } );
		p.on( 'error', rej );
		p.on( 'close', ( code ) => code === 0 ? res() : rej( new Error( `${ path.basename( bin ) } exited with ${ code }` ) ) );
	} );
}

const safeUnlink = ( f ) => { try { fs.unlinkSync( f ); } catch { /* not there */ } };
const fmt = ( s ) => `${ Math.floor( s / 60 ) }m${ String( Math.floor( s % 60 ) ).padStart( 2, '0' ) }s`;

async function renderMode( browser, baseUrl, ffmpeg, narration, mode, duration ) {
	const [ W, H ] = SIZES[ mode ];
	const from = Number( opt( 'from', 0 ) ), to = Math.min( duration, Number( opt( 'to', duration ) ) );
	const first = Math.round( from * FPS ), last = Math.ceil( to * FPS ); // [first, last)
	const total = last - first;
	const suffix = from > 0 || to < duration ? `_${ from }-${ to }s` : '';
	const name = `glass-planet-toon_${ mode }${ suffix }`;
	const videoTmp = path.join( OUT, `${ name }.video.tmp.mp4` );
	const finalTmp = path.join( OUT, `${ name }.tmp.mp4` );
	const final = path.join( OUT, `${ name }.mp4` );

	const page = await browser.newPage();
	await page.setViewport( { width: Math.round( W / 4 ), height: Math.round( H / 4 ) } );
	page.on( 'console', ( m ) => { if ( m.type() === 'error' || m.type() === 'warn' ) console.log( `  [page ${ m.type() }] ${ m.text() }` ); } );
	page.on( 'pageerror', ( e ) => console.log( '  [page error]', e.message ) );
	await page.goto( `${ baseUrl }?capture=1&mode=${ mode }&duration=${ duration }`, { waitUntil: 'load' } );
	await page.waitForFunction( 'window.__ready || window.__error', { timeout: 120000 } );
	const err = await page.evaluate( () => window.__error );
	if ( err ) throw new Error( 'Page failed to boot:\n' + err );

	console.log( `\n▶ ${ mode } ${ W }x${ H } @ ${ FPS } fps — ${ total } frames (${ from.toFixed( 2 ) }s → ${ to.toFixed( 2 ) }s)` );
	const enc = spawn( ffmpeg, [
		'-hide_banner', '-loglevel', 'error', '-y',
		'-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${ W }x${ H }`, '-framerate', String( FPS ), '-i', 'pipe:0',
		'-vf', 'vflip', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
		'-movflags', '+faststart', videoTmp,
	], { stdio: [ 'pipe', 'inherit', 'inherit' ] } );
	const encDone = new Promise( ( res, rej ) => {
		enc.on( 'error', rej );
		enc.on( 'close', ( code ) => code === 0 ? res() : rej( new Error( 'ffmpeg (video) exited with ' + code ) ) );
	} );

	const started = Date.now();
	for ( let f = first; f < last; f ++ ) {
		const t = f / FPS;
		const b64 = await page.evaluate( ( tt ) => window.__app.frame( tt ), t );
		const buf = Buffer.from( b64, 'base64' );
		if ( buf.length !== W * H * 4 ) throw new Error( `Frame ${ f }: got ${ buf.length } bytes, expected ${ W * H * 4 }` );
		if ( ! enc.stdin.write( buf ) ) await new Promise( ( r ) => enc.stdin.once( 'drain', r ) );
		const done = f - first + 1;
		if ( done % 30 === 0 || done === total ) {
			const el = ( Date.now() - started ) / 1000, eta = el / done * ( total - done );
			process.stdout.write( `\r  frame ${ done }/${ total }  ${ ( done / el ).toFixed( 1 ) } fps  elapsed ${ fmt( el ) }  eta ${ fmt( eta ) }   ` );
		}
	}
	enc.stdin.end();
	await encDone;
	await page.close();

	console.log( '\n  muxing narration…' );
	await run( ffmpeg, [
		'-hide_banner', '-loglevel', 'error', '-y',
		'-i', videoTmp, '-ss', String( from ), '-t', String( to - from ), '-i', narration,
		'-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
		'-shortest', '-movflags', '+faststart', finalTmp,
	] );
	safeUnlink( final );
	fs.renameSync( finalTmp, final );
	safeUnlink( videoTmp );
	console.log( `  ✔ ${ path.relative( ROOT, final ) }` );
}

async function main() {
	fs.mkdirSync( OUT, { recursive: true } );
	const ffmpeg = await findFfmpeg();
	const narration = findNarration();
	const duration = audioDuration( ffmpeg, narration );
	console.log( `ffmpeg: ${ ffmpeg }\nnarration: ${ path.relative( ROOT, narration ) } (${ duration.toFixed( 2 ) }s)` );

	const server = await createServer( { root: ROOT, logLevel: 'error', server: { port: 5199, strictPort: false, host: '127.0.0.1' } } );
	await server.listen();
	const baseUrl = server.resolvedUrls.local[ 0 ];
	const browser = await puppeteer.launch( {
		headless: true,
		executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
		args: [ '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
			...( process.platform === 'linux' ? [ '--no-sandbox' ] : [] ) ],
		protocolTimeout: 0,
	} );
	try {
		for ( const m of modes ) await renderMode( browser, baseUrl, ffmpeg, narration, m, duration );
	} finally {
		await browser.close();
		await server.close();
	}
}

main().catch( ( e ) => { console.error( '\n✖ ' + ( e.stack || e ) ); process.exit( 1 ); } );
