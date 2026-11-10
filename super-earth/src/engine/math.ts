// Pure, deterministic helpers. Nothing in here reads the clock.

export const clamp = ( v: number, a = 0, b = 1 ) => Math.min( b, Math.max( a, v ) );
export const lerp = ( a: number, b: number, t: number ) => a + ( b - a ) * t;
export const remap = ( t: number, a: number, b: number ) => clamp( ( t - a ) / ( b - a ) );
export const smooth = ( x: number ) => { x = clamp( x ); return x * x * ( 3 - 2 * x ); };
export const easeOutCubic = ( x: number ) => 1 - Math.pow( 1 - clamp( x ), 3 );
export const easeInOutCubic = ( x: number ) => { x = clamp( x ); return x < .5 ? 4 * x * x * x : 1 - Math.pow( - 2 * x + 2, 3 ) / 2; };
export const easeInCubic = ( x: number ) => Math.pow( clamp( x ), 3 );

/** Damped spring from 0 to 1 that overshoots (bouncy pop). x = seconds since start. */
export function spring( x: number, freq = 2.1, damp = 6.5 ) {
	if ( x <= 0 ) return 0;
	return 1 - Math.exp( - damp * x ) * Math.cos( 2 * Math.PI * freq * x );
}

/** Appear with a spring at t0, disappear (quick shrink) at t1. Returns scale 0..~1.15 */
export function popInOut( t: number, t0: number, t1 = Infinity, outDur = 0.22 ) {
	if ( t < t0 || t > t1 + outDur ) return 0;
	const s = spring( t - t0 );
	if ( t <= t1 ) return s;
	return s * ( 1 - easeInCubic( ( t - t1 ) / outDur ) );
}

/** Squash impulse: 1 at x=0 decaying, oscillating. */
export const wobble = ( x: number, freq = 2.4, damp = 5 ) => x < 0 ? 0 : Math.exp( - damp * x ) * Math.cos( 2 * Math.PI * freq * x );

export const wrap = ( v: number, min: number, max: number ) => {
	const r = max - min;
	return ( ( ( v - min ) % r ) + r ) % r + min;
};

/** Seeded PRNG (mulberry32). Same seed -> same sequence. */
export function rng( seed: number ) {
	let a = seed >>> 0;
	return () => {
		a = ( a + 0x6D2B79F5 ) >>> 0;
		let t = a;
		t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
		t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
	};
}

/** Stateless hash noise in [0,1) for integer-ish input. */
export function hash( n: number ) {
	const s = Math.sin( n * 127.1 + 311.7 ) * 43758.5453123;
	return s - Math.floor( s );
}

/** Window helper: 0 outside [a,b], fades in/out over f seconds. */
export function windowed( t: number, a: number, b: number, f = 0.25 ) {
	return clamp( ( t - a ) / f ) * clamp( ( b - t ) / f );
}
