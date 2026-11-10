// Scenes 12–22.
import * as THREE from 'three';
import { at, atEnd, wordAfter } from './timeline';
import { clamp, easeInCubic, easeInOutCubic, easeOutCubic, lerp, popInOut, remap, smooth, spring } from './engine/math';
import { PALETTE } from './engine/toon';
import { bigX, pill, thought } from './engine/hud';
import { burst, crowd, planet, poofs, puffs, solarSystem, star, V3 } from './props';
import { float, hops, idle, leap, tremble, type Motion } from './motion';
import { buddy, label, ship, stat, type SceneDef } from './scenes-a';
import type { Stage } from './stage';

/** landing times of a hops() run (for smoke poofs) */
function landings( t0: number, t1: number, hopDur: number ) {
	const n = Math.max( 1, Math.round( ( t1 - t0 ) / hopDur ) ), hd = ( t1 - t0 ) / n;
	return Array.from( { length: n }, ( _, i ) => t0 + ( i + 1 ) * hd );
}

/** Underwater look: dark sea, drifting specks, fading god rays, helmet light at `head`. */
function sea( c: Stage, center: THREE.Vector3, rays: number, head: THREE.Vector3 | null, beamDir = - 0.5 ) {
	const w = c.w;
	w.scene.background = new THREE.Color( '#0b1a3c' );
	w.stars.visible = false; w.neb.visible = false;
	w.hemi.intensity = 0.25; w.key.intensity = 0.4;
	c.vignette = 0.75;
	w.sea.visible = true;
	const arr = ( w.sea.geometry.attributes.position as THREE.BufferAttribute ).array as Float32Array;
	w.seaSeed.forEach( ( [ a, b, d, e ], i ) => {
		arr[ i * 3 ] = center.x + ( a - .5 ) * 12 + Math.sin( c.t * 0.3 + i ) * 0.1;
		arr[ i * 3 + 1 ] = center.y + ( ( ( b * 10 + c.t * ( 0.05 + e * 0.1 ) ) % 10 ) - 5 );
		arr[ i * 3 + 2 ] = center.z + ( d - .5 ) * 6;
	} );
	w.sea.geometry.attributes.position.needsUpdate = true;
	w.rays.visible = rays > 0.01;
	w.rays.children.forEach( ( r, i ) => {
		const m = r as THREE.Mesh;
		m.position.set( center.x - 3 + i * 1.3, center.y + 3.5, center.z - 2 );
		m.scale.set( 0.7, 9, 1 ); m.rotation.z = 0.25;
		( m.material as THREE.MeshBasicMaterial ).opacity = rays * ( 0.5 + 0.5 * Math.sin( c.t * 0.7 + i * 1.7 ) );
	} );
	w.seaGlow.visible = true; w.seaGlow.position.set( center.x, center.y + 0.6, center.z - 4 ); w.seaGlow.scale.set( 16, 10, 1 );
	w.helmetGlow.visible = w.beam.visible = !! head;
	if ( head ) {
		w.helmetGlow.position.copy( head ).add( V3( 0, 0, - 0.2 ) ); w.helmetGlow.scale.setScalar( 1.3 + Math.sin( c.t * 3 ) * 0.04 );
		w.beam.position.copy( head ).add( V3( 0, 0, - 0.3 ) ); w.beam.scale.set( 0.9, 1, 0.9 ); w.beam.rotation.set( 0, 0, Math.PI / 2 + beamDir );
	}
}

/** The creature's glowing eyes: open 0..1, look offset. */
function eyes( c: Stage, pos: THREE.Vector3, size: number, open: number, glow = 1 ) {
	const e = c.w.eyes;
	e.visible = open > 0.01;
	e.position.copy( pos ); e.scale.setScalar( size );
	e.children.forEach( ( m, i ) => {
		const blink = 1;
		m.scale.set( 1, Math.max( 0.02, open * blink ), 1 );
		( ( m as THREE.Mesh ).material as THREE.MeshBasicMaterial ).color.setScalar( 1.2 + 0.6 * glow + Math.sin( c.t * 2 + i ) * 0.1 );
	} );
}

