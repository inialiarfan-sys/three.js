// 2D overlay (captions, numbers, title, speed lines) drawn into a canvas that the
// final post pass composites on top. Fully redrawn from `t` every frame.
import * as THREE from 'three';
import { clamp, popInOut, rng, wrap } from './math';
import { PALETTE } from './toon';
import type { Caption } from '../timeline';

export const FONT = 'Fredoka';

export class Hud {
	canvas: HTMLCanvasElement;
	g: CanvasRenderingContext2D;
	texture: THREE.CanvasTexture;
	W = 1; H = 1;
	constructor() {
		this.canvas = document.createElement( 'canvas' );
		this.g = this.canvas.getContext( '2d' )!;
		this.texture = new THREE.CanvasTexture( this.canvas );
		this.texture.minFilter = THREE.LinearFilter;
		this.texture.generateMipmaps = false;
	}
	resize( w: number, h: number ) {
		this.canvas.width = this.W = w; this.canvas.height = this.H = h;
		this.texture.dispose();
		this.texture.image = this.canvas;
	}
	begin() { this.g.setTransform( 1, 0, 0, 1, 0, 0 ); this.g.clearRect( 0, 0, this.W, this.H ); }
	end() { this.texture.needsUpdate = true; }

	/** Bold rounded text with a soft dark outline and pastel drop shadow. */
	text( str: string, x: number, y: number, size: number, opts: {
		fill?: string; scale?: number; alpha?: number; rot?: number; shadow?: string; align?: CanvasTextAlign; weight?: number; outline?: string;
	} = {} ) {
		const { fill = '#fff', scale = 1, alpha = 1, rot = 0, shadow = PALETTE.cobalt, align = 'center', weight = 700, outline = PALETTE.ink } = opts;
		if ( scale <= 0.001 || alpha <= 0.001 ) return;
		const g = this.g;
		g.save();
		g.globalAlpha = clamp( alpha );
		g.translate( x, y ); g.rotate( rot ); g.scale( scale, scale );
		g.font = `${ weight } ${ size }px ${ FONT }, 'Arial Rounded MT Bold', sans-serif`;
		g.textAlign = align; g.textBaseline = 'middle';
		g.lineJoin = 'round'; g.miterLimit = 2;
		// soft offset shadow
		g.lineWidth = size * 0.26; g.strokeStyle = shadow; g.fillStyle = shadow;
		g.strokeText( str, size * 0.04, size * 0.09 ); g.fillText( str, size * 0.04, size * 0.09 );
		g.lineWidth = size * 0.2; g.strokeStyle = outline; g.strokeText( str, 0, 0 );
		g.fillStyle = fill; g.fillText( str, 0, 0 );
		// highlight sheen on the top half
		g.globalAlpha *= 0.25; g.save(); g.beginPath(); g.rect( - 4000, - size, 8000, size * 0.55 ); g.clip();
		g.fillStyle = '#ffffff'; g.fillText( str, 0, 0 ); g.restore();
		g.restore();
	}

	/** A number/stat that pops in with a spring when spoken and pops out at t1. */
	stat( t: number, t0: number, t1: number, str: string, x: number, y: number, size: number, fill = PALETTE.yellow, sub?: string ) {
		const s = popInOut( t, t0, t1 );
		if ( s <= 0 ) return;
		const wob = Math.sin( ( t - t0 ) * 3 ) * 0.03;
		this.text( str, x, y, size, { fill, scale: s, rot: wob - 0.04 } );
		if ( sub ) this.text( sub, x, y + size * 0.78, size * 0.38, { fill: '#fff', scale: popInOut( t, t0 + 0.12, t1 ), shadow: PALETTE.ink } );
	}

	/** Manga speed lines streaming horizontally. */
	speedLines( t: number, amount: number, seed = 1, dir = - 1, color = 'rgba(255,255,255,0.9)' ) {
		if ( amount <= 0.01 ) return;
		const g = this.g, r = rng( seed ), n = 46;
		g.save(); g.globalAlpha = clamp( amount );
		for ( let i = 0; i < n; i ++ ) {
			const y = r() * this.H, len = this.W * ( 0.15 + r() * 0.35 ), sp = this.W * ( 1.6 + r() * 2.2 );
			const thick = 2 + r() * 7;
			const x = wrap( r() * this.W * 2 + dir * t * sp, - len, this.W + len );
			g.fillStyle = r() < 0.25 ? 'rgba(200,244,255,0.9)' : color;
			g.beginPath(); // tapered stroke
			g.moveTo( x, y ); g.lineTo( x - dir * len, y - thick / 2 ); g.lineTo( x - dir * len, y + thick / 2 ); g.closePath();
			g.fill();
		}
		g.restore();
	}

