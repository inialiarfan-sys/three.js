// "The Planet With No Sun": scenes 0–22. Every gag is keyed to the exact word.
import * as THREE from 'three';
import { at, atEnd, wordAfter } from './timeline';
import { clamp, easeInCubic, easeInOutCubic, easeOutCubic, hash, lerp, popInOut, remap, smooth, spring, wobble } from './engine/math';
import { PALETTE } from './engine/toon';
import { bigX, pill, sweat } from './engine/hud';
import { burst, planet, puffs, star, V3 } from './props';
import { float, hops, idle, leap, tremble, type Motion } from './motion';
import { buddy, label, ship, stat, type SceneDef } from './scenes-a';
import { crack, frost, glowArrow, heatWaves, lightCurve, phone, sunIcon, sunscreen, thermometer } from './rogue-hud';
import type { Stage } from './stage';

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();

/** darker space for this episode, but never unreadable */
function night( c: Stage, stars = 0.7, light = 1 ) {
	c.w.scene.background = new THREE.Color( '#070a1f' );
	( c.w.stars.material as THREE.ShaderMaterial ).uniforms.uOpacity.value = stars;
	c.w.hemi.intensity = 0.75 * light; c.w.hemi.color.set( '#b8c4ff' );
	c.w.key.intensity = 1.5 * light; c.w.key.color.set( '#cfd8ff' );
	c.vignette = 0.5;
}

function rogue( c: Stage, pos: THREE.Vector3, R: number, o: { spin?: number; roll?: number; tumble?: number } = {} ) {
	const r = c.r.rogue;
	r.visible = R > 1e-4; r.position.copy( pos ); r.scale.setScalar( Math.max( 1e-4, R ) );
	c.r.rogueSpin.rotation.set( ( o.tumble ?? 0 ) * c.t * 0.3, c.t * ( o.spin ?? 0.15 ), 0.4 + ( o.tumble ?? 0 ) * c.t * 0.1 );
	r.rotation.z = o.roll ?? 0;
}

/** icy ground (top of a huge dark sphere) with crystals scattered in front of the camera */
function iceGround( c: Stage, R = 14, crystalsZ = [ - 1.5, 2.2 ], spreadX = 5, crystalAmount = 1 ) {
	const g = c.r.ground; g.visible = true; g.position.set( 0, - R, 0 ); g.scale.setScalar( R ); g.rotation.set( 0, 0, 0 );
	const cr = c.r.crystals; cr.visible = crystalAmount > 0;
	c.r.crystalData.forEach( ( d, i ) => {
		const x = d.x * spreadX, z = lerp( crystalsZ[ 0 ], crystalsZ[ 1 ], d.z );
		const y = Math.sqrt( Math.max( 0, R * R - x * x - z * z ) ) - R;
		const s = d.s * 0.16 * clamp( crystalAmount * 1.2 - d.z * 0.2 );
		e3.set( d.tilt, d.ry, d.tilt * 0.6 ); q.setFromEuler( e3 ); v3.set( x, y + s * 0.6, z ); s3.setScalar( Math.max( 1e-4, s ) );
		m4.compose( v3, q, s3 ); cr.setMatrixAt( i, m4 ); c.r.crOl.setMatrixAt( i, m4 );
	} );
	cr.instanceMatrix.needsUpdate = true; c.r.crOl.instanceMatrix.needsUpdate = true;
}

/** HUD helper: a rounded label in the stat slot */
const tag = ( c: Stage, str: string, t0: number, t1: number, dy = 0, bg = PALETTE.cobalt, size = 0.34 ) =>
	pill( c.hud, str, c.sx, c.L.statY + dy, c.L.statSize * size, popInOut( c.t, t0, t1 ), '#ffffff', bg );

