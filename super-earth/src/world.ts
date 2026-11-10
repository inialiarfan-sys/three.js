// Every 3D prop, built once (seeded) and posed from t by the scenes.
import * as THREE from 'three';
import { addOutline, hullOutline, PALETTE, rimShell, toon, toonBall } from './engine/toon';
import { burstTexture, canvas, radialTexture, tex } from './engine/textures';
import { rng } from './engine/math';
import { planetTextures, type PlanetKind } from './planets';
import { Ship } from './ship';

const pastelStar = [ '#ffffff', '#ffe3f0', '#dfe6ff', '#fff2cc', '#d9fff3', '#ffd9c2' ];

export function starfield( n = 1800, seed = 11, radius = 300 ) {
	const r = rng( seed );
	const pos = new Float32Array( n * 3 ), col = new Float32Array( n * 3 ), size = new Float32Array( n ), ph = new Float32Array( n );
	const c = new THREE.Color();
	for ( let i = 0; i < n; i ++ ) {
		const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt( 1 - u * u );
		pos.set( [ Math.cos( a ) * s * radius, u * radius, Math.sin( a ) * s * radius ], i * 3 );
		c.set( pastelStar[ Math.floor( r() * pastelStar.length ) ] ); col.set( [ c.r, c.g, c.b ], i * 3 );
		size[ i ] = r() < 0.07 ? 10 + r() * 7 : 2.5 + r() * 4.5; ph[ i ] = r() * 10;
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute( 'position', new THREE.BufferAttribute( pos, 3 ) );
	geo.setAttribute( 'color', new THREE.BufferAttribute( col, 3 ) );
	geo.setAttribute( 'size', new THREE.BufferAttribute( size, 1 ) );
	geo.setAttribute( 'phase', new THREE.BufferAttribute( ph, 1 ) );
	const mat = new THREE.ShaderMaterial( {
		uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uOpacity: { value: 1 }, uTwinkle: { value: 1 } },
		vertexShader: /* glsl */`
			attribute float size; attribute float phase; attribute vec3 color;
			uniform float uTime, uScale, uTwinkle; varying vec3 vC; varying float vBig; varying float vTw;
			void main(){
				vC = color; vBig = step(8., size);
				vTw = 0.7 + 0.3*sin(uTime*2.2*uTwinkle + phase*6.);
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
				gl_PointSize = size * uScale * (0.8 + 0.2*vTw);
			}`,
		fragmentShader: /* glsl */`
			uniform float uOpacity; varying vec3 vC; varying float vBig; varying float vTw;
			void main(){
				vec2 p = gl_PointCoord - .5; float d = length(p);
				float dot_ = smoothstep(.5, .25, d);
				float cr = vBig * max(smoothstep(.07,.0,abs(p.x))*smoothstep(.5,.1,abs(p.y)), smoothstep(.07,.0,abs(p.y))*smoothstep(.5,.1,abs(p.x)));
				float a = max(dot_ * (1. - vBig*.45), cr);
				if (a < .02) discard;
				gl_FragColor = vec4(vC * (1.0 + vBig*0.6) * vTw, a * uOpacity);
			}`,
		transparent: true, depthWrite: false,
	} );
	const pts = new THREE.Points( geo, mat );
	pts.frustumCulled = false;
	return pts;
}

