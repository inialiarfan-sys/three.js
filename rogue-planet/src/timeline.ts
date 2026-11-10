// The audio decides timing. Scenes and beats are anchor phrases fuzzy-matched (in
// order) against the word timings in transcript.json. Re-record -> re-transcribe ->
// everything re-times itself. Missing anchors are placed proportionally between
// their neighbours with a warning.
import transcript from './data/transcript.json';

export interface Word { word: string; start: number; end: number }

const norm = ( w: string ) => w.toLowerCase().replace( /[’'‘]/g, '' ).replace( /,(?=\d)/g, '' ).replace( /[^a-z0-9]/g, '' );

/** Whisper sometimes splits numbers ("6" + ",000"). Re-join them. */
function mergeSplitNumbers( words: Word[] ) {
	const out: Word[] = [];
	for ( const w of words ) {
		const prev = out[ out.length - 1 ];
		const joinNum = prev && /^,\d/.test( w.word ) && /\d$/.test( prev.word );
		const joinDash = prev && /^-\d/.test( w.word ) && /[A-Za-z0-9]$/.test( prev.word ); // "K2" + "-18B."
		if ( joinNum || joinDash ) out[ out.length - 1 ] = { word: prev.word + w.word, start: prev.start, end: w.end };
		else out.push( { ...w } );
	}
	return out;
}
export const WORDS: Word[] = mergeSplitNumbers( ( transcript as { words: Word[] } ).words );
const TOKENS = WORDS.map( ( w ) => norm( w.word ) );

function lev( a: string, b: string ) {
	const m = a.length, n = b.length;
	if ( ! m ) return n; if ( ! n ) return m;
	let prev = Array.from( { length: n + 1 }, ( _, i ) => i );
	for ( let i = 1; i <= m; i ++ ) {
		const cur = [ i ];
		for ( let j = 1; j <= n; j ++ ) cur[ j ] = Math.min( prev[ j ] + 1, cur[ j - 1 ] + 1, prev[ j - 1 ] + ( a[ i - 1 ] === b[ j - 1 ] ? 0 : 1 ) );
		prev = cur;
	}
	return prev[ n ];
}

/** Best fuzzy match of `phrase` at/after word index `from`, looking at most `window` words ahead. */
export function findPhrase( phrase: string, from = 0, window = 400 ) {
	const p = phrase.split( /\s+/ ).map( norm ).filter( Boolean );
	const target = p.join( ' ' );
	let best = { index: - 1, score: 0, len: 0 };
	for ( let i = from; i < Math.min( TOKENS.length, from + window ); i ++ ) {
		for ( let len = Math.max( 1, p.length - 1 ); len <= p.length + 1 && i + len <= TOKENS.length; len ++ ) {
			const s = TOKENS.slice( i, i + len ).join( ' ' );
			const score = 1 - lev( target, s ) / Math.max( target.length, s.length );
			if ( score > best.score + 1e-9 ) best = { index: i, score, len };
		}
		if ( best.score >= 0.999 ) break;
	}
	return best;
}

/**
 * Anchors in narrative order. `scene: true` marks a scene start; the rest are beats
 * (gags, poses, facts) used inside scenes.
 */
export const ANCHOR_LIST: { key: string; phrase: string; scene?: string }[] = [
	{ key: 'imagine', phrase: 'imagine a planet with no sun', scene: '1 A planet with no sun' },
	{ key: 'noSunrise', phrase: 'no sunrise' },
	{ key: 'noSunset', phrase: 'no sunset' },
	{ key: 'noDay', phrase: 'no daytime' },
	{ key: 'ever', phrase: 'ever' },
	{ key: 'darkness', phrase: 'just endless darkness', scene: '2 Endless darkness' },
	{ key: 'alone', phrase: 'all alone' },
	{ key: 'billions', phrase: 'and scientists think there could be billions', scene: '3 Billions?' },
	{ key: 'billionsWord', phrase: 'billions of them' },
	{ key: 'flashlight', phrase: 'luna grab your flashlight', scene: '4 Grab your flashlight' },
	{ key: 'dark', phrase: 'this ones going to be dark' },
	{ key: 'most', phrase: 'most planets travel around a star', scene: '5 Rogue planets' },
	{ key: 'some', phrase: 'but some dont have a star at all' },
	{ key: 'rogue', phrase: 'scientists call them rogue planets' },
	{ key: 'wander', phrase: 'they wander through the galaxy', scene: '6 Wandering' },
	{ key: 'ball', phrase: 'like a lost ball rolling forever' },
	{ key: 'lose', phrase: 'so how does a planet lose its sun', scene: '7 Kicked out' },
	{ key: 'born', phrase: 'many may have been born around a star' },
	{ key: 'giant', phrase: 'then a giant planet came too close' },
	{ key: 'pushed', phrase: 'its gravity pushed the smaller planet' },
	{ key: 'chat', phrase: 'like getting kicked out of the group chat', scene: '8 The group chat' },
	{ key: 'forever', phrase: 'forever' },
	{ key: 'find', phrase: 'okay luna lets find one', scene: '9 Searching' },
	{ key: 'doesntShine', phrase: 'how do you find a planet that doesnt shine' },
	{ key: 'passes', phrase: 'sometimes a rogue planet passes in front', scene: '10 Bending light' },
	{ key: 'bends', phrase: 'its gravity bends the light' },
	{ key: 'brighter', phrase: 'the star looks brighter' },
	{ key: 'flash', phrase: 'that tiny flash' },
	{ key: 'something', phrase: 'something is there' },
	{ key: 'found', phrase: 'found one lets land', scene: '11 Landing' },
	{ key: 'careful', phrase: 'careful luna its freezing', scene: '12 Freezing' },
	{ key: 'antarctica', phrase: 'much colder than antarctica' },
	{ key: 'sunscreen', phrase: 'luna why did you bring sunscreen', scene: '13 Sunscreen' },
	{ key: 'noSun', phrase: 'theres no sun' },
	{ key: 'surprise', phrase: 'but heres the surprise', scene: '14 The hidden ocean' },
	{ key: 'warm', phrase: 'could still be warm deep inside' },
	{ key: 'core', phrase: 'heat from its core' },
	{ key: 'ice', phrase: 'trapped under thick ice' },
	{ key: 'ocean', phrase: 'a hidden ocean of liquid water' },
	{ key: 'shine', phrase: 'luna shine your light down here', scene: '15 Shine your light' },
	{ key: 'hear', phrase: 'do you hear that', scene: '16 Crack' },
	{ key: 'crack', phrase: 'crack' },
	{ key: 'breaking', phrase: 'the ice is breaking' },
	{ key: 'run', phrase: 'run luna', scene: '17 RUN!' },
	{ key: 'backShip', phrase: 'back to the ship' },
	{ key: 'phew', phrase: 'phew that was close', scene: '18 Phew' },
	{ key: 'honest', phrase: 'okay lets be honest', scene: '19 Being honest' },
	{ key: 'nobody', phrase: 'nobody has visited a rogue planet' },
	{ key: 'oceansQ', phrase: 'nobody knows if any have hidden oceans' },
	{ key: 'models', phrase: 'telescope data and computer models' },
	{ key: 'newTel', phrase: 'and new telescopes are getting ready' },
	{ key: 'think', phrase: 'think about it', scene: '20 Never a sunrise' },
	{ key: 'drifts', phrase: 'a planet drifts through the dark' },
	{ key: 'neverSunrise', phrase: 'never seeing a sunrise' },
	{ key: 'hereWe', phrase: 'and here we are' },
	{ key: 'everyDay', phrase: 'a brand new sunrise every day' },
	{ key: 'thing', phrase: 'and heres the thing', scene: '21 But you can' },
	{ key: 'billions2', phrase: 'billions of planets' },
	{ key: 'youCan', phrase: 'but you can' },
	{ key: 'forget', phrase: 'dont ever forget how special that makes you' },
	{ key: 'amazing', phrase: 'space is truly amazing', scene: '22 Only the beginning' },
	{ key: 'beginning', phrase: 'and this is only the beginning' },
];

export interface Anchor { key: string; phrase: string; time: number; end: number; index: number; score: number; estimated: boolean }
export const WARNINGS: string[] = [];

function resolve() {
	const out: ( Anchor | null )[] = [];
	let from = 0;
	for ( const a of ANCHOR_LIST ) {
		const m = findPhrase( a.phrase, from );
		const n = a.phrase.split( /\s+/ ).length;
		if ( m.index < 0 || m.score < 0.62 ) { out.push( null ); continue; }
		out.push( { key: a.key, phrase: a.phrase, index: m.index, score: m.score, time: WORDS[ m.index ].start, end: WORDS[ Math.min( WORDS.length - 1, m.index + Math.max( m.len, 1 ) - 1 ) ].end, estimated: false } );
		void n;
		from = m.index + 1;
	}
	// proportional placement of missing anchors between found neighbours
	const audioEnd = WORDS[ WORDS.length - 1 ].end;
	for ( let i = 0; i < out.length; i ++ ) {
		if ( out[ i ] ) continue;
		let a = i - 1; while ( a >= 0 && ! out[ a ] ) a --;
		let b = i + 1; while ( b < out.length && ! out[ b ] ) b ++;
		const ta = a >= 0 ? out[ a ]!.time : 0, tb = b < out.length ? out[ b ]!.time : audioEnd;
		const ia = a, ib = b;
		const time = ta + ( tb - ta ) * ( i - ia ) / ( ib - ia );
		out[ i ] = { key: ANCHOR_LIST[ i ].key, phrase: ANCHOR_LIST[ i ].phrase, index: - 1, score: 0, time, end: time + 0.6, estimated: true };
		const msg = `[timeline] anchor "${ ANCHOR_LIST[ i ].phrase }" not found in transcript; placed at ${ time.toFixed( 2 ) }s`;
		WARNINGS.push( msg ); console.warn( msg );
	}
	return new Map( ( out as Anchor[] ).map( ( a ) => [ a.key, a ] ) );
}

export const ANCHORS = resolve();
export const at = ( key: string ) => { const a = ANCHORS.get( key ); if ( ! a ) throw new Error( 'Unknown anchor ' + key ); return a.time; };
export const atEnd = ( key: string ) => ANCHORS.get( key )!.end;

/** Find a single word (e.g. "go") after an anchor; returns its start time. Handy for per-word gags. */
export function wordAfter( key: string, word: string, nth = 0 ) {
	const a = ANCHORS.get( key )!;
	let k = 0;
	for ( let i = Math.max( 0, a.index ); i < WORDS.length; i ++ ) if ( norm( WORDS[ i ].word ) === norm( word ) && k ++ === nth ) return WORDS[ i ].start;
	return a.time;
}

export const AUDIO_END = WORDS[ WORDS.length - 1 ].end;

export interface SceneTiming { name: string; key: string; t0: number; t1: number; estimated: boolean }
/** Scene windows; the first scene is the title card from 0 until the first anchor. */
export function sceneTimings( duration: number ): SceneTiming[] {
	const s = ANCHOR_LIST.filter( ( a ) => a.scene ).map( ( a ) => ( { name: a.scene!, key: a.key, t0: at( a.key ), estimated: ANCHORS.get( a.key )!.estimated } ) );
	const all = [ { name: '0 Title', key: 'title', t0: 0, estimated: false }, ...s ];
	return all.map( ( x, i ) => ( { ...x, t1: i + 1 < all.length ? all[ i + 1 ].t0 : duration } ) );
}

// ---------------- captions ----------------

/** Spelling fixes from the script (key = normalized token). */
const FIXES: Record<string, string> = {
	luna: 'Luna', antarctica: 'Antarctica', earth: 'Earth', rogue: 'rogue',
};
function fixWord( raw: string, prev?: string ) {
	const m = raw.match( /^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/ )!;
	let core = m[ 2 ];
	const k = norm( core );
	if ( FIXES[ k ] ) core = FIXES[ k ];
	void prev;
	return m[ 1 ] + core + m[ 3 ];
}

export interface Caption { start: number; end: number; words: Word[] }
export function buildCaptions( maxWords: number ): Caption[] {
	const out: Caption[] = [];
	let cur: Word[] = [];
	const flush = () => { if ( cur.length ) out.push( { start: cur[ 0 ].start, end: cur[ cur.length - 1 ].end, words: cur } ); cur = []; };
	for ( let i = 0; i < WORDS.length; i ++ ) {
		const w = { ...WORDS[ i ], word: fixWord( WORDS[ i ].word, WORDS[ i - 1 ]?.word ) };
		const prev = cur[ cur.length - 1 ];
		if ( prev && ( w.start - prev.end > 0.6 || cur.length >= maxWords ) ) flush();
		cur.push( w );
		if ( /[.?!]$/.test( w.word ) || ( /[,;:]$/.test( w.word ) && cur.length >= Math.ceil( maxWords * 0.6 ) ) ) flush();
	}
	flush();
	for ( let i = 0; i < out.length; i ++ ) {
		const next = out[ i + 1 ];
		out[ i ].end = next && next.start - out[ i ].end < 1.0 ? next.start : out[ i ].end + 0.45;
	}
	return out;
}
