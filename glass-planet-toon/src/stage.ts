// Per-frame context shared by all scenes: camera framing for both aspect ratios,
// screen<->world helpers, layout slots (captions, stats, host) per output format.
import * as THREE from 'three';
import { spring, wobble } from './engine/math';
import type { Hud } from './engine/hud';
import type { Host, HostState, Pose, Expr } from './host';
import type { World } from './world';

export type Mode = 'vertical' | 'wide';
export const SIZES: Record<Mode, [ number, number ]> = { vertical: [ 1080, 1920 ], wide: [ 1920, 1080 ] };

export interface Layout {
	/** key visual centre in NDC */
	focus: { x: number; y: number };
	statY: number; statSize: number; titleY: number; titleSize: number;
	capX: number; capY: number; capW: number; capSize: number; capWords: number;
	/** host feet slot in NDC (left / right variants) */
	hostY: number; hostXL: number; hostXR: number;
	/** host sprite height as a fraction of the frame height (NDC units, 2 = full) */
	hostH: number;
	/** side panel x for cards / labels (px) */
	sideX: number;
}

export const LAYOUTS: Record<Mode, Layout> = {
	// TikTok: keep text out of the top bar (~0-180px), right rail (~x>900) and bottom sheet (~y>1600).
	vertical: {
		focus: { x: 0, y: 0.3 }, statY: 300, statSize: 150, titleY: 330, titleSize: 96,
		capX: 470, capY: 1420, capW: 740, capSize: 64, capWords: 7,
		hostY: - 0.3, hostXL: - 0.52, hostXR: 0.4, hostH: 0.36, sideX: 540,
	},
	wide: {
		focus: { x: 0.12, y: 0.08 }, statY: 150, statSize: 128, titleY: 170, titleSize: 96,
		capX: 960, capY: 960, capW: 1180, capSize: 56, capWords: 10,
		hostY: - 0.8, hostXL: - 0.78, hostXR: 0.76, hostH: 0.62, sideX: 1500,
	},
};

const tmp = new THREE.Vector3();

export class Stage {
	camera = new THREE.PerspectiveCamera( 40, 1, 0.05, 2000 );
	mode: Mode = 'vertical';
	L: Layout = LAYOUTS.vertical;
	W = 1080; H = 1920;
	camDist = 10;
	t = 0;
	/** start of the current scene (set by the director) */
	t0 = 0; t1 = 0;
	flash = 0; shimmer = 0;
	/** x (px) of stats / titles; scenes may move it aside in wide shots */
	sx = 540;
	hostState: HostState | null = null;

	constructor( public w: World, public hud: Hud, public host: Host ) {}

	setMode( mode: Mode ) {
		this.mode = mode; this.L = LAYOUTS[ mode ];
		[ this.W, this.H ] = SIZES[ mode ];
		this.camera.aspect = this.W / this.H;
		this.camera.updateProjectionMatrix();
	}
	get V() { return this.mode === 'vertical'; }
	get lt() { return this.t - this.t0; }
	get dur() { return this.t1 - this.t0; }
	pick<T>( vertical: T, wide: T ) { return this.V ? vertical : wide; }

	private halfV() { return THREE.MathUtils.degToRad( this.camera.fov / 2 ); }

	/**
	 * Frame a sphere of `radius` around `center` so it fits in both aspect ratios,
	 * placing it at `focus` (NDC). `punch` adds a springy zoom on scene cuts.
	 */
	frame( center: THREE.Vector3, radius: number, focus = this.L.focus, punchAt = this.t0 ) {
		const hv = this.halfV(), hh = Math.atan( Math.tan( hv ) * this.camera.aspect );
		const r = radius * ( 1 + 0.1 * wobble( this.t - punchAt, 1.6, 4.5 ) );
		const dist = r / Math.sin( Math.min( hv, hh ) );
		const halfH = dist * Math.tan( hv ), halfW = halfH * this.camera.aspect;
		this.camDist = dist;
		this.camera.position.set( center.x - focus.x * halfW, center.y - focus.y * halfH, center.z + dist );
		this.camera.quaternion.identity();
		this.camera.updateMatrixWorld();
		this.w.stars.position.copy( this.camera.position );
		this.w.neb.position.set( this.camera.position.x * 0.9, this.camera.position.y * 0.9, this.camera.position.z - 200 );
	}

