// Procedural pastel planet textures (seeded canvas painting).
import * as THREE from 'three';
import { rng } from './engine/math';
import { canvas, tex, earthTexture, bandTexture } from './engine/textures';

export type PlanetKind = 'mercury' | 'jupiter' | 'earth' | 'neptune' | 'rock' | 'ocean' | 'lava' | 'ice' | 'k218' | 'mars' | 'venus' | 'saturn' | 'uranus';

function blobs( g: CanvasRenderingContext2D, r: () => number, W: number, H: number, n: number, color: string, min: number, max: number ) {
	g.fillStyle = color;
	for ( let i = 0; i < n; i ++ ) { g.beginPath(); g.arc( r() * W, H * 0.12 + r() * H * 0.76, min + r() * ( max - min ), 0, 7 ); g.fill(); }
}
function craters( g: CanvasRenderingContext2D, r: () => number, W: number, H: number, n: number, dark: string, light: string ) {
	for ( let i = 0; i < n; i ++ ) {
		const x = r() * W, y = H * 0.15 + r() * H * 0.7, s = 6 + r() * 22;
		g.fillStyle = dark; g.beginPath(); g.ellipse( x, y, s * 1.6, s, 0, 0, 7 ); g.fill();
		g.fillStyle = light; g.beginPath(); g.ellipse( x - s * 0.25, y - s * 0.2, s * 1.1, s * 0.6, 0, 0, 7 ); g.fill();
	}
}
function swirls( g: CanvasRenderingContext2D, r: () => number, W: number, H: number, n: number, color: string, width = 6 ) {
	g.strokeStyle = color; g.lineCap = 'round'; g.lineWidth = width;
	for ( let i = 0; i < n; i ++ ) {
		const x = r() * W, y = H * 0.15 + r() * H * 0.7, len = 60 + r() * 160;
		g.beginPath(); g.moveTo( x, y ); g.bezierCurveTo( x + len * 0.3, y - 14, x + len * 0.6, y + 14, x + len, y + ( r() - .5 ) * 20 ); g.stroke();
	}
}

/** Returns { map, emissiveMap? } */
export function planetTextures( kind: PlanetKind, seed = 1 ): { map: THREE.Texture; emissiveMap?: THREE.Texture } {
	const W = 1024, H = 512, r = rng( seed * 977 + kind.length );
	if ( kind === 'earth' ) return { map: earthTexture( seed ) };
	if ( kind === 'jupiter' ) return { map: bandTexture( [ '#f3d3b0', '#e7b58c', '#fbe6cf', '#d99c7a', '#f6dcc0' ], seed ) };
	if ( kind === 'saturn' ) return { map: bandTexture( [ '#f6e3b8', '#ecd29a', '#fbefcf', '#e4c487' ], seed + 3 ) };
	if ( kind === 'neptune' ) return { map: bandTexture( [ '#6f95ff', '#86a8ff', '#9ab8ff', '#7c9cf5' ], seed + 5 ) };
	if ( kind === 'uranus' ) return { map: bandTexture( [ '#a8ecf0', '#bdf3f5', '#9fe0e8' ], seed + 6 ) };
	const [ c, g ] = canvas( W, H );
	if ( kind === 'mercury' ) { g.fillStyle = '#b8b2c8'; g.fillRect( 0, 0, W, H ); blobs( g, r, W, H, 30, '#c9c3d8', 20, 60 ); craters( g, r, W, H, 50, '#9d97b0', '#d6d1e3' ); }
	if ( kind === 'mars' ) { g.fillStyle = '#f0a07e'; g.fillRect( 0, 0, W, H ); blobs( g, r, W, H, 30, '#e48c6c', 20, 60 ); craters( g, r, W, H, 25, '#cf7b5e', '#f6b495' ); }
	if ( kind === 'venus' ) { g.fillStyle = '#f7dca0'; g.fillRect( 0, 0, W, H ); swirls( g, r, W, H, 40, '#fbe8bf', 10 ); }
	if ( kind === 'rock' ) {
		g.fillStyle = '#d9a184'; g.fillRect( 0, 0, W, H );
		blobs( g, r, W, H, 40, '#c98c70', 20, 70 ); blobs( g, r, W, H, 14, '#a9cf8f', 30, 70 ); blobs( g, r, W, H, 10, '#bfe0a2', 12, 30 );
		craters( g, r, W, H, 26, '#b97c62', '#e6b49a' ); swirls( g, r, W, H, 14, 'rgba(255,248,240,0.85)', 7 );
		g.fillStyle = '#fff6ee'; g.fillRect( 0, 0, W, 26 ); g.fillRect( 0, H - 26, W, 26 );
	}
	if ( kind === 'ocean' ) {
		g.fillStyle = '#3d6ad6'; g.fillRect( 0, 0, W, H );
		blobs( g, r, W, H, 40, '#4f7ce4', 20, 60 ); blobs( g, r, W, H, 6, '#a9e3b6', 8, 18 );
		swirls( g, r, W, H, 26, 'rgba(240,248,255,0.9)', 8 );
	}
	if ( kind === 'k218' ) {
		g.fillStyle = '#2f55c2'; g.fillRect( 0, 0, W, H );
		let y = 0; while ( y < H ) { const h = 20 + r() * 40; g.fillStyle = [ '#2f55c2', '#3a64d2', '#4a74e0', '#2a4bb0' ][ Math.floor( r() * 4 ) ]; g.fillRect( 0, y, W, h ); y += h; }
		swirls( g, r, W, H, 20, 'rgba(200,225,255,0.6)', 10 );
	}
	if ( kind === 'ice' ) {
		g.fillStyle = '#e4f6ff'; g.fillRect( 0, 0, W, H );
		blobs( g, r, W, H, 30, '#d2efff', 20, 70 );
		g.strokeStyle = '#8fd6ff'; g.lineWidth = 4; g.lineCap = 'round';
		for ( let i = 0; i < 40; i ++ ) { let x = r() * W, yy = r() * H; g.beginPath(); g.moveTo( x, yy ); for ( let k = 0; k < 5; k ++ ) { x += ( r() - .5 ) * 90; yy += ( r() - .5 ) * 50; g.lineTo( x, yy ); } g.stroke(); }
	}
	if ( kind === 'lava' ) {
		g.fillStyle = '#4a3350'; g.fillRect( 0, 0, W, H );
		blobs( g, r, W, H, 40, '#3c2a45', 20, 70 );
		const [ ec, eg ] = canvas( W, H );
		eg.fillStyle = '#000'; eg.fillRect( 0, 0, W, H );
		for ( const ctx of [ g, eg ] ) {
			ctx.lineCap = 'round'; ctx.lineJoin = 'round';
			const rr = rng( seed + 99 );
			for ( let i = 0; i < 55; i ++ ) {
				let x = rr() * W, yy = rr() * H; ctx.strokeStyle = rr() < .5 ? '#ff8a4a' : '#ffc46b'; ctx.lineWidth = 3 + rr() * 6;
				ctx.beginPath(); ctx.moveTo( x, yy ); for ( let k = 0; k < 6; k ++ ) { x += ( rr() - .5 ) * 110; yy += ( rr() - .5 ) * 60; ctx.lineTo( x, yy ); } ctx.stroke();
			}
			ctx.fillStyle = '#ff9a4a'; for ( let i = 0; i < 18; i ++ ) { ctx.beginPath(); ctx.arc( rr() * W, rr() * H, 6 + rr() * 22, 0, 7 ); ctx.fill(); }
		}
		return { map: tex( c ), emissiveMap: tex( ec ) };
	}
	return { map: tex( c ) };
}
