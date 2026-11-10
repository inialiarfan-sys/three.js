// Posing helpers (pure in t).
import * as THREE from 'three';
import { clamp, hash, popInOut, spring, wrap } from './engine/math';
import type { Stage } from './stage';
import type { PlanetObj } from './world';

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s3 = new THREE.Vector3();
export const V3 = ( x = 0, y = 0, z = 0 ) => new THREE.Vector3( x, y, z );

export function planet( c: Stage, p: PlanetObj, pos: THREE.Vector3, R: number, o: { spin?: number; roll?: number; tilt?: number } = {} ) {
	p.group.visible = true;
	p.group.position.copy( pos );
	p.group.scale.setScalar( Math.max( 1e-4, R ) );
	p.spin.rotation.set( 0, c.t * ( o.spin ?? 0.25 ), o.tilt ?? 0.3 );
	p.group.rotation.z = o.roll ?? 0;
}

export function star( c: Stage, g: THREE.Group, pos: THREE.Vector3, R: number ) {
	g.visible = R > 1e-3;
	g.position.copy( pos ); g.scale.setScalar( Math.max( 1e-4, R ) );
	const { corona, halo } = g.userData as { corona: THREE.Mesh; halo: THREE.Mesh };
	corona.rotation.z = c.t * 0.25; corona.scale.setScalar( 3.1 * ( 1 + Math.sin( c.t * 3 ) * 0.04 ) );
	halo.scale.setScalar( 5.5 * ( 1 + Math.sin( c.t * 2.1 ) * 0.03 ) );
}

export function burst( c: Stage, i: number, pos: THREE.Vector3, size: number, t0: number, t1 = t0 + 1.0 ) {
	const b = c.w.bursts[ i ];
	const s = popInOut( c.t, t0, t1, 0.25 );
	b.visible = s > 0.001;
	if ( ! b.visible ) return;
	b.position.copy( pos ); b.scale.setScalar( size * s );
	b.rotation.z = ( c.t - t0 ) * 0.8 + i;
}

/** Planet crowd around tiny stars. superOnly: >0 tints non-super-Earths down. */
export function crowd( c: Stage, center: THREE.Vector3, scale: number, t0: number, spread = 2, dimOthers = 0, out = Infinity ) {
	const w = c.w; w.crowd.visible = true; w.hostStars.visible = true;
	w.hostStars.position.copy( center ); w.hostStars.scale.setScalar( scale );
	const col = new THREE.Color();
	w.crowdData.forEach( ( d, i ) => {
		const k = popInOut( c.t, t0 + d.delay * spread, out + d.delay * 0.3 );
		const s = k * d.s * scale * ( d.superE ? 1 : 1 - dimOthers * 0.5 );
		v.set( center.x + d.x * scale, center.y + d.y * scale + Math.sin( c.t * 1.3 + i ) * 0.04 * scale, center.z + d.z * scale );
		e.set( 0, c.t * 0.5 + i, 0.3 ); q.setFromEuler( e ); s3.setScalar( Math.max( 1e-4, s ) );
		m4.compose( v, q, s3 ); w.crowd.setMatrixAt( i, m4 ); w.crowdOutline.setMatrixAt( i, m4 );
		col.copy( d.color ); if ( ! d.superE ) col.lerp( new THREE.Color( '#4a5290' ), dimOthers * 0.7 );
		w.crowd.setColorAt( i, col );
	} );
	w.crowd.instanceMatrix.needsUpdate = true; w.crowdOutline.instanceMatrix.needsUpdate = true;
	if ( w.crowd.instanceColor ) w.crowd.instanceColor.needsUpdate = true;
}

/** Smoke/cloud puffs: list drift around center. */
export function puffs( c: Stage, list: THREE.Group[], center: THREE.Vector3, span: number, speed: number, size: number, amount = 1, seed = 1 ) {
	list.forEach( ( p, i ) => {
		const k = hash( i + seed * 10 );
		const s = clamp( amount * list.length - i ) * size * ( 0.7 + k * 0.6 );
		p.visible = s > 0.001;
		if ( ! p.visible ) return;
		p.position.set( center.x + wrap( ( k - 0.5 ) * span * 2 + c.t * speed * ( 0.8 + k * 0.4 ), - span, span ), center.y + ( hash( i + 7 ) - 0.5 ) * span * 0.5 + Math.sin( c.t * 1.5 + i ) * 0.1 * size, center.z + ( hash( i + 3 ) - 0.5 ) * span * 0.3 );
		const b = 1 + Math.sin( c.t * 3 + i * 2 ) * 0.06;
		p.scale.set( s * b, s / b, s );
	} );
}

/** One-shot smoke poofs at landing times (e.g. lava hops). */
export function poofs( c: Stage, times: number[], at: ( i: number ) => THREE.Vector3, size: number ) {
	const list = c.w.smokes;
	list.forEach( ( p ) => ( p.visible = false ) );
	let slot = 0;
	for ( let i = times.length - 1; i >= 0 && slot < list.length; i -- ) {
		const age = c.t - times[ i ];
		if ( age < 0 || age > 0.9 ) continue;
		const p = list[ slot ++ ];
		p.visible = true;
		const o = at( i );
		p.position.set( o.x + ( hash( i ) - .5 ) * size, o.y + age * size * 1.6, o.z + 0.1 );
		const s = size * ( 0.3 + age * 0.9 ) * ( 1 - Math.pow( age / 0.9, 3 ) ) * spring( age, 3, 8 );
		p.scale.setScalar( Math.max( 1e-4, s ) );
	}
}

/** The fluttering cape on a planet at pos/R. fall 0..1 drops it away. */
export function cape( c: Stage, pos: THREE.Vector3, R: number, show: number, fall: number ) {
	const m = c.w.cape;
	m.visible = show > 0.001;
	if ( ! m.visible ) return;
	const arr = ( m.geometry.attributes.position.array as Float32Array ), base = c.w.capeBase;
	for ( let i = 0; i < arr.length; i += 3 ) {
		const y = base[ i + 1 ];
		const k = clamp( ( 0.25 - y ) / 1.6 );
		const ang = Math.atan2( base[ i + 2 ], base[ i ] );
		const flap = Math.sin( c.t * 7 + ang * 3 + y * 3 ) * 0.08 * k + k * 0.15;
		arr[ i ] = base[ i ] * ( 1 + flap ); arr[ i + 1 ] = y; arr[ i + 2 ] = base[ i + 2 ] * ( 1 + flap ) - k * 0.25;
	}
	m.geometry.attributes.position.needsUpdate = true;
	m.geometry.computeVertexNormals();
	const f = clamp( fall );
	m.position.set( pos.x + f * R * 0.4, pos.y + R * 0.15 - f * f * R * 4, pos.z );
	m.rotation.set( 0, 0, f * 1.4 );
	m.scale.setScalar( R * show );
}
