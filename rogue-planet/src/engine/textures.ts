import * as THREE from 'three';
import { rng } from './math';
import { PALETTE } from './toon';

export function canvas( w: number, h: number ) {
	const c = document.createElement( 'canvas' );
	c.width = w; c.height = h;
	return [ c, c.getContext( '2d' )! ] as const;
}

export function tex( c: HTMLCanvasElement, srgb = true ) {
	const t = new THREE.CanvasTexture( c );
	if ( srgb ) t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 4;
	return t;
}

/** Equirect toon texture for the glass planet: cobalt/periwinkle bands + cream swirls. */
export function glassPlanetTexture( seed = 189733 ) {
	const W = 1024, H = 512;
	const [ c, g ] = canvas( W, H );
	const r = rng( seed );
	g.fillStyle = PALETTE.cobalt; g.fillRect( 0, 0, W, H );
	const bands = [ '#2f4cb8', '#4a6be0', '#6f8cf2', '#8fa8ff', '#3e5fd4', '#5a7cec' ];
	let y = 0;
	while ( y < H ) {
		const h = 18 + r() * 46;
		g.fillStyle = bands[ Math.floor( r() * bands.length ) ];
		g.beginPath();
		g.moveTo( 0, y );
		for ( let x = 0; x <= W; x += 32 ) g.lineTo( x, y + Math.sin( x / W * Math.PI * 4 + r() * .3 ) * 6 );
		g.lineTo( W, y + h ); g.lineTo( 0, y + h ); g.closePath(); g.fill();
		y += h;
	}
	// cream cloud swirls (spirals and long wisps)
	g.lineCap = 'round';
	for ( let i = 0; i < 26; i ++ ) {
		const cx = r() * W, cy = 60 + r() * ( H - 120 ), rad = 14 + r() * 38;
		g.strokeStyle = r() < .7 ? PALETTE.cream : '#dfe8ff';
		g.lineWidth = 5 + r() * 7;
		g.beginPath();
		for ( let a = 0; a < Math.PI * 3.2; a += .12 ) {
			const rr = rad * ( 1 - a / ( Math.PI * 3.6 ) );
			const x = cx + Math.cos( a ) * rr * 1.8, yy = cy + Math.sin( a ) * rr;
			a === 0 ? g.moveTo( x, yy ) : g.lineTo( x, yy );
		}
		g.stroke();
		// wisp tail
		g.beginPath(); g.moveTo( cx + rad * 1.8, cy );
		g.bezierCurveTo( cx + rad * 4, cy - 10, cx + rad * 6, cy + 14, cx + rad * ( 7 + r() * 5 ), cy + ( r() - .5 ) * 20 );
		g.stroke();
	}
	// copy right edge into left edge region for seamless wrap (cheap): blend a strip
	const strip = g.getImageData( W - 40, 0, 40, H );
	g.globalAlpha = .5; g.putImageData( strip, 0, 0 ); g.globalAlpha = 1;
	return tex( c );
}

export function earthTexture( seed = 3 ) {
	const W = 1024, H = 512;
	const [ c, g ] = canvas( W, H );
	const r = rng( seed );
	g.fillStyle = '#5aa8ff'; g.fillRect( 0, 0, W, H );
	g.fillStyle = '#7cc0ff';
	for ( let i = 0; i < 40; i ++ ) { g.beginPath(); g.arc( r() * W, r() * H, 20 + r() * 50, 0, 7 ); g.fill(); }
	// blobby continents
	const lands = [ [ .22, .38 ], [ .3, .65 ], [ .52, .35 ], [ .56, .62 ], [ .75, .4 ], [ .82, .7 ] ];
	for ( const [ lx, ly ] of lands ) {
		g.fillStyle = '#7fd98a';
		for ( let k = 0; k < 9; k ++ ) { g.beginPath(); g.arc( lx * W + ( r() - .5 ) * 120, ly * H + ( r() - .5 ) * 80, 22 + r() * 36, 0, 7 ); g.fill(); }
		g.fillStyle = '#b5ec9a';
		for ( let k = 0; k < 4; k ++ ) { g.beginPath(); g.arc( lx * W + ( r() - .5 ) * 80, ly * H + ( r() - .5 ) * 50, 10 + r() * 18, 0, 7 ); g.fill(); }
	}
	g.fillStyle = '#f4fbff'; g.fillRect( 0, 0, W, 34 ); g.fillRect( 0, H - 34, W, 34 );
	return tex( c );
}

export function bandTexture( colors: string[], seed = 7 ) {
	const W = 512, H = 256;
	const [ c, g ] = canvas( W, H );
	const r = rng( seed );
	let y = 0, i = 0;
	while ( y < H ) {
		const h = 10 + r() * 28;
		g.fillStyle = colors[ i ++ % colors.length ];
		g.beginPath(); g.moveTo( 0, y );
		for ( let x = 0; x <= W; x += 16 ) g.lineTo( x, y + Math.sin( x / 40 + i ) * 3 );
		g.lineTo( W, y + h + 4 ); g.lineTo( 0, y + h + 4 ); g.fill();
		y += h;
	}
	g.fillStyle = '#e88a6a'; g.beginPath(); g.ellipse( W * .65, H * .62, 26, 14, 0, 0, 7 ); g.fill();
	return tex( c );
}

