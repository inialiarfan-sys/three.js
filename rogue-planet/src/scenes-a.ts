// Scenes 0–11. Every gag is keyed to the exact word in the transcript.
import * as THREE from 'three';
import { at, atEnd, wordAfter } from './timeline';
import { clamp, easeInCubic, easeInOutCubic, easeOutCubic, lerp, popInOut, remap, smooth, spring } from './engine/math';
import { PALETTE } from './engine/toon';
import { bigX, pill, routeMap, stamp, sweat } from './engine/hud';
import { burst, cape, crowd, planet, puffs, solarSystem, V3 } from './props';
import { float, hops, idle, leap, type Motion } from './motion';
import type { Expr } from './luna';
import type { Stage } from './stage';

export interface SceneDef { key: string; render: ( c: Stage ) => void }

export function stat( c: Stage, t0: number, t1: number, str: string, sub?: string, fill: string = PALETTE.yellow, dy = 0, size = 1 ) {
	c.hud.stat( c.t, t0, t1, str, c.sx, c.L.statY + dy, c.L.statSize * size, fill, sub );
}
export function label( c: Stage, p: THREE.Vector3, str: string, t0: number, t1: number, size = 0.4, fill = '#ffffff', dy = 0 ) {
	const s = popInOut( c.t, t0, t1 );
	if ( s <= 0 ) return;
	const q = c.px( p );
	c.hud.text( str, q.x, q.y + dy, c.L.statSize * size, { scale: s, fill, rot: Math.sin( c.t * 2 ) * 0.03 } );
}
export const cycle = ( m: ( t: number ) => Motion ) => m;

type Sprite = Parameters<Stage[ 'lunaAt' ]>[ 2 ][ 'sprite' ];
/**
 * Luna as the on-screen buddy in a slot: pose schedule [[t, sprite]], bubble list, and she pops
 * in with a spring at `enter` (hopping in from off-screen). space=true floats instead of standing.
 */
export function buddy( c: Stage, side: 'L' | 'R', poses: [ number, Sprite ][], bubbles: [ number, number, Expr ][], o: { enter?: number; space?: boolean; face?: number } = {} ) {
	const sl = c.slot( side );
	const enter = o.enter ?? c.t0;
	if ( c.t < enter ) return;
	const p = c.sched( poses );
	const hopIn = ( t: number ) => hops( t, enter, enter + 0.72, { hopDur: 0.36, height: 0.2, wobble: 8 } );
	const inProg = hopIn( c.t ).p;
	const from = side === 'L' ? - 1.35 : 1.35;
	const x = c.t < enter + 0.72 ? lerp( from, sl.x, inProg ) : sl.x;
	const motion = ( t: number ) => ( t < enter + 0.72 ? hopIn( t ) : o.space ? float( t, 0.5 ) : idle( t ) );
	const bub = c.bubbles( bubbles );
	let bx = x;
	if ( c.V && side === 'L' ) { bx = x + 0.12; if ( bub ) ( bub as { side?: 1 | -1 } ).side = - 1; }   // vertical: bubble on her outer side, away from the key visual
	c.lunaAt( bx, sl.y, { sprite: p.v, poseAt: p.at, face: o.face ?? ( side === 'L' ? 1 : - 1 ), shadow: o.space ? 0.35 : 1, bubble: bub }, motion );
}

/** Ship helper: position/rotation + flame/door/face */
export function ship( c: Stage, pos: THREE.Vector3, o: { rot?: number; scale?: number; flame?: number; door?: number; face?: Parameters<Stage[ 'w' ][ 'ship' ][ 'pose' ]>[ 1 ][ 'face' ]; wobble?: number } = {} ) {
	const s = c.w.ship;
	s.group.visible = true;
	s.group.position.copy( pos );
	s.group.rotation.set( 0, 0, o.rot ?? 0 );
	s.group.scale.setScalar( o.scale ?? 1 );
	s.pose( c.t, { flame: o.flame, door: o.door, face: o.face ?? null, wobble: o.wobble } );
}

