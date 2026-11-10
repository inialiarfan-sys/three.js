// Luna's sticker/paper-puppet motion. No walk cycle: hops, squash & stretch, wobble.
// Everything is a pure function of t.
import { clamp, easeInOutCubic, wobble } from './engine/math';

export interface Motion {
	/** 0..1 progress along the move (use it to place her between two points) */
	p: number;
	/** height above ground, in units of Luna's height */
	lift: number;
	sx: number; sy: number;
	/** in-plane rotation (radians), positive = lean toward facing direction */
	rot: number;
	/** seconds since the last landing (Infinity if none) */
	sinceLand: number;
	airborne: boolean;
}

export interface HopOpts {
	hopDur?: number;   // seconds per hop (0.3..0.4 normal)
	height?: number;   // hop height (fraction of her height)
	wobble?: number;   // side-to-side wobble amplitude in degrees
	squash?: number;   // landing squash multiplier (heavy gravity -> 2)
	lean?: number;     // forward tilt at the top of a hop (radians)
}

const DEG = Math.PI / 180;

/** Standing still: soft breathing and a slight sway, never frozen. calm=0..1 reduces sway. */
export function idle( t: number, sway = 1 ): Motion {
	const b = Math.sin( t * Math.PI * 2 / 2.4 );
	return { p: 0, lift: 0, sx: 1 - 0.012 * b, sy: 1 + 0.016 * b, rot: Math.sin( t * Math.PI * 2 / 3.3 ) * 0.022 * sway, sinceLand: Infinity, airborne: false };
}

/**
 * Hop from progress 0 to 1 between t0 and t1 (whole number of hops), then settle.
 * Before t0 she idles; after t1 the last landing squash rings out into idle.
 */
export function hops( t: number, t0: number, t1: number, o: HopOpts = {} ): Motion {
	const hopDur = o.hopDur ?? 0.36, height = o.height ?? 0.16, wob = ( o.wobble ?? 6 ) * DEG, sq = o.squash ?? 1, lean = o.lean ?? 0.12;
	const base = idle( t, 0.6 );
	if ( t < t0 ) return base;
	const n = Math.max( 1, Math.round( ( t1 - t0 ) / hopDur ) );
	const hd = ( t1 - t0 ) / n;
	if ( t >= t1 ) {
		const L = t - t1;
		const s = wobble( L, 2.6, 7 );
		return { ...base, p: 1, sx: base.sx * ( 1 + 0.2 * sq * s ), sy: base.sy * ( 1 - 0.24 * sq * s ), rot: base.rot + Math.sin( L * 14 ) * Math.exp( - L * 6 ) * wob * 0.6, sinceLand: L };
	}
	const k = Math.floor( ( t - t0 ) / hd );
	const u = ( t - t0 ) / hd - k;
	const p = ( k + easeInOutCubic( u ) ) / n;
	const lift = height * Math.sin( Math.PI * u );
	const since = k > 0 ? u * hd : Infinity;
	const land = k > 0 ? wobble( u * hd, 3, 11 ) : 0;               // squash right after touching down
	const stretch = Math.pow( Math.cos( Math.PI * u ), 2 ) * ( u < 0.5 ? 0.14 : 0.06 ) * clamp( u * 8 ); // tall on take-off
	return {
		p, lift, sinceLand: since, airborne: u > 0.12,
		sx: ( 1 - stretch * 0.6 ) * ( 1 + 0.2 * sq * land ),
		sy: ( 1 + stretch ) * ( 1 - 0.24 * sq * land ),
		rot: Math.sin( 2 * Math.PI * u ) * wob + Math.sin( Math.PI * u ) * lean,
	};
}

/** A single big leap (into the ship etc.): p 0..1, arc of `height`. */
export function leap( t: number, t0: number, dur: number, height = 1.2, spin = 0 ): Motion {
	const u = clamp( ( t - t0 ) / dur );
	const m = hops( t, t0, t0 + dur, { hopDur: dur, height, wobble: 4, lean: 0.3 } );
	return { ...m, p: u < 1 ? easeInOutCubic( u ) : 1, rot: m.rot + spin * u };
}

/** Floating (underwater / zero-g): slow drift bob, almost no wobble. */
export function float( t: number, amount = 1 ): Motion {
	const b = Math.sin( t * 1.3 );
	return { p: 0, lift: 0.04 * b * amount, sx: 1, sy: 1 + 0.01 * Math.sin( t * 2.6 ), rot: Math.sin( t * 0.8 ) * 0.04 * amount, sinceLand: Infinity, airborne: true };
}

/** High-frequency fear tremble added on top of another motion. */
export function tremble( m: Motion, t: number, amt: number ): Motion {
	return { ...m, rot: m.rot + Math.sin( t * 61 ) * 0.025 * amt, sx: m.sx * ( 1 + Math.sin( t * 47 ) * 0.01 * amt ) };
}
