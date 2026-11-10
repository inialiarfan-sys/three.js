#!/usr/bin/env node
// npm run still -- <seconds> <vertical|wide>   (several seconds allowed: npm run still -- 14.2 141 wide)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SIZES, audioDuration, findFfmpeg, findNarration, openPage } from './common.mjs';

const args = process.argv.slice( 2 );
const mode = args.find( ( a ) => SIZES[ a ] ) || 'vertical';
const times = args.filter( ( a ) => /^[\d.]+$/.test( a ) ).map( Number );
if ( ! times.length ) { console.error( 'Usage: npm run still -- <seconds> [more seconds] <vertical|wide>' ); process.exit( 1 ); }
const OUT = path.join( ROOT, 'out', 'stills' );
fs.mkdirSync( OUT, { recursive: true } );
const duration = audioDuration( await findFfmpeg(), findNarration() ) + 1.5;
const { page, close } = await openPage( mode, duration, 5298 );
try {
	for ( const t of times ) {
		const url = await page.evaluate( ( tt ) => { window.__app.render( tt ); return document.getElementById( 'view' ).toDataURL( 'image/png' ); }, t );
		const f = path.join( OUT, `${ mode }_${ t.toFixed( 2 ).padStart( 7, '0' ) }.png` );
		fs.writeFileSync( f, Buffer.from( url.split( ',' )[ 1 ], 'base64' ) );
		console.log( path.relative( ROOT, f ) );
	}
} finally { await close(); }
