// 2D overlay pieces for the rogue-planet episode (drawn into the HUD canvas, pure in t).
import { clamp, easeOutCubic, hash, popInOut, spring } from './engine/math';
import { PALETTE } from './engine/toon';
import type { Hud } from './engine/hud';

const tau = Math.PI * 2;

/** Sunrise / sunset / sun icons. */
export function sunIcon( h: Hud, kind: 'sunrise' | 'sunset' | 'sun', x: number, y: number, r: number, s: number, t: number ) {
	if ( s <= 0 ) return;
	const g = h.g; g.save(); g.translate( x, y ); g.scale( s, s );
	const rays = ( n: number, r0: number, r1: number, a0: number, a1: number ) => {
		g.lineCap = 'round';
		for ( let i = 0; i < n; i ++ ) {
			const a = a0 + ( a1 - a0 ) * ( i / ( n - 1 ) ) + Math.sin( t * 2 ) * 0.03;
			for ( const [ col, lw ] of [ [ PALETTE.ink, r * 0.2 ], [ '#ffd36e', r * 0.11 ] ] as const ) {
				g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo( Math.cos( a ) * r0, Math.sin( a ) * r0 ); g.lineTo( Math.cos( a ) * r1, Math.sin( a ) * r1 ); g.stroke();
			}
		}
	};
	const disc = ( cy: number, half: boolean, col: string ) => {
		g.beginPath(); half ? g.arc( 0, cy, r, Math.PI, 0 ) : g.arc( 0, cy, r, 0, tau ); g.closePath();
		g.fillStyle = col; g.fill(); g.lineWidth = r * 0.14; g.strokeStyle = PALETTE.ink; g.stroke();
	};
	if ( kind === 'sun' ) { rays( 12, r * 1.25, r * 1.6, 0, tau - tau / 12 ); disc( 0, false, '#ffd36e' ); }
	else {
		rays( 7, r * 1.25, r * 1.6, Math.PI + 0.3, tau - 0.3 );
		disc( r * 0.25, true, kind === 'sunrise' ? '#ffd36e' : '#ffa36e' );
		g.lineCap = 'round'; g.strokeStyle = PALETTE.ink; g.lineWidth = r * 0.16;
		g.beginPath(); g.moveTo( - r * 1.7, r * 0.28 ); g.lineTo( r * 1.7, r * 0.28 ); g.stroke();
		// arrow up (sunrise) / down (sunset)
		const d = kind === 'sunrise' ? - 1 : 1;
		g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo( 0, r * 0.95 + d * r * 0.3 ); g.lineTo( - r * 0.3, r * 0.95 - d * r * 0.05 ); g.lineTo( r * 0.3, r * 0.95 - d * r * 0.05 ); g.closePath(); g.fill(); g.lineWidth = r * 0.08; g.stroke();
	}
	g.restore();
}

