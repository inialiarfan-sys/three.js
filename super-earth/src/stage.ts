// Per-frame context for scenes: camera framing for both formats, screen/world
// helpers, layout slots, and Luna placement helpers.
import * as THREE from 'three';
import { hash, spring, wobble } from './engine/math';
import type { Hud } from './engine/hud';
import type { Luna, LunaState, SpriteName, Expr } from './luna';
import { idle, type Motion } from './motion';
import type { World } from './world';

export type Mode = 'vertical' | 'wide';
export const SIZES: Record<Mode, [ number, number ]> = { vertical: [ 1080, 1920 ], wide: [ 1920, 1080 ] };

export interface Layout {
	focus: { x: number; y: number };
	statY: number; statSize: number; titleY: number; titleSize: number;
	capX: number; capY: number; capW: number; capSize: number; capWords: number;
	/** Luna slot (feet, NDC) */
	lunaY: number; lunaXL: number; lunaXR: number;
	/** Luna height as NDC span (2 = full frame height) */
	lunaH: number;
}

export const LAYOUTS: Record<Mode, Layout> = {
	// TikTok safe area: avoid top ~180px, right rail x>900, bottom sheet y>1600.
	vertical: {
		focus: { x: 0, y: 0.3 }, statY: 300, statSize: 120, titleY: 330, titleSize: 96,
		capX: 470, capY: 1420, capW: 740, capSize: 62, capWords: 7,
		lunaY: - 0.3, lunaXL: - 0.5, lunaXR: 0.38, lunaH: 0.34,
	},
	wide: {
		focus: { x: 0.1, y: 0.08 }, statY: 150, statSize: 104, titleY: 170, titleSize: 96,
		capX: 960, capY: 965, capW: 1180, capSize: 54, capWords: 10,
		lunaY: - 0.78, lunaXL: - 0.76, lunaXR: 0.74, lunaH: 0.6,
	},
};

const tmp = new THREE.Vector3();

export class Stage {
	camera = new THREE.PerspectiveCamera( 40, 1, 0.05, 2000 );
	mode: Mode = 'vertical';
	L: Layout = LAYOUTS.vertical;
	W = 1080; H = 1920;
	camDist = 10;
	t = 0; t0 = 0; t1 = 0;
	flash = 0; shimmer = 0; dim = 0; vignette = 0.38;
	sx = 540;
	luna: LunaState | null = null;

	constructor( public w: World, public hud: Hud, public lunaObj: Luna ) {}

	setMode( mode: Mode ) {
		this.mode = mode; this.L = LAYOUTS[ mode ];
		[ this.W, this.H ] = SIZES[ mode ];
		this.camera.aspect = this.W / this.H;
		this.camera.updateProjectionMatrix();
	}
	get V() { return this.mode === 'vertical'; }
	get lt() { return this.t - this.t0; }
	pick<T>( v: T, w: T ) { return this.V ? v : w; }
	private halfV() { return THREE.MathUtils.degToRad( this.camera.fov / 2 ); }

	/**
	 * Fit a sphere of `radius` around `center` in both aspect ratios, placed at `focus`
	 * (NDC). punchAt: springy zoom-punch time. shake: camera shake amount.
	 */
	frame( center: THREE.Vector3, radius: number, focus = this.L.focus, punchAt = this.t0, shake = 0, punch = 0.1 ) {
		const hv = this.halfV(), hh = Math.atan( Math.tan( hv ) * this.camera.aspect );
		const r = radius * ( 1 + punch * wobble( this.t - punchAt, 1.6, 4.5 ) );
		const dist = r / Math.sin( Math.min( hv, hh ) );
		const halfH = dist * Math.tan( hv ), halfW = halfH * this.camera.aspect;
		this.camDist = dist;
		const f = Math.floor( this.t * 30 );
		const sx = shake ? ( hash( f * 1.7 ) - .5 ) * shake * radius * 0.08 : 0, sy = shake ? ( hash( f * 3.1 + 9 ) - .5 ) * shake * radius * 0.08 : 0;
		this.camera.position.set( center.x - focus.x * halfW + sx, center.y - focus.y * halfH + sy, center.z + dist );
		this.camera.quaternion.identity();
		this.camera.rotation.z = shake ? ( hash( f * 5.3 ) - .5 ) * 0.02 * shake : 0;
		this.camera.updateMatrixWorld();
		this.w.stars.position.copy( this.camera.position );
		this.w.neb.position.set( this.camera.position.x * 0.9, this.camera.position.y * 0.9, this.camera.position.z - 200 );
	}

