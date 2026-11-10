// Posing helpers for world props. All functions are pure in `t`.
import * as THREE from 'three';
import { clamp, easeOutCubic, hash, popInOut, spring, wrap } from './engine/math';
import type { Stage } from './stage';

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s3 = new THREE.Vector3();

export function planet( c: Stage, pos: THREE.Vector3, R: number, o: { spin?: number; roll?: number; heat?: number; wind?: number; scale?: number } = {} ) {
	const w = c.w;
	w.planet.visible = true;
	w.planet.position.copy( pos );
	w.planet.scale.setScalar( R * ( o.scale ?? 1 ) );
	w.planetSpin.rotation.y = c.t * ( o.spin ?? 0.25 );
	w.planetRoll.rotation.z = o.roll ?? 0;
	const heat = o.heat ?? 0;
	w.planetMat.emissiveIntensity = heat * 0.55;
	( w.planetHeat.material as THREE.ShaderMaterial ).uniforms.uIntensity.value = heat * 2.2;
	const wind = o.wind ?? 0;
	w.windArcs.visible = wind > 0.01;
	w.windArcs.children.forEach( ( a, i ) => {
		a.rotation.z = c.t * ( a.userData.speed as number ) * ( 1 + wind ) + i;
		a.scale.setScalar( clamp( wind ) );
	} );
}

export function star( c: Stage, which: 'star' | 'sun', pos: THREE.Vector3, R: number ) {
	const g = c.w[ which ];
	g.visible = true;
	g.position.copy( pos );
	g.scale.setScalar( R );
	const { corona, halo } = g.userData as { corona: THREE.Mesh; halo: THREE.Mesh };
	corona.rotation.z = c.t * 0.25;
	const p = 1 + Math.sin( c.t * 3 ) * 0.04;
	corona.scale.setScalar( 3.1 * p );
	halo.scale.setScalar( 5.5 * ( 1 + Math.sin( c.t * 2.1 ) * 0.03 ) );
}

export function earth( c: Stage, pos: THREE.Vector3, R: number, spin = 0.3 ) {
	const g = c.w.earth;
	g.visible = true; g.position.copy( pos ); g.scale.setScalar( R );
	( g.userData.ball as THREE.Mesh ).rotation.y = c.t * spin;
	( g.userData.clouds as THREE.Group ).rotation.y = c.t * spin * 1.4;
}

/** Comic burst billboard: pops with a spring, spins slowly, fades out. */
export function burst( c: Stage, i: number, pos: THREE.Vector3, size: number, t0: number, t1 = t0 + 1.2 ) {
	const b = c.w.bursts[ i ];
	const s = popInOut( c.t, t0, t1, 0.3 );
	b.visible = s > 0.001;
	if ( ! b.visible ) return;
	b.position.copy( pos );
	b.scale.setScalar( size * s );
	b.rotation.z = ( c.t - t0 ) * 0.6 + i;
	( b.material as THREE.MeshBasicMaterial ).opacity = clamp( 1.6 - ( c.t - t0 ) / ( t1 - t0 ) );
}

/**
 * Glass shards inside a box (center, half-size), moving along +x/-x.
 * mode 'zoom' = fast streaks past camera, 'drift' = slow sparkly float, 'rain' = sideways rain.
 */
export function shards( c: Stage, center: THREE.Vector3, half: THREE.Vector3, speed: number, amount = 1, dir = - 1, size = 1 ) {
	const w = c.w, n = Math.floor( w.shardData.length * clamp( amount ) );
	w.shards.visible = n > 0;
	w.sparkles.visible = n > 0;
	if ( ! n ) return;
	const fall = speed > 3 ? 0.25 : 0.05; // rain falls a bit while flying sideways
	for ( let i = 0; i < w.shardData.length; i ++ ) {
		const d = w.shardData[ i ];
		if ( i >= n ) { m4.makeScale( 0, 0, 0 ); w.shards.setMatrixAt( i, m4 ); w.shardOutline.setMatrixAt( i, m4 ); continue; }
		const x = wrap( d.x * 2 * half.x + dir * c.t * speed * d.sp * half.x * 0.5, - half.x, half.x );
		const y = wrap( d.y * half.y - c.t * fall * speed * d.sp, - half.y, half.y );
		v.set( center.x + x, center.y + y, center.z + d.z * half.z );
		// orient the long axis with the motion for fast modes, tumble for slow
		if ( speed > 2 ) e.set( 0.2 * Math.sin( d.rx ), Math.PI / 2 + 0.1 * Math.sin( d.ry ), - fall * 0.8 * dir + c.t * 0.0 );
		else e.set( d.rx + c.t * 0.6 * d.sp, d.ry + c.t * 0.4, d.rx * 0.5 );
		q.setFromEuler( e );
		const stretch = speed > 2 ? 1 + Math.min( speed, 7 ) * 0.07 : 1;
		s3.set( d.s * size, d.s * size, d.s * size * stretch );
		m4.compose( v, q, s3 );
		w.shards.setMatrixAt( i, m4 ); w.shardOutline.setMatrixAt( i, m4 );
	}
	w.shards.instanceMatrix.needsUpdate = true; w.shardOutline.instanceMatrix.needsUpdate = true;
	// sparkles ride on every 2nd shard, twinkling
	const arr = ( w.sparkles.geometry.attributes.position as THREE.BufferAttribute ).array as Float32Array;
	for ( let i = 0; i < arr.length / 3; i ++ ) {
		const k = ( i * 2 ) % n;
		w.shards.getMatrixAt( k, m4 ); v.setFromMatrixPosition( m4 );
		const tw = Math.sin( c.t * 5 + i * 1.7 );
		const hide = tw < 0.2 ? 1e4 : 0;
		arr[ i * 3 ] = v.x + 0.1 * size; arr[ i * 3 + 1 ] = v.y + 0.12 * size + hide; arr[ i * 3 + 2 ] = v.z + 0.2;
	}
	w.sparkles.geometry.attributes.position.needsUpdate = true;
	( w.sparkles.material as THREE.PointsMaterial ).size = 0.45 * size;
}