	/** Radial focus lines (anime "shock" frame). */
	focusLines( t: number, amount: number, seed = 5 ) {
		if ( amount <= 0.01 ) return;
		const g = this.g, r = rng( seed ), cx = this.W / 2, cy = this.H / 2, R = Math.hypot( cx, cy );
		g.save(); g.globalAlpha = clamp( amount ) * 0.85; g.fillStyle = '#ffffff';
		const jitter = Math.floor( t * 12 );
		for ( let i = 0; i < 70; i ++ ) {
			const a = r() * Math.PI * 2 + ( ( jitter * 7 + i ) % 5 ) * 0.004, w = 0.004 + r() * 0.01, inner = R * ( 0.55 + r() * 0.25 );
			g.beginPath();
			g.moveTo( cx + Math.cos( a ) * inner, cy + Math.sin( a ) * inner );
			g.lineTo( cx + Math.cos( a - w ) * R * 1.1, cy + Math.sin( a - w ) * R * 1.1 );
			g.lineTo( cx + Math.cos( a + w ) * R * 1.1, cy + Math.sin( a + w ) * R * 1.1 );
			g.fill();
		}
		g.restore();
	}

	roundRect( x: number, y: number, w: number, h: number, r: number ) {
		const g = this.g; g.beginPath();
		g.moveTo( x + r, y ); g.arcTo( x + w, y, x + w, y + h, r ); g.arcTo( x + w, y + h, x, y + h, r );
		g.arcTo( x, y + h, x, y, r ); g.arcTo( x, y, x + w, y, r ); g.closePath();
	}

	/** Pastel card with a title and simple bar spectrum (transit scene). */
	spectrumCard( t: number, t0: number, t1: number, cx: number, cy: number, w: number ) {
		const s = popInOut( t, t0, t1 );
		if ( s <= 0 ) return;
		const g = this.g, h = w * 0.62;
		g.save(); g.translate( cx, cy ); g.scale( s, s ); g.rotate( 0.03 );
		this.roundRect( - w / 2 + 8, - h / 2 + 12, w, h, 34 ); g.fillStyle = PALETTE.cobalt; g.fill();
		this.roundRect( - w / 2, - h / 2, w, h, 34 ); g.fillStyle = '#fbf7ff'; g.fill();
		g.lineWidth = 10; g.strokeStyle = PALETTE.ink; g.stroke();
		const cols = [ '#ff9fb8', '#ffc58f', '#ffe68a', '#a8f0c8', '#8fd6ff', '#8fa8ff', '#c7a6ff' ];
		const n = 21, bw = ( w * 0.8 ) / n;
		for ( let i = 0; i < n; i ++ ) {
			const dip = i === 6 || i === 13 || i === 17 ? 0.35 : 1; // absorption lines = "what it's made of"
			const grow = clamp( ( t - t0 - i * 0.04 ) * 3 );
			const bh = h * 0.5 * ( 0.55 + 0.45 * Math.sin( i * 0.9 ) ** 2 ) * dip * grow;
			g.fillStyle = cols[ Math.floor( i / n * cols.length ) ];
			this.roundRect( - w * 0.4 + i * bw + 3, h * 0.3 - bh, bw - 6, bh, 6 ); g.fill();
		}
		g.restore();
		this.text( 'starlight', cx, cy - h * 0.36 * s, w * 0.09, { scale: s, fill: PALETTE.peach, shadow: PALETTE.ink } );
	}

