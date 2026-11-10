// Luna: a camera-facing sprite (billboard) in the 3D world with a toon drop shadow,
// a lagging cat, reaction bubbles and an optional silhouette/tint mode.
import * as THREE from 'three';
import { bubbleTexture, loadImage, shadowTexture } from './engine/textures';
import { clamp, popInOut, wobble } from './engine/math';
import type { Motion } from './motion';

export type Expr = 'happy' | 'excited' | 'angry' | 'sad' | 'surprised' | 'embarrassed' | 'crying' | 'sleepy' | 'confused' | 'dizzy' | 'thinking' | 'neutral';
const EXPRS: Expr[] = [ 'happy', 'excited', 'angry', 'sad', 'surprised', 'embarrassed', 'crying', 'sleepy', 'confused', 'dizzy', 'thinking', 'neutral' ];
export const SPRITES = [ 'astronaut', 'side', 'side_other', 'front', 'astronaut_sit', 'laptop_sit', 'crossed_arms', 'pointing', 'cheering', 'shy',
	'proud', 'waving', 'thinking', 'thumbs_up', 'peace', 'scared', 'nervous', 'gloomy', 'crying_pose', 'sad_pose', 'excited_pose',
	'confused_pose', 'surprised_pose', 'grumpy', 'love' ] as const;
export type SpriteName = typeof SPRITES[ number ] | 'casual' | 'winter' | 'back';

interface Meta { w: number; h: number; footX: number; footY: number }

export interface LunaState {
	sprite: SpriteName;
	/** feet position (world) */
	pos: THREE.Vector3;
	/** world height of the reference sprite (astronaut) */
	height: number;
	/** +1 facing right, -1 facing left */
	face?: number;
	motion: Motion;
	/** motion 0.1 s earlier, so the cat can lag behind */
	motionPrev?: Motion;
	poseAt?: number;
	bubble?: { expr: Expr; t0: number; t1: number; side?: 1 | -1 } | null;
	shadow?: number;
	/** extra in-plane tilt (e.g. standing on a sphere) */
	tilt?: number;
	alpha?: number;
	/** 0..1: dark silhouette with a soft rim (night stargazing) */
	silhouette?: number;
	/** cat fluff (0..1) */
	fluff?: number;
	visible?: boolean;
}

/** Fallbacks for sprites the sheets don't have (documented in README). */
const ALIAS: Record<string, string> = { casual: 'front', winter: 'astronaut', back: 'astronaut_sit' };

export class Luna {
	group = new THREE.Group();
	body = new THREE.Group(); // everything that moves with her (jackets attach here)
	sprite: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
	private shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
	private bubble: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
	private fluffs: THREE.Mesh[] = [];
	private tex = new Map<string, THREE.Texture>();
	private bubbles = new Map<string, THREE.Texture>();
	heads = new Map<Expr, HTMLImageElement>();
	meta: Record<string, Meta> = {};
	/** last frame's sprite rect in world units relative to feet (for props like jackets) */
	rect = { w: 1, h: 1 };