export const SCENES_A: SceneDef[] = [
	// 0 ── title card (before the first anchor)
	{
		key: 'title', render( c ) {
			c.frame( V3(), 2.2 );
			const s = spring( c.t - 0.3 );
			planet( c, c.w.P.rock, V3( 0, c.V ? - 0.4 : - 0.3, - 1 ), 0.9 * s, { spin: 0.2 } );
			c.hud.text( 'THE PLANET', c.W / 2, c.L.titleY, c.L.titleSize, { scale: spring( c.t - 0.1 ), fill: '#ffffff', rot: - 0.04 } );
			c.hud.text( 'WE ARE MISSING', c.W / 2, c.L.titleY + c.L.titleSize * 1.1, c.L.titleSize * 0.9, { scale: spring( c.t - 0.35 ), fill: PALETTE.peach, rot: 0.03 } );
			buddy( c, 'R', [ [ 0, 'astronaut' ], [ 1.3, 'waving' ] ], [ [ 1.4, c.t1 + 0.3, 'happy' ] ], { enter: 0.45, space: true } );
		},
	},
	// 1 ── "The most common planet in our galaxy… is one we don't have."
	{
		key: 'common', render( c ) {
			const t0 = c.t0, tQ = at( 'dontHave' );
			const w = c.w;
			w.milky.visible = true; w.milky.rotation.set( 1.05, 0, 0.3 ); w.milky.children[ 0 ].rotation.y = c.t * 0.02;
			const z = easeInOutCubic( remap( c.t, t0, tQ + 0.5 ) );
			c.frame( V3( 0, 0, 0 ), lerp( 30, 12, z ) );
			crowd( c, V3( 0, 0, 4 ), 1.2, t0 + 0.2, 2.5 );
			const s = popInOut( c.t, tQ + 0.15, c.t1 + 0.3 );
			c.hud.text( '?', c.W / 2, c.H * ( c.V ? 0.36 : 0.42 ), c.L.statSize * 3.2, { scale: s, fill: PALETTE.yellow, rot: Math.sin( c.t * 3 ) * 0.08 } );
			buddy( c, 'L', [ [ t0, 'astronaut' ], [ tQ + 0.2, 'confused_pose' ] ], [], { enter: t0 + 0.6, space: true } );   // the big "?" is the bubble here
		},
	},
	// 2 ── "Not Mercury. Not Jupiter. Not Earth. Something in between."
	{
		key: 'notMercury', render( c ) {
			const tM = c.t0, tJ = at( 'notJupiter' ), tE = at( 'notEarth' ), tB = at( 'between' );
			c.cuts( tJ, tE, tB );
			const shots: [ number, number, keyof Stage[ 'w' ][ 'P' ] | 'mystery', string, number ][] = [
				[ tM, tJ, 'mercury', 'Mercury', 0.75 ], [ tJ, tE, 'jupiter', 'Jupiter', 1.1 ], [ tE, tB, 'earth', 'Earth', 0.95 ], [ tB, c.t1, 'mystery', 'something in between', 1.0 ] ];
			const cur = shots.find( ( s ) => c.t >= s[ 0 ] && c.t < s[ 1 ] ) ?? shots[ 3 ];
			const [ a, , key, name, R ] = cur;
			c.frame( V3(), 1.7, undefined, a );
			const s = spring( c.t - a, 2.2, 6 );
			if ( key === 'mystery' ) {
				c.w.mystery.visible = true; c.w.mystery.position.set( 0, 0, 0 ); c.w.mystery.scale.setScalar( R * s ); c.w.mystery.rotation.y = c.t * 0.3;
				c.hud.text( '?', c.px( V3() ).x, c.px( V3() ).y, c.L.statSize * 1.6, { scale: spring( c.t - a - 0.2 ), fill: PALETTE.periwinkle } );
			} else planet( c, c.w.P[ key ], V3(), R * s, { spin: 0.4 } );
			stat( c, a + 0.02, cur[ 1 ] - 0.05, name, undefined, key === 'mystery' ? PALETTE.periwinkle : '#ffffff', 0, key === 'mystery' ? 0.55 : 0.8 );
			if ( key !== 'mystery' ) {
				const p = c.px( V3() );
				const xw = wordAfter( key === 'mercury' ? 'notMercury' : key === 'jupiter' ? 'notJupiter' : 'notEarth', key );
				bigX( c.hud, p.x, p.y, c.W * ( c.V ? 0.26 : 0.14 ), spring( c.t - xw - 0.15, 2.5, 7 ) );
			}
			buddy( c, 'L', [ [ tM, 'nervous' ], [ tJ, 'crossed_arms' ], [ tE, 'grumpy' ], [ tB, 'thinking' ] ],
				[], { enter: tM - 0.4, space: true } );   // poses only: a bubble would sit on the planet
		},
	},
	// 3 ── "Scientists call it a super-Earth. No, it doesn't wear a cape."
	{
		key: 'superEarth', render( c ) {
			const t0 = c.t0, tCape = wordAfter( 'cape', 'cape' ), tNo = at( 'cape' ), tEnd = atEnd( 'cape' );
			const P = V3( 0, c.V ? 0.1 : 0, 0 );
			c.punch( V3( 0, 0.1, 0 ), 1.7, tCape );
			const s = spring( c.t - t0 - 0.1, 1.8, 5 );
			planet( c, c.w.P.rock, P, 1 * s, { spin: 0.3 } );
			burst( c, 0, V3( 0, 0, - 1.5 ), 4.4, t0 + 0.1, t0 + 1.2 );
			const sw = wordAfter( 'superEarth', 'super-earth' );
			stat( c, sw, c.t1 - 0.1, 'SUPER-EARTH', undefined, PALETTE.mint, 0, 0.85 );
			// the cape: pops on at "No", X on "cape", then slides off
			const show = spring( c.t - tNo, 2.4, 6 );
			const fall = easeInCubic( remap( c.t, tEnd + 0.35, tEnd + 1.3 ) );
			cape( c, P, 1 * s, show, fall );
			burst( c, 1, V3( 0.9, 0.7, 0.8 ), 1.6, tCape, tCape + 0.6 );
			const p = c.px( P.clone().add( V3( 0, - 0.2, 1 ) ) );
			bigX( c.hud, p.x, p.y, c.W * ( c.V ? 0.17 : 0.09 ), popInOut( c.t, tCape + 0.05, tEnd + 1.1 ) );
			buddy( c, 'L', [ [ t0, 'excited_pose' ], [ tNo, 'surprised_pose' ], [ tCape + 0.05, 'cheering' ], [ tEnd + 0.6, 'pointing' ] ],
				[], { space: true } );
		},
	},
	// 4 ── "So today, we're going to find one. Luna, grab your helmet. Let's go on an adventure!"
	{
		key: 'findOne', render( c ) {
			const t0 = c.t0, tH = at( 'helmet' ), tA = at( 'adventure' ), tGo = atEnd( 'adventure' );
			const w = c.w;
			w.pad.visible = true; w.pad.position.set( 0, 0, 0 );
			const tLeap = tA + 0.25, leapDur = 0.6, tIn = tLeap + leapDur;
			const tBlast = Math.max( tIn + 0.45, tGo - 0.2 );
			const rise = c.t > tBlast ? Math.pow( c.t - tBlast, 2 ) * 2.4 : 0;
			const shipPos = V3( 0, 1.55 + rise, 0 );
			const camY = 1.4 + Math.max( 0, rise - 0.5 ) * 0.9;
			c.frame( V3( c.V ? 0 : - 0.4, camY, 0 ), 2.7, { x: 0, y: c.V ? 0.12 : 0.05 }, t0, c.t > tBlast ? clamp( 1.4 - ( c.t - tBlast ) ) : 0 );
			const door = clamp( 1 - remap( c.t, tIn, tIn + 0.2 ) );
			ship( c, shipPos, { flame: c.t > tBlast - 0.3 ? 0.4 + clamp( ( c.t - tBlast ) * 2 ) : 0, door, face: c.t > tIn + 0.1 ? 'excited' : null, wobble: c.t > tBlast - 0.3 ? 1 : 0 } );
			if ( c.t > tBlast - 0.2 ) puffs( c, w.clouds, V3( 0, 0.4, 0.6 ), 2.4, 0.4, 0.5 * clamp( ( c.t - tBlast + 0.2 ) * 2 ) * clamp( 2 - ( c.t - tBlast ) ), 1, 5 );
			// Luna: waits by the pad, hops excitedly over, big leap into the door
			if ( c.t < tIn ) {
				const start = V3( c.V ? - 1.9 : - 2.6, 0.25, 0.9 ), mid = V3( - 0.8, 0.25, 0.9 ), doorP = V3( 0, 1.0, 0.65 );
				let pos: THREE.Vector3, mo: ( t: number ) => Motion;
				if ( c.t < tLeap ) {
					mo = ( t ) => hops( t, tH + 0.15, tLeap, { hopDur: 0.26, height: 0.22, wobble: 10 } );
					pos = start.clone().lerp( mid, mo( c.t ).p );
				} else {
					mo = ( t ) => leap( t, tLeap, leapDur, 1.3 );
					pos = mid.clone().lerp( doorP, mo( c.t ).p );
				}
				const shrink = 1 - easeInCubic( remap( c.t, tIn - 0.15, tIn ) );
				c.lunaWorld( pos, { sprite: c.t > tH ? 'excited_pose' : 'astronaut', poseAt: tH, face: 1, alpha: shrink, bubble: c.bubbles( [ [ tH + 0.1, tLeap - 0.1, 'excited' ] ] ) }, mo );
			}
		},
	},
	// 5 ── "So what exactly is a super-Earth? bigger than Earth, smaller than Neptune. rocky / oceans"
	{
		key: 'whatIs', render( c ) {
			const t0 = c.t0, tB = at( 'bigger' ), tS = at( 'smaller' ), tR = at( 'rocky' ), tO = at( 'oceans' );
			const P = c.w.P;
			const sw = easeInOutCubic( remap( c.t, tR - 0.2, tR + 0.5 ) );
			c.frame( V3( 0, 0, 0 ), c.V ? 2.6 : 2.0 );
			if ( sw < 1 ) {
				const k = 1 - sw;
				const xs = c.V ? [ - 1.2, - 0.15, 1.15 ] : [ - 2.4, - 0.95, 0.85 ];
				const y = c.V ? 0.3 : - 0.05;
				planet( c, P.earth, V3( xs[ 0 ], y, 0 ), ( c.V ? 0.3 : 0.42 ) * spring( c.t - t0 - 0.1 ) * k );
				planet( c, P.rock, V3( xs[ 1 ], y, 0 ), ( c.V ? 0.45 : 0.68 ) * spring( c.t - tB ) * k );
				planet( c, P.neptune, V3( xs[ 2 ], y, 0 ), ( c.V ? 0.68 : 1.0 ) * spring( c.t - tS ) * k );
				label( c, V3( xs[ 0 ], y - ( c.V ? 0.5 : 0.62 ), 0 ), 'Earth', t0 + 0.3, tR - 0.2, 0.3 );
				label( c, V3( xs[ 1 ], y - ( c.V ? 0.66 : 0.88 ), 0 ), 'super-Earth', tB, tR - 0.2, 0.3, PALETTE.mint );
				label( c, V3( xs[ 2 ], y - ( c.V ? 0.9 : 1.2 ), 0 ), 'Neptune', tS, tR - 0.2, 0.3, '#c9dcff' );
				c.hud.stat( c.t, tB, tR - 0.2, 'Bigger than Earth,', c.sx, c.L.statY, c.L.statSize * ( c.V ? 0.46 : 0.5 ), '#ffffff' );
				c.hud.stat( c.t, tS, tR - 0.2, 'smaller than Neptune', c.sx, c.L.statY + c.L.statSize * 0.62, c.L.statSize * ( c.V ? 0.46 : 0.5 ), PALETTE.periwinkle );
			}
			if ( sw > 0 ) {
				// rocky and ocean versions flip in side by side
				const dx = c.V ? 0.75 : 1.05;
				const fr = spring( c.t - tR, 1.6, 5 ), fo = spring( c.t - tO, 1.6, 5 );
				planet( c, P.rock, V3( - dx, c.V ? 0.3 : 0, 0 ), 0.62 * sw, { spin: 0.3 } ); P.rock.group.rotation.y = ( 1 - fr ) * Math.PI / 2;
				planet( c, P.ocean, V3( dx, c.V ? 0.3 : 0, 0 ), 0.62 * fo, { spin: 0.3 } ); P.ocean.group.rotation.y = ( 1 - fo ) * Math.PI / 2;
				label( c, V3( - dx, c.V ? - 0.5 : - 0.8, 0 ), 'rocky', tR + 0.1, c.t1, 0.34, PALETTE.peach );
				label( c, V3( dx, c.V ? - 0.5 : - 0.8, 0 ), 'ocean?', tO + 0.1, c.t1, 0.34, '#8fd6ff' );
			}
			// Luna's face in the ship window, floating in her slot
			const sl = c.slot( 'R' );
			const sp = c.screen( c.V ? sl.x : 0.74, sl.y + ( c.V ? 0.16 : 0.45 ), c.camDist * 0.7 );
			ship( c, sp.add( V3( 0, Math.sin( c.t * 1.4 ) * 0.05, 0 ) ), { scale: c.lunaHeight( c.camDist * 0.7 ) * ( c.V ? 0.5 : 0.38 ), rot: - 0.25 + Math.sin( c.t ) * 0.05, flame: 0.35, face: c.sched<Expr>( [ [ t0, 'thinking' ], [ tB, 'happy' ], [ tR, 'excited' ], [ tO, 'surprised' ] ] ).v } );
		},
	},
	// 6 ── "Here's the strange part … kept finding super-Earths. Again and again … none"
	{
		key: 'strange', render( c ) {
			const t0 = c.t0, tK = at( 'keptFinding' ), tA = at( 'again' ), tM = at( 'mostCommon' ), tN = at( 'none' );
			const g1 = wordAfter( 'again', 'again', 0 ), g2 = wordAfter( 'again', 'again', 1 );
			c.cuts( tN );
			if ( c.t < tN ) {
				c.frame( V3( 0, 0, 0 ), lerp( 9, 7.5, smooth( remap( c.t, t0, tN ) ) ), undefined, t0 );
				crowd( c, V3( 0, 0, 0 ), 0.75, tK - 0.6, 4.2, smooth( remap( c.t, tM, tM + 0.6 ) ) );
				// tally that ticks up as planets pop in
				const n = c.w.crowdData.filter( ( d ) => d.superE && c.t > tK - 0.6 + d.delay * 4.2 ).length;
				if ( c.t > tK - 0.3 ) {
					c.hud.stat( c.t, tK - 0.3, tN - 0.1, `super-Earths: ${ n }`, c.sx, c.L.statY, c.L.statSize * 0.55, PALETTE.mint );
				}
				for ( const g of [ g1, g2 ] ) burst( c, g === g1 ? 0 : 1, V3( ( g === g1 ? - 1 : 1 ) * ( c.V ? 1.5 : 3 ), 0.5, 2 ), 2.4, g, g + 0.5 );
				c.hud.stat( c.t, tM + 0.1, tN - 0.1, 'most common planet!', c.sx, c.L.statY + c.L.statSize * 0.7, c.L.statSize * 0.42, '#ffffff' );
				c.hud.text( 'AGAIN!', c.W * 0.5, c.H * 0.36, c.L.statSize * 0.55, { scale: popInOut( c.t, g1, g2 - 0.05 ), fill: PALETTE.yellow, rot: - 0.1 } );
				c.hud.text( 'AND AGAIN!', c.W * 0.5, c.H * 0.36, c.L.statSize * 0.55, { scale: popInOut( c.t, g2, g2 + 0.9 ), fill: PALETTE.pink, rot: 0.1 } );
				buddy( c, 'L', [ [ t0, 'thinking' ], [ tK, 'surprised_pose' ], [ g1, 'excited_pose' ], [ tM, 'cheering' ] ],
					[ [ t0 + 0.3, tK - 0.1, 'thinking' ], [ tK + 0.2, g1 - 0.1, 'surprised' ], [ g1 + 0.1, tN - 0.15, 'excited' ] ], { space: true } );
			} else {
				// our solar system: small ... (gap) ... giant
				const S = solarSystem( c, tN );
				c.frame( S.center, S.radius, { x: 0, y: c.V ? 0 : c.L.focus.y * 0.3 } );
				const gp = c.px( S.gap );
				c.hud.text( '?', gp.x, gp.y, c.L.statSize * ( c.V ? 0.9 : 0.6 ), { scale: spring( c.t - tN - 0.6 ), fill: PALETTE.yellow } );
				pill( c.hud, 'none here!', gp.x, gp.y + c.L.statSize * ( c.V ? 1.25 : 1.0 ), c.L.statSize * 0.32, spring( c.t - tN - 0.8 ), '#ffffff', '#ff6b81' );
				c.hud.stat( c.t, tN + 0.1, c.t1 - 0.1, 'our solar system', c.sx, c.L.statY, c.L.statSize * 0.5, '#ffffff' );
				buddy( c, c.V ? 'R' : 'L', [ [ tN, 'confused_pose' ] ], [ [ tN + 0.4, c.t1 + 0.3, 'confused' ] ], { space: true } );
			}
		},
	},
	// 7 ── the menu: "We got small planets. We got giant planets. But no medium… ran out of medium."
	{
		key: 'small', render( c ) {
			const t0 = c.t0, tG = at( 'giant' ), tNo = at( 'noMedium' ), tF = at( 'fries' ), tR = at( 'ranOut' );
			const tMed = wordAfter( 'noMedium', 'medium' ), tMed2 = wordAfter( 'ranOut', 'medium' );
			const w = c.w;
			const bx = c.V ? 0.16 : - 0.2, by = c.V ? 0.66 : 0.05, bs = c.V ? 2.05 : 2.3;
			c.punch( V3( c.V ? 0 : 0.6, c.V ? 0.35 : 0, 0 ), c.V ? 1.75 : 1.9, tMed );
			w.menu.visible = true;
			const ms = spring( c.t - t0, 1.8, 6 );
			w.menu.position.set( bx, by, 0 ); w.menu.scale.setScalar( bs * ms ); w.menu.rotation.z = Math.sin( c.t * 1.2 ) * 0.015;
			const rowY = ( v: number ) => by + ( 0.5 - v / 1280 ) * 1.25 * bs;
			const hl = ( v0: number, v1: number, t0_: number, t1_: number, col: string ) => {
				const s = popInOut( c.t, t0_, t1_ );
				if ( s <= 0 ) return;
				const a = c.px( V3( bx - 0.44 * bs, rowY( v0 ), 0.01 ) ), b = c.px( V3( bx + 0.44 * bs, rowY( v1 ), 0.01 ) );
				const g = c.hud.g; g.save(); g.globalAlpha = 0.9 * s; g.lineWidth = 10; g.strokeStyle = col;
				c.hud.roundRect( a.x, a.y, b.x - a.x, b.y - a.y, 24 ); g.stroke(); g.restore();
			};
			hl( 260, 525, t0 + 0.1, tG - 0.05, PALETTE.mint );
			hl( 770, 1040, tG + 0.05, tNo - 0.05, '#8fd6ff' );
			const mid = c.px( V3( bx, rowY( 640 ), 0.02 ) );
			stamp( c.hud, 'SOLD OUT', mid.x, mid.y, c.L.statSize * ( c.V ? 0.62 : 0.55 ), c.t, tMed );
			burst( c, 0, V3( bx, rowY( 640 ), - 0.3 ), 1.6 * bs, tMed, tMed + 0.6 );
			// fries pop in, then the medium box is empty
			const fs = popInOut( c.t, tF, c.t1 + 1 );
			w.fries.visible = fs > 0;
			w.fries.position.set( c.V ? 0.75 : 1.75, c.V ? - 1.05 : - 0.55, 0.6 ); w.fries.scale.setScalar( 0.6 * fs );
			w.fries.rotation.set( 0.25, c.t * 0.6, c.t > tMed2 ? 0.25 + Math.sin( ( c.t - tMed2 ) * 6 ) * 0.08 * Math.exp( - ( c.t - tMed2 ) * 2 ) : 0 );
			w.fries.children.forEach( ( f, i ) => { if ( i > 0 ) f.visible = c.t < tMed2; } );
			const sl = c.slot( 'L' );
			c.lunaAt( c.V ? sl.x - 0.08 : sl.x, c.V ? sl.y - 0.04 : sl.y, { sprite: c.t > tMed ? 'sad_pose' : 'astronaut', poseAt: tMed, face: 1, bubble: c.V ? null : c.bubbles( [ [ tMed + 0.15, c.t1 - 0.1, 'sad' ] ] ) } );   // vertical: her crying pose says it; a bubble would cover the board
		},
	},
	// 8 ── landing: "Okay Luna, let's land on one. Careful… the gravity here is strong! … twice as heavy"
	{
		key: 'land', render( c ) {
			const t0 = c.t0, tC = at( 'careful' ), tH = at( 'heavier' ), tT = at( 'twice' );
			const w = c.w;
			const R = 7, G = V3( 0, - R, 0 );
			planet( c, w.P.big, G, R, { spin: 0.0, tilt: 0 } );
			const tLand = tC - 0.4;
			const desc = easeOutCubic( remap( c.t, t0, tLand ) );
			const shipY = lerp( 4.5, 1.3, desc );
			c.frame( V3( 0, 1.0, 0 ), 2.6, { x: c.V ? 0 : 0.15, y: c.V ? 0.0 : 0.1 } );
			ship( c, V3( - 0.9, shipY, 0 ), { flame: c.t < tLand ? 0.7 : clamp( 0.7 - ( c.t - tLand ) * 3 ), door: smooth( remap( c.t, tC - 0.3, tC ) ), face: null } );
			if ( c.t > tLand - 0.2 ) puffs( c, w.clouds, V3( - 0.9, 0.1, 0.5 ), 1.6, 0.3, 0.35 * clamp( 1.5 - ( c.t - tLand ) ), 1, 3 );
			// Luna steps out and is squashed: slow, heavy, barely-there hops
			if ( c.t > tC ) {
				const out = V3( - 0.9, 0.02, 0.7 ), end = V3( c.V ? 0.9 : 1.6, 0.02, 0.7 );
				const mo = ( t: number ) => {
					const m = hops( t, tC + 0.4, c.t1 - 0.6, { hopDur: 0.6, height: 0.035, wobble: 3, squash: 2.2, lean: 0.03 } );
					const squash = 1 - 0.18 * spring( t - tC, 1.2, 3 );      // flattened by gravity
					return { ...m, sy: m.sy * squash, sx: m.sx * ( 2 - squash ) };
				};
				const pos = out.clone().lerp( end, mo( c.t ).p );
				c.lunaWorld( pos, { sprite: 'astronaut', face: 1, poseAt: tC, bubble: c.bubbles( [ [ tC + 0.3, tH - 0.1, 'surprised' ], [ tT + 0.2, c.t1 - 0.1, 'dizzy' ] ] ) }, mo );
				const p = c.px( pos.clone().add( V3( 0, c.luna!.height * 0.95, 0 ) ) );
				sweat( c.hud, p.x, p.y, c.H * 0.012, c.t, clamp( ( c.t - tC - 0.3 ) * 2 ) );
				// down arrows (gravity)
				const g = c.hud.g, a = clamp( ( c.t - tC ) * 2 ) * clamp( ( tH - c.t ) * 2 + 1 );
				if ( a > 0 ) for ( let i = 0; i < 3; i ++ ) {
					const yy = p.y - c.H * 0.08 + ( ( c.t * 0.9 + i / 3 ) % 1 ) * c.H * 0.05, xx = p.x + ( i - 1 ) * c.W * 0.06;
					g.save(); g.globalAlpha = a * 0.8; g.fillStyle = PALETTE.yellow; g.strokeStyle = PALETTE.ink; g.lineWidth = 5;
					g.beginPath(); g.moveTo( xx - 14, yy ); g.lineTo( xx + 14, yy ); g.lineTo( xx, yy + 20 ); g.closePath(); g.fill(); g.stroke(); g.restore();
				}
			}
			stat( c, tT, c.t1 - 0.1, '2x heavier', 'on some super-Earths', PALETTE.yellow );
			c.hud.stat( c.t, tH, tT - 0.1, 'much heavier!', c.sx, c.L.statY, c.L.statSize * 0.55, '#ffffff' );
		},
	},
	// 9 ── "So if your weighing scale gives you a scary number… don't blame the scale. Blame the planet."
	{
		key: 'scale', render( c ) {
			const t0 = c.t0, tS = at( 'scary' ), tN = at( 'notScale' ), tB = at( 'blame' );
			const w = c.w;
			const R = 7, G = V3( 0, - R, 0 );
			planet( c, w.P.big, G, R, { spin: 0, tilt: 0 } );
			// the super-Earth itself, looming in the sky to point at
			planet( c, w.P.rock, V3( c.V ? 1.1 : 2.4, c.V ? 2.6 : 1.7, - 4 ), 0.9, { spin: 0.2 } );
			c.punch( V3( 0, 1.0, 0 ), 2.3, tB, { x: c.V ? 0 : 0.15, y: c.V ? 0.05 : 0.1 } );
			w.scale.visible = true; w.scale.position.set( 0, 0, 0.6 ); w.scale.scale.setScalar( 0.75 );
			const spin = c.t > tS ? ( c.t - tS ) * 26 + Math.sin( c.t * 31 ) * 0.6 : Math.sin( c.t * 2 ) * 0.2;
			const settle = c.t > tB ? Math.exp( - ( c.t - tB ) * 3 ) : 1;
			w.needle.rotation.z = - spin * settle - ( c.t > tB ? 2.6 : 0 );
			const sp = c.px( V3( 0, 0.45, 1.1 ) );
			c.hud.text( '9999 kg?!', sp.x - c.W * ( c.V ? 0.2 : 0.12 ), sp.y - c.H * ( c.V ? 0.29 : 0.42 ), c.L.statSize * 0.5, { scale: popInOut( c.t, tS + 0.2, tN - 0.05 ), fill: '#ff8fab', rot: Math.sin( c.t * 20 ) * 0.05 } );
			burst( c, 0, V3( 0, 0.9, 0.2 ), 1.8, tS + 0.1, tS + 0.7 );
			const pose = c.sched<Parameters<Stage[ 'lunaAt' ]>[ 2 ][ 'sprite' ]>( [ [ t0, 'nervous' ], [ tN, 'crossed_arms' ], [ tB, 'pointing' ] ] );
			c.lunaWorld( V3( 0, 0.39, 0.62 ), { sprite: pose.v, poseAt: pose.at, face: c.t > tB ? 1 : - 1, bubble: c.bubbles( [ [ tS + 0.1, tN - 0.1, 'surprised' ], [ tB + 0.1, c.t1 - 0.1, 'angry' ] ] ) },
				( t ) => c.t > tS && c.t < tN ? hops( t, tS, tN, { hopDur: 0.2, height: 0.03, wobble: 9 } ) : idle( t ), 0.95 );
			burst( c, 1, V3( c.V ? 1.1 : 2.4, c.V ? 2.6 : 1.7, - 4.5 ), 2.4, tB + 0.05, tB + 0.8 );
			c.hud.stat( c.t, tB + 0.05, c.t1 - 0.05, 'Blame the planet!', c.sx, c.L.statY + ( c.V ? c.L.statSize * 2.4 : 0 ), c.L.statSize * 0.5, '#ffffff' );
		},
	},
	// 10 ── "Every staircase would be leg day."
	{
		key: 'stairs', render( c ) {
			const t0 = c.t0, tL = at( 'legDay' );
			const w = c.w;
			w.stairs.visible = true; w.stairs.position.set( - 1.8, - 0.5, 0 ); w.stairs.scale.setScalar( 0.8 );
			c.frame( V3( 0.9, c.V ? 0.8 : 1.5, 0 ), c.V ? 2.5 : 3.3, { x: 0, y: c.V ? 0.02 : - 0.18 } );
			// three hard-won steps: each hop barely clears the next block
			const steps = 3, hd = ( c.t1 - t0 - 0.1 ) / steps;
			const mo = ( t: number ) => hops( t, t0 + 0.05, t0 + 0.05 + hd * steps, { hopDur: hd, height: 0.5, wobble: 14, squash: 1.8, lean: 0.25 } );
			const m = mo( c.t );
			const k = Math.min( steps, m.p * steps );
			const stepI = Math.floor( k ), frac = k - stepI;
			const sx = - 1.8 + 0.8 * 0.6, x = sx + ( stepI + easeInOutCubic( frac ) ) * 0.96;
			const yOf = ( i: number ) => - 0.5 + 0.8 * 0.5 * ( i + 1 );
			const y = lerp( yOf( stepI ), yOf( Math.min( stepI + 1, 5 ) ), frac > 0.5 ? 1 : 0 );
			c.lunaWorld( V3( x, y, 0.85 ), { sprite: 'astronaut', face: 1, bubble: c.bubbles( [ [ t0 + 0.4, c.t1, 'dizzy' ] ] ) }, mo, 0.85 );
			const p = c.px( V3( x, y + c.luna!.height * 0.9, 0.85 ) );
			sweat( c.hud, p.x, p.y, c.H * 0.011, c.t, 1 );
			if ( ! c.V ) c.sx = c.W * 0.3;   // wide: keep the text clear of Luna on the top step
			stat( c, tL, c.t1 + 0.2, 'LEG DAY', undefined, PALETTE.pink );
		},
	},
	// 11 ── "Come on, Luna, let's visit a few more." -> back in the ship, route map with 3 stops
	{
		key: 'visit', render( c ) {
			const t0 = c.t0;
			const tLeap = t0 + 0.2, tIn = tLeap + 0.55, tGo = tIn + 0.25;
			if ( c.t < tGo + 0.4 ) {
				const R = 7; planet( c, c.w.P.big, V3( 0, - R, 0 ), R, { spin: 0, tilt: 0 } );
				c.frame( V3( 0, 1.0, 0 ), 2.6, { x: c.V ? 0 : 0.15, y: c.V ? 0 : 0.1 } );
				const rise = c.t > tGo ? Math.pow( c.t - tGo, 2 ) * 10 : 0;
				ship( c, V3( - 0.9, 1.3 + rise, 0 ), { flame: c.t > tGo - 0.2 ? 1 : 0, door: 1 - smooth( remap( c.t, tIn, tIn + 0.15 ) ), face: c.t > tIn ? 'happy' : null } );
				if ( c.t < tIn ) {
					const mo = ( t: number ) => leap( t, tLeap, 0.55, 1.0 );
					const pos = V3( 0.6, 0.02, 0.7 ).lerp( V3( - 0.9, 0.75, 0.65 ), mo( c.t ).p );
					c.lunaWorld( pos, { sprite: 'astronaut', face: - 1, alpha: 1 - easeInCubic( remap( c.t, tIn - 0.12, tIn ) ) }, mo );
				}
			} else {
				// route map
				c.frame( V3( 0, 0, 0 ), 3 );
				const P = c.V
					? [ { x: 0.14, y: 0.5 }, { x: 0.3, y: 0.4 }, { x: 0.72, y: 0.3 }, { x: 0.38, y: 0.16 } ]
					: [ { x: 0.12, y: 0.62 }, { x: 0.36, y: 0.38 }, { x: 0.6, y: 0.56 }, { x: 0.84, y: 0.32 } ];
				const names = [ '', '55 Cancri e', 'LHS 1140 b', 'K2-18 b' ], cols = [ '', '#ff9a5a', '#c8f4ff', '#6f95ff' ];
				const prog = easeInOutCubic( remap( c.t, tGo + 0.4, c.t1 - 0.3 ) );
				buddy( c, 'R', [ [ tGo + 0.4, 'cheering' ] ], [ [ tGo + 0.6, c.t1 + 0.3, 'excited' ] ], { enter: tGo + 0.4, space: true } );
				drawRoute( c, P.map( ( p, i ) => ( { x: p.x * c.W, y: p.y * c.H, label: names[ i ], color: cols[ i ] } ) ), prog );
				// tiny ship rides the route
				const seg = Math.min( 2, Math.floor( prog * 3 ) ), f = prog * 3 - seg;
				const a = P[ seg ], b = P[ seg + 1 ];
				const nx = lerp( a.x, b.x, f ) * 2 - 1, ny = - ( lerp( a.y, b.y, f ) * 2 - 1 );
				const ang = Math.atan2( - ( b.y - a.y ) * c.H, ( b.x - a.x ) * c.W );
				ship( c, c.screen( nx, ny, c.camDist * 0.7 ), { scale: c.lunaHeight( c.camDist * 0.7 ) * 0.17, rot: ang - Math.PI / 2, flame: 0.8, face: 'happy' } );
			}
		},
	},
];

function drawRoute( c: Stage, pts: { x: number; y: number; label: string; color: string }[], prog: number ) {
	routeMap( c.hud, pts, prog, 1, c.L.statSize * 0.42 );
}
