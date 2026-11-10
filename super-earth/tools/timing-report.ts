// npm run timing  -> src/data/timing-report.md (scene windows + every beat anchor)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ANCHOR_LIST, ANCHORS, AUDIO_END, sceneTimings, WARNINGS } from '../src/timeline';

const root = path.resolve( path.dirname( new URL( import.meta.url ).pathname.replace( /^\/([A-Za-z]:)/, '$1' ) ), '..' );
let audioDur = AUDIO_END;
try {
	const file = fs.readdirSync( path.join( root, 'public' ) ).find( ( f ) => /^narration\.(mp3|wav)$/i.test( f ) );
	const ff = process.env.FFMPEG_PATH || 'ffmpeg';
	const r = ( () => { try { execFileSync( ff, [ '-hide_banner', '-i', path.join( root, 'public', file! ) ], { stdio: 'pipe' } ); return ''; } catch ( e: any ) { return String( e.stderr ); } } )();
	const m = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec( r );
	if ( m ) audioDur = + m[ 1 ] * 3600 + + m[ 2 ] * 60 + + m[ 3 ];
} catch { /* fall back to last word */ }
const duration = audioDur + 1.5;
const f = ( s: number ) => `${ Math.floor( s / 60 ) }:${ ( s % 60 ).toFixed( 2 ).padStart( 5, '0' ) }`;
const lines = [ '# Timing report', '', `Audio: ${ audioDur.toFixed( 2 ) } s, video: ${ duration.toFixed( 2 ) } s (audio + 1.5 s).`, '',
	'## Scenes', '', '| Scene | Start | End | Length | Anchor |', '|---|---|---|---|---|' ];
for ( const s of sceneTimings( duration ) ) lines.push( `| ${ s.name } | ${ f( s.t0 ) } | ${ f( s.t1 ) } | ${ ( s.t1 - s.t0 ).toFixed( 1 ) } s | ${ s.key === 'title' ? '(start of audio)' : `"${ ANCHOR_LIST.find( ( a ) => a.key === s.key )!.phrase }"` }${ s.estimated ? ' **estimated**' : '' } |` );
lines.push( '', '## All beats', '', '| Beat | Phrase | Time | Match |', '|---|---|---|---|' );
for ( const a of ANCHOR_LIST ) { const r = ANCHORS.get( a.key )!; lines.push( `| ${ a.key } | "${ a.phrase }" | ${ f( r.time ) } | ${ r.estimated ? '**estimated**' : ( r.score * 100 ).toFixed( 0 ) + '%' } |` ); }
if ( WARNINGS.length ) lines.push( '', '## Warnings', '', ...WARNINGS.map( ( w ) => '- ' + w ) );
fs.writeFileSync( path.join( root, 'src', 'data', 'timing-report.md' ), lines.join( '\n' ) + '\n' );
console.log( lines.slice( 0, 34 ).join( '\n' ) );