export const SCENES_B: SceneDef[] = [
	// 12 ── 55 Cancri e: lava, "Watch your step, Luna!", "extra crispy"
	{
		key: 'cancri', render( c ) {
			const t0 = c.t0, tL = at( 'lava' ), tW = at( 'watch' ), tB = at( 'beach' ), tC = wordAfter( 'crispy', 'crispy' );
			const w = c.w;
			c.cuts( tW );
			if ( c.t < tW ) {
				const z = easeInOutCubic( remap( c.t, tL - 0.3, tL + 1.5 ) );
				c.frame( V3( lerp( 0.6, 0.9, z ), 0, 0 ), lerp( 3.2, 2.0, z ) );
				star( c, w.star, V3( c.V ? - 1.2 : - 2.6, c.V ? 1.6 : 0.4, - 2 ), 1.7 );
				planet( c, w.P.lava, V3( c.V ? 0.6 : 0.9, c.V ? - 0.3 : 0, 0 ), 0.75 * spring( c.t - t0 ), { spin: 0.3 } );
				c.shimmer = 0.5 * z;
				stat( c, t0 + 0.05, tW - 0.1, '55 Cancri e', undefined, '#ffb27a' );
				label( c, V3( c.V ? 0.6 : 0.9, c.V ? - 1.25 : - 0.95, 0 ), 'lava world?', tL + 0.2, tW - 0.1, 0.36, '#ffb27a' );
				return;
			}
			// on the surface: panicky hops with smoke, then boots smoke and back to the ship
			const R = 1, P = V3( 0, - 0.3, 0 );
			c.frame( V3( 0, 0.5, 0 ), 1.9, { x: 0, y: c.V ? 0.08 : 0.05 } );
			star( c, w.star, V3( c.V ? - 1.5 : - 2.6, c.V ? 2.7 : 1.2, - 4 ), 0.9 );
			c.shimmer = 0.6;
			const tPanic1 = tW + 0.15, tPanic2 = tC + 0.1;
			const hopDur = 0.22;
			const mo = ( t: number ): Motion => hops( t, tPanic1, tPanic2, { hopDur, height: 0.2, wobble: 13, squash: 1.2, lean: 0.2 } );
			const m = mo( c.t );
			const sweep = Math.sin( m.p * Math.PI * 3 ) * 0.42;           // back and forth across the top
			planet( c, w.P.lava, P, R, { spin: 0, roll: - sweep * 0.8 } );   // the planet rolls under her
			const facing = Math.cos( m.p * Math.PI * 3 ) >= 0 ? 1 : - 1;
			const tLeap = tC + 0.7, leapDur = 0.55;
			const shipP = V3( c.V ? 1.05 : 1.7, c.V ? 1.85 : 1.1, 0.3 );
			ship( c, shipP.clone().add( V3( 0, c.t > tLeap + leapDur + 0.2 ? Math.pow( c.t - tLeap - leapDur - 0.2, 2 ) * 6 : Math.sin( c.t * 2 ) * 0.04, 0 ) ), { scale: 0.5, flame: 0.5, door: 1 - smooth( remap( c.t, tLeap + leapDur, tLeap + leapDur + 0.15 ) ), face: c.t > tLeap + leapDur ? 'crying' : null } );
			if ( c.t < tLeap + leapDur ) {
				const a = sweep;
				if ( c.t < tLeap ) {
					c.lunaOnSphere( P, R, a, { sprite: c.t > tC ? 'crying_pose' : 'scared', poseAt: c.t > tC ? tC : tW, face: facing, bubble: c.bubbles( [ [ tW + 0.1, tC - 0.1, 'surprised' ], [ tC + 0.05, tLeap + 0.5, 'crying' ] ] ) }, mo );
					const lp = c.luna!.pos.clone();
					poofs( c, landings( tPanic1, tPanic2, hopDur ).concat( c.t > tC ? [ tC + 0.1, tC + 0.3, tC + 0.5 ] : [] ), () => lp.clone().add( V3( 0, 0.02, 0.1 ) ), 0.16 );
				} else {
					const mo2 = ( t: number ) => leap( t, tLeap, leapDur, 1.2 );
					const start = V3( P.x + Math.sin( a ) * R, P.y + Math.cos( a ) * R, R * 0.12 );
					const pos = start.lerp( shipP.clone().add( V3( 0, - 0.3, 0.3 ) ), mo2( c.t ).p );
					c.lunaWorld( pos, { sprite: 'crying_pose', face: 1, alpha: 1 - easeInCubic( remap( c.t, tLeap + leapDur - 0.12, tLeap + leapDur ) ), bubble: c.bubbles( [ [ tC + 0.05, tLeap + 0.5, 'crying' ] ] ) }, mo2 );
				}
			}
			const bs = popInOut( c.t, tB + 0.1, tC - 0.1 );
			if ( bs > 0 ) { c.hud.text( 'beach holiday?', c.sx, c.L.statY, c.L.statSize * 0.5, { scale: bs, fill: PALETTE.yellow } ); bigX( c.hud, c.sx, c.L.statY, c.L.statSize * 0.5, bs ); }
			stat( c, tC, c.t1 - 0.05, 'EXTRA CRISPY', undefined, '#ffb27a', 0, 0.7 );
			burst( c, 0, V3( 0, 0.9, - 0.4 ), 1.6, tC, tC + 0.6 );
		},
	},
	// 13 ── LHS 1140 b: ice world, ocean under the ice, "Bring a jacket… Actually, bring ten."
	{
		key: 'lhs', render( c ) {
			const t0 = c.t0, tN = at( 'notHot' ), tI = at( 'iceWorld' ), tWa = at( 'water' ), tJ = at( 'jacket' ), tT = at( 'ten' );
			// the stack starts on "Actually": "ten" lands only ~1.2 s before the next scene
			const tTen = tT + 0.15, STEP = 0.08;
			const w = c.w;
			c.cuts( tJ );
			if ( c.t < tJ ) {
				c.frame( V3( 0, 0, 0 ), 1.8 );
				const cut = smooth( remap( c.t, tWa - 0.2, tWa + 0.6 ) );
				planet( c, w.P.ice, V3( 0, c.V ? 0.1 : 0, 0 ), 1 * spring( c.t - t0 ) * ( 1 - cut ), { spin: 0.25 } );
				w.iceCut.visible = cut > 0;
				w.iceCut.position.set( 0, c.V ? 0.1 : 0, 0 ); w.iceCut.scale.setScalar( Math.max( 1e-4, cut ) );
				w.iceCut.rotation.set( 0.3, Math.PI * 0.75 - 0.45 + ( c.t - tWa ) * 0.05, 0 );
				stat( c, t0 + 0.05, tN - 0.05, 'LHS 1140 b', undefined, '#c8f4ff' );
				pill( c.hud, 'not too hot · not too cold', c.sx, c.L.statY, c.L.statSize * 0.3, popInOut( c.t, tN, tI - 0.1 ), PALETTE.ink, '#ffe07a' );
				c.hud.stat( c.t, tI, tWa - 0.1, 'ice world?', c.sx, c.L.statY, c.L.statSize * 0.6, '#c8f4ff' );
				c.hud.stat( c.t, tWa + 0.4, tJ - 0.05, 'ocean under the ice', c.sx, c.L.statY, c.L.statSize * 0.46, '#8fd6ff' );
				const sl = c.slot( 'L' );
				c.lunaAt( sl.x, sl.y, { sprite: 'astronaut', face: 1, bubble: c.bubbles( [ [ tWa + 0.3, tJ - 0.1, 'excited' ] ] ) } );
				return;
			}
			// on the ice: jackets!
			const R = 6; planet( c, w.P.ice, V3( 0, - R, 0 ), R, { spin: 0, tilt: 0 } );
			c.frame( V3( 0, c.V ? 0.85 : 1.0, 0 ), c.V ? 1.95 : 2.4, { x: 0, y: c.V ? 0.0 : - 0.14 } );
			puffs( c, w.clouds, V3( 0, 1.6, - 1.5 ), 2.4, 0.15, 0.25, 1, 7 );
			const n = c.t < tTen ? ( c.t > tJ + 0.2 ? 1 : 0 ) : Math.min( 10, 1 + Math.floor( ( c.t - tTen ) / STEP ) );
			const tRoll = tTen + 9 * STEP + 0.25;
			const rollMo = ( t: number ): Motion => {
				if ( t < tRoll ) return idle( t, 0.4 );
				const u = clamp( ( t - tRoll ) / 0.45 );
				const m = hops( t, tRoll, tRoll + 0.35, { hopDur: 0.35, height: 0.12, wobble: 4 } );
				return { ...m, rot: m.rot + easeInCubic( u ) * Math.PI * 0.5 };
			};
			const H = c.lunaHeight( c.camDist );
			const r = H * ( 0.24 + n * 0.045 );
			const top = H * 0.43;                                    // just under her eyes: only eyes + cat peek out
			const lift = Math.max( 0, 2 * r - top );
			const rollX = c.t > tRoll ? easeOutCubic( clamp( ( c.t - tRoll ) / 0.6 ) ) * H * 0.5 : 0;
			c.lunaWorld( V3( rollX, lift, 0.4 ), { sprite: 'astronaut', poseAt: n > 0 ? tJ + 0.2 + ( n > 1 ? ( n - 1 ) * STEP + tTen - tJ - 0.2 : 0 ) : undefined, face: 1, shadow: 1, bubble: c.bubbles( [ [ tJ + 0.4, tTen - 0.1, 'happy' ], [ tRoll + 0.35, c.t1 + 0.2, 'dizzy' ] ] ) }, rollMo );
			// stack jackets around her: the ball grows with each one, collars pile up under her face
			w.jackets.visible = n > 0;
			w.jackets.children.forEach( ( j, i ) => {
				const born = i === 0 ? tJ + 0.2 : tTen + ( i - 1 ) * STEP;
				const s = spring( c.t - born, 2.4, 6 );
				j.visible = i < n;
				const ri = H * ( 0.24 + ( i + 1 ) * 0.045 );
				const ball = j.getObjectByName( 'ball' )!, collar = j.getObjectByName( 'collar' )!;
				ball.visible = i === n - 1;
				ball.position.set( 0, top - ri * s, 0 );        // anchored at the top so the overshoot never covers her eyes
				ball.scale.set( ri * s * 1.06, ri * s, 1 );
				const cw = H * ( 0.2 + i * 0.022 );
				collar.position.set( 0, top - H * 0.02 - i * H * 0.03, 0 );
				collar.scale.set( cw * s, cw * 0.5 * s, 1 );
			} );
			pill( c.hud, 'bring a jacket', c.sx, c.L.statY, c.L.statSize * 0.32, popInOut( c.t, tJ + 0.1, tTen - 0.1 ), PALETTE.ink, '#c8f4ff' );
			const cnt = Math.max( 0, n );
			if ( c.t > tTen ) c.hud.text( `x${ cnt }`, c.sx, c.L.statY, c.L.statSize * 0.9, { scale: 0.85 + 0.15 * spring( c.t - ( tTen + ( cnt - 1 ) * STEP ), 3, 8 ), fill: PALETTE.yellow } );
			burst( c, 1, V3( 0, H * 0.4, - 0.6 ), H * 1.8, tTen + 9 * STEP, tTen + 9 * STEP + 0.6 );
		},
	},
	// 14 ── K2-18 b: ocean world, 2025, "possible hint", "Let's take a closer look."
	{
		key: 'lastStop', render( c ) {
			const t0 = c.t0, tK = at( 'k218' ), tO = at( 'oceanWorld' ), tY = at( 'y2025' ), tH = at( 'hint' ), tCl = at( 'closer' );
			const w = c.w;
			const z = easeInOutCubic( remap( c.t, tCl, c.t1 ) );
			c.frame( V3( 0, lerp( 0, 0.7, z ), 0 ), lerp( c.V ? 2.3 : 1.9, 0.9, z ) );
			planet( c, w.P.k218, V3( 0, c.V ? - 0.15 : 0, 0 ), 1 * spring( c.t - tK + 0.3 ), { spin: 0.15 } );
			stat( c, tK, tO - 0.1, 'K2-18 b', undefined, '#8fb8ff' );
			c.hud.stat( c.t, tO, tY - 0.1, 'giant ocean world?', c.sx, c.L.statY, c.L.statSize * 0.5, '#8fd6ff' );
			stat( c, tY, tH - 0.05, '2025', undefined, PALETTE.yellow );
			pill( c.hud, 'possible hint', c.sx, c.L.statY, c.L.statSize * 0.38, popInOut( c.t, tH, tCl - 0.1 ), '#ffffff', '#7a8cff', '?' );
			c.hud.text( 'gas made by living things on Earth', c.sx, c.L.statY + c.L.statSize * 0.75, c.L.statSize * ( c.V ? 0.24 : 0.26 ), { scale: popInOut( c.t, at( 'living' ) - 0.6, tCl - 0.1 ), fill: '#ffffff' } );
			const sl = c.slot( 'R' );
			const sp = c.screen( c.V ? sl.x : 0.72, sl.y + ( c.V ? 0.16 : 0.45 ), c.camDist * 0.7 );
			ship( c, sp.add( V3( 0, Math.sin( c.t * 1.4 ) * 0.05, 0 ) ), { scale: c.lunaHeight( c.camDist * 0.7 ) * ( c.V ? 0.42 : 0.34 ), rot: 0.2 + Math.sin( c.t ) * 0.05, flame: 0.35, face: c.t > tH ? 'surprised' : 'happy' } );
			buddy( c, 'L', [ [ t0, 'astronaut' ], [ tO, 'excited_pose' ], [ tH, 'surprised_pose' ], [ tCl, 'thinking' ] ],
				[ [ tK + 0.2, tO - 0.1, 'happy' ], [ tO + 0.2, tH - 0.1, 'excited' ], [ tH + 0.2, tCl - 0.1, 'surprised' ] ], { enter: t0 + 0.2, space: true } );
		},
	},
	// 15 ── underwater: "Luna, dive in… slowly. It's dark down here. Very quiet."
	{
		key: 'dive', render( c ) {
			const t0 = c.t0;
			const drift = ( c.t - t0 ) * 0.06;
			const C = V3( Math.sin( c.t * 0.2 ) * 0.1, - drift * 2, 0 );
			c.frame( C.clone().add( V3( 0, 0.4, 0 ) ), 1.7, { x: c.V ? 0 : 0.1, y: 0 }, t0, 0, 0 );
			const rays = 1 - smooth( remap( c.t, t0, t0 + 4 ) );
			const sink = easeOutCubic( remap( c.t, t0, t0 + 2.5 ) );
			const pos = C.clone().add( V3( c.V ? 0 : - 0.4, lerp( 1.4, - 0.1, sink ), 0.5 ) );
			c.lunaWorld( pos, { sprite: 'astronaut', face: 1, shadow: 0 }, ( t ) => float( t, 0.35 ) );
			const head = pos.clone().add( V3( 0.05, c.luna!.height * 0.62, 0 ) );
			sea( c, C, rays, head, - 0.6 );
			c.dim = 0.15;
		},
	},
	// 16 ── "Wait. Did you see that? Something is moving. Something big. Luna… don't move. It's looking at us."
	{
		key: 'wait', render( c ) {
			const t0 = c.t0, tM = at( 'moving' ), tB = at( 'big' ), tD = at( 'dontMove' ), tL = at( 'looking' );
			const w = c.w;
			const C = V3( 0, - 0.55, 0 );
			c.frame( C.clone().add( V3( 0, 0.4, 0 ) ), 1.8, { x: c.V ? 0 : 0.1, y: 0 }, t0, 0, 0 );
			const pos = C.clone().add( V3( c.V ? 0 : - 0.4, - 0.1, 0.5 ) );
			const fear = smooth( remap( c.t, tD - 0.2, tD + 0.4 ) );
			c.lunaWorld( pos, { sprite: c.t > tL + 0.4 ? 'scared' : 'astronaut', poseAt: tL + 0.4, face: 1, shadow: 0,
				bubble: c.bubbles( [ [ t0 + 0.3, tM - 0.1, 'confused' ], [ tB + 0.05, tL - 0.05, 'surprised' ], [ tL + 0.5, c.t1, 'crying' ] ] ) },
			( t ) => tremble( float( t, 0.3 * ( 1 - fear ) ), t, fear * 1.2 ) );
			const head = pos.clone().add( V3( 0.05, c.luna!.height * 0.62, 0 ) );
			sea( c, C, 0, head, - 0.6 );
			c.dim = 0.2;
			// shadow passes: once at "Wait", bigger at "Something big"
			const sh = w.creatureShadow;
			const pass = ( a: number, dur: number, size: number ) => {
				const u = ( c.t - a ) / dur;
				if ( u < 0 || u > 1 ) return false;
				sh.visible = true;
				sh.position.set( lerp( - 6, 6, u ) * ( c.V ? 0.8 : 1.4 ), C.y + 0.7, - 2.5 );
				sh.scale.set( - size, size, 1 );   // swimming left-to-right (tail behind)
				( sh.material as THREE.MeshBasicMaterial ).opacity = Math.min( 1, Math.sin( u * Math.PI ) * 1.6 );
				return true;
			};
			// first pass crosses behind her on "see that", the much bigger one is centred on "Something big"
			pass( t0 - 0.2, 2.8, 2.6 ) || pass( tB - 1.7, 3.4, 6.5 );
			// two giant eyes slowly open in the dark
			const open = easeInOutCubic( remap( c.t, tL - 0.1, tL + 1.6 ) );
			eyes( c, V3( c.V ? 0.1 : 0.6, C.y + ( c.V ? 1.45 : 0.95 ), - 3.5 ), c.V ? 2.1 : 2.6, open, open );
			c.vignette = 0.85;
		},
	},
	// 17 ── "RUN, LUNA! Back to the spaceship! Go, go, go!"
	{
		key: 'run', render( c ) {
			const t0 = c.t0, tG = at( 'gogo' );
			const gos = [ wordAfter( 'gogo', 'go', 0 ), wordAfter( 'gogo', 'go', 1 ), wordAfter( 'gogo', 'go', 2 ) ];
			const tLeap = gos[ 2 ] + 0.15, leapDur = 0.55, tIn = tLeap + leapDur, tBlast = tIn + 0.35;
			const w = c.w;
			const C = V3( 0, - 0.55, 0 );
			const run = ( t: number ) => hops( t, t0 + 0.05, tLeap, { hopDur: 0.28, height: 0.32, wobble: 15, squash: 1.2, lean: 0.3 } );
			const m = run( c.t );
			const x0 = c.V ? - 1.6 : - 3.0, x1 = c.V ? 0.6 : 1.4;
			const shipP = V3( x1 + ( c.V ? 0.75 : 1.4 ), C.y + 0.6, 0.3 );
			const camX = lerp( x0 + 1, x1, smooth( remap( c.t, t0, tLeap ) ) );
			c.frame( V3( camX, C.y + 0.45, 0 ), 1.9, { x: 0, y: 0 }, t0, c.t < tIn + 0.8 ? 1.0 : 0.5 );
			sea( c, V3( camX, C.y, 0 ), 0, null );
			c.dim = 0.1;
			c.hud.speedLines( c.t, 0.6, 21, - 1, 'rgba(160,210,255,0.55)' );
			const blast = c.t > tBlast ? Math.pow( c.t - tBlast, 2 ) * 14 : 0;
			ship( c, shipP.clone().add( V3( blast, blast * 0.4, 0 ) ), { scale: 0.75, rot: c.t > tBlast ? - 0.9 : 0, flame: c.t > tBlast - 0.2 ? 1.2 : 0.3, door: 1 - smooth( remap( c.t, tIn, tIn + 0.08 ) ), face: c.t > tIn ? 'crying' : null, wobble: c.t > tIn ? 1.5 : 0 } );
			if ( c.t > tIn && c.t < tIn + 0.4 ) c.cuts( tIn );   // door SLAM
			if ( c.t < tIn ) {
				let pos: THREE.Vector3, mo: ( t: number ) => Motion;
				if ( c.t < tLeap ) { mo = run; pos = V3( lerp( x0, x1, m.p ), C.y - 0.1, 0.5 ); }
				else {
					mo = ( t ) => leap( t, tLeap, leapDur, 1.0 );
					pos = V3( x1, C.y - 0.1, 0.5 ).lerp( shipP.clone().add( V3( 0, - 0.45, 0.3 ) ), mo( c.t ).p );
				}
				c.lunaWorld( pos, { sprite: 'scared', face: 1, shadow: 0, alpha: 1 - easeInCubic( remap( c.t, tIn - 0.1, tIn ) ), bubble: c.bubbles( [ [ t0 + 0.1, tLeap, 'crying' ] ] ) }, mo );
			}
			// the eyes follow
			const eyeX = lerp( x0 - 1.5, x1 - 0.5, smooth( remap( c.t, t0, tIn + 0.5 ) ) );
			eyes( c, V3( eyeX, C.y + 0.9, - 3 ), 1.4, 1, 1.2 );
			c.vignette = 0.75;
			void tG;
		},
	},
	// 18 ── "Phew. That was close." inside the ship
	{
		key: 'phew', render( c ) {
			const t0 = c.t0;
			const w = c.w;
			w.interior.visible = true; w.interior.position.set( 0, 0, 0 );
			w.scene.background = new THREE.Color( '#1b2150' );
			w.stars.visible = false;
			c.frame( V3( 0, - 0.5, - 1.0 ), 1.15, { x: 0, y: c.V ? 0.12 : 0.05 } );
			const fluff = 1 - smooth( remap( c.t, t0 + 0.6, c.t1 + 0.6 ) );
			c.lunaWorld( V3( 0, - 1.1, - 0.7 ), { sprite: 'astronaut_sit', face: - 1, fluff: 0.6 + fluff * 0.6, shadow: 0.6,
				bubble: c.bubbles( [ [ t0 + 0.15, t0 + 1.2, 'dizzy' ], [ t0 + 1.35, c.t1 + 0.4, 'happy' ] ] ) }, ( t ) => idle( t, 0.3 ) );
		},
	},
	// 19 ── "Okay… let's be honest. That creature was only our imagination. … Not yet. … still looking."
	{
		key: 'honest', render( c ) {
			const t0 = c.t0, tI = at( 'imagination' ), tE = at( 'evidence' ), tN = at( 'nobody' ), tY = at( 'notYet' ), tS = at( 'stillLooking' );
			const tPop = atEnd( 'imagination' ) + 0.1;
			c.frame( V3( 0, 0, 0 ), c.V ? 2.3 : 1.9 );
			// thought bubble with the eyes inside -> pops
			const bs = c.t < tPop ? spring( c.t - t0 - 0.1, 2, 6 ) : 0;
			const bx = c.V ? c.W * 0.5 : c.W * 0.55, by = c.V ? c.H * 0.3 : c.H * 0.38, br = c.V ? c.W * 0.3 : c.H * 0.26;
			thought( c.hud, bx, by, br, bs, ( g ) => {
				g.fillStyle = '#0a1028'; g.fillRect( - br, - br, br * 2, br * 2 );
				for ( const sx of [ - 1, 1 ] ) {
					const grd = g.createRadialGradient( sx * br * 0.32, 0, 2, sx * br * 0.32, 0, br * 0.25 );
					grd.addColorStop( 0, '#fffbd0' ); grd.addColorStop( 0.5, '#e8ff7a' ); grd.addColorStop( 1, 'rgba(160,255,120,0)' );
					g.fillStyle = grd; g.beginPath(); g.ellipse( sx * br * 0.32, 0, br * 0.24, br * 0.12, 0, 0, 7 ); g.fill();
					g.fillStyle = '#0b1020'; g.beginPath(); g.ellipse( sx * br * 0.32, 0, br * 0.025, br * 0.1, 0, 0, 7 ); g.fill();
				}
			} );
			if ( c.t >= tPop ) burst( c, 1, c.screen( ( bx / c.W ) * 2 - 1, - ( ( by / c.H ) * 2 - 1 ), c.camDist ), 2.4, tPop, tPop + 0.5 );
			c.hud.text( 'POP!', bx, by, c.L.statSize * 0.7, { scale: popInOut( c.t, tPop, tPop + 0.6 ), fill: PALETTE.pink } );
			// calm shot of the real planet
			const real = spring( c.t - tE + 0.4, 1.6, 5 );
			if ( c.t > tE - 0.4 ) planet( c, c.w.P.k218, V3( c.V ? 0 : 0.3, c.V ? - 0.2 : - 0.25, 0 ), ( c.V ? 0.95 : 0.8 ) * real, { spin: 0.1 } );
			pill( c.hud, 'Not confirmed', c.sx, c.L.statY, c.L.statSize * 0.38, popInOut( c.t, tE + 0.3, c.t1 - 0.1 ), '#ffffff', '#ff6b81' );
			c.hud.text( 'no life found…', c.sx, c.L.statY + c.L.statSize * 0.85, c.L.statSize * 0.36, { scale: popInOut( c.t, tN, tY - 0.05 ), fill: '#ffffff' } );
			c.hud.text( '…not yet!', c.sx, c.L.statY + c.L.statSize * 0.85, c.L.statSize * 0.42, { scale: popInOut( c.t, tY, c.t1 - 0.1 ), fill: PALETTE.yellow } );
			const sl = c.slot( 'L' );
			c.lunaAt( sl.x, sl.y, { sprite: c.t > tS ? 'thinking' : 'astronaut', poseAt: tS, face: 1, bubble: c.bubbles( [ [ t0 + 0.4, tPop - 0.1, 'thinking' ], [ tS + 0.2, c.t1 - 0.1, 'happy' ] ] ) } );
			void tI;
		},
	},
	// 20 ── "Think about it. … our solar system might be the unusual one. … Earth might be rarer…"
	{
		key: 'think', render( c ) {
			const t0 = c.t0, tC = at( 'commonOut' ), tU = at( 'unusual' ), tR = at( 'rarer' );
			const w = c.w;
			c.cuts( tU );
			if ( c.t < tU ) {
				w.milky.visible = true; w.milky.rotation.set( 1.05, 0, 0.3 ); w.milky.children[ 0 ].rotation.y = c.t * 0.02;
				const z = easeInOutCubic( remap( c.t, t0, tU ) );
				c.frame( V3( 0, 0, 0 ), lerp( 8, 26, z ) );
				crowd( c, V3( 0, 0, 2 ), 1.0, t0 - 3, 1, 0.7 );
				c.hud.stat( c.t, tC, tU - 0.1, 'super-Earths everywhere', c.sx, c.L.statY, c.L.statSize * 0.5, PALETTE.mint );
				buddy( c, 'L', [ [ t0, 'thinking' ], [ tC, 'surprised_pose' ] ], [ [ t0 + 0.3, tC - 0.1, 'thinking' ], [ tC + 0.2, tU - 0.1, 'surprised' ] ], { space: true } );
				return;
			}
			const S = solarSystem( c, tU, false );
			const earthP = S.earth;
			( c.w.solar.userData.dashes as THREE.Group ).visible = remap( c.t, tR - 0.2, tR + 0.6 ) < 1;
			const push = easeInOutCubic( remap( c.t, tR - 0.2, c.t1 - 0.3 ) );
			c.frame( S.center.clone().lerp( earthP, push ), lerp( S.radius, c.V ? 0.95 : 0.6, push ), { x: 0, y: lerp( c.V ? 0 : c.L.focus.y * 0.3, 0, push ) } );
			c.hud.stat( c.t, tU + 0.1, tR - 0.1, 'the unusual one?', c.sx, c.L.statY, c.L.statSize * 0.5, '#ffffff' );
			// Earth glows warmly
			const warm = smooth( remap( c.t, tR, tR + 1.2 ) );
			w.helmetGlow.visible = warm > 0; w.helmetGlow.position.copy( earthP ).add( V3( 0, 0, - 0.3 ) );
			w.helmetGlow.scale.setScalar( S.earthR * 4.5 * warm * ( 1 + Math.sin( c.t * 2 ) * 0.04 ) );
			( w.helmetGlow.material as THREE.MeshBasicMaterial ).color.set( '#ffcf9a' );
			c.hud.stat( c.t, tR + 0.4, c.t1 - 0.1, 'rarer than we imagined', c.sx, c.L.statY, c.L.statSize * 0.46, PALETTE.peach );
			buddy( c, c.V ? 'L' : 'L', [ [ tU, 'confused_pose' ], [ tR, 'love' ] ], [ [ tU + 0.2, tR - 0.1, 'confused' ] ], { enter: tU, space: true } );   // then she just hugs the heart
		},
	},
	// 21 ── "And here's the thing… But you can." quiet night hill, Luna from behind
	{
		key: 'thing', render( c ) {
			const t0 = c.t0, tY = at( 'youCan' );
			const w = c.w;
			w.hill.visible = true; w.hill.position.set( 0, 0, 0 );
			w.neb.visible = true;
			( w.stars.material as THREE.ShaderMaterial ).uniforms.uTwinkle.value = 0.6;
			const push = smooth( remap( c.t, t0, c.t1 + 3 ) );
			c.frame( V3( 0, lerp( 1.1, 0.7, push ), 0 ), lerp( 2.6, 1.7, push ), { x: 0, y: c.V ? - 0.1 : - 0.15 }, t0, 0, 0 );
			c.lunaWorld( V3( c.V ? 0 : - 0.3, 0.02, 0.6 ), { sprite: 'back', face: - 1, silhouette: 1, shadow: 0.5 }, ( t ) => idle( t, 0 ) );
			// a single soft shooting star on "But you can."
			const u = remap( c.t, tY + 0.2, tY + 1.4 );
			if ( u > 0 && u < 1 ) {
				const a = c.px( V3( lerp( - 2, 1.5, u ), lerp( 3.2, 2.2, u ), - 6 ) );
				const g = c.hud.g; g.save();
				const grd = g.createLinearGradient( a.x - 160, a.y - 45, a.x, a.y ); grd.addColorStop( 0, 'rgba(255,255,255,0)' ); grd.addColorStop( 1, 'rgba(255,246,220,0.9)' );
				g.strokeStyle = grd; g.lineWidth = 5; g.lineCap = 'round'; g.globalAlpha = Math.sin( u * Math.PI );
				g.beginPath(); g.moveTo( a.x - 160, a.y - 45 ); g.lineTo( a.x, a.y ); g.stroke(); g.restore();
			}
			c.vignette = 0.5;
		},
	},
	// 22 ── "Space is truly amazing. And this is only the beginning."
	{
		key: 'amazing', render( c ) {
			const t0 = c.t0, tB = at( 'beginning' );
			const w = c.w;
			const back = easeInOutCubic( remap( c.t, t0, t0 + 3 ) );
			w.hill.visible = true; w.hill.position.set( 0, 0, 0 );
			c.frame( V3( 0, lerp( 0.7, 1.7, back ), 0 ), lerp( 1.7, 3.4, back ), { x: 0, y: c.V ? - 0.1 : - 0.15 } );
			const turn = t0 + 0.5, hopT = t0 + 1.0;
			const sprite = c.t < turn ? 'back' : c.t < hopT + 0.4 ? 'casual' : 'waving';
			const mo = ( t: number ) => hops( t, hopT, hopT + 0.4, { hopDur: 0.4, height: 0.25, wobble: 8 } );
			// she stays on the hill top as the hill sinks away with the pull-back
			c.lunaWorld( V3( c.V ? 0 : - 0.3, 0.02, 0.6 ), { sprite, poseAt: c.t < turn ? undefined : c.t < hopT + 0.4 ? turn : hopT + 0.4, face: - 1, silhouette: c.t < turn ? 1 : 0, shadow: 0.5 }, mo );
			const fly = remap( c.t, tB + 0.3, tB + 3.2 );
			if ( fly > 0 && fly < 1 ) ship( c, V3( lerp( - 3, 3.5, fly ), lerp( 2.6, 5.0, fly ), - 2 ), { scale: lerp( 0.6, 0.15, fly ), rot: - 1.0, flame: 1, face: 'happy' } );
			c.hud.text( 'Space is', c.W / 2, c.L.titleY, c.L.titleSize * 0.6, { scale: popInOut( c.t, t0 + 0.2, tB - 0.1 ), fill: '#ffffff' } );
			c.hud.text( 'truly amazing', c.W / 2, c.L.titleY + c.L.titleSize * 0.8, c.L.titleSize * 0.8, { scale: popInOut( c.t, t0 + 0.4, tB - 0.1 ), fill: PALETTE.yellow } );
			c.hud.text( 'This is only', c.W / 2, c.L.titleY, c.L.titleSize * 0.6, { scale: spring( c.t - tB ), fill: '#ffffff' } );
			c.hud.text( 'the beginning.', c.W / 2, c.L.titleY + c.L.titleSize * 0.8, c.L.titleSize * 0.85, { scale: spring( c.t - tB - 0.25 ), fill: PALETTE.peach } );
		},
	},
];
