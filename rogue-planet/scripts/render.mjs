#!/usr/bin/env node
// Frame-exact render: render(t) for every frame at 30 fps -> raw RGBA -> ffmpeg (libx264 crf 18
// veryfast yuv420p) -> narration muxed with -c:v copy. Writes *.tmp.mp4, renames on success.
//   npm run render:vertical | render:wide | render:all     [--from 40 --to 55]  [--fps 30]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SIZES, audioDuration, findFfmpeg, findNarration, openPage } from './common.mjs';

const args = process.argv.slice( 2 );
const opt = ( n, d ) => { const i = args.indexOf( '--' + n ); return i >= 0 ? args[ i + 1 ] : d; };
const target = args.find( ( a ) => SIZES[ a ] || a === 'all' ) || 'all';
const modes = target === 'all' ? [ 'vertical', 'wide' ] : [ target ];
const FPS = Number( opt( 'fps', 30 ) );
const OUT = path.join( ROOT, 'out' );
const fmt = ( s ) => `${ Math.floor( s / 60 ) }m${ String( Math.floor( s % 60 ) ).padStart( 2, '0' ) }s`;
const unlink = ( f ) => { try { fs.unlinkSync( f ); } catch { /* ok */ } };

function run( bin, argv ) {
	return new Promise( ( res, rej ) => {
		const p = spawn( bin, argv, { stdio: [ 'ignore', 'inherit', 'inherit' ] } );
		p.on( 'error', rej ); p.on( 'close', ( c ) => c === 0 ? res() : rej( new Error( `${ path.basename( bin ) } exited with ${ c }` ) ) );
	} );
}

async function renderMode( mode, ffmpeg, narration, duration ) {
	const [ W, H ] = SIZES[ mode ];
	const from = Number( opt( 'from', 0 ) ), to = Math.min( duration, Number( opt( 'to', duration ) ) );
	const first = Math.round( from * FPS ), last = Math.round( to * FPS );
	const total = last - first;
	const part = from > 0 || to < duration ? `_${ from }-${ to }s` : '';
	const name = `the-planet-with-no-sun_${ mode }${ part }`;
	const videoTmp = path.join( OUT, `${ name }.video.tmp.mp4` ), finalTmp = path.join( OUT, `${ name }.tmp.mp4` ), final = path.join( OUT, `${ name }.mp4` );
	const { page, close } = await openPage( mode, duration );
	console.log( `\n▶ ${ mode } ${ W }x${ H } @ ${ FPS } fps: ${ total } frames (${ from.toFixed( 2 ) }s → ${ to.toFixed( 2 ) }s)` );
	const enc = spawn( ffmpeg, [ '-hide_banner', '-loglevel', 'error', '-y',
		'-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${ W }x${ H }`, '-framerate', String( FPS ), '-i', 'pipe:0',
		'-vf', 'vflip', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', videoTmp ],
	{ stdio: [ 'pipe', 'inherit', 'inherit' ] } );
	const encDone = new Promise( ( res, rej ) => { enc.on( 'error', rej ); enc.on( 'close', ( c ) => c === 0 ? res() : rej( new Error( 'ffmpeg (video) exited with ' + c ) ) ); } );
	const started = Date.now();
	try {
		for ( let f = first; f < last; f ++ ) {
			const b64 = await page.evaluate( ( t ) => window.__app.frame( t ), f / FPS );
			const buf = Buffer.from( b64, 'base64' );
			if ( buf.length !== W * H * 4 ) throw new Error( `frame ${ f }: ${ buf.length } bytes, expected ${ W * H * 4 }` );
			if ( ! enc.stdin.write( buf ) ) await new Promise( ( r ) => enc.stdin.once( 'drain', r ) );
			const done = f - first + 1;
			if ( done % 30 === 0 || done === total ) {
				const el = ( Date.now() - started ) / 1000;
				process.stdout.write( `\r  frame ${ done }/${ total }  ${ ( done / el ).toFixed( 1 ) } fps  elapsed ${ fmt( el ) }  eta ${ fmt( el / done * ( total - done ) ) }   ` );
			}
		}
	} finally {
		enc.stdin.end();
		await close();
	}
	await encDone;
	console.log( '\n  muxing narration…' );
	// video is audio + 1.5 s: no -shortest, the tail is silent
	await run( ffmpeg, [ '-hide_banner', '-loglevel', 'error', '-y', '-i', videoTmp, '-ss', String( from ), '-t', String( to - from ), '-i', narration,
		'-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', finalTmp ] );
	unlink( final ); fs.renameSync( finalTmp, final ); unlink( videoTmp );
	console.log( `  ✔ ${ path.relative( ROOT, final ) }` );
}

async function main() {
	fs.mkdirSync( OUT, { recursive: true } );
	const ffmpeg = await findFfmpeg();
	const narration = findNarration();
	const duration = audioDuration( ffmpeg, narration ) + 1.5;
	console.log( `ffmpeg: ${ ffmpeg }\nnarration: ${ path.relative( ROOT, narration ) } → video ${ duration.toFixed( 2 ) }s (audio + 1.5 s)` );
	for ( const m of modes ) await renderMode( m, ffmpeg, narration, duration );
}
main().catch( ( e ) => { console.error( '\n✖ ' + ( e.stack || e ) ); process.exit( 1 ); } );
