// Every 3D prop in the film. Built once (seeded), then posed from t by the scenes.
import * as THREE from 'three';
import { addOutline, hullOutline, PALETTE, rimShell, toon, toonBall } from './engine/toon';
import { bandTexture, burstTexture, earthTexture, glassPlanetTexture, puffTexture, radialTexture, sparkleTexture } from './engine/textures';
import { rng } from './engine/math';

const pastelStar = [ '#ffffff', '#ffe3f0', '#dfe6ff', '#fff2cc', '#d9fff3', '#ffd9c2' ];

function starfield( n = 1600, seed = 11 ) {
	const r = rng( seed );
	const pos = new Float32Array( n * 3 ), col = new Float32Array( n * 3 ), size = new Float32Array( n ), ph = new Float32Array( n );
	const c = new THREE.Color();
	for ( let i = 0; i < n; i ++ ) {
		const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt( 1 - u * u );
		pos.set( [ Math.cos( a ) * s * 300, u * 300, Math.sin( a ) * s * 300 ], i * 3 );
		c.set( pastelStar[ Math.floor( r() * pastelStar.length ) ] ); col.set( [ c.r, c.g, c.b ], i * 3 );
		size[ i ] = r() < 0.06 ? 9 + r() * 6 : 2.5 + r() * 4; ph[ i ] = r() * 10;
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute( 'position', new THREE.BufferAttribute( pos, 3 ) );
	geo.setAttribute( 'color', new THREE.BufferAttribute( col, 3 ) );
	geo.setAttribute( 'size', new THREE.BufferAttribute( size, 1 ) );
	geo.setAttribute( 'phase', new THREE.BufferAttribute( ph, 1 ) );
	const mat = new THREE.ShaderMaterial( {
		uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uOpacity: { value: 1 } },
		vertexShader: /* glsl */`
			attribute float size; attribute float phase; attribute vec3 color;
			uniform float uTime, uScale; varying vec3 vC; varying float vBig;
			void main(){
				vC = color; vBig = step(8., size);
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
				gl_PointSize = size * uScale * (0.75 + 0.25*sin(uTime*2.2 + phase*6.));
			}`,
		fragmentShader: /* glsl */`
			uniform float uOpacity; varying vec3 vC; varying float vBig;
			void main(){
				vec2 p = gl_PointCoord - .5;
				float d = length(p);
				float dot_ = smoothstep(.5, .3, d);
				// big ones get a 4-point twinkle cross
				float cross_ = vBig * max(smoothstep(.08,.0,abs(p.x))*smoothstep(.5,.1,abs(p.y)), smoothstep(.08,.0,abs(p.y))*smoothstep(.5,.1,abs(p.x)));
				float a = max(dot_ * (1. - vBig*.5), cross_);
				if (a < .02) discard;
				gl_FragColor = vec4(vC * 1.2, a * uOpacity);
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
	const mat = new THREE.PointsMaterial( { size: 0.32, vertexColors: true, map: radialTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 } );
	const g = new THREE.Group();
	g.add( new THREE.Points( geo, mat ) );
	const core = new THREE.Sprite( new THREE.SpriteMaterial( { map: radialTexture( 'rgba(255,236,210,1)', 'rgba(255,200,230,0)' ), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 } ) );
	core.scale.setScalar( 26 );
	g.add( core );
	return g;
}

/** Toon star: bright HDR core with outline, spiky corona and soft glow. */
function makeStar( core: string, glow: string, spikes: string ) {
	const g = new THREE.Group();
	const c = new THREE.Color( core ).multiplyScalar( 1.08 );
	// toon-shaded "sun ball": bright rim-to-centre ramp in 3 flat bands
	const ball = new THREE.Mesh( new THREE.SphereGeometry( 1, 48, 24 ), new THREE.ShaderMaterial( {
		uniforms: { uCore: { value: c }, uEdge: { value: new THREE.Color( spikes ) } },
		vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
		fragmentShader: `uniform vec3 uCore, uEdge; varying vec3 vN; varying vec3 vV;
			void main(){ float f = dot(vN, vV); float b = f > .75 ? 1. : f > .4 ? .6 : 0.;
				vec3 col = mix(uEdge, uCore, b) * (b > .9 ? 1.25 : 1.); gl_FragColor = vec4(col, 1.);
				#include <colorspace_fragment>
			}`,
	} ) );
	addOutline( ball, 0.035, '#a8532c' );
	const halo = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: radialTexture( glow, 'rgba(255,160,100,0)' ), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.45 } ) );
	halo.scale.setScalar( 5.5 ); halo.position.z = - 0.6;
	const corona = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: burstTexture( spikes, core, 18 ), transparent: true, depthWrite: false } ) );
	corona.scale.setScalar( 3.1 ); corona.position.z = - 0.5;
	g.add( halo, corona, ball );
	g.userData = { ball, halo, corona };
	return g;
}

function puff( color: string, seed: number, n = 6 ) {
	const r = rng( seed ), g = new THREE.Group();
	for ( let i = 0; i < n; i ++ ) {
		const s = 0.35 + r() * 0.35;
		const m = toonBall( s, color, 0.07, 24 );
		m.position.set( ( r() - .5 ) * 1.3, ( r() - .3 ) * 0.5, ( r() - .5 ) * 0.4 );
		g.add( m );
	}
	return g;
}

export type World = ReturnType<typeof buildWorld>;

export function buildWorld() {
	const scene = new THREE.Scene();
	scene.background = new THREE.Color( PALETTE.navy );
	const overlay = new THREE.Scene();
	const all: THREE.Object3D[] = [];
	const add = <T extends THREE.Object3D>( o: T, parent: THREE.Object3D = scene ) => { parent.add( o ); all.push( o ); return o; };

	// lights
	const hemi = new THREE.HemisphereLight( '#cfd8ff', '#2a2f6b', 1.3 );
	const key = new THREE.DirectionalLight( '#fff1e4', 2.8 );
	key.position.set( - 4, 3, 5 );
	scene.add( hemi, key, key.target );

	// backdrop: pastel nebula blobs on a far plane
	const neb = add( new THREE.Group() );
	{
		const r = rng( 77 );
		const cs = [ 'rgba(160,140,255,0.35)', 'rgba(255,150,200,0.22)', 'rgba(120,200,255,0.25)' ];
		for ( let i = 0; i < 7; i ++ ) {
			const m = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: radialTexture( cs[ i % 3 ], 'rgba(0,0,0,0)' ), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } ) );
			m.scale.setScalar( 90 + r() * 120 ); m.position.set( ( r() - .5 ) * 260, ( r() - .5 ) * 300, - 160 );
			neb.add( m );
		}
	}
	const stars = add( starfield() );

	const milky = add( galaxy() );

	// --- the glass planet ---
	const planet = add( new THREE.Group() );
	const planetRoll = new THREE.Group(); planet.add( planetRoll );
	const planetSpin = new THREE.Group(); planetRoll.add( planetSpin );
	planetSpin.rotation.z = 0.35;
	const planetMat = toon( '#ffffff', { map: glassPlanetTexture(), emissive: new THREE.Color( '#ff7a3c' ), emissiveIntensity: 0 } );
	const planetBall = new THREE.Mesh( new THREE.SphereGeometry( 1, 64, 32 ), planetMat );
	addOutline( planetBall, 0.03 );
	planetSpin.add( planetBall );
	const planetAtmo = rimShell( 1.07, '#a9c4ff', 2.2, 1.1 );
	planet.add( planetAtmo );
	const planetHeat = rimShell( 1.12, '#ff9a5c', 1.6, 0 );
	planet.add( planetHeat );
	// wind swirl arcs around the planet
	const windArcs = new THREE.Group(); planet.add( windArcs );
	{
		const r = rng( 5 );
		for ( let i = 0; i < 7; i ++ ) {
			const arc = new THREE.Mesh( new THREE.TorusGeometry( 1.18 + r() * 0.25, 0.022, 8, 48, 1.2 + r() * 1.4 ), toon( '#ffffff', { emissive: '#dfe8ff', emissiveIntensity: 0.4 } ) );
			addOutline( arc, 0.012 );
			arc.rotation.set( ( r() - .5 ) * 0.9, ( r() - .5 ) * 0.9, r() * 6 );
			arc.userData.speed = 2 + r() * 2;
			windArcs.add( arc );
		}
	}

	const star = add( makeStar( '#ffd2a8', 'rgba(255,170,110,0.9)', '#ffab6b' ) );
	const sun = add( makeStar( '#fff0b3', 'rgba(255,230,140,0.9)', '#ffd36e' ) );

	const earth = add( new THREE.Group() );
	{
		const ball = new THREE.Mesh( new THREE.SphereGeometry( 1, 64, 32 ), toon( '#ffffff', { map: earthTexture() } ) );
		addOutline( ball, 0.03 );
		earth.add( ball, rimShell( 1.07, '#bfe6ff', 2.2, 1.0 ) );
		earth.userData.ball = ball;
		const clouds = new THREE.Group();
		const r = rng( 9 );
		for ( let i = 0; i < 5; i ++ ) {
			const p = puff( '#ffffff', 40 + i, 4 );
			p.scale.setScalar( 0.22 );
			const a = r() * Math.PI * 2, b = ( r() - .5 ) * 1.6;
			p.position.setFromSphericalCoords( 1.08, Math.PI / 2 + b * 0.5, a );
			p.lookAt( 0, 0, 0 );
			clouds.add( p );
		}
		earth.add( clouds );
		earth.userData.clouds = clouds;
	}

	const jupiter = add( toonBall( 1, '#ffffff', 0.03, 64, { map: bandTexture( [ '#f3d3b0', '#e7b58c', '#fbe6cf', '#d99c7a', '#f6dcc0' ] ) } ) );

	// exoplanet crowd for the 6,000+ count
	const EXO = 70;
	const exoGeo = new THREE.SphereGeometry( 1, 24, 12 );
	const exos = add( new THREE.InstancedMesh( exoGeo, toon( '#ffffff' ), EXO ) );
	const exoOutline = new THREE.InstancedMesh( hullOutline( exoGeo, 1.09 ).geometry, hullOutline( exoGeo ).material, EXO );
	exos.add( exoOutline );
	exos.frustumCulled = exoOutline.frustumCulled = false;
	const exoData: { x: number; y: number; z: number; s: number; delay: number }[] = [];
	{
		const r = rng( 6000 );
		const pal = [ '#ffb8d2', '#a8f0c8', '#ffe07a', '#8fd6ff', '#c7a6ff', '#ffc9a3', '#8fa8ff', '#f7a8a8' ];
		for ( let i = 0; i < EXO; i ++ ) {
			const a = i * 2.39996, rad = 1.4 + Math.sqrt( i / EXO ) * 7.6; // golden-angle spread
			exoData.push( { x: Math.cos( a ) * rad * 1.25, y: Math.sin( a ) * rad, z: ( r() - .5 ) * 2, s: 0.18 + r() * 0.28, delay: i / EXO } );
			exos.setColorAt( i, new THREE.Color( pal[ i % pal.length ] ) );
		}
	}

	// glass shards
	const SH = 150;
	const shardGeo = new THREE.OctahedronGeometry( 1, 0 );
	shardGeo.scale( 0.35, 0.12, 1.0 );
	const shardMat = toon( PALETTE.cyan, { emissive: '#5fb8e6', emissiveIntensity: 0.12 } );
	const shards = add( new THREE.InstancedMesh( shardGeo, shardMat, SH ) );
	const ho = hullOutline( shardGeo, 1.18, '#2a4a8a' );
	const shardOutline = new THREE.InstancedMesh( ho.geometry, ho.material, SH );
	shards.add( shardOutline );
	shards.frustumCulled = shardOutline.frustumCulled = false;
	const shardData: { x: number; y: number; z: number; sp: number; rx: number; ry: number; s: number }[] = [];
	{
		const r = rng( 42 );
		for ( let i = 0; i < SH; i ++ ) shardData.push( { x: r(), y: r() * 2 - 1, z: r() * 2 - 1, sp: 0.7 + r() * 0.8, rx: r() * 6, ry: r() * 6, s: 0.5 + r() * 0.8 } );
	}
	const SP = 90;
	const sparkleGeo = new THREE.BufferGeometry();
	sparkleGeo.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array( SP * 3 ), 3 ) );
	const sparkles = add( new THREE.Points( sparkleGeo, new THREE.PointsMaterial( { map: sparkleTexture(), size: 0.5, color: new THREE.Color( '#ffffff' ).multiplyScalar( 1.15 ), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } ) ) );
	sparkles.frustumCulled = false;

	// puffs
	const stinks = [ 0, 1, 2, 3, 4 ].map( ( i ) => add( puff( PALETTE.stink, 100 + i ) ) );
	const clouds = [ 0, 1, 2, 3 ].map( ( i ) => add( puff( '#ffffff', 200 + i ) ) );

	// egg
	const egg = add( new THREE.Group() );
	{
		const e = toonBall( 1, '#fff3dc', 0.04, 48 );
		e.scale.set( 0.78, 1, 0.78 );
		egg.add( e );
		// zigzag crack
		const pts = [ [ - .7, .15 ], [ - .4, .35 ], [ - .15, .1 ], [ .1, .35 ], [ .35, .1 ], [ .62, .3 ] ].map( ( [ x, y ] ) => new THREE.Vector3( x, y, 0.82 ) );
		const crack = new THREE.Mesh( new THREE.TubeGeometry( new THREE.CatmullRomCurve3( pts, false, 'catmullrom', 0 ), 32, 0.035, 6 ), new THREE.MeshBasicMaterial( { color: PALETTE.ink } ) );
		egg.add( crack );
	}

	// James Webb (toon): gold hex mirror + pastel sunshield
	const webb = add( new THREE.Group() );
	{
		const hex = new THREE.CylinderGeometry( 0.3, 0.3, 0.08, 6 );
		hex.rotateX( Math.PI / 2 ); hex.rotateZ( Math.PI / 6 );
		const gold = toon( '#ffd36e', { emissive: '#ffb84d', emissiveIntensity: 0.25 } );
		const mirror = new THREE.Group();
		const hx = 0.3 * Math.sqrt( 3 ) + 0.03;
		const cells: [ number, number ][] = [];
		for ( let q = - 2; q <= 2; q ++ ) for ( let rr = - 2; rr <= 2; rr ++ ) {
			const s = - q - rr; if ( Math.max( Math.abs( q ), Math.abs( rr ), Math.abs( s ) ) > 1 && ! ( Math.abs( q ) <= 1 && Math.abs( rr ) <= 2 && Math.abs( s ) <= 2 ) ) continue;
			if ( Math.max( Math.abs( q ), Math.abs( rr ), Math.abs( s ) ) > 2 ) continue;
			cells.push( [ q, rr ] );
		}
		for ( const [ q, rr ] of cells.slice( 0, 18 ) ) {
			const m = new THREE.Mesh( hex, gold );
			m.position.set( hx * ( q + rr / 2 ), rr * 0.3 * 1.5 + 0.0, 0 );
			addOutline( m, 0.025 );
			mirror.add( m );
		}
		mirror.position.y = 0.9;
		const shield = new THREE.Group();
		[ '#ffb8d2', '#c7a6ff', '#8fa8ff' ].forEach( ( c, i ) => {
			const s = new THREE.Mesh( new THREE.CylinderGeometry( 2.0 - i * 0.15, 2.0 - i * 0.15, 0.05, 6 ), toon( c ) );
			s.scale.z = 0.55; s.position.y = - 0.35 - i * 0.14;
			addOutline( s, 0.03 );
			shield.add( s );
		} );
		const strut = new THREE.Mesh( new THREE.CylinderGeometry( 0.04, 0.04, 1.6 ), toon( '#dfe4ff' ) );
		strut.position.set( 0, 1.0, 0.8 ); strut.rotation.x = 0.6;
		const secondary = toonBall( 0.1, '#ffd36e', 0.08 );
		secondary.position.set( 0, 1.65, 1.2 );
		webb.add( shield, mirror, strut, secondary );
	}

	// H2S molecule
	const h2s = add( new THREE.Group() );
	{
		const S = toonBall( 0.55, '#ffe07a', 0.06 );
		const H1 = toonBall( 0.32, '#ffffff', 0.08 ); H1.position.set( - 0.75, - 0.5, 0 );
		const H2 = toonBall( 0.32, '#ffffff', 0.08 ); H2.position.set( 0.75, - 0.5, 0 );
		const bond = ( a: THREE.Vector3 ) => {
			const m = new THREE.Mesh( new THREE.CylinderGeometry( 0.08, 0.08, a.length() ), toon( '#dfe4ff' ) );
			m.position.copy( a ).multiplyScalar( 0.5 ); m.quaternion.setFromUnitVectors( new THREE.Vector3( 0, 1, 0 ), a.clone().normalize() );
			addOutline( m, 0.03 );
			return m;
		};
		h2s.add( bond( H1.position ), bond( H2.position ), S, H1, H2 );
	}

	// thermometer
	const thermo = add( new THREE.Group() );
	const thermoFill = new THREE.Mesh( new THREE.CylinderGeometry( 0.13, 0.13, 1, 16 ), toon( '#ff6b6b', { emissive: '#ff4d4d', emissiveIntensity: 0.4 } ) );
	{
		const glass = new THREE.Mesh( new THREE.CapsuleGeometry( 0.24, 2.4, 8, 24 ), toon( '#ffffff', { transparent: true, opacity: 0.55 } ) );
		addOutline( glass, 0.04 );
		const bulb = toonBall( 0.42, '#ff6b6b', 0.06, 32, { emissive: '#ff4d4d', emissiveIntensity: 0.4 } );
		bulb.position.y = - 1.45;
		thermoFill.geometry.translate( 0, 0.5, 0 );
		thermoFill.position.y = - 1.3;
		thermo.add( thermoFill, bulb, glass );
	}

	// sound-barrier rings
	const rings = add( new THREE.Group() );
	for ( let i = 0; i < 4; i ++ ) {
		const t = new THREE.Mesh( new THREE.TorusGeometry( 1, 0.05, 8, 64 ), toon( '#ffffff', { transparent: true } ) );
		addOutline( t, 0.03 );
		rings.add( t );
	}

	// transit light beams
	const beams = add( new THREE.Group() );
	{
		const bt = radialTexture( 'rgba(255,214,170,0.9)', 'rgba(255,214,170,0)' );
		for ( let i = 0; i < 7; i ++ ) {
			const m = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: bt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false } ) );
			beams.add( m );
		}
	}

	// dashed distance path
	const pathGeo = new THREE.BufferGeometry().setFromPoints( [ new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 1, 0, 0 ) ] );
	const path = add( new THREE.Line( pathGeo, new THREE.LineDashedMaterial( { color: '#ffe07a', dashSize: 0.3, gapSize: 0.2, linewidth: 1 } ) ) );
	// a fat dashed path out of little toon pills (Line width is 1px on most GPUs)
	const dashes = add( new THREE.InstancedMesh( new THREE.CapsuleGeometry( 0.06, 0.28, 4, 8 ), toon( '#ffe07a', { emissive: '#ffcf4d', emissiveIntensity: 0.3 } ), 60 ) );
	dashes.frustumCulled = false;

	// comic pop bursts (billboards)
	const burstTex = [ burstTexture( '#ffe07a' ), burstTexture( '#ffb8d2', '#fff0f6', 12 ), burstTexture( '#a8f0c8', '#effff6', 16 ) ];
	const bursts = [ 0, 1, 2 ].map( ( i ) => {
		const m = add( new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: burstTex[ i ], transparent: true, depthWrite: false } ) ) );
		return m;
	} );
	const stinkWave = add( new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: puffTexture( PALETTE.stink ), transparent: true, depthWrite: false } ) ) );

	return {
		scene, overlay, all, hemi, key, neb, stars, milky,
		planet, planetRoll, planetSpin, planetMat, planetAtmo, planetHeat, windArcs,
		star, sun, earth, jupiter, exos, exoOutline, exoData, shards, shardOutline, shardData, sparkles,
		stinks, clouds, egg, webb, h2s, thermo, thermoFill, rings, beams, path, dashes, bursts, stinkWave,
		hideAll() { for ( const o of all ) o.visible = false; },
	};
}
