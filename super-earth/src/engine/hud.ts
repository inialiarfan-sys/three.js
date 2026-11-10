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
