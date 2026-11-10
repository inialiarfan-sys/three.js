// A cute rounded toon rocket built from code: pastel white body, soft-blue nose and
// fins, a round window showing Luna's face, a hinged door and a glowing engine.
import * as THREE from 'three';
import { addOutline, PALETTE, toon } from './engine/toon';
import { canvas, radialTexture, tex } from './engine/textures';
import type { Expr } from './luna';

export class Ship {
	group = new THREE.Group();   // position / rotation set by scenes
	private inner = new THREE.Group();
	private door: THREE.Group;
	private flame: THREE.Mesh;
	private flameCore: THREE.Mesh;
	private glow: THREE.Mesh;
	private windowMat: THREE.MeshBasicMaterial;
	private faces = new Map<string, THREE.Texture>();

	constructor() {
		// body: lathe of a rounded capsule
		const pts: THREE.Vector2[] = [];
		for ( let i = 0; i <= 24; i ++ ) {
			const a = i / 24;
			const y = - 1.1 + a * 2.6;
			const r = 0.62 * Math.pow( Math.sin( Math.PI * ( 0.08 + a * 0.84 ) ), 0.7 ) * ( a > 0.6 ? 1 - ( a - 0.6 ) * 0.9 : 1 );
			pts.push( new THREE.Vector2( Math.max( r, 0.02 ), y ) );
		}
		const body = new THREE.Mesh( new THREE.LatheGeometry( pts, 48 ), toon( '#fbfaff' ) );
		addOutline( body, 0.035 );
		// soft blue nose cap
		const nose = new THREE.Mesh( new THREE.SphereGeometry( 0.3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2 ), toon( '#9cc0ff' ) );
		nose.position.y = 1.18; nose.scale.set( 1, 1.25, 1 );
		addOutline( nose, 0.03 );
		// belly stripe
		const stripe = new THREE.Mesh( new THREE.TorusGeometry( 0.6, 0.06, 10, 48 ), toon( '#9cc0ff' ) );
		stripe.rotation.x = Math.PI / 2; stripe.position.y = - 0.45;
		// window
		const ring = new THREE.Mesh( new THREE.TorusGeometry( 0.3, 0.07, 12, 40 ), toon( '#9cc0ff' ) );
		ring.position.set( 0, 0.42, 0.56 ); ring.rotation.x = - 0.12;
		addOutline( ring, 0.02 );
		this.windowMat = new THREE.MeshBasicMaterial( { color: '#ffffff' } );
		const win = new THREE.Mesh( new THREE.CircleGeometry( 0.3, 40 ), this.windowMat );
		win.position.set( 0, 0.42, 0.565 ); win.rotation.x = - 0.12;
		const gloss = new THREE.Mesh( new THREE.CircleGeometry( 0.07, 16 ), new THREE.MeshBasicMaterial( { color: '#ffffff', transparent: true, opacity: 0.85 } ) );
		gloss.position.set( - 0.12, 0.56, 0.58 ); gloss.scale.set( 1, 0.6, 1 ); gloss.rotation.z = 0.6;
		// fins (rounded)
		const finShape = new THREE.Shape();
		finShape.moveTo( 0, 0 ); finShape.quadraticCurveTo( 0.55, - 0.1, 0.62, - 0.62 ); finShape.quadraticCurveTo( 0.3, - 0.5, 0, - 0.55 ); finShape.lineTo( 0, 0 );
		const finGeo = new THREE.ExtrudeGeometry( finShape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3 } );
		finGeo.translate( 0, 0, - 0.04 );
		for ( let i = 0; i < 3; i ++ ) {
			const f = new THREE.Mesh( finGeo, toon( '#9cc0ff' ) );
			addOutline( f, 0.02 );
			const g = new THREE.Group(); g.rotation.y = i * Math.PI * 2 / 3 + Math.PI / 2;
			f.position.set( 0.5, - 0.55, 0 );
			g.add( f ); this.inner.add( g );
		}
		// door (hinged on its left edge) on the front, below the window
		this.door = new THREE.Group();
		const doorShape = new THREE.Shape();
		const dw = 0.36, dh = 0.62, r = 0.16;
		doorShape.moveTo( 0, 0 ); doorShape.lineTo( dw, 0 ); doorShape.lineTo( dw, dh - r ); doorShape.quadraticCurveTo( dw, dh, dw - r, dh );
		doorShape.lineTo( r, dh ); doorShape.quadraticCurveTo( 0, dh, 0, dh - r ); doorShape.lineTo( 0, 0 );
		const doorMesh = new THREE.Mesh( new THREE.ExtrudeGeometry( doorShape, { depth: 0.04, bevelEnabled: false } ), toon( '#dfe8ff' ) );
		const doorEdge = new THREE.Mesh( new THREE.ExtrudeGeometry( doorShape, { depth: 0.03, bevelEnabled: false } ), new THREE.MeshBasicMaterial( { color: PALETTE.ink } ) );
		doorEdge.scale.set( 1.12, 1.08, 1 ); doorEdge.position.set( - 0.02, - 0.02, - 0.01 );
		this.door.add( doorEdge, doorMesh );
		this.door.position.set( - dw / 2, - 0.62, 0.6 );
		const doorHole = new THREE.Mesh( new THREE.ShapeGeometry( doorShape ), new THREE.MeshBasicMaterial( { color: '#1b2150' } ) );
		doorHole.position.set( - dw / 2, - 0.62, 0.595 );
		// engine bell + flame
		const bell = new THREE.Mesh( new THREE.CylinderGeometry( 0.22, 0.34, 0.25, 32, 1, true ), toon( '#c9d6ff', { side: THREE.DoubleSide } ) );
		bell.position.y = - 1.2;
		addOutline( bell, 0.02 );
		this.flame = new THREE.Mesh( new THREE.ConeGeometry( 0.28, 1, 24 ), toon( '#ffb27a', { emissive: '#ff8a4a', emissiveIntensity: 1.2 } ) );
		this.flame.rotation.x = Math.PI; this.flame.geometry.translate( 0, 0.5, 0 );
		addOutline( this.flame, 0.02 );
		this.flameCore = new THREE.Mesh( new THREE.ConeGeometry( 0.15, 1, 20 ), new THREE.MeshBasicMaterial( { color: new THREE.Color( '#fff2c4' ).multiplyScalar( 2.2 ) } ) );
		this.flameCore.rotation.x = Math.PI; this.flameCore.geometry.translate( 0, 0.5, 0 );
		this.flame.position.y = this.flameCore.position.y = - 1.3;
		this.glow = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: radialTexture( 'rgba(255,190,120,0.9)', 'rgba(255,150,90,0)' ), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } ) );
		this.glow.position.set( 0, - 1.5, 0.3 );
		this.inner.add( body, nose, stripe, ring, win, gloss, doorHole, this.door, bell, this.flame, this.flameCore, this.glow );
		this.group.add( this.inner );
	}

	/** Prepare round window textures with Luna's face for each expression. */
	setFaces( heads: Map<Expr, HTMLImageElement> ) {
		for ( const [ e, img ] of heads ) {
			const [ c, g ] = canvas( 256, 256 );
			g.fillStyle = '#cfe3ff'; g.fillRect( 0, 0, 256, 256 );
			const s = 250 / Math.max( img.width, img.height * 0.9 );
			g.drawImage( img, 128 - img.width * s / 2, 256 - img.height * s + 30, img.width * s, img.height * s );
			const grd = g.createLinearGradient( 0, 0, 256, 256 ); grd.addColorStop( 0, 'rgba(255,255,255,0.35)' ); grd.addColorStop( 0.5, 'rgba(255,255,255,0)' );
			g.fillStyle = grd; g.fillRect( 0, 0, 256, 256 );
			this.faces.set( e, tex( c ) );
		}
		const [ c, g ] = canvas( 64, 64 ); g.fillStyle = '#2a3270'; g.fillRect( 0, 0, 64, 64 );
		this.faces.set( 'empty', tex( c ) );
	}

	/** flame 0..1+, door 0 (closed) .. 1 (open), face = expression in the window or null */
	pose( t: number, o: { flame?: number; door?: number; face?: Expr | null; wobble?: number } ) {
		const fl = o.flame ?? 0;
		this.flame.visible = this.flameCore.visible = this.glow.visible = fl > 0.01;
		const flick = 1 + Math.sin( t * 41 ) * 0.12 + Math.sin( t * 23 ) * 0.08;
		this.flame.scale.set( 0.9 + fl * 0.3, fl * 1.4 * flick, 0.9 + fl * 0.3 );
		this.flameCore.scale.set( 1, fl * 0.9 * flick, 1 );
		this.glow.scale.setScalar( 1.6 + fl * 1.4 );
		this.door.rotation.y = - ( o.door ?? 0 ) * 1.9;
		const map = this.faces.get( o.face ?? 'empty' ) ?? this.faces.get( 'empty' )!;
		if ( this.windowMat.map !== map ) { this.windowMat.map = map; this.windowMat.needsUpdate = true; }
		const w = o.wobble ?? 0;
		this.inner.rotation.z = Math.sin( t * 9 ) * 0.03 * w;
	}
}