export const SCENES: SceneDef[] = [
	// 0 ── title
	{
		key: 'title', render( c ) {
			night( c, 0.6 );
			c.frame( V3(), 2.4 );
			rogue( c, V3( 0, c.V ? - 0.3 : - 0.25, 0 ), 0.8 * spring( c.t - 0.3, 1.6, 5 ), { tumble: 0.6 } );
			c.hud.text( 'THE PLANET', c.W / 2, c.L.titleY, c.L.titleSize, { scale: spring( c.t - 0.15 ), fill: '#dfe4ff', rot: - 0.04 } );
			c.hud.text( 'WITH NO SUN', c.W / 2, c.L.titleY + c.L.titleSize * 1.1, c.L.titleSize * 0.95, { scale: spring( c.t - 0.4 ), fill: PALETTE.periwinkle, rot: 0.03 } );
		},
	},
	// 1 ── "Imagine a planet with no sun. No sunrise. No sunset. No daytime. Ever."
	{
		key: 'imagine', render( c ) {
			const t0 = c.t0, tR = at( 'noSunrise' ), tS = at( 'noSunset' ), tD = at( 'noDay' ), tE = at( 'ever' );
			night( c, 0.4 );
			c.frame( V3(), 2.2 );
			rogue( c, V3( 0, c.V ? - 0.35 : - 0.15, 0 ), 0.7 * spring( c.t - t0, 1.6, 5 ), { tumble: 0.4 } );
			// quick cuts: each icon pops in and gets crossed out on its word
			const cuts: [ number, number, 'sunrise' | 'sunset' | 'sun' ][] = [ [ tR, tS, 'sunrise' ], [ tS, tD, 'sunset' ], [ tD, tE, 'sun' ] ];
			const r = c.V ? c.W * 0.13 : c.H * 0.13, ix = c.sx, iy = c.V ? c.H * 0.27 : c.H * 0.3;
			for ( const [ a, b, k ] of cuts ) {
				const s = popInOut( c.t, a, b - 0.02, 0.1 );
				sunIcon( c.hud, k, ix, iy, r, s, c.t );
				bigX( c.hud, ix, iy + r * 0.2, r * 1.15, popInOut( c.t, a + 0.22, b - 0.02, 0.1 ) * spring( c.t - a - 0.22, 2.6, 7 ) );
			}
			c.hud.text( 'EVER.', c.sx, iy, c.L.statSize * 1.1, { scale: popInOut( c.t, tE, c.t1 + 0.2 ), fill: '#c9d6ff', rot: - 0.05 } );
		},
	},
	// 2 ── "Just endless darkness, drifting through space, all alone."
	{
		key: 'darkness', render( c ) {
			const t0 = c.t0;
			night( c, 0.35, 0.8 );
			const u = ( c.t - t0 ) / ( c.t1 - t0 );
			c.frame( V3( lerp( - 1.1, 1.1, u ), lerp( 0.2, - 0.1, u ), 0 ), 2.4, { x: 0, y: c.V ? 0.12 : 0 }, t0, 0, 0 );
			rogue( c, V3( 0, 0, 0 ), 1, { tumble: 1.2, spin: 0.1 } );
			c.vignette = 0.7;
		},
	},
	// 3 ── "And scientists think there could be billions of them!"
	{
		key: 'billions', render( c ) {
			const t0 = c.t0, tB = at( 'billionsWord' );
			night( c, 0.6 );
			const w = c.w;
			w.milky.visible = true; w.milky.rotation.set( 1.05, 0, 0.3 ); w.milky.children[ 0 ].rotation.y = c.t * 0.02;
			( ( w.milky.children[ 0 ] as THREE.Points ).material as THREE.PointsMaterial ).opacity = 0.55;
			const z = easeInOutCubic( remap( c.t, t0, t0 + 1.4 ) );
			c.frame( V3(), lerp( 3, 26, z ) );
			rogue( c, V3( 0, 0, 4 ), 0.9 * ( 1 - z * 0.85 ), { tumble: 0.5 } );
			// tiny dark planets popping up all over
			const tiny = c.r.tiny; tiny.visible = true;
			c.r.tinyData.forEach( ( d, i ) => {
				const s = spring( c.t - t0 - 0.4 - d.d * 1.4 ) * d.s * 0.55;
				v3.set( d.x * 26 * ( c.V ? 0.6 : 1 ), d.y * 26 * ( c.V ? 1.4 : 0.6 ), d.z * 10 ); q.identity(); s3.setScalar( Math.max( 1e-4, s ) );
				m4.compose( v3, q, s3 ); tiny.setMatrixAt( i, m4 ); c.r.tinyOl.setMatrixAt( i, m4 );
			} );
			tiny.instanceMatrix.needsUpdate = true; c.r.tinyOl.instanceMatrix.needsUpdate = true;
			const s = popInOut( c.t, tB, c.t1 + 0.3 );
			c.hud.text( 'Billions', c.sx - c.L.statSize * 0.35, c.L.statY + c.H * 0.04, c.L.statSize * 0.95, { scale: s, fill: PALETTE.yellow, rot: - 0.04 } );
			c.hud.text( '?', c.sx + c.L.statSize * 2.25, c.L.statY + c.H * 0.035, c.L.statSize * 1.2, { scale: s, fill: PALETTE.pink, rot: Math.sin( ( c.t - tB ) * 7 ) * 0.25 } );
		},
	},
	// 4 ── "Luna, grab your flashlight! This one's going to be dark."
	{
		key: 'flashlight', render( c ) {
			const t0 = c.t0, tClick = wordAfter( 'flashlight', 'flashlight' ) + 0.15;
			const w = c.w;
			w.interior.visible = true; w.interior.position.set( 0, 0, 0 );
			w.scene.background = new THREE.Color( '#10143a' ); w.stars.visible = false;
			const lit = smooth( remap( c.t, tClick, tClick + 0.25 ) );
			w.hemi.intensity = 0.45 + 0.25 * lit; w.key.intensity = 0.5;
			c.frame( V3( 0, - 0.4, - 1.0 ), 1.45, { x: 0, y: c.V ? 0.1 : 0.05 } );
			const mo = ( t: number ) => hops( t, t0 + 0.1, tClick - 0.15, { hopDur: 0.34, height: 0.2, wobble: 9 } );
			const x = lerp( c.V ? - 1.6 : - 2.4, c.V ? - 0.35 : - 0.6, mo( c.t ).p );
			c.lunaWorld( V3( x, - 1.48, - 0.6 ), { sprite: c.t > tClick ? 'excited_pose' : 'astronaut', poseAt: tClick, face: 1, bubble: c.bubbles( [ [ tClick + 0.1, c.t1 + 0.3, 'excited' ] ] ) }, mo );
			if ( c.t > tClick - 0.15 ) c.torch = { on: lit, aim: V3( 2.5, - 0.2, - 2.2 ), spread: 0.55, intensity: 45 };
			c.hud.text( 'CLICK!', c.sx + ( c.V ? 180 : 260 ), c.L.statY + c.H * 0.1, c.L.statSize * 0.5, { scale: popInOut( c.t, tClick, tClick + 0.6 ), fill: PALETTE.yellow, rot: 0.12 } );
		},
	},
	// 5 ── "Most planets travel around a star. But some don't have a star at all. … rogue planets."
	{
		key: 'most', render( c ) {
			const t0 = c.t0, tS = at( 'some' ), tR = at( 'rogue' );
			night( c, 0.6 );
			const rr = c.r;
			if ( c.t < tS ) {
				c.frame( V3(), 2.6 );
				star( c, c.w.sun, V3( 0, c.V ? 0.2 : 0, - 0.5 ), 0.42 * spring( c.t - t0 ) );
				rr.orbits.visible = true; rr.orbits.position.set( 0, c.V ? 0.2 : 0, 0 );
				rr.orbits.children.forEach( ( o, i ) => o.scale.setScalar( ( 0.8 + i * 0.45 ) * spring( c.t - t0 - 0.1 - i * 0.08 ) ) );
				rr.orbitPlanets.forEach( ( p, i ) => {
					const R = 0.8 + i * 0.45, a = c.t * ( 1.2 - i * 0.22 ) + i * 1.7;
					p.visible = true;
					v3.set( Math.cos( a ) * R, 0, Math.sin( a ) * R ).applyEuler( new THREE.Euler( - 0.35, 0, 0 ) );
					p.position.set( v3.x, v3.y + ( c.V ? 0.2 : 0 ), v3.z ); p.scale.setScalar( ( 0.09 + i * 0.03 ) * spring( c.t - t0 - 0.2 - i * 0.1 ) );
				} );
				c.w.key.position.set( 0, 0.2, 3 );
			} else {
				c.frame( V3(), 2.0, undefined, tS );
				rogue( c, V3( 0, c.V ? - 0.1 : - 0.1, 0 ), 0.75 * spring( c.t - tS, 1.8, 5 ), { tumble: 0.5 } );
				c.hud.text( 'no star!', c.sx, c.L.statY, c.L.statSize * 0.5, { scale: popInOut( c.t, tS + 0.3, tR - 0.1 ), fill: '#c9d6ff' } );
				const ws = wordAfter( 'rogue', 'rogue' );
				c.hud.text( 'ROGUE', c.sx, c.L.statY, c.L.statSize * 1.05, { scale: spring( c.t - ws ), fill: PALETTE.periwinkle, rot: - 0.05 } );
				c.hud.text( 'PLANETS', c.sx, c.L.statY + c.L.statSize * 1.0, c.L.statSize * 0.85, { scale: spring( c.t - ws - 0.18 ), fill: '#ffffff', rot: 0.04 } );
				burst( c, 0, V3( 0, c.V ? - 0.1 : - 0.1, - 1.4 ), 3.2, ws, ws + 0.8 );
			}
			buddy( c, 'R', [ [ t0, 'astronaut' ], [ tS, 'confused_pose' ], [ tR, 'excited_pose' ] ], [ [ tS + 0.3, tR - 0.1, 'confused' ], [ tR + 0.3, c.t1 + 0.3, 'excited' ] ], { enter: t0 + 0.3, space: true } );
		},
	},
	// 6 ── "They wander through the galaxy, like a lost ball rolling forever."
	{
		key: 'wander', render( c ) {
			const t0 = c.t0, tB = at( 'ball' );
			night( c, 0.6 );
			const u = ( c.t - t0 ) / ( c.t1 - t0 );
			const path = ( k: number ) => V3( lerp( - 3.2, 3.2, k ) * ( c.V ? 0.55 : 1 ), Math.sin( k * 7 ) * 0.45 + Math.sin( k * 3 + 1 ) * 0.3 + ( c.V ? 0.4 : 0 ), 0 );
			const k = lerp( 0.15, 0.85, u );
			c.frame( V3( path( k ).x * 0.4, c.V ? 0.4 : 0, 0 ), 2.6 );
			const bounce = c.t > tB ? Math.abs( Math.sin( ( c.t - tB ) * 9 ) ) * Math.exp( - ( c.t - tB ) * 2.5 ) * 0.35 : 0;
			const p = path( k ).add( V3( 0, bounce, 0 ) );
			rogue( c, p, 0.42, { roll: - k * 18, spin: 0 } );
			// dotted trail behind it
			const dots = c.r.dots; dots.visible = true;
			for ( let i = 0; i < dots.count; i ++ ) {
				const kk = k - 0.03 - i * 0.012;
				const s = kk > 0 ? 0.035 * clamp( 1 - i / dots.count ) : 0;
				v3.copy( path( Math.max( 0, kk ) ) ); q.identity(); s3.setScalar( Math.max( 1e-4, s ) );
				m4.compose( v3, q, s3 ); dots.setMatrixAt( i, m4 );
			}
			dots.instanceMatrix.needsUpdate = true;
			label( c, p.clone().add( V3( 0, - 0.75, 0 ) ), 'lost ball?', tB + 0.1, c.t1, 0.32, '#c9d6ff' );
			buddy( c, 'L', [ [ t0, 'astronaut' ], [ tB, 'thinking' ] ], [ [ tB + 0.2, c.t1 + 0.3, 'sad' ] ], { space: true } );
		},
	},
	// 7 ── "So how does a planet lose its sun? … born around a star … a giant planet came too close. Its gravity pushed …"
	{
		key: 'lose', render( c ) {
			const t0 = c.t0, tBorn = at( 'born' ), tG = at( 'giant' ), tP = at( 'pushed' );
			night( c, 0.6 );
			const rr = c.r, w = c.w;
			const C = V3( 0, c.V ? 0.25 : 0, 0 );
			c.frame( C, 2.4 );
			star( c, w.star, C.clone().add( V3( 0, 0, - 0.6 ) ), 0.4 * spring( c.t - t0 - 0.1 ) );
			w.key.position.copy( C ).add( V3( 0, 0, 2 ) );
			rr.orbits.visible = c.t < tP + 1;
			rr.orbits.position.copy( C );
			rr.orbits.children.forEach( ( o, i ) => o.scale.setScalar( i === 1 ? 1.0 : i === 2 ? 1.7 : 0.0001 ) );
			// small planet on its orbit; the giant swings in close on "giant", then the kick on "pushed"
			const aS = c.t * 0.9;
			const near = smooth( remap( c.t, tG, tP ) );
			const kick = c.t > tP ? easeInCubic( clamp( ( c.t - tP ) / 2.2 ) ) : 0;
			const sm = C.clone().add( V3( Math.cos( aS ) * 1.0, Math.sin( aS ) * 0.35, Math.sin( aS ) * 0.4 ) );
			const kickDir = V3( 1, 0.45, 0 ).normalize();
			const smallPos = c.t < tP ? sm : C.clone().add( V3( Math.cos( tP * 0.9 ), Math.sin( tP * 0.9 ) * 0.35, 0 ) ).addScaledVector( kickDir, kick * 6 );
			const aG = c.t * 0.35;
			const gFar = C.clone().add( V3( Math.cos( aG ) * 1.7, Math.sin( aG ) * 0.6, Math.sin( aG ) * 0.5 ) );
			const gPos = gFar.lerp( smallPos.clone().add( V3( - 0.55, - 0.25, 0 ) ), near * ( 1 - kick ) * 0.85 );
			planet( c, w.P.jupiter, gPos, 0.42 * spring( c.t - t0 - 0.4 ), { spin: 0.5 } );
			rr.small.visible = true; rr.small.position.copy( smallPos ); rr.small.scale.setScalar( 0.18 * spring( c.t - t0 - 0.6 ) );
			const face = rr.small.userData.face as THREE.Mesh;
			( face.material as THREE.MeshBasicMaterial ).map = c.t > tP ? rr.small.userData.sad : rr.small.userData.happy;
			// glowing gravity arrows
			if ( c.t > tG + 0.3 ) {
				const a = c.px( gPos ), b = c.px( smallPos );
				const s = popInOut( c.t, tG + 0.3, tP + 0.9 );
				glowArrow( c.hud, a.x, a.y, a.x + ( b.x - a.x ) * 0.85, a.y + ( b.y - a.y ) * 0.85, 0.25, Math.min( 1, s ), PALETTE.yellow );
			}
			if ( c.t > tP + 0.1 ) c.hud.speedLines( c.t, 0.4 * clamp( 1.5 - ( c.t - tP ) ), 31 );
			tag( c, 'born around a star', tBorn, tG - 0.1, 0, '#7a8cff' );
			tag( c, 'a giant came too close', tG + 0.1, tP - 0.05, 0, '#ff8a5c' );
			c.hud.stat( c.t, tP + 0.2, c.t1 - 0.1, 'YEET!', c.sx, c.L.statY, c.L.statSize * 0.8, PALETTE.pink );
			buddy( c, 'L', [ [ t0, 'thinking' ], [ tG, 'nervous' ], [ tP, 'surprised_pose' ] ], [ [ tP + 0.3, c.t1 + 0.2, 'surprised' ] ], { space: true } );
		},
	},
	// 8 ── "Like getting kicked out of the group chat. Forever."
	{
		key: 'chat', render( c ) {
			const t0 = c.t0, tK = wordAfter( 'chat', 'kicked' ), tF = at( 'forever' );
			night( c, 0.6 );
			c.punch( V3(), 2.2, tK );
			const px = c.V ? c.W * 0.62 : c.W * 0.56, py = c.V ? c.H * 0.23 : c.H * 0.4, pw = c.V ? c.W * 0.4 : c.H * 0.38;
			phone( c.hud, px, py, pw, spring( c.t - t0, 2, 6 ) * ( 1 - easeInCubic( remap( c.t, tF + 0.9, c.t1 ) ) * 0.3 ), c.t, t0 + 0.2, tK + 0.1 );
			burst( c, 1, c.screen( ( px / c.W ) * 2 - 1, - ( ( py / c.H ) * 2 - 1 ), c.camDist * 0.9 ), 2.6, tK + 0.1, tK + 0.6 );
			// the small planet, sad, flies off-screen on "Forever"
			const rr = c.r;
			const fly = c.t > tF ? easeInCubic( clamp( ( c.t - tF ) / 1.0 ) ) : 0;
			if ( c.t > tF - 0.3 ) {
				rr.small.visible = true;
				const start = c.screen( ( ( px + pw * 0.1 ) / c.W ) * 2 - 1, - ( ( py + pw * 1.15 ) / c.H ) * 2 + 1, c.camDist * 0.8 );
				rr.small.position.copy( start ).add( V3( fly * 5, fly * 2.4, 0 ) );
				rr.small.scale.setScalar( c.lunaHeight( c.camDist * 0.8 ) * 0.22 * spring( c.t - tF + 0.3 ) );
				rr.small.rotation.z = - fly * 6;
				( ( rr.small.userData.face as THREE.Mesh ).material as THREE.MeshBasicMaterial ).map = rr.small.userData.sad;
				if ( fly > 0 ) c.hud.speedLines( c.t, 0.5 * ( 1 - fly ), 41, 1 );
			}
			const sl = c.slot( 'L' );
			// vertical: Luna a little right of the slot with her bubble on her left, clear of the phone
			const bub = c.bubbles( [ [ tK + 0.15, tF + 0.2, 'sad' ], [ tF + 0.4, c.t1 + 0.3, 'happy' ] ] );
			if ( bub && c.V ) ( bub as { side?: 1 | -1 } ).side = - 1;
			c.lunaAt( c.V ? - 0.3 : sl.x, c.V ? sl.y + 0.02 : sl.y, { sprite: c.t < tF + 0.3 ? 'sad_pose' : 'cheering', poseAt: c.t < tF + 0.3 ? tK : tF + 0.3, face: 1,
				bubble: bub }, ( t ) => t > tF + 0.3 ? hops( t, tF + 0.3, c.t1, { hopDur: 0.3, height: 0.08, wobble: 10 } ) : float( t, 0.5 ) );
		},
	},
	// 9 ── "Okay Luna, let's find one. But how do you find a planet that doesn't shine?"
	{
		key: 'find', render( c ) {
			const t0 = c.t0, tQ = at( 'doesntShine' );
			night( c, 0.8, 0.8 );
			c.frame( V3(), 2.0, { x: 0, y: c.V ? 0.1 : 0 } );
			c.hud.speedLines( c.t, 0.25, 51, - 1, 'rgba(180,200,255,0.5)' );
			const sp = V3( c.V ? - 0.35 : - 0.9, Math.sin( c.t * 1.2 ) * 0.06 + ( c.V ? 0.1 : 0 ), 0 );
			const S = c.w.ship;
			ship( c, sp, { rot: - Math.PI / 2 + 0.12 + Math.sin( c.t * 0.9 ) * 0.04, scale: 0.85, flame: 0.7, face: c.t > tQ ? 'confused' : 'happy', wobble: 0.3 } );
			S.group.updateMatrixWorld( true );
			const win = S.group.localToWorld( V3( 0, 0.42, 0.66 ) );
			// searching: the beam sweeps the dark
			const sweep = Math.sin( ( c.t - t0 ) * 1.4 ) * 1.2;
			c.torch = { on: smooth( remap( c.t, t0 + 0.3, t0 + 0.7 ) ), origin: win, aim: V3( win.x + 4, win.y + sweep, - 1 ), spread: 0.32, intensity: 0 };
			c.hud.text( '?', c.px( win ).x + c.W * 0.12, c.px( win ).y - c.H * 0.08, c.L.statSize * 0.9, { scale: popInOut( c.t, tQ + 0.4, c.t1 ), fill: PALETTE.yellow, rot: Math.sin( c.t * 4 ) * 0.2 } );
			tag( c, 'it doesn\'t shine…', tQ + 0.6, c.t1 - 0.05, 0, '#5b5878' );
		},
	},
	// 10 ── the microlensing trick
	{
		key: 'passes', render( c ) {
			const t0 = c.t0, tBend = at( 'bends' ), tBr = at( 'brighter' ), tF = at( 'flash' ), tS = at( 'something' );
			night( c, 0.5 );
			const C = V3( 0, c.V ? 0.45 : 0.15, 0 );
			c.frame( C, 2.0 );
			// the planet drifts across; it lines up with the star exactly on "brighter"
			const x = lerp( - 2.2, 2.2, ( c.t - ( tBr - ( tBr - t0 ) ) ) / ( ( tBr - t0 ) * 2 ) );
			const P = C.clone().add( V3( x, 0.05, 1.2 ) );
			const align = Math.exp( - Math.pow( x / 0.5, 2 ) );
			const sp = C.clone().add( V3( 0, 0, - 4 ) );
			star( c, c.w.star, sp, 0.16 * ( 1 + align * 0.9 ) );
			( ( c.w.star.userData.halo as THREE.Mesh ).material as THREE.MeshBasicMaterial ).opacity = 0.45 + align * 0.5;
			rogue( c, P, 0.42, { spin: 0.2 } );
			c.w.key.position.copy( sp ).add( V3( 0, 0, 1 ) ); c.w.key.intensity = 0.9;
			// bent light: glowing arcs from the star curving around the planet
			const bs = popInOut( c.t, tBend, c.t1 - 0.1 );
			if ( bs > 0 ) {
				const sP = c.px( sp ), pP = c.px( P ), pr = Math.abs( c.px( P.clone().add( V3( 0.42, 0, 0 ) ) ).x - pP.x );
				const g = c.hud.g; g.save(); g.lineCap = 'round';
				for ( const side of [ - 1, 1 ] ) for ( let k = 0; k < 2; k ++ ) {
					const off = pr * ( 1.25 + k * 0.35 ) * side;
					const endY = pP.y + ( c.V ? c.H * 0.3 : c.H * 0.36 );
					for ( const [ col, lw, a ] of [ [ '#ffe07a', 16, 0.25 ], [ '#ffe07a', 6, 0.85 ], [ '#ffffff', 2.5, 1 ] ] as const ) {
						g.globalAlpha = a * bs * ( 0.6 + 0.4 * align ); g.strokeStyle = col; g.lineWidth = lw;
						g.beginPath(); g.moveTo( sP.x + side * pr * 0.1, sP.y );
						g.quadraticCurveTo( pP.x + off * 1.1, pP.y, sP.x + ( pP.x - sP.x ) * 1.2 + side * pr * 0.25 * ( 1 - k * 0.4 ), sP.y + ( endY - sP.y ) * clamp( bs * 1.2 ) );
						g.stroke();
					}
				}
				g.restore();
			}
			// soft brightening (no white screen flash)
			c.w.bursts[ 0 ].visible = false;
			const glow = popInOut( c.t, tF, tF + 0.9 );
			if ( glow > 0 ) burst( c, 0, sp.clone().add( V3( 0, 0, 0.1 ) ), 0.9, tF, tF + 0.8 );
			const gx = c.V ? c.W * 0.5 : c.W * 0.8, gy = c.V ? c.H * 0.155 : c.H * 0.23, gw = c.V ? c.W * 0.42 : c.W * 0.22;
			lightCurve( c.hud, gx, gy, gw, popInOut( c.t, tBend + 0.3, c.t1 - 0.1 ), remap( c.t, tBend + 0.3, tS ), clamp( ( tBr + 0.4 - tBend - 0.3 ) / ( tS - tBend - 0.3 ) ) );
			c.hud.text( 'like a magnifying glass', c.sx, c.V ? c.H * 0.27 : c.L.statY, c.L.statSize * 0.38, { scale: popInOut( c.t, wordAfter( 'bends', 'magnifying' ), tBr - 0.1 ), fill: '#ffffff' } );
			c.hud.text( 'something is there!', c.sx, c.V ? c.H * 0.27 : c.L.statY, c.L.statSize * 0.46, { scale: popInOut( c.t, tS, c.t1 ), fill: PALETTE.yellow } );
			buddy( c, 'L', [ [ t0, 'astronaut' ], [ tBr, 'excited_pose' ], [ tS, 'surprised_pose' ] ], [ [ tBr + 0.1, tS - 0.15, 'excited' ], [ tS + 0.05, c.t1 + 0.3, 'surprised' ] ], { space: true } );
		},
	},
	// 11 ── "Found one! Let's land."
	{
		key: 'found', render( c ) {
			const t0 = c.t0, T = c.t1 - t0;
			night( c, 0.5, 0.7 );
			iceGround( c, 14, [ - 0.4, 2.4 ], 4, 1 );
			c.frame( V3( 0, 0.9, 0.4 ), 2.1, { x: 0, y: c.V ? 0.05 : 0.05 } );
			const tLand = t0 + T * 0.35, tDoor = t0 + T * 0.45, tOut = t0 + T * 0.5;
			const sy = lerp( 3.6, 1.28, easeOutCubic( remap( c.t, t0, tLand ) ) );
			ship( c, V3( - 1.0, sy, - 0.4 ), { flame: c.t < tLand ? 0.7 : clamp( 0.7 - ( c.t - tLand ) * 4 ), door: smooth( remap( c.t, tDoor - 0.1, tDoor + 0.1 ) ), face: c.t < tOut ? 'excited' : null } );
			if ( c.t > tLand - 0.15 ) puffs( c, c.w.clouds, V3( - 1.0, 0.15, 0 ), 1.3, 0.3, 0.28 * clamp( 1.2 - ( c.t - tLand ) * 1.5 ), 1, 3 );
			if ( c.t > tOut ) {
				const mo = ( t: number ) => hops( t, tOut, c.t1, { hopDur: 0.34, height: 0.16, wobble: 7 } );
				const pos = V3( - 1.0, 0.02, 0.3 ).lerp( V3( c.V ? 0.4 : 0.8, 0.02, 0.6 ), mo( c.t ).p );
				c.lunaWorld( pos, { sprite: 'astronaut', face: 1 }, mo );
				c.torch = { on: smooth( remap( c.t, tOut + 0.25, tOut + 0.45 ) ), aim: pos.clone().add( V3( 1.8, - 0.3, 1.0 ) ), spread: 0.45, intensity: 50 };
			}
			c.hud.stat( c.t, t0 + 0.05, c.t1, 'FOUND ONE!', c.sx, c.L.statY, c.L.statSize * 0.75, PALETTE.yellow );
		},
	},
	// 12 ── "Careful, Luna, it's freezing! … much colder than Antarctica."
	{
		key: 'careful', render( c ) {
			const t0 = c.t0, tA = at( 'antarctica' ), tAw = wordAfter( 'antarctica', 'antarctica' );
			night( c, 0.5, 0.7 );
			iceGround( c, 14, [ - 0.4, 2.4 ], 4, 1 );
			c.frame( V3( 0, 0.75, 0.4 ), 1.6, { x: 0, y: c.V ? 0.05 : 0.05 } );
			ship( c, V3( - 1.6, 1.28, - 0.8 ), { face: null } );
			// shivering: tiny shaky hops
			const mo = ( t: number ) => tremble( hops( t, t0 + 0.2, c.t1, { hopDur: 0.18, height: 0.025, wobble: 5, squash: 0.6 } ), t, 1.6 );
			const pos = V3( c.V ? 0.1 : - 0.1, 0.02, 0.6 ).add( V3( Math.sin( c.t * 2 ) * 0.04, 0, 0 ) );
			c.lunaWorld( pos, { sprite: 'nervous', poseAt: t0, face: 1 }, mo );
			c.torch = { on: 1, aim: pos.clone().add( V3( 1.5, - 0.25, 0.9 ) ), spread: 0.45, intensity: 45 };
			const H = c.luna!.height, head = c.px( pos.clone().add( V3( 0, H * 0.62, 0 ) ) ), hr = c.px( pos.clone().add( V3( H * 0.3, H * 0.62, 0 ) ) ).x - head.x;
			frost( c.hud, head.x, head.y, Math.abs( hr ), smooth( remap( c.t, t0, t0 + 2 ) ), c.t );
			// thermometer drops to the bottom and cracks
			const tx = c.V ? c.W * 0.8 : c.W * 0.82, ty = c.V ? c.H * 0.4 : c.H * 0.4, th = c.V ? c.H * 0.2 : c.H * 0.34;
			thermometer( c.hud, tx, ty, th, spring( c.t - t0 - 0.2 ), 1 - easeInOutCubic( remap( c.t, t0 + 0.4, tAw + 0.2 ) ), c.t, tAw + 0.35 );
			c.hud.stat( c.t, tA, c.t1 + 0.2, 'Colder than', c.sx, c.L.statY, c.L.statSize * 0.5, '#ffffff' );
			c.hud.stat( c.t, tAw, c.t1 + 0.2, 'ANTARCTICA', c.sx, c.L.statY + c.L.statSize * 0.65, c.L.statSize * 0.8, '#bfe6ff' );
			c.hud.stat( c.t, t0 + 0.1, tA - 0.1, 'brrr…', c.sx, c.L.statY, c.L.statSize * 0.6, '#bfe6ff' );
		},
	},
	// 13 ── "Luna, why did you bring sunscreen? There's no sun!"
	{
		key: 'sunscreen', render( c ) {
			const t0 = c.t0, tN = at( 'noSun' );
			night( c, 0.5, 0.75 );
			iceGround( c, 14, [ - 0.4, 2.4 ], 4, 1 );
			c.punch( V3( 0, 0.75, 0.4 ), 1.5, tN, { x: 0, y: c.V ? 0.05 : 0.05 } );
			const pos = V3( c.V ? 0 : - 0.2, 0.02, 0.6 );
			const hide = c.t > tN + 0.35;
			c.lunaWorld( pos, { sprite: c.t < tN + 0.35 ? 'cheering' : 'shy', poseAt: c.t < tN + 0.35 ? t0 + 0.2 : tN + 0.35, face: 1,
				bubble: c.bubbles( [ [ tN + 0.5, c.t1 + 0.3, 'embarrassed' ] ] ) }, ( t ) => t < tN ? hops( t, t0 + 0.2, t0 + 0.6, { hopDur: 0.4, height: 0.12 } ) : idle( t ) );
			c.torch = { on: 1, aim: pos.clone().add( V3( 1.5, - 0.2, 0.9 ) ), spread: 0.5, intensity: 40 };
			const H = c.luna!.height;
			// proudly held up, then whisked behind her back
			const up = c.px( pos.clone().add( V3( H * 0.32, H * 1.05, 0.05 ) ) );
			const back = c.px( pos.clone().add( V3( - H * 0.15, H * 0.35, 0.05 ) ) );
			const k = easeInOutCubic( remap( c.t, tN + 0.25, tN + 0.5 ) );
			const bh = c.V ? c.H * 0.08 : c.H * 0.13;
			if ( ! hide ) sunscreen( c.hud, lerp( up.x, back.x, k ), lerp( up.y, back.y, k ) + Math.sin( c.t * 5 ) * 4, bh, spring( c.t - t0 - 0.3 ) * ( 1 - k * 0.6 ), 0.15 + Math.sin( c.t * 4 ) * 0.05 );
			bigX( c.hud, up.x, up.y, bh * 0.75, popInOut( c.t, tN, tN + 0.9 ) );
			c.hud.stat( c.t, t0 + 0.4, tN - 0.05, 'SPF 50!', c.sx, c.L.statY, c.L.statSize * 0.7, PALETTE.yellow );
			c.hud.stat( c.t, tN + 0.05, c.t1 + 0.2, 'no sun!', c.sx, c.L.statY, c.L.statSize * 0.8, '#ff8fab' );
			burst( c, 1, pos.clone().add( V3( H * 0.3, H * 1.0, - 0.3 ) ), H * 1.2, tN, tN + 0.6 );
		},
	},
	// 14 ── cutaway: warm core, thick ice, hidden ocean
	{
		key: 'surprise', render( c ) {
			const t0 = c.t0, tW = at( 'warm' ), tC = at( 'core' ), tI = at( 'ice' ), tO = at( 'ocean' );
			night( c, 0.6 );
			const w = c.w, P = V3( 0, c.V ? 0.15 : 0, 0 );
			c.frame( V3( 0, c.V ? 0.15 : 0, 0 ), 1.9 );
			const cut = smooth( remap( c.t, tW - 0.3, tW + 0.6 ) );
			rogue( c, P, 1 * spring( c.t - t0 ) * ( 1 - cut ), { spin: 0.2 } );
			w.iceCut.visible = cut > 0; w.iceCut.position.copy( P ); w.iceCut.scale.setScalar( Math.max( 1e-4, cut ) );
			w.iceCut.rotation.set( 0.3, Math.PI * 0.75 - 0.45 + ( c.t - tW ) * 0.04, 0 );
			const pp = c.px( P );
			heatWaves( c.hud, pp.x, pp.y, c.W * ( c.V ? 0.3 : 0.16 ), c.H * ( c.V ? 0.12 : 0.2 ), c.t, popInOut( c.t, tC, c.t1 ) );
			c.hud.stat( c.t, t0 + 0.1, tW - 0.1, 'surprise!', c.sx, c.L.statY, c.L.statSize * 0.6, PALETTE.yellow );
			tag( c, 'warm core', tC, c.t1 - 0.05, 0, '#ff8a5c' );
			tag( c, 'thick ice', tI, c.t1 - 0.05, c.L.statSize * 0.62, '#7f8fc8' );
			tag( c, 'hidden ocean?', tO, c.t1 - 0.05, c.L.statSize * 1.24, '#3a64d2' );
			buddy( c, 'L', [ [ t0, 'astronaut' ], [ tC, 'excited_pose' ], [ tO, 'surprised_pose' ] ], [ [ tW + 0.2, tC - 0.1, 'thinking' ], [ tO + 0.3, c.t1 + 0.3, 'surprised' ] ], { space: true } );
		},
	},
	// 15 ── "Luna, shine your light down here." kneeling at a crack
	{
		key: 'shine', render( c ) {
			const t0 = c.t0;
			night( c, 0.4, 0.55 );
			iceGround( c, 14, [ - 0.4, 2.4 ], 4, 0.6 );
			const push = easeInOutCubic( remap( c.t, t0, c.t1 + 3.3 ) );
			c.frame( V3( 0.15, 0.45, 0.6 ), lerp( 1.25, 1.05, push ), { x: 0, y: c.V ? 0.05 : 0.05 }, t0, 0, 0 );
			holeAndLuna( c, push, 0 );
		},
	},
	// 16 ── "Do you hear that? Crack. The ice is breaking!"
	{
		key: 'hear', render( c ) {
			const t0 = c.t0, tC = at( 'crack' ), tB = at( 'breaking' );
			night( c, 0.4, 0.55 );
			iceGround( c, 14, [ - 0.4, 2.4 ], 4, 0.6 );
			const push = easeInOutCubic( remap( c.t, at( 'shine' ), c.t1 ) );
			const shake = c.t > tC ? clamp( 1.2 - ( c.t - tC ) * 1.5 ) + ( c.t > tB ? 0.5 : 0 ) : 0;
			c.frame( V3( 0.15, 0.45, 0.6 ), lerp( 1.25, 1.05, push ), { x: 0, y: c.V ? 0.05 : 0.05 }, t0, shake, 0 );
			if ( c.t > tC && c.t < tC + 0.12 ) c.flash = 0.18 * ( 1 - ( c.t - tC ) / 0.12 );   // one soft flash on "Crack"
			const hole = holeAndLuna( c, push, 1 );
			// the crack shoots across, then spreads under her feet
			const W = c.W, a = hole.hole, f = hole.feet;
			crack( c.hud, a.x, a.y, a.x + W * 0.55, a.y - c.H * 0.02, easeOutCubic( remap( c.t, tC, tC + 0.18 ) ), 5, 3, 3 );
			crack( c.hud, a.x, a.y, - W * 0.05, a.y + c.H * 0.04, easeOutCubic( remap( c.t, tC + 0.05, tC + 0.25 ) ), 4, 7, 2 );
			crack( c.hud, f.x, f.y, f.x + W * 0.18, f.y + c.H * 0.06, easeOutCubic( remap( c.t, tB + 0.05, tB + 0.4 ) ), 4, 11, 2 );
			crack( c.hud, f.x, f.y, f.x - W * 0.2, f.y + c.H * 0.03, easeOutCubic( remap( c.t, tB + 0.15, tB + 0.5 ) ), 4, 13, 2 );
			c.hud.stat( c.t, tC, tB - 0.05, 'CRACK!', c.sx, c.L.statY, c.L.statSize * 0.95, '#ffffff' );
		},
	},
	// 17 ── "RUN, LUNA! Back to the ship!"
	{
		key: 'run', render( c ) {
			const t0 = c.t0, T = c.t1 - t0;
			night( c, 0.5, 0.7 );
			iceGround( c, 14, [ - 0.5, 2.0 ], 6, 0.5 );
			const tLeap = t0 + T * 0.5, leapDur = T * 0.2, tIn = tLeap + leapDur, tBlast = tIn + T * 0.08;
			const x0 = c.V ? - 1.3 : - 2.4, x1 = c.V ? 0.55 : 1.2;
			const shipP = V3( x1 + ( c.V ? 0.6 : 1.0 ), 1.28, 0.1 );
			const run = ( t: number ) => hops( t, t0 + 0.02, tLeap, { hopDur: 0.24, height: 0.3, wobble: 15, squash: 1.2, lean: 0.3 } );
			const m = run( c.t );
			const camX = lerp( x0 + 0.6, x1, smooth( remap( c.t, t0, tIn ) ) );
			c.frame( V3( camX, 0.8, 0.4 ), 1.8, { x: 0, y: c.V ? 0.05 : 0.05 }, t0, 0.9 );
			c.hud.speedLines( c.t, 0.55, 61, - 1, 'rgba(200,225,255,0.6)' );
			// ice splitting behind her: slabs tilt and sink
			const sl = c.r.slabs; sl.visible = true;
			const front = c.t < tLeap ? lerp( x0, x1, m.p ) : x1 + ( c.t - tLeap ) * 3;
			for ( let i = 0; i < sl.count; i ++ ) {
				const sx = x0 - 1.6 + i * 0.62;
				const behind = front - sx;
				const k = clamp( ( behind - 0.3 ) / 1.6 ) * ( c.t > tBlast ? 1.5 : 1 );
				e3.set( hash( i ) * 0.6 * k, 0, ( hash( i + 4 ) - .5 ) * 1.4 * k ); q.setFromEuler( e3 );
				v3.set( sx, - 0.12 - k * k * 0.9, 0.4 + ( hash( i + 2 ) - .5 ) * 0.6 ); s3.set( 0.58, 1, 1 );
				m4.compose( v3, q, s3 ); sl.setMatrixAt( i, m4 ); c.r.slabOl.setMatrixAt( i, m4 );
			}
			sl.instanceMatrix.needsUpdate = true; c.r.slabOl.instanceMatrix.needsUpdate = true;
			const blast = c.t > tBlast ? Math.pow( c.t - tBlast, 2 ) * 16 : 0;
			ship( c, shipP.clone().add( V3( blast * 0.3, blast, 0 ) ), { flame: c.t > tBlast - 0.15 ? 1.2 : 0.3, door: 1 - smooth( remap( c.t, tIn, tIn + 0.06 ) ), face: c.t > tIn ? 'crying' : null, wobble: c.t > tIn ? 1.5 : 0 } );
			if ( c.t > tBlast - 0.1 ) puffs( c, c.w.clouds, shipP.clone().add( V3( 0, - 1.1, 0.3 ) ), 1.2, 0.2, 0.3 * clamp( 1.5 - ( c.t - tBlast ) * 2 ), 1, 9 );
			if ( c.t < tIn ) {
				let pos: THREE.Vector3, mo: ( t: number ) => Motion;
				if ( c.t < tLeap ) { mo = run; pos = V3( lerp( x0, x1, m.p ), 0.02, 0.7 ); }
				else { mo = ( t ) => leap( t, tLeap, leapDur, 0.9 ); pos = V3( x1, 0.02, 0.7 ).lerp( shipP.clone().add( V3( 0, - 0.65, 0.6 ) ), mo( c.t ).p ); }
				c.lunaWorld( pos, { sprite: 'scared', face: 1, alpha: 1 - easeInCubic( remap( c.t, tIn - 0.08, tIn ) ), bubble: c.bubbles( [ [ t0 + 0.05, tLeap, 'crying' ] ] ) }, mo );
			}
			c.hud.stat( c.t, t0, tLeap, 'RUN!', c.sx, c.L.statY, c.L.statSize * 1.1, '#ff8fab' );
		},
	},
	// 18 ── "Phew. That was close." in the ship
	{
		key: 'phew', render( c ) {
			const t0 = c.t0, w = c.w;
			w.interior.visible = true; w.interior.position.set( 0, 0, 0 );
			w.scene.background = new THREE.Color( '#141a44' ); w.stars.visible = false;
			w.hemi.intensity = 1.0;
			c.frame( V3( 0, - 0.5, - 1.0 ), 1.15, { x: 0, y: c.V ? 0.12 : 0.05 } );
			const fluff = 1 - smooth( remap( c.t, t0 + 0.6, c.t1 + 0.6 ) );
			c.lunaWorld( V3( 0, - 1.1, - 0.7 ), { sprite: 'astronaut_sit', face: - 1, fluff: 0.6 + fluff * 0.6, shadow: 0.6,
				bubble: c.bubbles( [ [ t0 + 0.15, t0 + 1.2, 'dizzy' ], [ t0 + 1.35, c.t1 + 0.4, 'happy' ] ] ) }, ( t ) => idle( t, 0.3 ) );
		},
	},
	// 19 ── "Okay, let's be honest. … telescope data and computer models. And new telescopes …"
	{
		key: 'honest', render( c ) {
			const t0 = c.t0, tN = at( 'nobody' ), tO = at( 'oceansQ' ), tM = at( 'models' ), tT = at( 'newTel' );
			night( c, 0.6 );
			const P = V3( c.V ? 0 : 0.2, c.V ? - 0.1 : - 0.15, 0 );
			c.frame( V3(), c.V ? 2.3 : 2.0 );
			rogue( c, P.clone().add( V3( Math.sin( c.t * 0.2 ) * 0.1, 0, 0 ) ), 0.8 * spring( c.t - t0 ), { tumble: 0.3 } );
			pill( c.hud, 'Not confirmed', c.sx, c.L.statY, c.L.statSize * 0.36, popInOut( c.t, tN, c.t1 - 0.1 ), '#ffffff', '#ff6b81' );
			c.hud.text( 'nobody has been there', c.sx, c.L.statY + c.L.statSize * 0.75, c.L.statSize * 0.3, { scale: popInOut( c.t, tN + 0.3, tM - 0.05 ), fill: '#ffffff' } );
			pill( c.hud, 'Telescope data + computer models', c.sx, c.L.statY + c.L.statSize * 0.75, c.L.statSize * ( c.V ? 0.24 : 0.28 ), popInOut( c.t, tM, c.t1 - 0.1 ), PALETTE.ink, '#ffe07a' );
			// a cute toon telescope glides in and scans the dark
			const g = easeOutCubic( remap( c.t, tT, tT + 1.4 ) );
			const tel = c.r.telescope;
			tel.visible = c.t > tT;
			const tp = V3( lerp( c.V ? - 2.6 : - 3.8, c.V ? - 0.6 : - 1.4, g ), c.V ? 1.15 : 0.75, 0.4 );
			tel.position.copy( tp ); tel.scale.setScalar( c.V ? 0.4 : 0.5 ); tel.rotation.set( 0.2, - 0.3, - 0.25 + Math.sin( c.t * 0.8 ) * 0.08 );
			if ( c.t > tT + 0.8 ) {
				const sb = c.r.scanBeam; sb.visible = true;
				const sweep = Math.sin( ( c.t - tT ) * 1.2 ) * 0.5;
				const dir = V3( 1, - 0.55 + sweep, 0 ).normalize(), len = 3;
				tel.updateMatrixWorld( true );
				const origin = tel.localToWorld( V3( 0.85, 0, 0 ) );
				sb.position.copy( origin ); sb.quaternion.setFromUnitVectors( V3( 0, - 1, 0 ), dir ); sb.scale.set( Math.tan( 0.25 ) * len, len, Math.tan( 0.25 ) * len );
				( sb.material as THREE.ShaderMaterial ).uniforms.uOpacity.value = 0.35 * smooth( remap( c.t, tT + 0.8, tT + 1.2 ) );
			}
			buddy( c, 'L', [ [ t0, 'thinking' ], [ tT, 'excited_pose' ] ], [ [ t0 + 0.3, tO + 1.0, 'thinking' ], [ tT + 0.4, c.t1 + 0.3, 'happy' ] ], { space: true } );
		},
	},
	// 20 ── "Think about it. … never seeing a sunrise. And here we are, with a brand new sunrise every day."
	{
		key: 'think', render( c ) {
			const t0 = c.t0, tH = at( 'hereWe' ), tE = at( 'everyDay' );
			const w = c.w, rr = c.r;
			// slow cross-fade through the dark from the rogue planet to Earth's sunrise
			const dip = Math.exp( - Math.pow( ( c.t - ( tH - 0.1 ) ) / 0.45, 2 ) );
			c.dim = Math.max( c.dim, dip * 0.92 );
			if ( c.t < tH - 0.1 ) {
				night( c, 0.35, 0.7 );
				c.frame( V3(), 2.2, undefined, t0, 0, 0 );
				rogue( c, V3( lerp( - 0.4, 0.4, remap( c.t, t0, tH ) ), c.V ? - 0.1 : 0, 0 ), 0.75, { tumble: 0.6 } );
				c.vignette = 0.7;
				return;
			}
			night( c, 0.5, 1 );
			const rise = easeInOutCubic( remap( c.t, tH, c.t1 ) );
			const E = V3( 0, c.V ? - 3.0 : - 3.3, 0 );
			c.frame( V3( 0, 0.1, 0 ), 2.0, { x: 0, y: c.V ? 0.1 : 0 }, tH, 0, 0 );
			planet( c, w.P.earth, E, 3, { spin: 0.04, tilt: 0.1 } );
			const sunP = V3( c.V ? 0.4 : 0.9, lerp( - 0.15, 0.55, rise ), - 3 );
			rr.sunDisc.visible = true; rr.sunDisc.position.copy( sunP ); rr.sunDisc.scale.setScalar( 0.28 );
			rr.dawn.visible = true; rr.dawn.position.set( sunP.x, sunP.y, - 3.2 ); rr.dawn.scale.set( 9, 5.5, 1 );
			( rr.dawn.material as THREE.MeshBasicMaterial ).opacity = 0.6 + rise * 0.4;
			w.key.position.copy( sunP ).add( V3( 0, 0.5, 2 ) ); w.key.color.set( '#ffd2a0' ); w.key.intensity = 2.4;
			( w.stars.material as THREE.ShaderMaterial ).uniforms.uOpacity.value = 0.5 * ( 1 - rise );
			c.hud.stat( c.t, tE, c.t1 + 0.3, 'a new sunrise, every day', c.sx, c.L.statY, c.L.statSize * 0.46, PALETTE.peach );
		},
	},
	// 21 ── "And here's the thing… But you can." dawn hill, Luna from behind
	{
		key: 'thing', render( c ) {
			const t0 = c.t0, w = c.w, rr = c.r;
			w.scene.background = new THREE.Color( '#141a44' );
			w.hill.visible = true; w.hill.position.set( 0, 0, 0 );
			w.hill.children[ w.hill.children.length - 1 ].visible = false; w.hill.children[ w.hill.children.length - 2 ].visible = false; // no moon: it's dawn
			w.hemi.intensity = 1.0; w.hemi.color.set( '#ffd9c2' ); w.key.color.set( '#ffc9a0' ); w.key.intensity = 1.6; w.key.position.set( 2, 1, - 5 );
			const push = smooth( remap( c.t, t0, c.t1 + 3 ) );
			const fade = remap( c.t, t0, c.t1 );
			( w.stars.material as THREE.ShaderMaterial ).uniforms.uOpacity.value = 0.9 - fade * 0.6;
			( w.stars.material as THREE.ShaderMaterial ).uniforms.uTwinkle.value = 0.6;
			c.frame( V3( 0, lerp( 1.1, 0.75, push ), 0 ), lerp( 2.6, 1.7, push ), { x: 0, y: c.V ? - 0.1 : - 0.15 }, t0, 0, 0 );
			const sunY = lerp( - 0.15, 0.25, fade );
			rr.dawn.visible = true; rr.dawn.position.set( c.V ? 1.3 : 2.0, sunY + 0.1, - 9 ); rr.dawn.scale.set( 22, 9, 1 );
			( rr.dawn.material as THREE.MeshBasicMaterial ).opacity = 0.75;
			rr.sunDisc.visible = true; rr.sunDisc.position.set( c.V ? 1.35 : 2.1, sunY - 0.2, - 8.9 ); rr.sunDisc.scale.setScalar( 0.5 );
			c.lunaWorld( V3( c.V ? - 0.1 : - 0.4, 0.02, 0.6 ), { sprite: 'back', face: - 1, silhouette: 1, shadow: 0.5 }, ( t ) => idle( t, 0 ) );
			c.vignette = 0.45;
		},
	},
	// 22 ── "Space is truly amazing. And this is only the beginning."
	{
		key: 'amazing', render( c ) {
			const t0 = c.t0, tB = at( 'beginning' ), w = c.w, rr = c.r;
			w.scene.background = new THREE.Color( '#0f1438' );
			const back = easeInOutCubic( remap( c.t, t0, t0 + 3 ) );
			w.hill.visible = true; w.hill.position.set( 0, 0, 0 );
			w.hill.children[ w.hill.children.length - 1 ].visible = false; w.hill.children[ w.hill.children.length - 2 ].visible = false; // no moon: it's dawn
			rr.dawn.visible = true; rr.dawn.position.set( c.V ? 1.3 : 2.0, 0.35, - 9 ); rr.dawn.scale.set( 22, 9, 1 );
			( rr.dawn.material as THREE.MeshBasicMaterial ).opacity = 0.75 * ( 1 - back * 0.5 );
			w.hemi.intensity = 1.0; w.hemi.color.set( '#ffd9c2' );
			c.frame( V3( 0, lerp( 0.75, 1.7, back ), 0 ), lerp( 1.7, 3.4, back ), { x: 0, y: c.V ? - 0.1 : - 0.15 } );
			const turn = t0 + 0.5, hopT = t0 + 1.0;
			const sprite = c.t < turn ? 'back' : c.t < hopT + 0.4 ? 'casual' : 'waving';
			const mo = ( t: number ) => hops( t, hopT, hopT + 0.4, { hopDur: 0.4, height: 0.25, wobble: 8 } );
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

/** Shared by scenes 15/16: Luna kneels at a dark crack and shines her light down into the water. Returns HUD points. */
function holeAndLuna( c: Stage, push: number, phase: number ) {
	const tB = at( 'breaking' ), tC = at( 'crack' ), tHear = at( 'hear' );
	const holeW = V3( c.V ? 0.5 : 0.75, 0.0, 1.05 );
	// the dark hole: a soft dark-blue ellipse on the ice, glowing faintly
	const hp = c.px( holeW ), edge = c.px( holeW.clone().add( V3( 0.35, 0, 0 ) ) );
	const rx = Math.abs( edge.x - hp.x ), g = c.hud.g;
	g.save();
	const grd = g.createRadialGradient( hp.x, hp.y, 0, hp.x, hp.y, rx );
	grd.addColorStop( 0, 'rgba(10,30,80,0.98)' ); grd.addColorStop( 0.7, 'rgba(20,50,120,0.9)' ); grd.addColorStop( 1, 'rgba(120,190,255,0.0)' );
	g.fillStyle = grd; g.beginPath(); g.ellipse( hp.x, hp.y, rx, rx * 0.32, 0, 0, Math.PI * 2 ); g.fill();
	g.strokeStyle = 'rgba(200,235,255,0.8)'; g.lineWidth = 4; g.beginPath(); g.ellipse( hp.x, hp.y, rx * 0.92, rx * 0.29, 0, Math.PI * 1.05, Math.PI * 1.95 ); g.stroke();
	g.restore();
	const pos = V3( c.V ? - 0.15 : 0.05, 0.02, 0.9 );
	const stand = phase > 0 && c.t > tB + 0.3;
	c.lunaWorld( pos, { sprite: stand ? 'scared' : 'astronaut_sit', poseAt: stand ? tB + 0.3 : undefined, face: 1,
		bubble: phase > 0 ? c.bubbles( [ [ tHear + 0.15, tC - 0.05, 'confused' ], [ tC + 0.1, tB + 0.25, 'surprised' ], [ tB + 0.35, c.t1 + 0.4, 'crying' ] ] ) : null },
	( t ) => phase > 0 && t > tHear ? tremble( idle( t, 0 ), t, t > tB ? 1.4 : 0.6 ) : idle( t, 0.05 ) );
	c.torch = { on: 1, aim: holeW.clone().add( V3( 0, - 0.25, 0 ) ), spread: 0.32, intensity: 30 };
	void push;
	return { hole: hp, feet: c.px( pos ) };
}

export { atEnd, wobble, sweat };
