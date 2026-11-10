// The audio decides timing. Every anchor below is fuzzy-matched against the word
// timings in transcript.json, in order, so re-recording the narration only needs a
// new transcript.json — no hand-edited timestamps anywhere.
import transcript from './data/transcript.json';

export interface Word { word: string; start: number; end: number }
/** Whisper sometimes splits numbers ("6" + ",000."). Re-join them. */
function mergeSplitNumbers( words: Word[] ) {
	const out: Word[] = [];
	for ( const w of words ) {
		const prev = out[ out.length - 1 ];
		if ( prev && /^[,.]?\d/.test( w.word ) && /\d$/.test( prev.word ) && w.word.startsWith( ',' ) ) {
			out[ out.length - 1 ] = { word: prev.word + w.word, start: prev.start, end: w.end };
		} else out.push( { ...w } );
	}
	return out;
}
export const WORDS: Word[] = mergeSplitNumbers( ( transcript as { words: Word[] } ).words );

const norm = ( w: string ) => w.toLowerCase().replace( /[’']/g, '' ).replace( /,(?=\d)/g, '' ).replace( /[^a-z0-9]/g, '' );
const TOKENS = WORDS.map( ( w ) => norm( w.word ) );

function lev( a: string, b: string ) {
	const m = a.length, n = b.length;
	if ( ! m ) return n; if ( ! n ) return m;
	let prev = new Array( n + 1 ).fill( 0 ).map( ( _, i ) => i );
	for ( let i = 1; i <= m; i ++ ) {
		const cur = [ i ];
		for ( let j = 1; j <= n; j ++ ) cur[ j ] = Math.min( prev[ j ] + 1, cur[ j - 1 ] + 1, prev[ j - 1 ] + ( a[ i - 1 ] === b[ j - 1 ] ? 0 : 1 ) );
		prev = cur;
	}
	return prev[ n ];
}

export interface Anchor { key: string; phrase: string; time: number; index: number; score: number }

/** Find `phrase` at or after word index `from`. Returns best fuzzy match. */
export function findPhrase( phrase: string, from = 0 ) {
	const p = phrase.split( /\s+/ ).map( norm ).filter( Boolean );
	const target = p.join( ' ' );
	let best = { index: - 1, score: 0, len: 0 };
	for ( let i = from; i < TOKENS.length; i ++ ) {
		for ( let len = Math.max( 1, p.length - 1 ); len <= p.length + 1; len ++ ) {
			if ( i + len > TOKENS.length ) break;
			const s = TOKENS.slice( i, i + len ).join( ' ' );
			const score = 1 - lev( target, s ) / Math.max( target.length, s.length );
			if ( score > best.score + 1e-9 ) best = { index: i, score, len };
		}
		if ( best.score === 1 ) break; // first exact match after `from` wins
	}
	return best;
}

/**
 * Anchors in narrative order. Each is searched after the previous one, so a phrase
 * that repeats ("from far away") resolves to the right occurrence.
 */
const ANCHOR_LIST: [ string, string ][] = [
	[ 'glassRain', 'glass rain' ],
	[ 'winds1', 'winds faster than sound' ],
	[ 'deg1', '1000 degrees' ],
	[ 'smells1', 'smells like rotten eggs' ],
	[ 'welcome', 'welcome to the worst planet' ],
	[ 'name', 'its name is hd 189733 b' ],
	[ 'notSolar', 'not in our solar system' ],
	[ 'ourSun', 'our sun is just one of billions' ],
	[ 'manyStars', 'many of those stars have planets' ],
	[ 'exoplanets', 'scientists call them exoplanets' ],
	[ 'soFar', 'so far they have found more' ],
	[ 'n6000', '6000' ],
	[ 'fewTerrifying', 'but few are as terrifying' ],
	[ 'distance', 'this planet is about 64 light years away' ],
	[ 'n64', '64' ],
	[ 'howKnow', 'so how do we know' ],
	[ 'transit', 'when the planet passes in front of its star' ],
	[ 'studying', 'by studying that light' ],
	[ 'shocking', 'what they found was shocking' ],
	[ 'deepBlue', 'from far away the planet looks deep blue' ],
	[ 'noOceans', 'but it has no oceans' ],
	[ 'blueGlass', 'scientists think the blue color may come from tiny bits of glass' ],
	[ 'silica', 'glass is made from silica' ],
	[ 'sand', 'found in sand' ],
	[ 'giant', 'this planet is a giant bigger than jupiter' ],
	[ 'closeStar', 'sits extremely close to its star' ],
	[ 'year', 'one year there lasts only about two earth days' ],
	[ 'twoDays', 'two earth days' ],
	[ 'temp', 'the temperature can reach around' ],
	[ 'deg2', '1000 degrees celsius' ],
	[ 'melt', 'hot enough to melt many metals' ],
	[ 'oneSide', 'one side always faces its star' ],
	[ 'night', 'the other side is always night' ],
	[ 'winds2', 'that huge difference in heat creates monstrous winds' ],
	[ 'kmh', 'thousands of kilometers per hour' ],
	[ 'sound', 'faster than the speed of sound' ],
	[ 'together', 'now put it all together' ],
	[ 'glassClouds', 'glass in the clouds' ],
	[ 'sideways', 'rain made of glass flying sideways' ],
	[ 'blades', 'millions of tiny blades' ],
	[ 'eggSmell', 'and the rotten egg smell' ],
	[ 'y2024', 'in 2024' ],
	[ 'webb', 'james webb space telescope' ],
	[ 'h2s', 'hydrogen sulfide' ],
	[ 'onEarth', 'on earth thats the gas' ],
	[ 'remember', 'but remember nobody has actually seen glass rain' ],
	[ 'idea', 'it is a scientific idea' ],
	[ 'stillStudying', 'scientists are still studying it' ],
	[ 'marble', 'from far away it looks like a peaceful blue marble' ],
	[ 'upClose', 'up close it may be one of the deadliest' ],
	[ 'special', 'it makes you realize how special' ],
	[ 'softRain', 'soft rain fresh air life everywhere' ],
	[ 'outThere', 'out there among thousands of worlds' ],
	[ 'home', 'another place like home' ],
	[ 'theThing', 'and heres the thing' ],
	[ 'youCan', 'but you can' ],
	[ 'dontForget', 'dont ever forget how special that makes you' ],
	[ 'amazing', 'space is truly amazing' ],
	[ 'beginning', 'and this is only the beginning' ],
];

function resolveAnchors() {
	const out = new Map<string, Anchor>();
	let from = 0;
	const misses: string[] = [];
	for ( const [ key, phrase ] of ANCHOR_LIST ) {
		const m = findPhrase( phrase, from );
		if ( m.index < 0 || m.score < 0.6 ) { misses.push( key ); continue; }
		out.set( key, { key, phrase, index: m.index, score: m.score, time: WORDS[ m.index ].start } );
		from = m.index + 1;
	}
	// Interpolate any anchor the recording skipped, so scenes still play in order.
	for ( const key of misses ) {
		const i = ANCHOR_LIST.findIndex( ( a ) => a[ 0 ] === key );
		let prev = 0, next = WORDS[ WORDS.length - 1 ].end;
		for ( let k = i - 1; k >= 0; k -- ) { const a = out.get( ANCHOR_LIST[ k ][ 0 ] ); if ( a ) { prev = a.time; break; } }
		for ( let k = i + 1; k < ANCHOR_LIST.length; k ++ ) { const a = out.get( ANCHOR_LIST[ k ][ 0 ] ); if ( a ) { next = a.time; break; } }
		out.set( key, { key, phrase: ANCHOR_LIST[ i ][ 1 ], index: - 1, score: 0, time: ( prev + next ) / 2 } );
		console.warn( `[timeline] anchor "${ key }" not found in transcript; estimated at ${ ( ( prev + next ) / 2 ).toFixed( 2 ) }s` );
	}
	return out;
}

export const ANCHORS = resolveAnchors();
export const at = ( key: string ) => {
	const a = ANCHORS.get( key );
	if ( ! a ) throw new Error( 'Unknown anchor ' + key );
	return a.time;
};
/** End time of the anchor phrase (last word end). */
export const atEnd = ( key: string ) => {
	const a = ANCHORS.get( key )!;
	if ( a.index < 0 ) return a.time + 0.5;
	const n = a.phrase.split( /\s+/ ).length;
	return WORDS[ Math.min( WORDS.length - 1, a.index + n - 1 ) ].end;
};

export const SPEECH_END = WORDS[ WORDS.length - 1 ].end;

// ---------------- captions ----------------

/** Spelling fixes from the script, applied per displayed word (key = normalized token). */
const FIXES: Record<string, string> = {
	hd: 'HD', '189733b': '189733 b', hd189733: 'HD 189733', web: 'Webb', webb: 'Webb', james: 'James',
	sulphide: 'sulfide', sulfite: 'sulfide', sulfate: 'sulfide', '1000': '1,000', '6000': '6,000',
	'2024': '2024', exoplanet: 'exoplanet', exoplanets: 'exoplanets', jupiter: 'Jupiter', celsius: 'Celsius',
	earth: 'Earth',
};

function fixWord( raw: string ) {
	const m = raw.match( /^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/ )!;
	const core = m[ 2 ];
	const fixed = FIXES[ norm( core ) ];
	return m[ 1 ] + ( fixed ?? core ) + m[ 3 ];
}

export interface Caption { start: number; end: number; words: Word[] }

export function buildCaptions( maxWords: number ): Caption[] {
	const out: Caption[] = [];
	let cur: Word[] = [];
	const flush = () => { if ( cur.length ) out.push( { start: cur[ 0 ].start, end: cur[ cur.length - 1 ].end, words: cur } ); cur = []; };
	for ( let i = 0; i < WORDS.length; i ++ ) {
		const w = { ...WORDS[ i ], word: fixWord( WORDS[ i ].word ) };
		const prev = cur[ cur.length - 1 ];
		if ( prev && ( w.start - prev.end > 0.6 || cur.length >= maxWords ) ) flush();
		cur.push( w );
		const endsSentence = /[.?!]$/.test( w.word );
		const endsClause = /[,;:]$/.test( w.word ) && cur.length >= Math.ceil( maxWords * 0.6 );
		if ( endsSentence || endsClause ) flush();
	}
	flush();
	// Keep each caption up until the next one starts (short gaps), so lines don't flicker.
	for ( let i = 0; i < out.length; i ++ ) {
		const next = out[ i + 1 ];
		out[ i ].end = next && next.start - out[ i ].end < 1.0 ? next.start : out[ i ].end + 0.45;
	}
	return out;
}