	constructor() {
		const geo = new THREE.PlaneGeometry( 1, 1 );
		geo.translate( 0, 0.5, 0 );
		this.sprite = new THREE.Mesh( geo, new THREE.ShaderMaterial( {
			uniforms: { map: { value: null }, uAlpha: { value: 1 }, uFlip: { value: 0 }, uCat: { value: 0 }, uCatY: { value: 0.82 }, uSil: { value: 0 }, uTex: { value: new THREE.Vector2( 1, 1 ) } },
			vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
			fragmentShader: /* glsl */`
				uniform sampler2D map; uniform float uAlpha, uFlip, uCat, uCatY, uSil; uniform vec2 uTex; varying vec2 vUv;
				vec4 samp(vec2 uv){
					if (uFlip > .5) uv.x = 1. - uv.x;
					// the cat (top band) lags behind her body: rotate that band around the helmet top
					float band = smoothstep(uCatY - .06, uCatY + .05, uv.y);
					vec2 piv = vec2(.5, uCatY);
					float a = -uCat * band;
					vec2 d = (uv - piv) * vec2(uTex.x/uTex.y, 1.);
					d = mat2(cos(a), -sin(a), sin(a), cos(a)) * d;
					uv = piv + d * vec2(uTex.y/uTex.x, 1.);
					return texture2D(map, uv);
				}
				void main(){
					vec4 c = samp(vUv);
					if (uSil > 0.) {
						// silhouette: dark navy body + soft periwinkle rim where alpha falls off
						float px = 3. / uTex.x, py = 3. / uTex.y;
						float mn = min(min(samp(vUv+vec2(px,0)).a, samp(vUv-vec2(px,0)).a), min(samp(vUv+vec2(0,py)).a, samp(vUv-vec2(0,py)).a));
						float rim = clamp((c.a - mn) * 3., 0., 1.);
						vec3 sil = mix(vec3(0.008,0.01,0.03), vec3(0.45,0.55,1.0), rim); // linear space (output is sRGB-encoded)
						c.rgb = mix(c.rgb, sil, uSil);
					}
					if (c.a < .03) discard;
					gl_FragColor = vec4(c.rgb, c.a * uAlpha);
					#include <colorspace_fragment>
				}`,
			transparent: true, depthTest: false, depthWrite: false,
		} ) );
		this.sprite.renderOrder = 21;
		this.shadow = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: shadowTexture(), transparent: true, depthTest: false, depthWrite: false } ) );
		this.shadow.renderOrder = 19;
		const bgeo = new THREE.PlaneGeometry( 1, 560 / 512 );
		bgeo.translate( 0, 0.5 * 560 / 512, 0 );
		this.bubble = new THREE.Mesh( bgeo, new THREE.MeshBasicMaterial( { transparent: true, depthTest: false, depthWrite: false } ) );
		this.bubble.renderOrder = 30;
		// fluffed-up cat: white puffs peeking out behind the cat
		for ( let i = 0; i < 9; i ++ ) {
			const m = new THREE.Mesh( new THREE.CircleGeometry( 1, 20 ), new THREE.MeshBasicMaterial( { color: '#fff6f0', depthTest: false, depthWrite: false, transparent: true } ) );
			const o = new THREE.Mesh( new THREE.CircleGeometry( 1.18, 20 ), new THREE.MeshBasicMaterial( { color: '#1a1f4d', depthTest: false, depthWrite: false, transparent: true } ) );
			o.position.z = - 0.001; m.add( o ); m.renderOrder = 20; o.renderOrder = 19;
			this.fluffs.push( m ); this.body.add( m );
		}
		this.body.add( this.sprite );
		this.group.add( this.shadow, this.body, this.bubble );
	}

	async load( base = '/character/' ) {
		this.meta = await ( await fetch( base + 'sprites.json' ) ).json();
		const loader = new THREE.TextureLoader();
		await Promise.all( SPRITES.map( async ( p ) => {
			const t = await loader.loadAsync( base + p + '.png' );
			t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
			this.tex.set( p, t );
		} ) );
		await Promise.all( EXPRS.map( async ( e ) => {
			const img = await loadImage( base + 'head_' + e + '.png' );
			this.heads.set( e, img );
			this.bubbles.set( e + '_L', bubbleTexture( img, true ) );
			this.bubbles.set( e + '_R', bubbleTexture( img, false ) );
		} ) );
	}

	resolve( name: SpriteName ) { return this.tex.has( name ) ? name : ALIAS[ name ] ?? 'astronaut'; }

	update( t: number, s: LunaState, camera: THREE.Camera ) {
		this.group.visible = s.visible !== false;
		if ( ! this.group.visible ) return;
		const name = this.resolve( s.sprite );
		const m = this.meta[ name ], ref = this.meta.astronaut;
		const k = s.height / ref.h;              // same px -> world scale for every sprite
		const w = m.w * k, h = m.h * k;
		const face = s.face ?? - 1;
		// side-view sprites face left; front-facing ones are mirrored only when asked to face right
		const flip = face > 0;
		const mo = s.motion;
		const pop = wobble( t - ( s.poseAt ?? - 99 ), 2.4, 6 );   // spring bounce on pose swap
		const sx = mo.sx * ( 1 + 0.14 * pop ), sy = mo.sy * ( 1 - 0.16 * pop );

		this.group.position.copy( s.pos );
		this.group.quaternion.copy( camera.quaternion );
		this.group.rotateZ( s.tilt ?? 0 );
		this.body.position.set( 0, mo.lift * s.height, 0 );
		// rot = "lean toward the facing direction": clockwise when facing right
		this.body.rotation.z = face > 0 ? - mo.rot : mo.rot;

		const footX = flip ? 1 - m.footX : m.footX;
		this.sprite.scale.set( w * sx, h * sy, 1 );
		this.sprite.position.set( ( 0.5 - footX ) * w * sx, - m.footY * h * sy, 0 );
		this.rect = { w: w * sx, h: h * sy * ( 1 - m.footY ) };
		const u = this.sprite.material.uniforms;
		u.map.value = this.tex.get( name );
		u.uFlip.value = flip ? 1 : 0;
		u.uAlpha.value = s.alpha ?? 1;
		u.uSil.value = s.silhouette ?? 0;
		u.uTex.value.set( m.w, m.h );
		// cat lag: difference between body rotation now and 0.1 s ago, plus a tiny idle sway
		const prevRot = s.motionPrev ? s.motionPrev.rot : mo.rot;
		const lag = ( prevRot - mo.rot ) * 1.6 + ( s.motionPrev ? ( s.motionPrev.lift - mo.lift ) * 0.6 : 0 );
		u.uCat.value = ( face > 0 ? 1 : - 1 ) * lag + Math.sin( t * 2.1 ) * 0.025;
		u.uCatY.value = name.includes( 'sit' ) ? 0.8 : 0.83;

		// fluffed-up cat puffs (behind the sprite, around the cat)
		const fl = s.fluff ?? 0;
		this.fluffs.forEach( ( f, i ) => {
			f.visible = fl > 0.01;
			if ( ! f.visible ) return;
			const a = Math.PI * ( 0.1 + 0.8 * i / ( this.fluffs.length - 1 ) );
			const cx = this.sprite.position.x, cy = h * sy * 0.9;
			const r = s.height * 0.045 * fl * ( 1 + 0.25 * Math.sin( t * 9 + i ) );
			f.position.set( cx + Math.cos( a ) * s.height * 0.13, cy + Math.sin( a ) * s.height * 0.06, - 0.002 );
			f.scale.setScalar( r );
		} );

		const sh = s.shadow ?? 1;
		this.shadow.visible = sh > 0.01;
		const shrink = 1 / ( 1 + mo.lift * 2.2 );
		this.shadow.scale.set( s.height * 0.6 * shrink * ( mo.sx ), s.height * 0.12 * shrink, 1 );
		this.shadow.position.set( 0, s.height * 0.01, - 0.01 );
		this.shadow.material.opacity = sh * ( s.alpha ?? 1 ) * shrink;

		const bub = s.bubble;
		const bp = bub ? popInOut( t, bub.t0, bub.t1 ) : 0;
		this.bubble.visible = bp > 0.001;
		if ( this.bubble.visible && bub ) {
			const size = s.height * 0.6 * bp;
			const side = bub.side ?? ( face > 0 ? - 1 : 1 );
			const map = this.bubbles.get( bub.expr + ( side < 0 ? '_L' : '_R' ) )!;
			if ( this.bubble.material.map !== map ) { this.bubble.material.map = map; this.bubble.material.needsUpdate = true; }
			this.bubble.scale.set( size, size, 1 );
			this.bubble.position.set( side * ( s.height * 0.22 + size * 0.5 ), s.height * 0.78 + mo.lift * s.height + Math.sin( t * 2.6 ) * s.height * 0.015, 0.001 );
			this.bubble.rotation.z = - side * ( 0.06 + Math.sin( ( t - bub.t0 ) * 3 ) * 0.04 );
			this.bubble.material.opacity = clamp( bp * 2 ) * ( s.alpha ?? 1 );
		}
	}
}