	/**
	 * Framing for "host standing on a sphere" shots. Vertical: sphere centred in the
	 * middle third. Wide: sphere right of centre, stats/title shifted left.
	 */
	sphereShot( center: THREE.Vector3, R: number, vertical: { radius: number; focusY: number } ) {
		if ( this.V ) { this.frame( center.clone().add( new THREE.Vector3( 0, R * 0.45, 0 ) ), vertical.radius * R, { x: 0, y: vertical.focusY } ); return; }
		this.frame( center.clone().add( new THREE.Vector3( 0, R * 0.45, 0 ) ), 2.5 * R, { x: 0.4, y: - 0.14 } );
		this.sx = this.W * 0.34;
	}

	/** world point at NDC (x,y) and distance `depth` in front of the camera */
	screen( x: number, y: number, depth = this.camDist ) {
		const hv = this.halfV();
		const halfH = depth * Math.tan( hv ), halfW = halfH * this.camera.aspect;
		return new THREE.Vector3( this.camera.position.x + x * halfW, this.camera.position.y + y * halfH, this.camera.position.z - depth );
	}
	/** world height of NDC span `h` at `depth` */
	worldH( h: number, depth = this.camDist ) { return h / 2 * 2 * depth * Math.tan( this.halfV() ); }
	/** world -> HUD pixels */
	px( v: THREE.Vector3 ) {
		tmp.copy( v ).project( this.camera );
		return { x: ( tmp.x * 0.5 + 0.5 ) * this.W, y: ( - tmp.y * 0.5 + 0.5 ) * this.H };
	}
	/** NDC -> HUD pixels */
	ndcPx( x: number, y: number ) { return { x: ( x * 0.5 + 0.5 ) * this.W, y: ( - y * 0.5 + 0.5 ) * this.H }; }

	/** white "cut" flash at each listed time */
	cuts( ...times: number[] ) {
		for ( const c of times ) if ( this.t >= c ) this.flash = Math.max( this.flash, 0.55 * Math.exp( - ( this.t - c ) * 16 ) );
	}

	/** Pose schedule: [[time, pose], ...] -> current pose + when it started (for the spring). */
	poses( list: [ number, Pose ][] ): { pose: Pose; poseAt: number } {
		let cur = list[ 0 ];
		for ( const p of list ) if ( this.t >= p[ 0 ] ) cur = p;
		return { pose: cur[ 1 ], poseAt: cur[ 0 ] };
	}
	bubbles( list: [ number, number, Expr ][] ) {
		for ( const [ a, b, e ] of list ) if ( this.t >= a && this.t <= b + 0.25 ) return { expr: e, t0: a, t1: b };
		return null;
	}

	/** Host standing in a screen slot (in front of the scene). */
	hostAt( x: number, y: number, s: Partial<HostState> & { pose: Pose }, float = 0 ) {
		const depth = this.camDist * 0.6;
		const height = this.worldH( this.L.hostH, depth );
		const fy = float ? Math.sin( this.t * 1.7 ) * 0.025 * float : 0;
		const pos = this.screen( x, y + fy, depth );
		this.hostState = { shadow: float ? 0.45 : 1, shadowDrop: float ? height * 0.12 : 0, ...s, pos, height, tilt: ( s.tilt ?? 0 ) + ( float ? Math.sin( this.t * 1.3 ) * 0.06 * float : 0 ) };
	}

	/** Host on top of a sphere at arc angle `a` (0 = top, + = right). Same on-screen size as hostAt. */
	hostOnSphere( center: THREE.Vector3, R: number, a: number, s: Partial<HostState> & { pose: Pose } ) {
		const depth = this.camera.position.z - center.z;
		const height = this.worldH( this.L.hostH, depth );
		const pos = new THREE.Vector3( center.x + Math.sin( a ) * R * 0.985, center.y + Math.cos( a ) * R * 0.985, center.z + R * 0.12 );
		this.hostState = { shadow: 0.9, ...s, pos, height, tilt: - a };
	}

	/** Host slot helper: left or right lower slot for this format. */
	slot( side: 'L' | 'R' ) { return { x: side === 'L' ? this.L.hostXL : this.L.hostXR, y: this.L.hostY }; }

	popScale( at: number ) { return spring( this.t - at ); }
}
