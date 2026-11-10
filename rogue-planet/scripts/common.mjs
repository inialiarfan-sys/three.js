// Shared helpers for the render and still scripts.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';

export const ROOT = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );
export const SIZES = { vertical: [ 1080, 1920 ], wide: [ 1920, 1080 ] };

export async function findFfmpeg() {
	if ( process.env.FFMPEG_PATH ) return process.env.FFMPEG_PATH;
	try { const m = await import( 'ffmpeg-static' ); if ( m.default && fs.existsSync( m.default ) ) return m.default; } catch { /* optional */ }
	return 'ffmpeg';
}

export function findNarration() {
	const f = fs.readdirSync( path.join( ROOT, 'public' ) ).find( ( n ) => /^narration\.(mp3|wav)$/i.test( n ) );
	if ( ! f ) throw new Error( 'Put your narration at public/narration.mp3 (or .wav)' );
	return path.join( ROOT, 'public', f );
}

export function audioDuration( ffmpeg, file ) {
	const r = spawnSync( ffmpeg, [ '-hide_banner', '-i', file ], { encoding: 'utf8' } );
	const m = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec( r.stderr || '' );
	if ( ! m ) throw new Error( 'Could not read the narration duration with ffmpeg (' + ffmpeg + ')' );
	return + m[ 1 ] * 3600 + + m[ 2 ] * 60 + + m[ 3 ];
}

/** Start Vite + headless Chrome and open the capture page. */
export async function openPage( mode, duration, port = 5299 ) {
	const server = await createServer( { root: ROOT, logLevel: 'error', server: { port, strictPort: false, host: '127.0.0.1' } } );
	await server.listen();
	const browser = await puppeteer.launch( {
		headless: true,
		executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
		args: [ '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
			...( process.platform === 'linux' ? [ '--no-sandbox' ] : [] ) ],
		protocolTimeout: 0,
	} );
	const page = await browser.newPage();
	const [ W, H ] = SIZES[ mode ];
	await page.setViewport( { width: Math.round( W / 4 ), height: Math.round( H / 4 ) } );
	page.on( 'console', ( m ) => { if ( [ 'error', 'warn', 'warning' ].includes( m.type() ) && ! /GPU stall|GL Driver/.test( m.text() ) ) console.log( `  [page ${ m.type() }] ${ m.text() }` ); } );
	page.on( 'pageerror', ( e ) => console.log( '  [page error]', e.message ) );
	await page.goto( `${ server.resolvedUrls.local[ 0 ] }?capture=1&mode=${ mode }&duration=${ duration }`, { waitUntil: 'load' } );
	await page.waitForFunction( 'window.__ready || window.__error', { timeout: 180000 } );
	const err = await page.evaluate( () => window.__error );
	if ( err ) throw new Error( 'Page failed to boot:\n' + err );
	return { page, close: async () => { await browser.close(); await server.close(); } };
}
