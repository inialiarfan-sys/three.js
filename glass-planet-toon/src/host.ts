// The chibi host: a camera-facing sprite plane living in the 3D world.
import * as THREE from 'three';
import { bubbleTexture, loadImage, shadowTexture } from './engine/textures';
import { clamp, popInOut, wobble } from './engine/math';

export type Expr = 'surprised' | 'dizzy' | 'happy' | 'thinking' | 'idea' | 'neutral';
interface SpriteMeta { w: number; h: number; footX: number; footY: number }

const POSES = [ 'astronaut', 'astronaut_sit', 'present_board', 'read_book', 'idea', 'chart', 'tablet', 'confused',
	'laptop_sit', 'star_board', 'thinking', 'shocked_wave', 'explain', 'hold_sign',
	'walk_1', 'walk_2', 'walk_3', 'walk_4', 'walk_5', 'walk_6', 'walk_7', 'walk_8' ] as const;
export type Pose = typeof POSES[ number ] | 'walk';
const EXPRS: Expr[] = [ 'surprised', 'dizzy', 'happy', 'thinking', 'idea', 'neutral' ];

const REF_PX = 359; // walk_1 height in px -> every sprite uses the same px->world scale

export interface HostState {
	pose: Pose;
	/** feet position in world space */
	pos: THREE.Vector3;
	/** world height of a REF_PX-tall sprite */
	height: number;
	/** true = facing right (sprites face left by default) */
	faceRight?: boolean;
	/** time the current pose started, for the spring bounce */
	poseAt?: number;
	/** shadow opacity 0..1 and drop below feet (world) */
	shadow?: number;
	shadowDrop?: number;
	bubble?: { expr: Expr; t0: number; t1: number; side?: 1 | -1 } | null;
	/** extra in-plane rotation (radians), e.g. tilt when standing on a curve */
	tilt?: number;
	visible?: boolean;
	alpha?: number;
	walkFps?: number;
}

export class Host {
	group = new THREE.Group();
	private sprite: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
	private shadow: THREE.Mesh;
	private bubble: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
	private tex = new Map<string, THREE.Texture>();
	private bubbles = new Map<string, THREE.Texture>();
	private meta: Record<string, SpriteMeta> = {};