function galaxy( n = 12000, seed = 21 ) {
	const r = rng( seed );
	const pos = new Float32Array( n * 3 ), col = new Float32Array( n * 3 );
	const cols = [ '#ffd1e6', '#c9d6ff', '#fff0c9', '#e3c9ff', '#bff2ff' ].map( ( s ) => new THREE.Color( s ) );
	for ( let i = 0; i < n; i ++ ) {
		const arm = i % 4, d = Math.pow( r(), 0.6 ) * 40;
		const a = arm * Math.PI / 2 + d * 0.16 + ( r() - .5 ) * ( 0.9 - d / 60 );
		const spread = ( r() - .5 ) * ( 2 + d * 0.08 );
		pos.set( [ Math.cos( a ) * d + spread, ( r() - .5 ) * ( 2.5 - d * 0.04 ), Math.sin( a ) * d + spread ], i * 3 );
		const c = d < 6 ? new THREE.Color( '#fff4d6' ) : cols[ Math.floor( r() * cols.length ) ];
		col.set( [ c.r, c.g, c.b ], i * 3 );
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute( 'position', new THREE.BufferAttribute( pos, 3 ) );
	geo.setAttribute( 'color', new THREE.BufferAttribute( col, 3 ) );
	const g = new THREE.Group();
	g.add( new THREE.Points( geo, new THREE.PointsMaterial( { size: 0.32, vertexColors: true, map: radialTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 } ) ) );
	const core = new THREE.Sprite( new THREE.SpriteMaterial( { map: radialTexture( 'rgba(255,236,210,1)', 'rgba(255,200,230,0)' ), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 } ) );
	core.scale.setScalar( 24 ); g.add( core );
	return g;
}

export interface PlanetObj { group: THREE.Group; ball: THREE.Mesh; mat: THREE.MeshToonMaterial; rim: THREE.Mesh; spin: THREE.Group }
function planet( kind: PlanetKind, rimColor: string, seed = 1 ): PlanetObj {
	const group = new THREE.Group(), spin = new THREE.Group();
	const { map, emissiveMap } = planetTextures( kind, seed );
	const mat = toon( '#ffffff', { map, ...( emissiveMap ? { emissiveMap } : {} ), emissive: emissiveMap ? new THREE.Color( '#ff9a5a' ).multiplyScalar( 1.4 ) : new THREE.Color( 0 ) } );
	const ball = new THREE.Mesh( new THREE.SphereGeometry( 1, 64, 32 ), mat );
	addOutline( ball, 0.03 );
	spin.add( ball );
	spin.rotation.z = 0.3;
	const rim = rimShell( 1.07, rimColor, 2.2, 1.0 );
	group.add( spin, rim );
	return { group, ball, mat, rim, spin };
}

function puff( color: string, seed: number, n = 6, outline = 0.07 ) {
	const r = rng( seed ), g = new THREE.Group();
	for ( let i = 0; i < n; i ++ ) {
		const s = 0.35 + r() * 0.35;
		const m = toonBall( s, color, outline, 24 );
		m.position.set( ( r() - .5 ) * 1.3, ( r() - .3 ) * 0.5, ( r() - .5 ) * 0.4 );
		g.add( m );
	}
	return g;
}

function boardTexture( lines: { text: string; color?: string; size?: number; strike?: boolean }[], w = 1024, h = 1280, bg = '#2b3366' ) {
	const [ c, g ] = canvas( w, h );
	g.fillStyle = PALETTE.ink; g.beginPath(); g.roundRect( 0, 0, w, h, 60 ); g.fill();
	g.fillStyle = bg; g.beginPath(); g.roundRect( 22, 22, w - 44, h - 44, 46 ); g.fill();
	g.strokeStyle = '#ffd36e'; g.lineWidth = 8; g.setLineDash( [ 20, 16 ] ); g.beginPath(); g.roundRect( 50, 50, w - 100, h - 100, 34 ); g.stroke(); g.setLineDash( [] );
	let y = 150;
	for ( const L of lines ) {
		const s = L.size ?? 70;
		g.font = `700 ${ s }px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
		g.lineJoin = 'round'; g.lineWidth = s * 0.18; g.strokeStyle = PALETTE.ink; g.strokeText( L.text, w / 2, y );
		g.fillStyle = L.color ?? '#fff6ea'; g.fillText( L.text, w / 2, y );
		y += s * 1.35;
	}
	return tex( c );
}

export type World = ReturnType<typeof buildWorld>;

export function buildWorld() {
	const scene = new THREE.Scene();
	const overlay = new THREE.Scene();
	const all: THREE.Object3D[] = [];
	const add = <T extends THREE.Object3D>( o: T, parent: THREE.Object3D = scene ) => { parent.add( o ); all.push( o ); return o; };

	const hemi = new THREE.HemisphereLight( '#cfd8ff', '#2a2f6b', 1.3 );
	const key = new THREE.DirectionalLight( '#fff1e4', 2.8 );
	key.position.set( - 4, 3, 5 );
	scene.add( hemi, key, key.target );

	const neb = add( new THREE.Group() );
	{
		const r = rng( 77 );
		const cs = [ 'rgba(160,140,255,0.32)', 'rgba(255,150,200,0.2)', 'rgba(120,200,255,0.22)' ];
		for ( let i = 0; i < 7; i ++ ) {
			const m = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: radialTexture( cs[ i % 3 ], 'rgba(0,0,0,0)' ), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } ) );
			m.scale.setScalar( 90 + r() * 120 ); m.position.set( ( r() - .5 ) * 260, ( r() - .5 ) * 300, - 160 );
			neb.add( m );
		}
	}
	const stars = add( starfield() );
	const milky = add( galaxy() );

	const P = {
		mercury: planet( 'mercury', '#e6e0ff', 2 ), jupiter: planet( 'jupiter', '#ffe6c9', 3 ), earth: planet( 'earth', '#bfe6ff', 4 ),
		neptune: planet( 'neptune', '#c9dcff', 5 ), rock: planet( 'rock', '#ffd9c2', 6 ), ocean: planet( 'ocean', '#bfe0ff', 7 ),
		lava: planet( 'lava', '#ff9a5a', 8 ), ice: planet( 'ice', '#d9f6ff', 9 ), k218: planet( 'k218', '#9fc4ff', 10 ),
		big: planet( 'rock', '#ffd9c2', 12 ),
	};
	for ( const p of Object.values( P ) ) add( p.group );
	// K2-18 b haze: an extra soft shell
	const haze = rimShell( 1.16, '#cfe2ff', 1.4, 0.8 ); P.k218.group.add( haze );
	// mystery silhouette planet
	const mystery = add( new THREE.Group() );
	{
		const m = new THREE.Mesh( new THREE.SphereGeometry( 1, 48, 24 ), new THREE.MeshBasicMaterial( { color: '#141a44' } ) );
		addOutline( m, 0.04, '#8fa8ff' );
		mystery.add( m, rimShell( 1.05, '#8fa8ff', 3, 1.4 ) );
	}
	// ice cutaway: shell with a wedge missing, glowing ocean inside, rocky core
	const iceCut = add( new THREE.Group() );
	{
		const shell = new THREE.Mesh( new THREE.SphereGeometry( 1, 64, 32, 0, Math.PI * 1.5 ), toon( '#ffffff', { map: planetTextures( 'ice', 9 ).map, side: THREE.DoubleSide } ) );
		addOutline( shell, 0.03 );
		const water = new THREE.Mesh( new THREE.SphereGeometry( 0.86, 48, 24, 0, Math.PI * 1.5 ), new THREE.MeshToonMaterial( { color: '#5fc4ff', emissive: new THREE.Color( '#3aa8ff' ).multiplyScalar( 1.3 ), side: THREE.DoubleSide, gradientMap: ( shell.material as THREE.MeshToonMaterial ).gradientMap } ) );
		const core = toonBall( 0.5, '#c99a7a', 0.05 );
		const glow = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: radialTexture( 'rgba(120,210,255,0.8)', 'rgba(120,210,255,0)' ), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } ) );
		glow.scale.setScalar( 2.4 ); glow.position.z = 0.3;
		iceCut.add( shell, water, core, glow );
		iceCut.userData = { shell, water };
	}

	// hot star (for 55 Cancri e) and a gentle sun
	const makeStar = ( core: string, edge: string ) => {
		const g = new THREE.Group();
		const ball = new THREE.Mesh( new THREE.SphereGeometry( 1, 48, 24 ), new THREE.ShaderMaterial( {
			uniforms: { uCore: { value: new THREE.Color( core ).multiplyScalar( 1.08 ) }, uEdge: { value: new THREE.Color( edge ) } },
			vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
			fragmentShader: `uniform vec3 uCore, uEdge; varying vec3 vN; varying vec3 vV;
				void main(){ float f = dot(vN, vV); float b = f > .75 ? 1. : f > .4 ? .6 : 0.; vec3 col = mix(uEdge, uCore, b) * (b > .9 ? 1.25 : 1.); gl_FragColor = vec4(col,1.);
				#include <colorspace_fragment>
				}`,
		} ) );
		addOutline( ball, 0.035, '#a8532c' );
		const halo = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: radialTexture( 'rgba(255,180,120,0.9)', 'rgba(255,160,100,0)' ), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.45 } ) );
		halo.scale.setScalar( 5.5 ); halo.position.z = - 0.6;
		const corona = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: burstTexture( edge, core, 18 ), transparent: true, depthWrite: false } ) );
		corona.scale.setScalar( 3.1 ); corona.position.z = - 0.5;
		g.add( halo, corona, ball );
		g.userData = { corona, halo };
		return g;
	};
	const star = add( makeStar( '#ffd2a8', '#ffab6b' ) );
	const sun = add( makeStar( '#fff0b3', '#ffd36e' ) );

	// crowd of planets around stars (instanced)
	const CROWD = 140;
	const crowdGeo = new THREE.SphereGeometry( 1, 20, 10 );
	const crowd = add( new THREE.InstancedMesh( crowdGeo, toon( '#ffffff' ), CROWD ) );
	const crowdOutline = new THREE.InstancedMesh( hullOutline( crowdGeo, 1.1 ).geometry, hullOutline( crowdGeo ).material, CROWD );
	crowd.add( crowdOutline ); crowd.frustumCulled = crowdOutline.frustumCulled = false;
	const crowdData: { x: number; y: number; z: number; s: number; delay: number; superE: boolean; color: THREE.Color }[] = [];
	{
		const r = rng( 5150 );
		const other = [ '#ffb8d2', '#ffe07a', '#c7a6ff', '#8fd6ff' ];
		for ( let i = 0; i < CROWD; i ++ ) {
			const a = i * 2.39996, rad = 0.8 + Math.sqrt( i / CROWD ) * 9;
			const superE = r() < 0.8;
			const color = new THREE.Color( superE ? ( r() < .5 ? '#a8f0c8' : '#7fd1a8' ) : other[ i % other.length ] );
			crowdData.push( { x: Math.cos( a ) * rad * 1.3, y: Math.sin( a ) * rad, z: ( r() - .5 ) * 3, s: superE ? 0.22 + r() * 0.1 : 0.12 + r() * 0.3, delay: r(), superE, color } );
			crowd.setColorAt( i, color );
		}
	}
	// little host stars for the crowd (points)
	const hostStars = add( starfield( 140, 99, 1 ) );
	{
		const arr = ( hostStars.geometry.attributes.position as THREE.BufferAttribute ).array as Float32Array;
		crowdData.forEach( ( d, i ) => { arr[ i * 3 ] = d.x - 0.6; arr[ i * 3 + 1 ] = d.y + 0.25; arr[ i * 3 + 2 ] = d.z; } );
		( hostStars.geometry.attributes.size as THREE.BufferAttribute ).array.fill( 12 );
	}

	// our solar system line-up with the missing middle
	const solar = add( new THREE.Group() );
	const solarDefs: [ PlanetKind, number ][] = [ [ 'mercury', 0.16 ], [ 'venus', 0.26 ], [ 'earth', 0.27 ], [ 'mars', 0.2 ], [ 'jupiter', 0.9 ], [ 'saturn', 0.78 ], [ 'uranus', 0.5 ], [ 'neptune', 0.48 ] ];
	const solarBalls: THREE.Group[] = [];
	{
		let x = 0;
		solarDefs.forEach( ( [ k, s ], i ) => {
			if ( i === 4 ) x += 0.9; // the gap where a super-Earth "should" be
			x += s;
			const b = toonBall( s, '#ffffff', 0.04, 40, { map: planetTextures( k, 20 + i ).map } );
			const g = new THREE.Group(); g.add( b ); g.position.x = x;
			if ( k === 'saturn' ) {
				const ring = new THREE.Mesh( new THREE.TorusGeometry( s * 1.6, s * 0.12, 6, 48 ), toon( '#f3d9a8' ) );
				ring.rotation.x = 1.25; addOutline( ring, 0.02 ); g.add( ring );
			}
			solar.add( g ); solarBalls.push( g );
			x += s + 0.25;
		} );
		const gapX = solarBalls[ 3 ].position.x + 0.2 + 0.25 + 0.45 + 0.05;
		// dashed ring for the empty slot
		const dashes = new THREE.Group();
		for ( let i = 0; i < 18; i ++ ) {
			const d = new THREE.Mesh( new THREE.CapsuleGeometry( 0.025, 0.08, 4, 6 ), new THREE.MeshBasicMaterial( { color: '#ffe07a' } ) );
			const a = i / 18 * Math.PI * 2;
			d.position.set( Math.cos( a ) * 0.4, Math.sin( a ) * 0.4, 0 ); d.rotation.z = a;
			dashes.add( d );
		}
		dashes.position.x = gapX;
		solar.add( dashes );
		solar.userData = { gapX, dashes, width: x };
	}

	// the cape (red, curved, flutters)
	const capeGeo = new THREE.CylinderGeometry( 1.02, 1.25, 1.6, 32, 10, true, Math.PI * 0.45, Math.PI * 1.1 );
	capeGeo.translate( 0, - 0.55, 0 );
	const cape = add( new THREE.Mesh( capeGeo, toon( '#ff6b81', { side: THREE.DoubleSide } ) ) );
	addOutline( cape, 0.02 );
	const capeBase = ( capeGeo.attributes.position.array as Float32Array ).slice();
	const capeCollar = new THREE.Mesh( new THREE.TorusGeometry( 1.0, 0.07, 10, 40 ), toon( '#ffd36e' ) );
	capeCollar.rotation.x = Math.PI / 2; capeCollar.position.y = 0.25; cape.add( capeCollar );

	// launch pad
	const pad = add( new THREE.Group() );
	{
		const base = new THREE.Mesh( new THREE.CylinderGeometry( 1.8, 2.1, 0.35, 48 ), toon( '#c9d6ff' ) ); addOutline( base, 0.03 );
		const top = new THREE.Mesh( new THREE.CylinderGeometry( 1.2, 1.2, 0.08, 48 ), toon( '#ffe07a' ) ); top.position.y = 0.21;
		const tower = new THREE.Mesh( new THREE.BoxGeometry( 0.25, 3.4, 0.25 ), toon( '#ffb8d2' ) ); tower.position.set( - 1.45, 1.7, - 0.2 ); addOutline( tower, 0.03 );
		const arm = new THREE.Mesh( new THREE.BoxGeometry( 0.7, 0.12, 0.12 ), toon( '#ffb8d2' ) ); arm.position.set( - 1.1, 2.4, - 0.2 ); addOutline( arm, 0.02 );
		const ground = new THREE.Mesh( new THREE.SphereGeometry( 12, 64, 32 ), toon( '#6f7fd6' ) ); ground.position.y = - 12.0; addOutline( ground, 0.01 );
		pad.add( ground, base, top, tower, arm );
	}

	// fast-food menu board
	const menu = add( new THREE.Mesh( new THREE.PlaneGeometry( 1, 1.25 ), new THREE.MeshBasicMaterial( { map: boardTexture( [
		{ text: '★ PLANET MENU ★', color: '#ffd36e', size: 84 }, { text: '', size: 30 },
		{ text: 'SMALL', color: '#a8f0c8', size: 78 }, { text: 'Mercury · Venus', size: 54 }, { text: 'Earth · Mars', size: 54 }, { text: '', size: 30 },
		{ text: 'MEDIUM', color: '#ffb8d2', size: 78 }, { text: 'super-Earth', size: 54 }, { text: '', size: 30 },
		{ text: 'LARGE', color: '#8fd6ff', size: 78 }, { text: 'Jupiter · Saturn', size: 54 }, { text: 'Uranus · Neptune', size: 54 },
	] ), transparent: true } ) ) );
	const fries = add( new THREE.Group() );
	{
		const box = new THREE.Mesh( new THREE.CylinderGeometry( 0.5, 0.36, 0.8, 4, 1 ), toon( '#ff6b81' ) );
		box.rotation.y = Math.PI / 4; addOutline( box, 0.04 );
		fries.add( box );
		const r = rng( 3 );
		for ( let i = 0; i < 9; i ++ ) {
			const f = new THREE.Mesh( new THREE.BoxGeometry( 0.09, 0.7, 0.09 ), toon( '#ffd36e' ) );
			f.position.set( ( r() - .5 ) * 0.5, 0.45 + r() * 0.15, ( r() - .5 ) * 0.4 ); f.rotation.z = ( r() - .5 ) * 0.5;
			addOutline( f, 0.02 ); fries.add( f );
		}
	}

	// bathroom scale with a dial
	const scale = add( new THREE.Group() );
	const needle = new THREE.Mesh( new THREE.BoxGeometry( 0.025, 0.17, 0.01 ), new THREE.MeshBasicMaterial( { color: '#ff4d6d' } ) );
	{
		const base = new THREE.Mesh( new THREE.BoxGeometry( 1.6, 0.5, 1.2, 1, 1, 1 ), toon( '#dfe8ff' ) ); base.position.y = 0.25; addOutline( base, 0.03 );
		const top = new THREE.Mesh( new THREE.BoxGeometry( 1.4, 0.04, 1.0 ), toon( '#b6c6ff' ) ); top.position.y = 0.52;
		const [ c, g ] = canvas( 256, 256 );
		g.fillStyle = '#fff'; g.beginPath(); g.arc( 128, 128, 120, 0, 7 ); g.fill(); g.lineWidth = 10; g.strokeStyle = PALETTE.ink; g.stroke();
		g.font = '700 30px Fredoka, sans-serif'; g.fillStyle = PALETTE.ink; g.textAlign = 'center';
		for ( let i = 0; i < 12; i ++ ) { const a = i / 12 * Math.PI * 2; g.fillRect( 128 + Math.cos( a ) * 95 - 3, 128 + Math.sin( a ) * 95 - 3, 6, 6 ); }
		g.fillText( 'kg', 128, 190 );
		// dial on the front face, facing the camera
		const dial = new THREE.Mesh( new THREE.CircleGeometry( 0.21, 32 ), new THREE.MeshBasicMaterial( { map: tex( c ) } ) );
		dial.position.set( 0, 0.25, 0.605 );
		needle.geometry.translate( 0, 0.08, 0 );
		needle.scale.set( 1, 0.9, 1 );
		needle.position.set( 0, 0.25, 0.615 );
		scale.add( base, top, dial, needle );
	}

	// giant stairs
	const stairs = add( new THREE.Group() );
	for ( let i = 0; i < 6; i ++ ) {
		const s = new THREE.Mesh( new THREE.BoxGeometry( 1.2, 0.5 * ( i + 1 ), 2 ), toon( i % 2 ? '#c9d6ff' : '#b6c6ff' ) );
		s.position.set( i * 1.2, 0.25 * ( i + 1 ), 0 ); addOutline( s, 0.02 );
		stairs.add( s );
	}

	// puffs: smoke (grey), clouds (white)
	const smokes = [ 0, 1, 2, 3, 4, 5 ].map( ( i ) => add( puff( '#cfcbe0', 300 + i, 4, 0.08 ) ) );
	const clouds = [ 0, 1, 2, 3 ].map( ( i ) => add( puff( '#ffffff', 200 + i ) ) );

	// jacket layers that wrap Luna (in the overlay, drawn over her sprite)
	const jackets = add( new THREE.Group(), overlay );
	{
		const cols = [ '#ff8fab', '#8fd6ff', '#ffe07a', '#a8f0c8', '#c7a6ff', '#ffb27a', '#8fa8ff', '#ffb8d2', '#9be3c8', '#ffd1a8' ];
		for ( let i = 0; i < 10; i ++ ) {
			const g = new THREE.Group();
			const ball = new THREE.Mesh( new THREE.SphereGeometry( 1, 32, 16 ), new THREE.MeshBasicMaterial( { color: cols[ i ], depthTest: false, depthWrite: false } ) );
			const shade = new THREE.Mesh( new THREE.CircleGeometry( 1, 32 ), new THREE.MeshBasicMaterial( { color: '#000000', transparent: true, opacity: 0.12, depthTest: false, depthWrite: false } ) );
			const hl = new THREE.Mesh( new THREE.CircleGeometry( 0.25, 16 ), new THREE.MeshBasicMaterial( { color: '#ffffff', transparent: true, opacity: 0.7, depthTest: false, depthWrite: false } ) );
			const ol = new THREE.Mesh( new THREE.CircleGeometry( 1.06, 32 ), new THREE.MeshBasicMaterial( { color: PALETTE.ink, depthTest: false, depthWrite: false } ) );
			shade.position.set( 0.15, - 0.25, 0.9 ); shade.scale.set( 0.9, 0.7, 1 );
			hl.position.set( - 0.4, 0.45, 1.01 );
			// quilted stitch lines
			const stitch = new THREE.Mesh( new THREE.TorusGeometry( 0.98, 0.025, 6, 40, Math.PI ), new THREE.MeshBasicMaterial( { color: PALETTE.ink, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false } ) );
			stitch.rotation.z = Math.PI; stitch.scale.set( 1, 0.25, 1 ); stitch.position.z = 1.0;
			ol.renderOrder = 22 + i * 3; ball.renderOrder = 23 + i * 3; shade.renderOrder = 24 + i * 3; hl.renderOrder = 24 + i * 3; stitch.renderOrder = 24 + i * 3;
			g.add( ol, ball, shade, hl, stitch );
			jackets.add( g );
		}
	}

	// underwater: particles, god rays, helmet light
	const SEA = 600;
	const seaGeo = new THREE.BufferGeometry();
	seaGeo.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array( SEA * 3 ), 3 ) );
	const sea = add( new THREE.Points( seaGeo, new THREE.PointsMaterial( { size: 0.06, color: '#9fd8ff', map: radialTexture(), transparent: true, depthWrite: false, opacity: 0.7, blending: THREE.AdditiveBlending } ) ) );
	sea.frustumCulled = false;
	const seaSeed = ( () => { const r = rng( 808 ); return Array.from( { length: SEA }, () => [ r(), r(), r(), r() ] ); } )();
	const rays = add( new THREE.Group() );
	for ( let i = 0; i < 6; i ++ ) {
		const m = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: radialTexture( 'rgba(160,220,255,0.5)', 'rgba(160,220,255,0)' ), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } ) );
		rays.add( m );
	}
	const helmetGlow = add( new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: radialTexture( 'rgba(200,235,255,0.4)', 'rgba(120,180,255,0)' ), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } ) ) );
	const beam = add( new THREE.Mesh( new THREE.ConeGeometry( 1, 4, 32, 1, true ), new THREE.ShaderMaterial( {
		uniforms: { uOpacity: { value: 0.35 } },
		vertexShader: `varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
		fragmentShader: `uniform float uOpacity; varying float vY; void main(){ float f = smoothstep(-2., 2., vY); gl_FragColor = vec4(vec3(0.75,0.9,1.0)*f*uOpacity, f*uOpacity); }`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	} ) ) );
	beam.geometry.translate( 0, - 2, 0 );

	// the creature: only ever a shadow and two eyes
	const shadowTex = radialTexture( 'rgba(2,4,14,0.92)', 'rgba(2,4,14,0)', 256 );
	const creatureShadow = add( new THREE.Mesh( new THREE.PlaneGeometry( 2.2, 1 ), new THREE.MeshBasicMaterial( { map: shadowTex, transparent: true, depthWrite: false } ) ) );
	const eyeTex = ( () => {
		const [ c, g ] = canvas( 256, 128 );
		const grd = g.createRadialGradient( 128, 64, 4, 128, 64, 62 );
		grd.addColorStop( 0, '#fffbd0' ); grd.addColorStop( 0.5, '#e8ff7a' ); grd.addColorStop( 1, 'rgba(160,255,120,0)' );
		g.fillStyle = grd; g.beginPath(); g.ellipse( 128, 64, 120, 60, 0, 0, 7 ); g.fill();
		g.fillStyle = '#0b1020'; g.beginPath(); g.ellipse( 128, 64, 10, 48, 0, 0, 7 ); g.fill();
		return tex( c );
	} )();
	const eyes = add( new THREE.Group() );
	for ( let i = 0; i < 2; i ++ ) {
		const e = new THREE.Mesh( new THREE.PlaneGeometry( 1, 0.5 ), new THREE.MeshBasicMaterial( { map: eyeTex, transparent: true, depthWrite: false, color: new THREE.Color( 1.6, 1.6, 1.6 ) } ) );
		e.position.x = ( i ? 1 : - 1 ) * 0.9;
		eyes.add( e );
	}

	// ship interior
	const interior = add( new THREE.Group() );
	{
		const wall = new THREE.Mesh( new THREE.CylinderGeometry( 4, 4, 6, 48, 1, true, Math.PI * 0.6, Math.PI * 0.8 ), toon( '#dfe6ff', { side: THREE.BackSide } ) );
		wall.rotation.y = Math.PI;
		const floor = new THREE.Mesh( new THREE.CylinderGeometry( 4, 4, 0.2, 48 ), toon( '#b6c6ff' ) ); floor.position.y = - 1.6;
		const portRing = new THREE.Mesh( new THREE.TorusGeometry( 0.9, 0.14, 12, 48 ), toon( '#9cc0ff' ) ); portRing.position.set( 0, 0.9, - 3.4 ); addOutline( portRing, 0.02 );
		const portHole = new THREE.Mesh( new THREE.CircleGeometry( 0.9, 48 ), new THREE.MeshBasicMaterial( { color: '#141a44' } ) ); portHole.position.set( 0, 0.9, - 3.42 );
		const portStars = starfield( 40, 7, 1 ); portStars.scale.setScalar( 0.75 ); portStars.position.set( 0, 0.9, - 3.4 ); portStars.scale.z = 0.01;
		const seat = new THREE.Mesh( new THREE.CapsuleGeometry( 0.7, 0.6, 8, 16 ), toon( '#ffb8d2' ) ); seat.rotation.z = Math.PI / 2; seat.position.set( 0, - 1.1, - 1.5 ); addOutline( seat, 0.03 );
		const panel = new THREE.Mesh( new THREE.BoxGeometry( 2.2, 0.5, 0.4 ), toon( '#c7a6ff' ) ); panel.position.set( 2.2, - 0.9, - 2.4 ); panel.rotation.y = - 0.6; addOutline( panel, 0.03 );
		const lights = [ '#ff8fab', '#a8f0c8', '#ffe07a' ].map( ( c, i ) => { const b = new THREE.Mesh( new THREE.SphereGeometry( 0.08, 12, 8 ), new THREE.MeshBasicMaterial( { color: new THREE.Color( c ).multiplyScalar( 1.6 ) } ) ); b.position.set( 1.9 + i * 0.3, - 0.6, - 2.1 + i * 0.2 ); return b; } );
		interior.add( wall, floor, portRing, portHole, portStars, seat, panel, ...lights );
	}

	// night hill
	const hill = add( new THREE.Group() );
	{
		const h = new THREE.Mesh( new THREE.SphereGeometry( 9, 64, 32 ), toon( '#2e3a78' ) );
		h.position.y = - 9; addOutline( h, 0.004, '#0b0f2a' );
		const h2 = new THREE.Mesh( new THREE.SphereGeometry( 14, 64, 32 ), toon( '#232d63' ) ); h2.position.set( 9, - 14.6, - 6 );
		const moon = new THREE.Mesh( new THREE.CircleGeometry( 0.7, 40 ), new THREE.MeshBasicMaterial( { color: new THREE.Color( '#fff4d6' ).multiplyScalar( 1.4 ) } ) );
		moon.position.set( - 4, 5, - 12 );
		const moonGlow = new THREE.Mesh( new THREE.PlaneGeometry( 6, 6 ), new THREE.MeshBasicMaterial( { map: radialTexture( 'rgba(255,240,210,0.5)', 'rgba(255,240,210,0)' ), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } ) );
		moonGlow.position.copy( moon.position ).z -= 0.1;
		const r = rng( 61 );
		for ( let i = 0; i < 14; i ++ ) {
			const tuft = new THREE.Mesh( new THREE.ConeGeometry( 0.06, 0.3, 5 ), toon( '#4b5ba8' ) );
			const a = ( r() - .5 ) * 0.7;
			tuft.position.set( Math.sin( a ) * 9, - 9 + Math.cos( a ) * 9 + 0.1, ( r() - .5 ) * 2 ); tuft.rotation.z = - a;
			hill.add( tuft );
		}
		hill.add( h2, h, moonGlow, moon );
	}

	// pop bursts (billboards)
	const bursts = [ burstTexture( '#ffe07a' ), burstTexture( '#ffb8d2', '#fff0f6', 12 ), burstTexture( '#a8f0c8', '#effff6', 16 ) ].map( ( t ) => add( new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: t, transparent: true, depthWrite: false } ) ) ) );

	const ship = new Ship();
	add( ship.group );

	return {
		scene, overlay, all, hemi, key, neb, stars, milky, P, mystery, iceCut, star, sun, crowd, crowdOutline, crowdData, hostStars, solar, solarBalls,
		cape, capeBase, pad, menu, fries, scale, needle, stairs, smokes, clouds, jackets, sea, seaSeed, rays, helmetGlow, beam,
		creatureShadow, eyes, interior, hill, bursts, ship,
		hideAll() { for ( const o of all ) o.visible = false; },
	};
}