	/** Captions: 1–3 short lines, current word highlighted with a pastel pill. */
	captions( t: number, caps: Caption[], cx: number, cy: number, maxW: number, size: number ) {
		const cap = caps.find( ( c ) => t >= c.start - 0.08 && t < c.end );
		if ( ! cap ) return;
		const g = this.g;
		g.font = `700 ${ size }px ${ FONT }, sans-serif`;
		const space = g.measureText( ' ' ).width;
		const lines: { w: typeof cap.words; width: number }[] = [];
		let line: typeof cap.words = [], lw = 0;
		for ( const w of cap.words ) {
			const ww = g.measureText( w.word ).width;
			if ( line.length && lw + space + ww > maxW ) { lines.push( { w: line, width: lw } ); line = []; lw = 0; }
			lw += ( line.length ? space : 0 ) + ww; line.push( w );
		}
		if ( line.length ) lines.push( { w: line, width: lw } );
		const lh = size * 1.28;
		const appear = popInOut( t, cap.start - 0.08, Infinity );
		const y0 = cy - ( ( lines.length - 1 ) * lh ) / 2;
		// current word = last word whose start <= t
		let cur = - 1;
		cap.words.forEach( ( w, i ) => { if ( t >= w.start - 0.03 ) cur = i; } );
		let k = 0;
		g.save();
		g.translate( cx, y0 ); g.scale( 0.9 + 0.1 * appear, 0.9 + 0.1 * appear ); g.translate( - cx, - y0 );
		lines.forEach( ( L, li ) => {
			let x = cx - L.width / 2;
			const y = y0 + li * lh;
			for ( const w of L.w ) {
				const ww = g.measureText( w.word ).width;
				const isCur = k === cur;
				const spoken = k <= cur;
				if ( isCur ) {
					const p = popInOut( t, w.start - 0.03 );
					g.save(); g.translate( x + ww / 2, y ); g.scale( 0.85 + 0.15 * p, 0.85 + 0.15 * p );
					this.roundRect( - ww / 2 - size * 0.18, - size * 0.62, ww + size * 0.36, size * 1.2, size * 0.42 );
					g.fillStyle = PALETTE.ink; g.fill();
					this.roundRect( - ww / 2 - size * 0.14, - size * 0.58, ww + size * 0.28, size * 1.12, size * 0.38 );
					g.fillStyle = PALETTE.peach; g.fill();
					g.restore();
				}
				g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineJoin = 'round';
				if ( ! isCur ) { g.lineWidth = size * 0.22; g.strokeStyle = PALETTE.ink; g.strokeText( w.word, x, y ); }
				g.fillStyle = isCur ? PALETTE.ink : spoken ? '#ffffff' : '#dfe4ff';
				g.fillText( w.word, x, y );
				x += ww + space; k ++;
			}
		} );
		g.restore();
	}
}

// ---------- extra cartoon overlays (super-Earth) ----------
export function bigX( h: Hud, x: number, y: number, size: number, s: number ) {
	if ( s <= 0 ) return;
	const g = h.g; g.save(); g.translate( x, y ); g.scale( s, s ); g.rotate( 0.08 ); g.lineCap = 'round';
	for ( const [ col, lw ] of [ [ PALETTE.ink, size * 0.3 ], [ '#ff5c7a', size * 0.18 ] ] as const ) {
		g.strokeStyle = col; g.lineWidth = lw;
		g.beginPath(); g.moveTo( - size, - size ); g.lineTo( size, size ); g.moveTo( size, - size ); g.lineTo( - size, size ); g.stroke();
	}
	g.restore();
}

/** Rounded pill label (tags like "Not confirmed"). */
export function pill( h: Hud, str: string, x: number, y: number, size: number, s: number, fill = '#ffffff', bg = PALETTE.cobalt, icon = '' ) {
	if ( s <= 0 ) return;
	const g = h.g;
	g.save(); g.translate( x, y ); g.scale( s, s ); g.rotate( - 0.03 );
	g.font = `700 ${ size }px Fredoka, sans-serif`;
	const text = icon ? icon + '  ' + str : str;
	const w = g.measureText( text ).width + size * 1.2, hh = size * 1.6;
	h.roundRect( - w / 2 + 6, - hh / 2 + 8, w, hh, hh / 2 ); g.fillStyle = PALETTE.ink; g.fill();
	h.roundRect( - w / 2, - hh / 2, w, hh, hh / 2 ); g.fillStyle = bg; g.fill(); g.lineWidth = size * 0.14; g.strokeStyle = PALETTE.ink; g.stroke();
	g.fillStyle = fill; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText( text, 0, size * 0.04 );
	g.restore();
}