	constructor() {
		const geo = new THREE.PlaneGeometry( 1, 1 );
		geo.translate( 0, 0.5, 0 );
		this.sprite = new THREE.Mesh( geo, new THREE.ShaderMaterial( {
			uniforms: { map: { value: null }, uTime: { value: 0 }, uAlpha: { value: 1 }, uFlip: { value: 0 } },
			vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
			fragmentShader: /* glsl */`
				uniform sampler2D map; uniform float uTime, uAlpha, uFlip; varying vec2 vUv;
				void main(){
					vec2 uv = vUv;
					if (uFlip > .5) uv.x = 1. - uv.x;
					// cat wobble: the top band of the sprite (the cat) sways gently
					float catBand = smoothstep(.80, .93, uv.y);
					uv.x += sin(uTime*4.2)*0.010*catBand;
					uv.y += max(0., sin(uTime*8.4))*0.004*catBand;
					vec4 c = texture2D(map, uv);
					if (c.a < .03) discard;
					gl_FragColor = vec4(c.rgb, c.a*uAlpha);
					#include <colorspace_fragment>
				}`,
			transparent: true, depthTest: false, depthWrite: false,
		} ) );
		this.sprite.renderOrder = 11;
		this.shadow = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: shadowTexture(), transparent: true, depthTest: false, depthWrite: false } ) );
		this.shadow.renderOrder = 10;
		const bgeo = new THREE.PlaneGeometry( 1, 560 / 512 );
		bgeo.translate( 0, 0.5 * 560 / 512, 0 );
		this.bubble = new THREE.Mesh( bgeo, new THREE.MeshBasicMaterial( { transparent: true, depthTest: false, depthWrite: false } ) );
		this.bubble.renderOrder = 12;
		this.group.add( this.shadow, this.sprite, this.bubble );
	}

	async load( base = '/character/' ) {
		this.meta = await ( await fetch( base + 'sprites.json' ) ).json();
		const loader = new THREE.TextureLoader();
		await Promise.all( POSES.map( async ( p ) => {
			const t = await loader.loadAsync( base + p + '.png' );
			t.colorSpace = THREE.SRGBColorSpace;
			t.anisotropy = 8;
			this.tex.set( p, t );
		} ) );
		await Promise.all( EXPRS.map( async ( e ) => {
			const img = await loadImage( base + 'head_' + e + '.png' );
			this.bubbles.set( e + '_L', bubbleTexture( img, true ) ); // bubble left of her, tail points right
			this.bubbles.set( e + '_R', bubbleTexture( img, false ) );
		} ) );
	}

	update( t: number, s: HostState, camera: THREE.Camera ) {
		const visible = s.visible !== false;
		this.group.visible = visible;
		if ( ! visible ) return;
		const fps = s.walkFps ?? 11;
		const name = s.pose === 'walk' ? `walk_${ ( Math.floor( t * fps ) % 8 ) + 1 }` : s.pose;
		const m = this.meta[ name ];
		const map = this.tex.get( name )!;
		const k = s.height / REF_PX;
		const w = m.w * k, h = m.h * k;
		const flip = !! s.faceRight;

		// breathing squash/stretch + spring bounce on pose change
		const breathe = Math.sin( t * Math.PI * 2 / 2.3 );
		const b = wobble( t - ( s.poseAt ?? - 99 ), 2.2, 5.5 );
		const walking = s.pose === 'walk';
		const bob = walking ? Math.abs( Math.sin( t * fps * Math.PI / 4 ) ) * 0.035 * s.height : 0;
		const sy = ( 1 + 0.018 * breathe ) * ( 1 - 0.16 * b );
		const sx = ( 1 - 0.012 * breathe ) * ( 1 + 0.12 * b );

		this.group.position.copy( s.pos );
		this.group.quaternion.copy( camera.quaternion );
		this.group.rotateZ( s.tilt ?? 0 );

		const footX = flip ? 1 - m.footX : m.footX;
		this.sprite.scale.set( w * sx, h * sy, 1 );
		this.sprite.position.set( ( 0.5 - footX ) * w * sx, bob - m.footY * h * sy, 0 );
		const mat = this.sprite.material;
		mat.uniforms.map.value = map;
		mat.uniforms.uTime.value = t;
		mat.uniforms.uFlip.value = flip ? 1 : 0;
		mat.uniforms.uAlpha.value = s.alpha ?? 1;

		const sh = s.shadow ?? 1;
		const drop = s.shadowDrop ?? 0;
		this.shadow.visible = sh > 0.01;
		const shrink = 1 / ( 1 + drop / s.height * 1.5 );
		this.shadow.scale.set( s.height * 0.62 * shrink * ( 1 - bob / s.height * 2 ), s.height * 0.13 * shrink, 1 );
		this.shadow.position.set( 0, - drop + s.height * 0.01, - 0.001 );
		( this.shadow.material as THREE.MeshBasicMaterial ).opacity = sh * ( s.alpha ?? 1 ) * shrink;

		// reaction bubble
		const bub = s.bubble;
		const pop = bub ? popInOut( t, bub.t0, bub.t1 ) : 0;
		this.bubble.visible = pop > 0.001;
		if ( this.bubble.visible && bub ) {
			const size = s.height * 0.62 * pop;
			// default: bubble behind her shoulder (sprites face left, so the right side)
			const side = bub.side ?? ( flip ? - 1 : 1 );
			const map = this.bubbles.get( bub.expr + ( side < 0 ? '_L' : '_R' ) )!;
			if ( this.bubble.material.map !== map ) { this.bubble.material.map = map; this.bubble.material.needsUpdate = true; }
			this.bubble.scale.set( size, size, 1 );
			this.bubble.position.set( side * ( s.height * 0.2 + size * 0.5 ), s.height * 0.8 + Math.sin( t * 2.6 ) * s.height * 0.015, 0.001 );
			this.bubble.rotation.z = - side * ( 0.06 + Math.sin( ( t - bub.t0 ) * 3 ) * 0.04 );
			this.bubble.material.opacity = clamp( pop * 2 ) * ( s.alpha ?? 1 );
		}
	}
}