/** Radial soft dot (glows, stars). */
export function radialTexture( inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128 ) {
	const [ c, g ] = canvas( size, size );
	const grd = g.createRadialGradient( size / 2, size / 2, 0, size / 2, size / 2, size / 2 );
	grd.addColorStop( 0, inner ); grd.addColorStop( 1, outer );
	g.fillStyle = grd; g.fillRect( 0, 0, size, size );
	return tex( c );
}

/** Four-point anime sparkle. */
export function sparkleTexture() {
	const S = 128;
	const [ c, g ] = canvas( S, S );
	g.translate( S / 2, S / 2 );
	g.fillStyle = '#ffffff';
	g.beginPath();
	for ( let i = 0; i < 8; i ++ ) {
		const a = i * Math.PI / 4, rr = i % 2 === 0 ? S * .48 : S * .08;
		g.lineTo( Math.cos( a ) * rr, Math.sin( a ) * rr );
	}
	g.closePath(); g.fill();
	const grd = g.createRadialGradient( 0, 0, 0, 0, 0, S * .2 );
	grd.addColorStop( 0, 'rgba(255,255,255,1)' ); grd.addColorStop( 1, 'rgba(255,255,255,0)' );
	g.fillStyle = grd; g.beginPath(); g.arc( 0, 0, S * .2, 0, 7 ); g.fill();
	return tex( c );
}

/** Spiky comic "pop" burst. */
export function burstTexture( fill = PALETTE.yellow, inner = '#fff6c8', spikes = 14 ) {
	const S = 512;
	const [ c, g ] = canvas( S, S );
	g.translate( S / 2, S / 2 );
	const r = rng( spikes * 31 );
	const path = ( k: number ) => {
		g.beginPath();
		for ( let i = 0; i < spikes * 2; i ++ ) {
			const a = i * Math.PI / spikes;
			const rr = ( i % 2 === 0 ? S * .47 * ( .85 + r() * .15 ) : S * .3 ) * k;
			g.lineTo( Math.cos( a ) * rr, Math.sin( a ) * rr );
		}
		g.closePath();
	};
	path( 1 ); g.fillStyle = fill; g.fill(); g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = PALETTE.ink; g.stroke();
	path( .62 ); g.fillStyle = inner; g.fill();
	return tex( c );
}

/** Round comic speech bubble containing an expression head. */
export function bubbleTexture( head: HTMLImageElement, tailRight = false ) {
	const W = 512, H = 560;
	const [ c, g ] = canvas( W, H );
	const cx = W / 2, cy = 250, R = 220;
	g.lineJoin = 'round';
	// tail (bottom-left)
	const tx = tailRight ? - 1 : 1;
	g.beginPath(); g.moveTo( cx - 120 * tx, cy + 150 ); g.lineTo( cx - 175 * tx, H - 18 ); g.lineTo( cx - 40 * tx, cy + 200 ); g.closePath();
	g.fillStyle = '#fff'; g.fill(); g.lineWidth = 16; g.strokeStyle = PALETTE.ink; g.stroke();
	g.beginPath(); g.arc( cx, cy, R, 0, Math.PI * 2 );
	g.fillStyle = '#fff'; g.fill(); g.stroke();
	// cover tail seam
	g.beginPath(); g.arc( cx, cy, R - 8, 0, Math.PI * 2 ); g.fillStyle = '#fff'; g.fill();
	// pastel inner disc
	g.beginPath(); g.arc( cx, cy, R - 22, 0, Math.PI * 2 ); g.fillStyle = '#eef2ff'; g.fill();
	// head clipped to circle
	g.save();
	g.beginPath(); g.arc( cx, cy, R - 22, 0, Math.PI * 2 ); g.clip();
	const s = ( R * 1.9 ) / Math.max( head.width, head.height * 1.05 );
	const w = head.width * s, h = head.height * s;
	g.drawImage( head, cx - w / 2, cy + R - 22 - h + 6, w, h );
	g.restore();
	// gloss
	g.beginPath(); g.ellipse( cx - 110, cy - 130, 34, 18, - .7, 0, 7 ); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
	return tex( c );
}

export function shadowTexture() {
	return radialTexture( 'rgba(15,20,56,0.55)', 'rgba(15,20,56,0)', 128 );
}

/** Planet ring / orbit dashed circle texture. */
export function puffTexture( color: string ) {
	const S = 256;
	const [ c, g ] = canvas( S, S );
	g.fillStyle = color; g.strokeStyle = PALETTE.ink; g.lineWidth = 8;
	const blobs = [ [ .35, .58, .2 ], [ .55, .45, .25 ], [ .7, .6, .18 ], [ .5, .66, .2 ] ];
	for ( const [ x, y, r ] of blobs ) { g.beginPath(); g.arc( x * S, y * S, r * S, 0, 7 ); g.stroke(); }
	for ( const [ x, y, r ] of blobs ) { g.beginPath(); g.arc( x * S, y * S, r * S, 0, 7 ); g.fill(); }
	return tex( c );
}

export function loadImage( url: string ) {
	return new Promise<HTMLImageElement>( ( res, rej ) => {
		const i = new Image();
		i.onload = () => res( i );
		i.onerror = () => rej( new Error( 'Failed to load ' + url ) );
		i.src = url;
	} );
}
