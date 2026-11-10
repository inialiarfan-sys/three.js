#!/usr/bin/env node
// Quick QA: save PNG stills at given times.  node scripts/stills.mjs vertical 5 18.5 40
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';

const ROOT = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );
const [ mode = 'vertical', ...times ] = process.argv.slice( 2 );
const OUT = path.join( ROOT, 'out', 'stills' );
fs.mkdirSync( OUT, { recursive: true } );
const server = await createServer( { root: ROOT, logLevel: 'error', server: { port: 5198, host: '127.0.0.1' } } );
await server.listen();
const browser = await puppeteer.launch( { headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
	args: [ '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', ...( process.platform === 'linux' ? [ '--no-sandbox' ] : [] ) ] } );
const page = await browser.newPage();
page.on( 'console', ( m ) => console.log( '[page]', m.text() ) );
page.on( 'pageerror', ( e ) => console.log( '[page error]', e.message ) );
await page.goto( `${ server.resolvedUrls.local[ 0 ] }?capture=1&mode=${ mode }&duration=172.67`, { waitUntil: 'load' } );
await page.waitForFunction( 'window.__ready || window.__error', { timeout: 120000 } );
const err = await page.evaluate( () => window.__error );
if ( err ) { console.error( err ); process.exit( 1 ); }
for ( const t of times ) {
	const url = await page.evaluate( ( tt ) => { window.__app.render( +tt ); return document.getElementById( 'view' ).toDataURL( 'image/png' ); }, t );
	const f = path.join( OUT, `${ mode }_${ String( t ).padStart( 6, '0' ) }.png` );
	fs.writeFileSync( f, Buffer.from( url.split( ',' )[ 1 ], 'base64' ) );
	console.log( f );
}
await browser.close(); await server.close();
