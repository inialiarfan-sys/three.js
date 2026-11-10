import * as THREE from 'three';

export const PALETTE = {
	navy: '#0f1438',
	ink: '#1a1f4d',
	cobalt: '#3657c9',
	periwinkle: '#8fa8ff',
	cream: '#fff3dc',
	peach: '#ffc9a3',
	orange: '#ff9a5c',
	cyan: '#c8f4ff',
	pink: '#ffb8d2',
	mint: '#a8f0c8',
	stink: '#9be36b',
	yellow: '#ffe07a',
	white: '#ffffff',
};

let _grad: THREE.DataTexture | null = null;
/** 3-step cel ramp (shadow, mid, lit). */
export function gradientMap() {
	if ( _grad ) return _grad;
	const data = new Uint8Array( [ 105, 185, 255 ] );
	_grad = new THREE.DataTexture( data, 3, 1, THREE.RedFormat );
	_grad.minFilter = _grad.magFilter = THREE.NearestFilter;
	_grad.generateMipmaps = false;
	_grad.needsUpdate = true;
	return _grad;
}

export function toon( color: THREE.ColorRepresentation, opts: THREE.MeshToonMaterialParameters = {} ) {
	return new THREE.MeshToonMaterial( { color, gradientMap: gradientMap(), ...opts } );
}

const outlineMats = new Map<string, THREE.MeshBasicMaterial>();
/** Inverted-hull outline material: pushes vertices along normals by `width` (object units). */
export function outlineMaterial( width: number, color: THREE.ColorRepresentation = PALETTE.ink ) {
	const key = width + '|' + color;
	let m = outlineMats.get( key );
	if ( m ) return m;
	m = new THREE.MeshBasicMaterial( { color, side: THREE.BackSide } );
	m.onBeforeCompile = ( s ) => {
		s.vertexShader = s.vertexShader.replace( '#include <begin_vertex>', `vec3 transformed = position + normalize( normal ) * ${ width.toFixed( 5 ) };` );
	};
	m.customProgramCacheKey = () => 'outline' + width;
	outlineMats.set( key, m );
	return m;
}

/** Adds an inverted-hull outline child that shares the geometry (smooth meshes). */
export function addOutline( mesh: THREE.Mesh, width: number, color: THREE.ColorRepresentation = PALETTE.ink ) {
	const o = new THREE.Mesh( mesh.geometry, outlineMaterial( width, color ) );
	o.name = 'outline';
	mesh.add( o );
	return o;
}

/** Outline for convex, origin-centered shapes with hard normals: scaled back-face copy. */
export function hullOutline( geo: THREE.BufferGeometry, scale = 1.12, color: THREE.ColorRepresentation = PALETTE.ink ) {
	const g = geo.clone();
	g.scale( scale, scale, scale );
	return { geometry: g, material: new THREE.MeshBasicMaterial( { color, side: THREE.BackSide } ) };
}

/** Toon sphere + outline in one call. */
export function toonBall( r: number, color: THREE.ColorRepresentation, outline = 0.04, seg = 48, opts: THREE.MeshToonMaterialParameters = {} ) {
	const mesh = new THREE.Mesh( new THREE.SphereGeometry( r, seg, seg / 2 ), toon( color, opts ) );
	if ( outline > 0 ) addOutline( mesh, r * outline );
	return mesh;
}

/** Soft fresnel rim shell (additive) used for atmospheres and glows. */
export function rimShell( r: number, color: THREE.ColorRepresentation, power = 2.5, intensity = 1.2 ) {
	const mat = new THREE.ShaderMaterial( {
		uniforms: { uColor: { value: new THREE.Color( color ) }, uPower: { value: power }, uIntensity: { value: intensity } },
		vertexShader: /* glsl */`
			varying vec3 vN; varying vec3 vV;
			void main(){
				vec4 mv = modelViewMatrix * vec4(position,1.);
				vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
				gl_Position = projectionMatrix * mv;
			}`,
		fragmentShader: /* glsl */`
			uniform vec3 uColor; uniform float uPower; uniform float uIntensity;
			varying vec3 vN; varying vec3 vV;
			void main(){
				float f = pow(1. - abs(dot(vN, vV)), uPower);
				f = floor(f * 3.0 + 0.35) / 3.0; // posterized rim = toon
				gl_FragColor = vec4(uColor * f * uIntensity, f);
			}`,
		transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
	} );
	return new THREE.Mesh( new THREE.SphereGeometry( r, 48, 24 ), mat );
}