	/** Comedy zoom-punch: a stronger, snappier punch at time `at`. */
	punch( center: THREE.Vector3, radius: number, at: number, focus = this.L.focus ) {
		const k = this.t >= at ? wobble( this.t - at, 2.2, 5 ) : 0;
		this.frame( center, radius * ( 1 - 0.16 * k ), focus );
	}

	screen( x: number, y: number, depth = this.camDist ) {
		const halfH = depth * Math.tan( this.halfV() ), halfW = halfH * this.camera.aspect;
		tmp.set( x * halfW, y * halfH, - depth ).applyQuaternion( this.camera.quaternion );
		return this.camera.position.clone().add( tmp );
	}
	worldH( h: number, depth = this.camDist ) { return h * depth * Math.tan( this.halfV() ); }
	px( v: THREE.Vector3 ) {
		tmp.copy( v ).project( this.camera );
		return { x: ( tmp.x * 0.5 + 0.5 ) * this.W, y: ( - tmp.y * 0.5 + 0.5 ) * this.H };
	}

	cuts( ...times: number[] ) {
		for ( const c of times ) if ( this.t >= c ) this.flash = Math.max( this.flash, 0.5 * Math.exp( - ( this.t - c ) * 16 ) );
	}

	/** [[time, value], ...] -> current value + when it started */
	sched<T>( list: [ number, T ][] ): { v: T; at: number } {
		let cur = list[ 0 ];
		for ( const p of list ) if ( this.t >= p[ 0 ] ) cur = p;
		return { v: cur[ 1 ], at: cur[ 0 ] };
	}
	bubbles( list: [ number, number, Expr ][] ) {
		for ( const [ a, b, e ] of list ) if ( this.t >= a && this.t <= b + 0.25 ) return { expr: e, t0: a, t1: b };
		return null;
	}

	/** Luna height (world) at a given camera depth so she keeps the same on-screen size. */
	lunaHeight( depth = this.camDist ) { return this.worldH( this.L.lunaH, depth ); }

	/** Luna in a screen slot (NDC feet position), in front of the scene. */
	lunaAt( x: number, y: number, s: Partial<LunaState> & { sprite: SpriteName }, motion: ( t: number ) => Motion = idle ) {
		const depth = this.camDist * 0.6;
		const height = this.lunaHeight( depth );
		this.luna = { shadow: 1, ...s, pos: this.screen( x, y, depth ), height, motion: motion( this.t ), motionPrev: motion( this.t - 0.1 ) };
	}

	/** Luna at a world position (feet), sized to keep her on-screen size. */
	lunaWorld( pos: THREE.Vector3, s: Partial<LunaState> & { sprite: SpriteName }, motion: ( t: number ) => Motion = idle, sizeMul = 1 ) {
		const d = Math.max( 0.1, this.camera.position.z - pos.z ); // camera always looks down -z
		this.luna = { shadow: 1, ...s, pos: pos.clone(), height: this.lunaHeight( d ) * sizeMul, motion: motion( this.t ), motionPrev: motion( this.t - 0.1 ) };
	}

	/** Luna on top of a sphere at arc angle a (0 = top, + = right). */
	lunaOnSphere( center: THREE.Vector3, R: number, a: number, s: Partial<LunaState> & { sprite: SpriteName }, motion: ( t: number ) => Motion = idle ) {
		const pos = new THREE.Vector3( center.x + Math.sin( a ) * R * 0.985, center.y + Math.cos( a ) * R * 0.985, center.z + R * 0.12 );
		this.lunaWorld( pos, { ...s, tilt: - a }, motion );
	}

	slot( side: 'L' | 'R' ) { return { x: side === 'L' ? this.L.lunaXL : this.L.lunaXR, y: this.L.lunaY }; }
	pop( at: number ) { return spring( this.t - at ); }
}