/** Cartoon phone with a group-chat "removed" notice. */
export function phone( h: Hud, x: number, y: number, w: number, s: number, t: number, t0: number, tRemoved: number ) {
	if ( s <= 0 ) return;
	const g = h.g, hh = w * 1.85;
	g.save(); g.translate( x, y ); g.scale( s, s ); g.rotate( - 0.05 + Math.sin( t * 2 ) * 0.01 );
	h.roundRect( - w / 2 + 10, - hh / 2 + 14, w, hh, w * 0.16 ); g.fillStyle = 'rgba(5,8,25,0.6)'; g.fill();
	h.roundRect( - w / 2, - hh / 2, w, hh, w * 0.16 ); g.fillStyle = PALETTE.ink; g.fill();
	h.roundRect( - w / 2 + w * 0.06, - hh / 2 + w * 0.12, w * 0.88, hh - w * 0.24, w * 0.1 ); g.fillStyle = '#f4f2ff'; g.fill();
	// header
	g.fillStyle = '#8fa8ff'; h.roundRect( - w * 0.44, - hh / 2 + w * 0.12, w * 0.88, w * 0.28, w * 0.1 ); g.fill();
	g.font = `700 ${ w * 0.09 }px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff';
	g.fillText( '🪐 Star System Squad', 0, - hh / 2 + w * 0.26 );
	const bubble = ( bx: number, by: number, bw: number, text: string, col: string, tc = PALETTE.ink, at = 0 ) => {
		const ps = spring( t - at, 2.4, 7 ); if ( ps <= 0 ) return;
		g.save(); g.translate( bx, by ); g.scale( ps, ps );
		h.roundRect( - bw / 2, - w * 0.08, bw, w * 0.16, w * 0.08 ); g.fillStyle = col; g.fill();
		g.font = `600 ${ w * 0.07 }px Fredoka, sans-serif`; g.fillStyle = tc; g.fillText( text, 0, 0 ); g.restore();
	};
	bubble( - w * 0.12, - hh * 0.22, w * 0.6, 'Big Planet: hiii 👋', '#ffe07a', PALETTE.ink, t0 );
	bubble( w * 0.1, - hh * 0.08, w * 0.64, 'Small Planet: hey!! 🙂', '#a8f0c8', PALETTE.ink, t0 + 0.25 );
	// system notice
	const ns = spring( t - tRemoved, 2.2, 6 );
	if ( ns > 0 ) {
		g.save(); g.translate( 0, hh * 0.14 ); g.scale( ns, ns );
		h.roundRect( - w * 0.42, - w * 0.13, w * 0.84, w * 0.26, w * 0.07 ); g.fillStyle = '#ffd6de'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#ff6b81'; g.stroke();
		g.font = `700 ${ w * 0.066 }px Fredoka, sans-serif`; g.fillStyle = '#c2284a';
		g.fillText( 'Big Planet removed', 0, - w * 0.045 ); g.fillText( 'Small Planet 🙁', 0, w * 0.05 );
		g.restore();
	}
	g.restore();
}

/** Brightness graph card with a microlensing spike that draws itself as `p` goes 0..1. */
export function lightCurve( h: Hud, x: number, y: number, w: number, s: number, p: number, spikeAt = 0.62 ) {
	if ( s <= 0 ) return;
	const g = h.g, hh = w * 0.6;
	g.save(); g.translate( x, y ); g.scale( s, s );
	h.roundRect( - w / 2 + 8, - hh / 2 + 10, w, hh, 28 ); g.fillStyle = PALETTE.cobalt; g.fill();
	h.roundRect( - w / 2, - hh / 2, w, hh, 28 ); g.fillStyle = '#fbf7ff'; g.fill(); g.lineWidth = 8; g.strokeStyle = PALETTE.ink; g.stroke();
	g.font = `700 ${ w * 0.075 }px Fredoka, sans-serif`; g.textAlign = 'center'; g.fillStyle = PALETTE.ink; g.fillText( 'star brightness', 0, - hh * 0.34 );
	const x0 = - w * 0.4, x1 = w * 0.4, yb = hh * 0.28, top = - hh * 0.2;
	g.lineWidth = 4; g.strokeStyle = '#b6c0e0'; g.beginPath(); g.moveTo( x0, yb ); g.lineTo( x1, yb ); g.stroke();
	g.lineWidth = 7; g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = '#ff8a5c'; g.beginPath();
	const n = 80;
	for ( let i = 0; i <= n * clamp( p ); i ++ ) {
		const u = i / n;
		const bump = Math.exp( - Math.pow( ( u - spikeAt ) / 0.045, 2 ) );
		const v = yb - 6 - bump * ( yb - top ) + Math.sin( u * 60 ) * 1.5;
		const xx = x0 + ( x1 - x0 ) * u;
		i === 0 ? g.moveTo( xx, v ) : g.lineTo( xx, v );
	}
	g.stroke();
	g.restore();
}

/** Cartoon thermometer dropping to the bottom, cracking at `crackAt`. level 1..0 */
export function thermometer( h: Hud, x: number, y: number, hgt: number, s: number, level: number, t: number, crackAt: number ) {
	if ( s <= 0 ) return;
	const g = h.g, w = hgt * 0.22;
	g.save(); g.translate( x, y ); g.scale( s, s ); g.rotate( 0.08 + ( t > crackAt ? Math.sin( ( t - crackAt ) * 40 ) * 0.04 * Math.exp( - ( t - crackAt ) * 4 ) : 0 ) );
	h.roundRect( - w / 2, - hgt / 2, w, hgt, w / 2 ); g.fillStyle = '#eef6ff'; g.fill(); g.lineWidth = w * 0.18; g.strokeStyle = PALETTE.ink; g.stroke();
	g.beginPath(); g.arc( 0, hgt / 2, w * 0.85, 0, tau ); g.fillStyle = '#8fd6ff'; g.fill(); g.stroke();
	const fh = ( hgt * 0.85 ) * clamp( level );
	h.roundRect( - w * 0.22, hgt / 2 - fh, w * 0.44, fh, w * 0.2 ); g.fillStyle = '#8fd6ff'; g.fill();
	for ( let i = 0; i < 5; i ++ ) { g.fillStyle = PALETTE.ink; g.fillRect( w * 0.2, - hgt / 2 + hgt * 0.15 + i * hgt * 0.15, w * 0.25, 4 ); }
	if ( t > crackAt ) {
		const k = clamp( ( t - crackAt ) / 0.15 );
		g.strokeStyle = '#ffffff'; g.lineWidth = w * 0.12; g.lineCap = 'round'; g.beginPath();
		const pts = [ [ - w * 0.5, - hgt * 0.1 ], [ - w * 0.1, - hgt * 0.02 ], [ - w * 0.3, hgt * 0.08 ], [ w * 0.2, hgt * 0.16 ], [ w * 0.05, hgt * 0.26 ] ];
		pts.slice( 0, 1 + Math.round( k * 4 ) ).forEach( ( [ px, py ], i ) => i ? g.lineTo( px, py ) : g.moveTo( px, py ) );
		g.stroke(); g.strokeStyle = PALETTE.ink; g.lineWidth = w * 0.05; g.stroke();
	}
	g.restore();
}

/** Sunscreen bottle (held up, or hidden). */
export function sunscreen( h: Hud, x: number, y: number, hgt: number, s: number, rot = 0 ) {
	if ( s <= 0 ) return;
	const g = h.g, w = hgt * 0.5;
	g.save(); g.translate( x, y ); g.rotate( rot ); g.scale( s, s );
	h.roundRect( - w * 0.25, - hgt * 0.62, w * 0.5, hgt * 0.16, 8 ); g.fillStyle = '#ff8fab'; g.fill(); g.lineWidth = 7; g.strokeStyle = PALETTE.ink; g.stroke();
	h.roundRect( - w / 2, - hgt * 0.48, w, hgt * 0.96, w * 0.28 ); g.fillStyle = '#fff3dc'; g.fill(); g.stroke();
	h.roundRect( - w * 0.4, - hgt * 0.2, w * 0.8, hgt * 0.42, 12 ); g.fillStyle = '#ffd36e'; g.fill();
	g.fillStyle = '#ff9a5c'; g.beginPath(); g.arc( 0, - hgt * 0.06, w * 0.14, 0, tau ); g.fill();
	g.font = `700 ${ hgt * 0.11 }px Fredoka, sans-serif`; g.textAlign = 'center'; g.fillStyle = PALETTE.ink; g.fillText( 'SPF 50', 0, hgt * 0.14 );
	g.restore();
}

/** A jagged crack line from a→b that grows with p (seeded wiggles), optional branches. */
export function crack( h: Hud, ax: number, ay: number, bx: number, by: number, p: number, width: number, seed: number, branches = 0 ) {
	if ( p <= 0 ) return;
	const g = h.g, n = 14;
	const pts: [ number, number ][] = [];
	for ( let i = 0; i <= n; i ++ ) {
		const u = i / n;
		const off = i === 0 || i === n ? 0 : ( hash( seed * 13 + i ) - .5 ) * width * 7;
		const nx = - ( by - ay ), ny = bx - ax, L = Math.hypot( nx, ny ) || 1;
		pts.push( [ ax + ( bx - ax ) * u + nx / L * off, ay + ( by - ay ) * u + ny / L * off ] );
	}
	const m = Math.max( 1, Math.ceil( n * clamp( p ) ) );
	g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
	for ( const [ col, lw ] of [ [ 'rgba(160,220,255,0.5)', width * 3 ], [ '#ffffff', width ] ] as const ) {
		g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
		pts.slice( 0, m + 1 ).forEach( ( [ x, y ], i ) => i ? g.lineTo( x, y ) : g.moveTo( x, y ) ); g.stroke();
	}
	g.restore();
	for ( let k = 0; k < branches; k ++ ) {
		const i = 3 + Math.floor( hash( seed + k * 7 ) * ( n - 6 ) );
		if ( i > m ) continue;
		const [ px, py ] = pts[ i ];
		const ang = Math.atan2( by - ay, bx - ax ) + ( hash( seed + k ) > .5 ? 1 : - 1 ) * ( 0.6 + hash( seed + k * 3 ) * 0.6 );
		const len = Math.hypot( bx - ax, by - ay ) * ( 0.2 + hash( seed + k * 5 ) * 0.25 );
		crack( h, px, py, px + Math.cos( ang ) * len, py + Math.sin( ang ) * len, clamp( ( p * n - i ) / 4 ), width * 0.6, seed * 3 + k + 1, 0 );
	}
}

/** Glowing curved arrow (gravity tug). */
export function glowArrow( h: Hud, ax: number, ay: number, bx: number, by: number, bend: number, s: number, col = '#ffe07a' ) {
	if ( s <= 0 ) return;
	const g = h.g;
	const mx = ( ax + bx ) / 2 - ( by - ay ) * bend, my = ( ay + by ) / 2 + ( bx - ax ) * bend;
	const ex = ax + ( bx - ax ) * s, ey = ay + ( by - ay ) * s;
	const cx = ax + ( mx - ax ) * s, cy = ay + ( my - ay ) * s;
	g.save(); g.lineCap = 'round';
	for ( const [ c, lw, a ] of [ [ col, 22, 0.25 ], [ col, 10, 0.9 ], [ '#ffffff', 4, 1 ] ] as const ) {
		g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo( ax, ay ); g.quadraticCurveTo( cx, cy, ex, ey ); g.stroke();
	}
	const ang = Math.atan2( ey - cy, ex - cx );
	g.globalAlpha = 1; g.fillStyle = col; g.beginPath();
	g.moveTo( ex + Math.cos( ang ) * 26, ey + Math.sin( ang ) * 26 ); g.lineTo( ex + Math.cos( ang + 2.5 ) * 24, ey + Math.sin( ang + 2.5 ) * 24 ); g.lineTo( ex + Math.cos( ang - 2.5 ) * 24, ey + Math.sin( ang - 2.5 ) * 24 ); g.closePath(); g.fill();
	g.restore();
}

/** Frost creeping over a circle (her helmet) — feathery white sparkles. */
export function frost( h: Hud, x: number, y: number, r: number, amount: number, t: number ) {
	if ( amount <= 0 ) return;
	const g = h.g; g.save();
	for ( let i = 0; i < 36; i ++ ) {
		if ( hash( i * 3.1 ) > amount ) continue;
		const a = hash( i ) * tau, d = r * ( 0.75 + hash( i * 7 ) * 0.3 );
		const px = x + Math.cos( a ) * d, py = y + Math.sin( a ) * d * 0.9, len = r * ( 0.12 + hash( i * 5 ) * 0.18 );
		g.strokeStyle = 'rgba(230,245,255,0.9)'; g.lineWidth = 3; g.lineCap = 'round';
		g.beginPath(); g.moveTo( px, py ); g.lineTo( px - Math.cos( a ) * len, py - Math.sin( a ) * len ); g.stroke();
		const tw = 0.5 + 0.5 * Math.sin( t * 6 + i );
		g.fillStyle = `rgba(255,255,255,${ 0.5 + 0.5 * tw })`; g.beginPath(); g.arc( px, py, 2.5 + tw * 2.5, 0, tau ); g.fill();
	}
	g.restore();
}

/** Soft rising heat wiggles. */
export function heatWaves( h: Hud, x: number, y: number, w: number, hgt: number, t: number, a: number ) {
	if ( a <= 0 ) return;
	const g = h.g; g.save(); g.globalAlpha = a; g.lineCap = 'round'; g.lineWidth = 7; g.strokeStyle = '#ffb27a';
	for ( let i = 0; i < 4; i ++ ) {
		const ph = ( t * 0.6 + i / 4 ) % 1, bx = x + ( i - 1.5 ) * w * 0.3;
		g.globalAlpha = a * Math.sin( ph * Math.PI );
		g.beginPath();
		for ( let k = 0; k <= 16; k ++ ) { const u = k / 16; const yy = y - ph * hgt * 0.4 - u * hgt * 0.5; const xx = bx + Math.sin( u * 9 + t * 4 + i ) * w * 0.04; k ? g.lineTo( xx, yy ) : g.moveTo( xx, yy ); }
		g.stroke();
	}
	g.restore();
}

export { easeOutCubic, popInOut };
