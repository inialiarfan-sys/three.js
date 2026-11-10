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
	{ key: 'common', phrase: 'the most common planet in our galaxy', scene: '1 The most common planet' },
	{ key: 'dontHave', phrase: 'is one we dont have' },
	{ key: 'notMercury', phrase: 'not mercury', scene: '2 Not Mercury, not Jupiter, not Earth' },
	{ key: 'notJupiter', phrase: 'not jupiter' },
	{ key: 'notEarth', phrase: 'not earth' },
	{ key: 'between', phrase: 'something in between' },
	{ key: 'superEarth', phrase: 'scientists call it a super-earth', scene: '3 Super-Earth (the cape)' },
	{ key: 'cape', phrase: 'no it doesnt wear a cape' },
	{ key: 'findOne', phrase: 'so today were going to find one', scene: '4 Launch pad' },
	{ key: 'helmet', phrase: 'luna grab your helmet' },
	{ key: 'adventure', phrase: 'lets go on an adventure' },
	{ key: 'whatIs', phrase: 'so what exactly is a super-earth', scene: '5 What is a super-Earth?' },
	{ key: 'bigger', phrase: 'bigger than earth' },
	{ key: 'smaller', phrase: 'but smaller than neptune' },
	{ key: 'rocky', phrase: 'some are rocky' },
	{ key: 'oceans', phrase: 'some may be covered in deep oceans' },
	{ key: 'strange', phrase: 'heres the strange part', scene: '6 The strange part' },
	{ key: 'keptFinding', phrase: 'they kept finding super-earths' },
	{ key: 'again', phrase: 'again and again' },
	{ key: 'mostCommon', phrase: 'it is the most common kind of planet' },
	{ key: 'none', phrase: 'but in our solar system there are none' },
	{ key: 'small', phrase: 'we got small planets', scene: '7 The menu (sold out)' },
	{ key: 'giant', phrase: 'we got giant planets' },
	{ key: 'noMedium', phrase: 'but no medium' },
	{ key: 'fries', phrase: 'its like ordering fries' },
	{ key: 'ranOut', phrase: 'they ran out of medium' },
	{ key: 'land', phrase: 'okay luna lets land on one', scene: '8 Heavy landing' },
	{ key: 'careful', phrase: 'careful the gravity here is strong' },
	{ key: 'heavier', phrase: 'a super-earth can be much heavier' },
	{ key: 'twice', phrase: 'you could feel twice as heavy' },
	{ key: 'scale', phrase: 'so if your weighing scale', scene: '9 The scale' },
	{ key: 'scary', phrase: 'gives you a scary number' },
	{ key: 'notScale', phrase: 'dont blame the scale' },
	{ key: 'blame', phrase: 'blame the planet' },
	{ key: 'stairs', phrase: 'every staircase would be leg day', scene: '10 Leg day' },
	{ key: 'legDay', phrase: 'leg day' },
	{ key: 'visit', phrase: 'come on luna lets visit a few more', scene: '11 Route map' },
	{ key: 'cancri', phrase: 'first 55 cancri e', scene: '12 55 Cancri e (lava)' },
	{ key: 'lava', phrase: 'covered in lava' },
	{ key: 'watch', phrase: 'watch your step luna' },
	{ key: 'beach', phrase: 'not a great place for a beach holiday' },
	{ key: 'crispy', phrase: 'extra crispy' },
	{ key: 'lhs', phrase: 'next lhs 1140 b', scene: '13 LHS 1140 b (ice)' },
	{ key: 'notHot', phrase: 'not too hot not too cold' },
	{ key: 'iceWorld', phrase: 'it might be an ice world' },
	{ key: 'water', phrase: 'an ocean of liquid water under the ice' },
	{ key: 'jacket', phrase: 'bring a jacket luna' },
	{ key: 'ten', phrase: 'actually bring ten' },
	{ key: 'lastStop', phrase: 'and now our last stop', scene: '14 K2-18 b' },
	{ key: 'k218', phrase: 'k2-18 b' },
	{ key: 'oceanWorld', phrase: 'it could be a giant ocean world' },
	{ key: 'y2025', phrase: 'in 2025 a team reported' },
	{ key: 'hint', phrase: 'a possible hint of a gas' },
	{ key: 'living', phrase: 'made by living things' },
	{ key: 'closer', phrase: 'lets take a closer look' },
	{ key: 'dive', phrase: 'luna dive in slowly', scene: '15 Dive' },
	{ key: 'dark', phrase: 'its dark down here' },
	{ key: 'quiet', phrase: 'very quiet' },
	{ key: 'wait', phrase: 'wait did you see that', scene: '16 Something big' },
	{ key: 'moving', phrase: 'something is moving' },
	{ key: 'big', phrase: 'something big' },
	{ key: 'dontMove', phrase: 'luna dont move' },
	{ key: 'looking', phrase: 'its looking at us' },
	{ key: 'run', phrase: 'run luna', scene: '17 RUN!' },
	{ key: 'backShip', phrase: 'back to the spaceship' },
	{ key: 'gogo', phrase: 'go go go' },
	// "Phew" is often dropped by Whisper (it was here), so the scene keys on the words after it.
	{ key: 'phew', phrase: 'that was close', scene: '18 Phew' },
	{ key: 'honest', phrase: 'okay lets be honest', scene: '19 Only our imagination' },
	{ key: 'imagination', phrase: 'that creature was only our imagination' },
	{ key: 'evidence', phrase: 'the evidence for life there is still weak' },
	{ key: 'nobody', phrase: 'nobody has found life on these planets' },
	{ key: 'notYet', phrase: 'not yet' },
	{ key: 'stillLooking', phrase: 'but scientists are still looking' },
	{ key: 'think', phrase: 'think about it', scene: '20 The missing middle' },
	{ key: 'commonOut', phrase: 'the most common planet out there' },
	{ key: 'unusual', phrase: 'our solar system might be the unusual one' },
	{ key: 'rarer', phrase: 'earth might be rarer than we ever imagined' },
	{ key: 'thing', phrase: 'and heres the thing', scene: '21 But you can' },
	{ key: 'billions', phrase: 'billions of planets' },
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
	superearth: 'super-Earth', superearths: 'super-Earths', luna: 'Luna', cancri: 'Cancri', e: 'e',
	'1140b': '1140 b', k218b: 'K2-18 b', k218: 'K2-18', lhs: 'LHS', '10': 'ten', earth: 'Earth',
	mercury: 'Mercury', jupiter: 'Jupiter', neptune: 'Neptune',
};
function fixWord( raw: string, prev?: string ) {
	const m = raw.match( /^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/ )!;
	let core = m[ 2 ];
	const k = norm( core );
	if ( k === 'e' && prev && norm( prev ) === 'cancri' ) core = 'e';
	else if ( FIXES[ k ] ) core = FIXES[ k ];
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