/** Rubber "SOLD OUT" stamp slammed onto the board. */
export function stamp( h: Hud, str: string, x: number, y: number, size: number, t: number, t0: number ) {
	if ( t < t0 ) return;
	const k = clamp( ( t - t0 ) / 0.12 );
	const s = 2.4 - 1.4 * k + ( k >= 1 ? 0.08 * Math.exp( - ( t - t0 - 0.12 ) * 10 ) * Math.cos( ( t - t0 ) * 40 ) : 0 );
	const g = h.g; g.save(); g.translate( x, y ); g.rotate( - 0.18 ); g.scale( s, s ); g.globalAlpha = clamp( k * 1.5 );
	g.font = `700 ${ size }px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
	const w = g.measureText( str ).width + size * 0.9, hh = size * 1.5;
	g.lineWidth = size * 0.14; g.strokeStyle = '#ff4d6d'; h.roundRect( - w / 2, - hh / 2, w, hh, size * 0.25 ); g.stroke();
	g.fillStyle = 'rgba(255,77,109,0.15)'; g.fill();
	g.fillStyle = '#ff4d6d'; g.fillText( str, 0, size * 0.05 );
	g.restore();
}

/** Cartoon sweat drops popping off a point. */
export function sweat( h: Hud, x: number, y: number, size: number, t: number, amount = 1 ) {
	if ( amount <= 0 ) return;
	const g = h.g;
	for ( let i = 0; i < 3; i ++ ) {
		const ph = ( t * 1.6 + i / 3 ) % 1;
		const dx = ( i - 1 ) * size * 1.4 + Math.sin( i * 2 ) * size * 0.3, dy = - size * 0.5 + ph * size * 2.2;
		g.save(); g.globalAlpha = ( 1 - ph ) * amount; g.translate( x + dx * ( 0.6 + ph ), y + dy );
		g.beginPath(); g.moveTo( 0, - size * 0.7 ); g.quadraticCurveTo( size * 0.55, 0, 0, size * 0.45 ); g.quadraticCurveTo( - size * 0.55, 0, 0, - size * 0.7 );
		g.fillStyle = '#9fe0ff'; g.fill(); g.lineWidth = size * 0.14; g.strokeStyle = PALETTE.ink; g.stroke();
		g.restore();
	}
}

/** Cloud-shaped thought bubble (path only); draw callback paints inside. */
export function thought( h: Hud, x: number, y: number, r: number, s: number, inner?: ( g: CanvasRenderingContext2D ) => void ) {
	if ( s <= 0 ) return;
	const g = h.g; g.save(); g.translate( x, y ); g.scale( s, s );
	const lobes = 9;
	const path = () => { g.beginPath(); for ( let i = 0; i < lobes; i ++ ) { const a = i / lobes * Math.PI * 2; g.moveTo( Math.cos( a ) * r * 0.85 + r * 0.32, Math.sin( a ) * r * 0.62 ); g.arc( Math.cos( a ) * r * 0.85, Math.sin( a ) * r * 0.62, r * 0.32, 0, 7 ); } g.ellipse( 0, 0, r * 0.88, r * 0.66, 0, 0, 7 ); };
	g.lineWidth = r * 0.07; g.strokeStyle = PALETTE.ink; path(); g.stroke();
	g.fillStyle = '#f4f2ff'; path(); g.fill();
	// trailing dots
	[ [ - r * 0.7, r * 0.85, r * 0.12 ], [ - r * 0.95, r * 1.12, r * 0.07 ] ].forEach( ( [ dx, dy, rr ] ) => { g.beginPath(); g.arc( dx, dy, rr, 0, 7 ); g.fillStyle = '#f4f2ff'; g.fill(); g.lineWidth = r * 0.05; g.stroke(); } );
	if ( inner ) { g.save(); g.beginPath(); g.ellipse( 0, 0, r * 0.95, r * 0.75, 0, 0, 7 ); g.clip(); inner( g ); g.restore(); }
	g.restore();
}

/** Route map: dashed path through stops with planet dots and labels. */
export function routeMap( h: Hud, pts: { x: number; y: number; label: string; color: string }[], prog: number, s: number, size: number ) {
	if ( s <= 0 ) return;
	const g = h.g; g.save(); g.globalAlpha = clamp( s );
	g.lineCap = 'round'; g.setLineDash( [ size * 0.5, size * 0.4 ] ); g.lineWidth = size * 0.18; g.strokeStyle = '#ffe07a';
	g.beginPath();
	const total = pts.length - 1;
	for ( let i = 0; i < pts.length; i ++ ) {
		const f = clamp( prog * total - ( i - 1 ) );
		if ( i === 0 ) g.moveTo( pts[ 0 ].x, pts[ 0 ].y );
		else if ( f > 0 ) g.lineTo( pts[ i - 1 ].x + ( pts[ i ].x - pts[ i - 1 ].x ) * f, pts[ i - 1 ].y + ( pts[ i ].y - pts[ i - 1 ].y ) * f );
	}
	g.stroke(); g.setLineDash( [] );
	pts.forEach( ( p, i ) => {
		const ps = popInOut( prog * total + 0.3, i, Infinity ) * s;
		if ( ps <= 0 || i === 0 ) return;
		g.save(); g.translate( p.x, p.y ); g.scale( ps, ps );
		g.beginPath(); g.arc( 0, 0, size * 0.9, 0, 7 ); g.fillStyle = p.color; g.fill(); g.lineWidth = size * 0.16; g.strokeStyle = PALETTE.ink; g.stroke();
		g.font = `700 ${ size * 0.8 }px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
		g.fillStyle = PALETTE.ink; g.fillText( String( i ), 0, size * 0.05 );
		g.restore();
		h.text( p.label, p.x, p.y + size * 1.9, size * 0.85, { scale: ps, fill: '#ffffff' } );
	} );
	g.restore();
}