/** The crowd of exoplanets popping in one after another. dim: 0..1 fades them back. */
export function exos( c: Stage, center: THREE.Vector3, scale: number, t0: number, spread = 1.6, dim = 0, out = Infinity ) {
	const w = c.w;
	w.exos.visible = true;
	const col = new THREE.Color();
	for ( let i = 0; i < w.exoData.length; i ++ ) {
		const d = w.exoData[ i ];
		const s = popInOut( c.t, t0 + d.delay * spread, out + d.delay * 0.3 ) * d.s * scale * ( 1 - dim * 0.45 );
		v.set( center.x + d.x * scale, center.y + d.y * scale + Math.sin( c.t * 1.3 + i ) * 0.05 * scale, center.z + d.z * scale );
		e.set( 0, c.t * 0.5 + i, 0.3 ); q.setFromEuler( e );
		s3.setScalar( Math.max( s, 0 ) );
		m4.compose( v, q, s3 );
		w.exos.setMatrixAt( i, m4 ); w.exoOutline.setMatrixAt( i, m4 );
	}
	w.exos.instanceMatrix.needsUpdate = true; w.exoOutline.instanceMatrix.needsUpdate = true;
	const mat = w.exos.material as THREE.MeshToonMaterial;
	mat.color.copy( col.setScalar( 1 - dim * 0.55 ) );
}

/** Puffy toon clouds drifting along x (wraps inside a span). */
export function puffs( c: Stage, list: THREE.Group[], center: THREE.Vector3, span: number, speed: number, size: number, amount = 1, seed = 1 ) {
	list.forEach( ( p, i ) => {
		const k = hash( i + seed * 10 );
		const s = clamp( amount * list.length - i ) * size * ( 0.7 + k * 0.6 );
		p.visible = s > 0.001;
		if ( ! p.visible ) return;
		p.position.set( center.x + wrap( ( k - 0.5 ) * span * 2 + c.t * speed * ( 0.8 + k * 0.4 ), - span, span ), center.y + ( hash( i + 7 ) - 0.5 ) * span * 0.5 + Math.sin( c.t * 1.5 + i ) * 0.1 * size, center.z + ( hash( i + 3 ) - 0.5 ) * span * 0.3 );
		const breathe = 1 + Math.sin( c.t * 3 + i * 2 ) * 0.06;
		p.scale.set( s * breathe, s / breathe, s );
	} );
}

/** Stink puffs rising out of a point, cartoon style. */
export function stink( c: Stage, origin: THREE.Vector3, size: number, t0: number, t1 = Infinity ) {
	c.w.stinks.forEach( ( p, i ) => {
		const cycle = 2.2, ph = ( ( c.t - t0 ) / cycle + i / c.w.stinks.length ) % 1;
		const life = popInOut( c.t, t0 + i * 0.12, t1 );
		p.visible = life > 0.001 && c.t >= t0;
		if ( ! p.visible ) return;
		const s = size * ( 0.35 + ph * 0.75 ) * life * ( 1 - Math.pow( ph, 6 ) );
		p.position.set( origin.x + Math.sin( ph * 6 + i * 2 ) * size * 0.6, origin.y + ph * size * 3.2, origin.z + ( i % 2 ) * 0.2 );
		p.scale.setScalar( Math.max( 0, s ) );
	} );
}

/** Dashed pill path between two points; `progress` reveals it. */
export function dashedPath( c: Stage, a: THREE.Vector3, b: THREE.Vector3, progress: number, thick = 1 ) {
	const w = c.w, n = w.dashes.count;
	w.dashes.visible = true;
	const dir = b.clone().sub( a ), len = dir.length();
	q.setFromUnitVectors( new THREE.Vector3( 0, 1, 0 ), dir.clone().normalize() );
	const shown = Math.floor( n * clamp( progress ) );
	for ( let i = 0; i < n; i ++ ) {
		const f = ( i + 0.5 ) / n;
		v.copy( a ).addScaledVector( dir, f );
		const pop = clamp( ( progress * n - i ) * 0.5 );
		s3.setScalar( i < shown + 2 ? easeOutCubic( pop ) * thick * ( len / n / 0.4 ) * 0.9 : 0 );
		m4.compose( v, q, s3 );
		w.dashes.setMatrixAt( i, m4 );
	}
	w.dashes.instanceMatrix.needsUpdate = true;
}

export function bounceIn( c: Stage, t0: number ) { return spring( c.t - t0, 1.8, 5 ); }
