// The film, scene by scene. Each scene starts at an anchor phrase found in the
// transcript; all motion inside is a pure function of t.
import * as THREE from 'three';
import { at, atEnd } from './timeline';
import { clamp, easeInOutCubic, easeOutCubic, lerp, popInOut, remap, smooth, spring, wobble } from './engine/math';
import { PALETTE } from './engine/toon';
import { bounceIn, burst, dashedPath, earth, exos, planet, puffs, shards, star, stink } from './props';
import type { Stage } from './stage';

const V3 = ( x = 0, y = 0, z = 0 ) => new THREE.Vector3( x, y, z );

export interface SceneDef { key: string; name: string; start: () => number; render: ( c: Stage ) => void }

/** Big stat helper in the stat slot. */
function stat( c: Stage, t0: number, t1: number, str: string, sub?: string, fill: string = PALETTE.yellow, dy = 0 ) {
	c.hud.stat( c.t, t0, t1, str, c.sx, c.L.statY + dy, c.L.statSize, fill, sub );
}
/** Label floating near a world point. */
function label( c: Stage, p: THREE.Vector3, str: string, t0: number, t1: number, size = 0.5, fill = '#ffffff', dy = 0 ) {
	const s = popInOut( c.t, t0, t1 );
	if ( s <= 0 ) return;
	const q = c.px( p );
	c.hud.text( str, q.x, q.y + dy, c.L.statSize * size, { scale: s, fill, rot: Math.sin( c.t * 2 ) * 0.03 } );
}

export const SCENES: SceneDef[] = [
	// 1 ── cold open: "Glass rain, winds faster than sound, 1000 degrees, rotten eggs"
	{
		key: 'glassRain', name: '1 Glass rain (cold open)', start: () => 0,
		render( c ) {
			const tG = at( 'glassRain' ), tW = at( 'winds1' ), tD = at( 'deg1' ), tS = at( 'smells1' );
			c.cuts( tG, tW, tD, tS );
			const side = c.slot( 'L' );
			// host floats in from off-screen
			const enter = easeOutCubic( remap( c.t, 0.1, 1.6 ) );
			const hx = lerp( side.x - 0.9, side.x, enter );
			const hy = c.V ? 0.0 : side.y + 0.25;
			if ( c.t < tG ) {
				// teaser: a far-off mystery planet with focus lines
				c.frame( V3(), 1.6 );
				planet( c, V3(), 0.75 * bounceIn( c, 0.25 ) );
				c.hud.focusLines( c.t, 0.6 * remap( c.t, 0.3, 1 ) );
				c.hud.text( '?!', c.W * 0.5 + ( c.V ? 260 : 380 ), c.L.statY + ( c.V ? 260 : 120 ), c.L.statSize * 1.2, { scale: spring( c.t - 1.4 ), fill: PALETTE.pink } );
			} else if ( c.t < tW ) {
				// cartoon glass shards zooming sideways
				c.frame( V3(), 3, { x: 0, y: c.L.focus.y * 0.5 }, tG );
				shards( c, V3( 0, 0.3, 0 ), V3( 6, 4, 2 ), 5, 0.55, - 1, 0.7 );
				c.hud.speedLines( c.t, 0.35, 3 );
				c.hud.stat( c.t, tG + 0.05, tW - 0.1, 'GLASS RAIN', c.sx, c.L.statY, c.L.statSize * 0.75, PALETTE.cyan );
			} else if ( c.t < tD ) {
				// speed-line wind blast across a planet's limb + clouds ripped sideways
				c.frame( V3( 0, - 1.6, 0 ), 1.6, { x: 0, y: 0 }, tW );
				planet( c, V3( 0, - 2.6, 0 ), 1.8, { wind: 1.4, spin: 3 } );
				puffs( c, c.w.clouds, V3( 0, - 0.2, 0.8 ), 3.5, - 9, 0.45, 1, 2 );
				c.hud.speedLines( c.t, 1, 7 );
				c.hud.stat( c.t, tW + 0.05, tD - 0.1, 'WHOOSH!', c.sx, c.L.statY, c.L.statSize * 0.8, '#ffffff' );
			} else if ( c.t < tS ) {
				// heat: glowing planet + shimmer
				c.frame( V3(), 1.25, undefined, tD );
				planet( c, V3(), 1, { heat: 1, spin: 0.6 } );
				c.shimmer = 1;
				stat( c, tD + 0.05, tS - 0.1, '1,000°C', undefined, '#ffb27a' );
			} else {
				// stink puff
				c.frame( V3( 0, 0.6, 0 ), 1.7, undefined, tS );
				c.w.egg.visible = true;
				c.w.egg.position.set( 0, - 0.2, 0 );
				const sq = wobble( c.t - tS, 2.5, 4 );
				c.w.egg.scale.set( 0.8 * ( 1 + 0.15 * sq ), 0.8 * ( 1 - 0.15 * sq ), 0.8 );
				c.w.egg.rotation.z = Math.sin( c.t * 7 ) * 0.08;
				stink( c, V3( 0, 0.5, 0.3 ), 0.55, tS + 0.1 );
				c.hud.stat( c.t, tS + 0.3, at( 'welcome' ) - 0.15, 'PEE-YEW!', c.sx, c.L.statY, c.L.statSize * 0.75, PALETTE.stink );
			}
			c.hostAt( hx, hy, { pose: 'astronaut', poseAt: 0.1, bubble: c.bubbles( [ [ 0.9, tS - 0.1, 'surprised' ], [ tS + 0.25, at( 'welcome' ) - 0.1, 'dizzy' ] ] ) }, 1 );
		},
	},
	// 2 ── "Welcome to the worst planet ever discovered."
	{
		key: 'welcome', name: '2 Welcome / title', start: () => at( 'welcome' ),
		render( c ) {
			const t0 = c.t0;
			const R = 1;
			const center = V3( 0, 0, 0 );
			c.sphereShot( center, R, { radius: 2.25, focusY: - 0.04 } );
			const s = bounceIn( c, t0 + 0.05 );
			planet( c, center, R, { scale: s, spin: 0.3 } );
			burst( c, 0, V3( 0, 0, - 1.2 ), 4.2, t0 + 0.05, t0 + 1.4 );
			// title: two lines
			const ty = c.L.titleY, ts = c.L.titleSize;
			c.hud.text( 'THE WORST PLANET', c.sx, ty, ts, { scale: spring( c.t - t0 - 0.25 ), fill: '#ffffff', rot: - 0.04 } );
			c.hud.text( 'EVER DISCOVERED', c.sx, ty + ts * 1.1, ts * 0.85, { scale: spring( c.t - t0 - 0.45 ), fill: PALETTE.peach, rot: 0.03 } );
			// host lands on top and waves
			const land = c.t - t0;
			const drop = land < 0.6 ? ( 1 - easeOutCubic( land / 0.6 ) ) * 1.2 : 0;
			c.hostOnSphere( center, R * s, 0, { ...c.poses( [ [ t0, 'astronaut' ], [ t0 + 0.6, 'shocked_wave' ], [ t0 + 2.2, 'explain' ] ] ) } );
			if ( c.hostState ) c.hostState.pos.y += drop;
		},
	},
	// 3 ── "Its name is HD 189733 b ... not in our solar system ... billions of stars ... exoplanets"
	{
		key: 'name', name: '3 Name / zoom out', start: () => at( 'name' ),
		render( c ) {
			const tN = c.t0, tOut = at( 'notSolar' ), tSun = at( 'ourSun' ), tMany = at( 'manyStars' ), tExo = at( 'exoplanets' );
			const w = c.w;
			w.milky.visible = true;
			w.milky.rotation.set( 1.05, 0, 0.3 );
			w.milky.children[ 0 ].rotation.y = c.t * 0.01;
			w.milky.updateMatrixWorld( true );
			const sunPos = w.milky.children[ 0 ].localToWorld( V3( 14, 0, 6 ) );
			const farPos = w.milky.children[ 0 ].localToWorld( V3( - 18, 0, - 12 ) );
			// 0 -> 1: sun close-up to whole galaxy; 1 -> 2: galaxy to distant star
			const out = easeInOutCubic( remap( c.t, tOut, tSun + 0.8 ) );
			const inn = easeInOutCubic( remap( c.t, tMany - 0.2, tMany + 2.2 ) );
			const logR = lerp( lerp( Math.log( 2.2 ), Math.log( 46 ), out ), Math.log( 2.6 ), inn );
			const center = sunPos.clone().lerp( V3(), out ).lerp( farPos, inn );
			c.frame( center, Math.exp( logR ), c.L.focus, tN );
			star( c, 'sun', sunPos, lerp( 1, 0.6, out ) );
			star( c, 'star', farPos, lerp( 0.05, 1, inn ) );
			c.w.star.visible = inn > 0.01;
			// distant system: our planet orbiting the far star
			if ( inn > 0.5 ) {
				const a = c.t * 0.9;
				planet( c, farPos.clone().add( V3( Math.cos( a ) * 2.1, Math.sin( a ) * 0.5, Math.sin( a ) * 1.2 ) ), 0.38 * bounceIn( c, tMany + 1.4 ) );
			}
			// labels
			( ( w.milky.children[ 0 ] as THREE.Points ).material as THREE.PointsMaterial ).opacity = clamp( ( Math.exp( logR ) - 3 ) / 14 ) * 0.95;
			label( c, sunPos, 'our Sun', tSun + 0.4, tMany - 0.3, 0.3, PALETTE.yellow, c.L.statSize * 0.4 );
			stat( c, tN + 0.1, tOut - 0.05, 'HD 189733 b', undefined, PALETTE.periwinkle );
			if ( c.t > tOut + 0.4 && c.t < tSun ) c.hud.text( 'not in our solar system', c.sx, c.L.statY, c.L.statSize * 0.42, { scale: spring( c.t - tOut - 0.4 ) } );
			c.hud.stat( c.t, tSun + 0.6, tMany - 0.2, 'billions of stars', c.sx, c.L.statY, c.L.statSize * 0.5, '#ffffff' );
			c.hud.stat( c.t, tExo, c.t1 - 0.1, 'EXOPLANETS', c.sx, c.L.statY, c.L.statSize * 0.7, PALETTE.pink );
			// host walks along the frame edge, turning around
			const span = c.V ? 0.55 : 0.18;
			const base = c.V ? 0 : c.L.hostXL + 0.18;
			const ph = ( c.t - tN ) / 7;
			const tri = Math.abs( ( ph % 2 ) - 1 ) * 2 - 1; // -1..1 triangle wave
			const goingRight = ( ph % 2 ) < 1;
			c.hostAt( base - tri * span, c.L.hostY, { pose: 'walk', faceRight: goingRight, bubble: c.bubbles( [ [ tSun + 0.3, tSun + 2.4, 'surprised' ], [ tExo + 0.1, c.t1 - 0.1, 'happy' ] ] ) } );
		},
	},
	// 4 ── "So far, they have found more than 6,000. But few are as terrifying as this one."
	{
		key: 'soFar', name: '4 6,000+ exoplanets', start: () => at( 'soFar' ),
		render( c ) {
			const t0 = c.t0, tN = at( 'n6000' ), tF = at( 'fewTerrifying' );
			c.frame( V3( 0, 0, 0 ), 5.2 );
			const dim = smooth( remap( c.t, tF, tF + 0.6 ) );
			exos( c, V3( 0, 0, - 1 ), 0.62, t0, 2.2, dim );
			// counter rolls up as "6,000" is spoken
			const k = easeOutCubic( remap( c.t, tN - 0.6, tN + 0.5 ) );
			const n = Math.round( k * 6000 / 10 ) * 10;
			if ( c.t > t0 + 0.2 ) {
				const str = n >= 6000 ? '6,000+' : n.toLocaleString( 'en-US' );
				c.hud.stat( c.t, t0 + 0.2, c.t1 - 0.1, str, c.sx, c.L.statY, c.L.statSize, PALETTE.yellow, 'exoplanets found' );
			}
			// "this one" bounces forward with a burst
			const s = bounceIn( c, tF + 0.6 );
			planet( c, V3( 0, 0, 1.5 ), 1.35 * s, { heat: 0.0 } );
			burst( c, 1, V3( 0, 0, 0.2 ), 5, tF + 0.6, tF + 2 );
			const sl = c.slot( 'L' );
			c.hostAt( sl.x, sl.y, { ...c.poses( [ [ t0, 'tablet' ], [ tF + 0.5, 'shocked_wave' ] ] ), bubble: c.bubbles( [ [ tF + 0.7, c.t1 - 0.1, 'surprised' ] ] ) } );
		},
	},
	// 5 ── "about 64 light years away. So how do we know anything about it?"
	{
		key: 'distance', name: '5 64 light-years', start: () => at( 'distance' ),
		render( c ) {
			const t0 = c.t0, t64 = at( 'n64' ), tHow = at( 'howKnow' );
			const A = c.V ? V3( - 0.9, 1.3, 0 ) : V3( - 3.6, 0.3, 0 );
			const B = c.V ? V3( 0.9, - 1.3, 0 ) : V3( 3.4, - 0.2, 0 );
			c.frame( A.clone().lerp( B, 0.5 ), c.V ? 2.0 : 3.0, c.V ? { x: 0, y: 0.12 } : c.L.focus );
			earth( c, A, 0.55 * bounceIn( c, t0 + 0.1 ) );
			star( c, 'star', B.clone().add( V3( 0.5, 0.2, - 1 ) ), 0.55 * bounceIn( c, t0 + 0.3 ) );
			planet( c, B.clone().add( V3( - 0.4, - 0.1, 0.3 ) ), 0.32 * bounceIn( c, t0 + 0.4 ) );
			const ab = B.clone().sub( A ).normalize();
			const pa = A.clone().addScaledVector( ab, 0.75 ), pb = B.clone().addScaledVector( ab, - 0.85 );
			dashedPath( c, pa, pb, remap( c.t, t0 + 0.3, t64 + 0.4 ), 0.9 );
			// a little light pulse runs along the path
			const pulse = ( ( c.t - t0 ) / 1.6 ) % 1;
			burst( c, 2, pa.clone().lerp( pb, pulse ).add( V3( 0, 0, 0.2 ) ), 0.35, t0 + 0.5, c.t1 );
			c.w.bursts[ 2 ].rotation.z = c.t * 4;
			stat( c, t64, c.t1 - 0.15, '64', 'light-years away', PALETTE.yellow );
			const sl = c.slot( 'L' );
			c.hostAt( sl.x, sl.y, { ...c.poses( [ [ t0, 'present_board' ], [ tHow, 'thinking' ] ] ), bubble: c.bubbles( [ [ tHow + 0.2, c.t1 - 0.1, 'thinking' ] ] ) } );
		},
	},
	// 6 ── transit: "passes in front of its star ... studying that light ... shocking"
	{
		key: 'transit', name: '6 Transit / starlight', start: () => at( 'transit' ),
		render( c ) {
			const t0 = c.t0, tStudy = at( 'studying' ), tShock = at( 'shocking' );
			c.frame( V3( 0, 0, 0 ), 2.4, c.V ? { x: 0, y: 0.3 } : { x: - 0.18, y: 0.08 } );
			star( c, 'star', V3( 0, 0, - 2 ), 1.6 * bounceIn( c, t0 ) );
			// planet crosses in front of the star (left -> right), then parks on the limb
			const k = easeInOutCubic( remap( c.t, t0 + 0.4, t0 + 4.4 ) );
			const px = lerp( - 2.6, 0.55, k );
			planet( c, V3( px, 0.25, 0.6 ), 0.42 );
			// beams: starlight filtering through the planet's air toward us/right
			const bw = c.w.beams;
			bw.visible = k > 0.5;
			bw.children.forEach( ( b, i ) => {
				const m = b as THREE.Mesh;
				const f = clamp( ( k - 0.5 ) * 2 ) * ( 0.6 + 0.4 * Math.sin( c.t * 3 + i ) );
				m.position.set( px + 1.6, 0.25 + ( i - 3 ) * 0.09, 0.4 );
				m.scale.set( 3.6, 0.22, 1 );
				m.rotation.z = ( i - 3 ) * 0.05;
				( m.material as THREE.MeshBasicMaterial ).opacity = f;
			} );
			c.w.key.position.set( - 2, 1, 2 );
			// spectrum card
			const cx = c.V ? c.W * 0.46 : c.W * 0.72, cy = c.V ? c.L.statY + 70 : c.H * 0.32;
			c.hud.spectrumCard( c.t, tStudy, c.t1 - 0.15, cx, cy, c.V ? 520 : 520 );
			c.hud.focusLines( c.t, 0.7 * popInOut( c.t, tShock, c.t1 - 0.2 ) );
			const sl = c.slot( 'L' );
			c.hostAt( sl.x, sl.y, { ...c.poses( [ [ t0, 'astronaut' ], [ tStudy, 'read_book' ], [ tShock, 'shocked_wave' ] ] ), bubble: c.bubbles( [ [ tShock + 0.15, c.t1 - 0.1, 'surprised' ] ] ) } );
		},
	},
	// 7 ── "From far away, the planet looks deep blue, just like Earth. But it has no oceans."
	{
		key: 'deepBlue', name: '7 Deep blue / no oceans', start: () => at( 'deepBlue' ),
		render( c ) {
			const t0 = c.t0, tNo = at( 'noOceans' );
			const R = 1;
			c.sphereShot( V3( 0, - 0.2, 0 ), R, { radius: 1.7, focusY: 0.14 } );
			// walking: the planet rolls under her
			const walkSpeed = 0.35;
			planet( c, V3( 0, - 0.2, 0 ), R, { spin: 0, roll: c.t * walkSpeed } );
			// Earth pops in beside for the comparison, then away
			const es = popInOut( c.t, t0 + 1.6, tNo - 0.2 );
			if ( es > 0 ) earth( c, V3( c.V ? 0.95 : - 1.9, c.V ? 1.25 : 0.0, - 0.5 ), 0.45 * es );
			c.hud.stat( c.t, t0 + 1.7, tNo - 0.2, 'just like Earth?', c.sx, c.L.statY, c.L.statSize * 0.5, '#ffffff' );
			// "NO OCEANS" with a big pink X
			const s = popInOut( c.t, tNo, c.t1 - 0.1 );
			if ( s > 0 ) {
				const x = c.sx, y = c.L.statY, r = c.L.statSize * 0.6 * s;
				const g = c.hud.g;
				c.hud.text( 'NO OCEANS', x, y, c.L.statSize * 0.62, { scale: s, fill: PALETTE.periwinkle } );
				// little crossed-out waves under the text
				g.save(); g.translate( x, y + r * 1.6 ); g.scale( s, s ); g.lineCap = 'round'; g.lineJoin = 'round';
				for ( const [ col, lw ] of [ [ PALETTE.ink, 16 ], [ '#8fd6ff', 8 ] ] as const ) {
					g.strokeStyle = col; g.lineWidth = lw;
					for ( let k = 0; k < 2; k ++ ) {
						g.beginPath();
						for ( let i = 0; i <= 24; i ++ ) { const xx = - r * 1.1 + i / 24 * r * 2.2; const yy = k * r * 0.45 + Math.sin( i / 24 * Math.PI * 4 + c.t * 4 ) * r * 0.12; i ? g.lineTo( xx, yy ) : g.moveTo( xx, yy ); }
						g.stroke();
					}
				}
				for ( const [ col, lw ] of [ [ PALETTE.ink, 24 ], [ '#ff7aa2', 13 ] ] as const ) {
					g.strokeStyle = col; g.lineWidth = lw;
					g.beginPath(); g.moveTo( - r * 0.6, - r * 0.4 ); g.lineTo( r * 0.6, r * 0.85 ); g.moveTo( r * 0.6, - r * 0.4 ); g.lineTo( - r * 0.6, r * 0.85 ); g.stroke();
				}
				g.restore();
			}
			c.hostOnSphere( V3( 0, - 0.2, 0 ), R, 0, { pose: c.t < tNo + 0.1 ? 'walk' : 'confused', poseAt: tNo + 0.1, faceRight: false } );
		},
	},
	// 8 ── "blue color may come from tiny bits of glass ... silica ... sand"
	{
		key: 'blueGlass', name: '8 Glass in the clouds', start: () => at( 'blueGlass' ),
		render( c ) {
			const t0 = c.t0, tSi = at( 'silica' ), tSand = at( 'sand' );
			const zoom = easeInOutCubic( remap( c.t, t0, t0 + 2.2 ) );
			c.frame( V3( 0, lerp( 0, 1.1, zoom ), 0 ), lerp( 1.6, 1.0, zoom ) );
			planet( c, V3( 0, - 0.9, - 1 ), 2.1, { spin: 0.08 } );
			shards( c, V3( 0, 1.15, 0.2 ), V3( 1.6, 0.7, 0.4 ), 0.35, 0.55 * remap( c.t, t0 + 0.8, t0 + 2 ), - 1, 0.13 );
			c.hud.stat( c.t, t0 + 1.0, tSi - 0.1, 'tiny bits of glass', c.sx, c.L.statY, c.L.statSize * 0.5, PALETTE.cyan );
			c.hud.stat( c.t, tSi + 0.1, c.t1 - 0.1, 'SILICA', c.sx, c.L.statY, c.L.statSize * 0.75, PALETTE.cyan );
			c.hud.stat( c.t, tSand, c.t1 - 0.1, '= sand!', c.sx + c.L.statSize * 1.6, c.L.statY + c.L.statSize * 0.75, c.L.statSize * 0.45, PALETTE.peach );
			const sl = c.slot( 'R' );
			c.hostAt( sl.x, sl.y, { ...c.poses( [ [ t0, 'idea' ], [ tSi, 'read_book' ] ] ), faceRight: false, bubble: c.bubbles( [ [ t0 + 0.4, tSi - 0.2, 'idea' ] ] ) } );
		},
	},
	// 9 ── "a giant, bigger than Jupiter ... extremely close to its star ... one year = two Earth days"
	{
		key: 'giant', name: '9 Giant / 2-day year', start: () => at( 'giant' ),
		render( c ) {
			const t0 = c.t0, tClose = at( 'closeStar' ), tYear = at( 'year' ), t2 = at( 'twoDays' );
			const w = c.w;
			const phase2 = easeInOutCubic( remap( c.t, tClose - 0.2, tClose + 0.8 ) );
			c.frame( V3( 0, 0, 0 ), lerp( 2.3, 2.6, phase2 ) );
			if ( phase2 < 1 ) {
				// size comparison
				const js = popInOut( c.t, t0 + 0.4, tClose - 0.3 );
				w.jupiter.visible = js > 0;
				const vert = c.V;
				w.jupiter.position.set( vert ? 0.15 : 1.7, vert ? - 1.25 : - 0.15, 0 );
				w.jupiter.scale.setScalar( 0.85 * js );
				w.jupiter.rotation.y = c.t * 0.4;
				const pp = vert ? V3( - 0.1, 0.55, 0 ) : V3( - 1.2, 0, 0 );
				planet( c, pp.clone().lerp( V3( 1.2, 0, 0 ), phase2 ), ( vert ? 0.9 : 1.0 ) * ( 1 - phase2 * 0.6 ) );
				label( c, w.jupiter.position.clone().add( V3( 0, - 1.05, 0 ) ), 'Jupiter', t0 + 0.6, tClose - 0.3, 0.32, '#f3d3b0' );
				c.hud.stat( c.t, t0 + 0.3, tClose - 0.3, 'GIANT!', c.sx, c.L.statY, c.L.statSize * 0.8, PALETTE.periwinkle );
			}
			if ( phase2 > 0 ) {
				// hugging its star, orbit speeding up for the 2-day year
				star( c, 'star', V3( 0, 0, - 0.5 ), 0.9 * phase2 );
				const speed = lerp( 0.8, 3.2, smooth( remap( c.t, tYear, t2 ) ) );
				// integrate the angle analytically: piecewise linear speed -> use an easy closed form
				const a = c.t * 0.8 + Math.max( 0, c.t - tYear ) * ( speed - 0.8 ) * 0.5;
				planet( c, V3( Math.cos( a ) * 1.9, Math.sin( a ) * 0.55, 0.6 + Math.sin( a ) * 0.6 ), 0.42 * phase2 );
				c.w.key.position.set( 0, 0, 0 ).sub( c.w.planet.position ).multiplyScalar( 1 ).add( V3( 0, 0.5, 1 ) );
			}
			stat( c, t2, c.t1 - 0.1, '2 days', '= 1 year there', PALETTE.yellow );
			const sl = c.slot( 'L' );
			c.hostAt( sl.x, sl.y, { ...c.poses( [ [ t0, 'chart' ], [ tClose, 'star_board' ], [ t2, 'idea' ] ] ) } );
		},
	},
	// 10 ── "temperature can reach around 1,000 degrees Celsius, hot enough to melt many metals"
	{
		key: 'temp', name: '10 1,000°C', start: () => at( 'temp' ),
		render( c ) {
			const t0 = c.t0, tD = at( 'deg2' ), tM = at( 'melt' );
			c.frame( V3( 0, 0, 0 ), 1.6 );
			const heat = smooth( remap( c.t, t0, tD + 0.3 ) );
			planet( c, V3( c.V ? - 0.2 : - 0.25, c.V ? - 0.1 : 0, 0 ), c.V ? 0.85 : 1.0, { heat, spin: 0.3 } );
			c.shimmer = heat;
			const w = c.w;
			w.thermo.visible = true;
			const ts = bounceIn( c, t0 + 0.2 );
			w.thermo.position.set( c.V ? 0.9 : 1.55, c.V ? 0.1 : 0, 0.6 );
			w.thermo.scale.setScalar( 0.42 * ts );
			w.thermo.rotation.z = Math.sin( c.t * 6 ) * 0.04 * heat + 0.1;
			w.thermoFill.scale.y = 0.1 + 2.5 * easeOutCubic( remap( c.t, t0 + 0.3, tD + 0.2 ) ) + Math.sin( c.t * 9 ) * 0.03;
			stat( c, tD, c.t1 - 0.1, '1,000°C', undefined, '#ffb27a' );
			c.hud.stat( c.t, tM + 0.1, c.t1 - 0.1, 'melts metal!', c.sx, c.L.statY + c.L.statSize * 0.85, c.L.statSize * 0.42, '#ffffff' );
			const sl = c.slot( 'L' );
			c.hostAt( sl.x, sl.y, { ...c.poses( [ [ t0, 'astronaut' ], [ tM, 'confused' ] ] ), bubble: c.bubbles( [ [ tD + 0.1, tM - 0.1, 'surprised' ], [ tM + 0.2, c.t1 - 0.1, 'dizzy' ] ] ) } );
		},
	},
	// 11 ── "One side always faces its star ... The other side is always night."
	{
		key: 'oneSide', name: '11 Day side / night side', start: () => at( 'oneSide' ),
		render( c ) {
			const t0 = c.t0, tN = at( 'night' );
			const P = c.V ? V3( 0.35, - 0.1, 0 ) : V3( 0.4, - 0.1, 0 );
			const S = c.V ? V3( - 1.65, 2.2, - 2.5 ) : V3( - 3.2, 0.6, - 1.5 );
			c.frame( c.V ? V3( - 0.1, 0.55, 0 ) : V3( - 0.6, 0.2, 0 ), 2.2, { x: 0, y: c.V ? 0.12 : 0 } );
			star( c, 'star', S, ( c.V ? 0.6 : 0.9 ) * bounceIn( c, t0 ) );
			planet( c, P, 1, { spin: 0 } );
			// key light straight from the star; weaker fill = real night side
			c.w.key.position.copy( S.clone().sub( P ).normalize().multiplyScalar( 5 ).add( P ) );
			c.w.key.target.position.copy( P );
			c.w.key.intensity = 3.4;
			c.w.hemi.intensity = 0.35;
			const day = P.clone().add( S.clone().sub( P ).normalize().multiplyScalar( 1.45 ) ).add( V3( 0, - 0.2, 0.5 ) );
			const night = P.clone().add( P.clone().sub( S ).normalize().multiplyScalar( 1.45 ) ).add( V3( 0, - 0.1, 0.5 ) );
			label( c, day, 'DAY', t0 + 0.4, c.t1 - 0.1, 0.55, PALETTE.yellow );
			label( c, night, 'NIGHT', tN, c.t1 - 0.1, 0.55, '#c9d6ff' );
			// she walks from the day side over to the night side
			const a = lerp( - 0.55, 0.55, smooth( remap( c.t, t0 + 0.5, c.t1 - 0.6 ) ) );
			const walking = c.t > t0 + 0.5 && c.t < c.t1 - 0.6;
			c.hostOnSphere( P, 1, a, { pose: walking ? 'walk' : 'astronaut', poseAt: walking ? t0 + 0.5 : c.t1 - 0.6, faceRight: true, bubble: c.bubbles( [ [ tN + 0.4, c.t1 - 0.1, 'surprised' ] ] ) } );
		},
	},
	// 12 ── "monstrous winds, thousands of kilometers per hour, faster than the speed of sound"
	{
		key: 'winds2', name: '12 Monstrous winds', start: () => at( 'winds2' ),
		render( c ) {
			const t0 = c.t0, tK = at( 'kmh' ), tS = at( 'sound' );
			c.sphereShot( V3( 0, - 0.15, 0 ), 1, { radius: 2.1, focusY: 0.02 } );
			const wind = smooth( remap( c.t, t0 + 0.3, t0 + 1.5 ) );
			planet( c, V3( 0, - 0.15, 0 ), 1, { wind: wind * 1.5, spin: 0.3 + wind * 2 } );
			puffs( c, c.w.clouds, V3( 0, 0.4, 1.0 ), 2.5, - 6 * wind, 0.3, wind, 4 );
			c.hud.speedLines( c.t, wind * 0.9, 11 );
			stat( c, tK, tS - 0.15, '1000s km/h', undefined, '#ffffff' );
			// sound-barrier rings
			const rs = c.w.rings;
			rs.visible = c.t > tS;
			rs.children.forEach( ( r, i ) => {
				const ph = ( ( c.t - tS ) * 0.9 + i / 4 ) % 1;
				r.position.set( 0, - 0.15, 0.2 );
				r.scale.setScalar( 1.15 + ph * 0.9 );
				( ( r as THREE.Mesh ).material as THREE.MeshToonMaterial ).opacity = 1 - ph;
			} );
			c.hud.stat( c.t, tS + 0.05, c.t1 - 0.1, 'FASTER THAN SOUND', c.sx, c.L.statY, c.L.statSize * ( c.V ? 0.48 : 0.6 ), PALETTE.cyan );
			c.hostOnSphere( V3( 0, - 0.15, 0 ), 1, - 0.12 + Math.sin( c.t * 9 ) * 0.03 * wind, { pose: 'walk', faceRight: false, walkFps: 16, bubble: c.bubbles( [ [ t0 + 1.2, c.t1 - 0.1, 'dizzy' ] ] ) } );
		},
	},
	// 13 ── "Now put it all together ... rain made of glass, flying sideways ... millions of tiny blades"
	{
		key: 'together', name: '13 Glass rain, sideways', start: () => at( 'together' ),
		render( c ) {
			const t0 = c.t0, tG = at( 'glassClouds' ), tSide = at( 'sideways' ), tB = at( 'blades' );
			c.cuts( tSide );
			if ( c.t < tSide - 0.05 ) {
				c.frame( V3( 0, 0, 0 ), 1.7 );
				const wind = smooth( remap( c.t, t0 + 1.4, tSide ) );
				planet( c, V3( 0, 0, 0 ), 1, { wind, spin: 0.4 + wind } );
				shards( c, V3( 0, 0, 0.8 ), V3( 1.6, 1.3, 0.4 ), lerp( 0.4, 2.5, wind ), 0.6 * remap( c.t, tG, tG + 0.8 ), - 1, 0.13 );
				c.hud.stat( c.t, tG, tSide - 0.1, 'glass + wind', c.sx, c.L.statY, c.L.statSize * 0.55, PALETTE.cyan );
			} else {
				// on the surface: sideways glass rain
				c.frame( V3( 0, 0, 0 ), 3, undefined, tSide );
				planet( c, V3( 0, - 7.2, - 2 ), 6.2, { wind: 1.4, spin: 0.05 } );
				shards( c, V3( 0, 0.4, 0 ), V3( 6, 4, 2.5 ), 6, 0.6, - 1, 0.6 );
				c.hud.speedLines( c.t, 0.85, 13 );
				c.hud.focusLines( c.t, 0.6 * popInOut( c.t, tB, c.t1 - 0.2 ) );
				stat( c, tSide + 0.05, c.t1 - 0.1, 'GLASS RAIN', 'flying sideways', PALETTE.cyan );
			}
			const sl = c.slot( 'L' );
			c.hostAt( sl.x, sl.y + ( c.t > tSide ? 0 : 0 ), { ...c.poses( [ [ t0, 'explain' ], [ tSide, 'shocked_wave' ] ] ), bubble: c.bubbles( [ [ tB + 0.1, c.t1 - 0.1, 'surprised' ] ] ), tilt: c.t > tSide ? 0.08 + Math.sin( c.t * 11 ) * 0.03 : 0 } );
		},
	},
	// 14 ── "And the rotten egg smell? In 2024, the James Webb Space Telescope found ... hydrogen sulfide"
	{
		key: 'eggSmell', name: '14 Webb / hydrogen sulfide', start: () => at( 'eggSmell' ),
		render( c ) {
			const t0 = c.t0, tY = at( 'y2024' ), tW = at( 'webb' ), tH = at( 'h2s' ), tE = at( 'onEarth' );
			c.cuts( tY, tH, tE );
			const w = c.w;
			if ( c.t < tY ) {
				c.frame( V3( 0, 0.5, 0 ), 1.6 );
				w.egg.visible = true; w.egg.position.set( 0, - 0.1, 0 ); w.egg.scale.setScalar( 0.75 * bounceIn( c, t0 ) );
				w.egg.rotation.z = Math.sin( c.t * 6 ) * 0.1;
				stink( c, V3( 0, 0.6, 0.3 ), 0.5, t0 + 0.2 );
			} else if ( c.t < tH ) {
				c.frame( V3( 0, 0.2, 0 ), 2.4, undefined, tY );
				const s = bounceIn( c, tW - 0.2 );
				w.webb.visible = s > 0.001;
				w.webb.position.set( 0, c.V ? - 0.75 : - 0.4, 0 );
				w.webb.scale.setScalar( 0.95 * s );
				w.webb.rotation.set( 0.25 + Math.sin( c.t ) * 0.05, - 0.5 + Math.sin( c.t * 0.7 ) * 0.15, 0 );
				burst( c, 0, V3( 0, c.V ? - 0.2 : 0.2, - 1.5 ), 5, tW - 0.2, tW + 1.0 );
				stat( c, tY, tH - 0.1, '2024', undefined, PALETTE.yellow );
				c.hud.stat( c.t, tW + 0.2, tH - 0.1, 'James Webb Space Telescope', c.sx, c.L.statY + c.L.statSize * 0.85, c.L.statSize * ( c.V ? 0.3 : 0.34 ), '#ffffff' );
			} else if ( c.t < tE ) {
				c.frame( V3( 0, 0.2, 0 ), 1.6, undefined, tH );
				const s = bounceIn( c, tH );
				w.h2s.visible = true;
				w.h2s.position.set( 0, 0.2, 0 );
				w.h2s.scale.setScalar( 0.9 * s );
				w.h2s.rotation.set( 0, Math.sin( c.t * 1.2 ) * 0.5, Math.sin( c.t * 2 ) * 0.1 );
				stat( c, tH, tE - 0.1, 'H₂S', 'hydrogen sulfide', PALETTE.yellow );
			} else {
				c.frame( V3( 0, 0.5, 0 ), 1.6, undefined, tE );
				earth( c, V3( c.V ? 0.9 : 1.6, 1.25, - 1.2 ), 0.4 * bounceIn( c, tE ) );
				w.egg.visible = true; w.egg.position.set( 0, - 0.1, 0 ); w.egg.scale.setScalar( 0.7 * bounceIn( c, tE + 0.3 ) );
				w.egg.rotation.z = Math.sin( c.t * 6 ) * 0.1;
				stink( c, V3( 0, 0.55, 0.3 ), 0.5, tE + 0.4 );
				c.hud.stat( c.t, tE + 0.8, c.t1 - 0.1, 'rotten eggs!', c.sx, c.L.statY, c.L.statSize * 0.6, PALETTE.stink );
			}
			const sl = c.slot( 'L' );
			c.hostAt( sl.x, sl.y, { ...c.poses( [ [ t0, 'astronaut' ], [ tW, 'tablet' ], [ tE, 'confused' ] ] ), bubble: c.bubbles( [ [ t0 + 0.3, tY - 0.1, 'dizzy' ], [ tE + 0.5, c.t1 - 0.1, 'dizzy' ] ] ) } );
		},
	},
	// 15 ── "nobody has actually seen glass rain ... a scientific idea ... still studying it"
	{
		key: 'remember', name: '15 Just an idea (for now)', start: () => at( 'remember' ),
		render( c ) {
			const t0 = c.t0, tI = at( 'idea' ), tS = at( 'stillStudying' );
			c.frame( V3( 0, 0, 0 ), 1.7 );
			const mv = easeInOutCubic( remap( c.t, tI + 0.5, tI + 1.3 ) ) * ( c.V ? 1 : 0 );
			const pc = V3( lerp( 0, 0.55, mv ), lerp( 0, - 0.55, mv ), 0 );
			planet( c, pc, lerp( 0.9, 0.5, mv ) * bounceIn( c, t0 ), { spin: 0.2 } );
			const g = c.hud;
			// pastel question marks orbiting the planet
			for ( let i = 0; i < 3; i ++ ) {
				const a = c.t * 0.8 + i * 2.1;
				const p = c.px( V3( Math.cos( a ) * 1.35, Math.sin( a ) * 0.8, 0.5 ) );
				g.text( '?', p.x, p.y, c.L.statSize * 0.6, { scale: popInOut( c.t, t0 + 0.3 + i * 0.15, tI - 0.1 ), fill: [ PALETTE.pink, PALETTE.yellow, PALETTE.mint ][ i ], rot: Math.sin( c.t * 2 + i ) * 0.2 } );
			}
			c.hud.stat( c.t, tI, c.t1 - 0.1, 'scientific idea', c.sx, c.L.statY, c.L.statSize * 0.55, PALETTE.yellow );
			c.hud.spectrumCard( c.t, tI + 0.8, c.t1 - 0.1, c.V ? c.W * 0.44 : c.W * 0.78, c.V ? c.L.statY + 300 : c.H * 0.42, c.V ? 420 : 400 );
			const sl = c.slot( 'L' );
			c.hostAt( sl.x, sl.y, { ...c.poses( [ [ t0, 'thinking' ], [ tI, 'idea' ], [ tS, 'read_book' ] ] ), bubble: c.bubbles( [ [ t0 + 0.3, tI - 0.1, 'thinking' ], [ tI + 0.2, tS - 0.1, 'idea' ] ] ) } );
		},
	},
	// 16 ── "peaceful blue marble ... up close, one of the deadliest places"
	{
		key: 'marble', name: '16 Blue marble / deadly', start: () => at( 'marble' ),
		render( c ) {
			const t0 = c.t0, tU = at( 'upClose' );
			const z = easeInOutCubic( remap( c.t, tU - 0.2, tU + 1.3 ) );
			c.frame( V3( 0, lerp( 0, 0.75, z ), 0 ), lerp( 2.4, 0.75, z ) );
			planet( c, V3( 0, 0, 0 ), 0.75, { spin: lerp( 0.12, 1.5, z ), wind: z * 1.3 } );
			if ( z > 0.3 ) {
				shards( c, V3( 0, 0.75, 0.6 ), V3( 1.2, 0.6, 0.2 ), 4, z, - 1, 0.25 );
				c.hud.speedLines( c.t, ( z - 0.3 ) * 1.2, 17 );
			}
			c.hud.stat( c.t, t0 + 0.6, tU - 0.1, 'peaceful?', c.sx, c.L.statY, c.L.statSize * 0.6, PALETTE.periwinkle );
			c.hud.stat( c.t, tU + 0.9, c.t1 - 0.1, 'DEADLY!', c.sx, c.L.statY, c.L.statSize * 0.85, '#ff8fa8' );
			c.hud.focusLines( c.t, 0.5 * popInOut( c.t, tU + 0.9, c.t1 - 0.2 ) );
			const sl = c.slot( 'R' );
			c.hostAt( sl.x, sl.y, { ...c.poses( [ [ t0, 'laptop_sit' ], [ tU + 0.8, 'shocked_wave' ] ] ), faceRight: false, bubble: c.bubbles( [ [ tU + 1.0, c.t1 - 0.1, 'surprised' ] ] ) } );
		},
	},
	// 17 ── "how special our own blue planet is. Soft rain, fresh air ... not found another place like home."
	{
		key: 'special', name: '17 Home', start: () => at( 'special' ),
		render( c ) {
			const t0 = c.t0, tR = at( 'softRain' ), tO = at( 'outThere' ), tH = at( 'home' );
			c.w.scene.background = new THREE.Color( PALETTE.navy );
			const out = easeInOutCubic( remap( c.t, tO - 0.2, tO + 1.8 ) );
			if ( out < 0.01 ) c.sphereShot( V3( 0, - 0.2, 0 ), 1, { radius: 1.7, focusY: 0.0 } );
			else c.frame( V3( 0, lerp( 0.45, 0.2, out ), 0 ), lerp( c.V ? 1.7 : 2.4, 5.2, out ) );
			const E = V3( 0, - 0.2, 0 );
			earth( c, E, 1 * bounceIn( c, t0 ), 0.1 );
			puffs( c, c.w.clouds, V3( 0, 1.2, 0.4 ), 1.6, 0.25, 0.22, remap( c.t, tR - 0.3, tR + 0.6 ), 9 );
			if ( out > 0 ) exos( c, V3( 0, 0, - 2 ), 0.75, tO, 1.2, smooth( remap( c.t, tH, tH + 0.5 ) ) );
			// soft rain (HUD streaks) while "soft rain" is spoken
			const rain = popInOut( c.t, tR, tO - 0.2 );
			if ( rain > 0 ) {
				const g = c.hud.g; g.save(); g.globalAlpha = 0.55 * clamp( rain ); g.strokeStyle = '#cfe6ff'; g.lineCap = 'round'; g.lineWidth = 5;
				const top = c.px( V3( 0, 1.2, 0.4 ) );
				for ( let i = 0; i < 26; i ++ ) {
					const x = top.x + ( ( i * 73 ) % 360 - 180 ) * ( c.W / 1080 );
					const y = top.y + ( ( c.t * 380 + i * 97 ) % 260 );
					g.beginPath(); g.moveTo( x, y ); g.lineTo( x - 4, y + 26 ); g.stroke();
				}
				g.restore();
			}
			burst( c, 1, E.clone().add( V3( 0, 0, - 1.5 ) ), 4.2 * lerp( 1, 1.6, out ), tH, c.t1 + 0.4 );
			c.hud.stat( c.t, tH + 0.2, c.t1 - 0.1, 'HOME ♥', c.sx, c.L.statY, c.L.statSize * 0.8, PALETTE.pink );
			// she walks on top of Earth (Earth rolls under her) then steps off to her slot as we zoom out
			if ( out < 0.05 ) c.hostOnSphere( E, 1, 0, { pose: 'walk', faceRight: false, bubble: c.bubbles( [ [ tR + 0.2, tO - 0.3, 'happy' ] ] ) } );
			else { const sl = c.slot( 'L' ); c.hostAt( sl.x, sl.y, { pose: c.t < tH ? 'astronaut' : 'hold_sign', poseAt: c.t < tH ? tO : tH, bubble: c.bubbles( [ [ tH + 0.3, c.t1 - 0.1, 'happy' ] ] ) } ); }
			( c.w.earth.userData.ball as THREE.Mesh ).rotation.z = out < 0.05 ? c.t * 0.25 : 0;
		},
	},
	// 18 ── "Billions of planets, and not one of them can care. But you can."
	{
		key: 'theThing', name: '18 But you can', start: () => at( 'theThing' ),
		render( c ) {
			const t0 = c.t0, tY = at( 'youCan' ), tF = at( 'dontForget' );
			const z = easeInOutCubic( remap( c.t, tY - 0.3, tY + 0.9 ) );
			c.frame( V3( 0, 0, 0 ), lerp( 5.5, 2.2, z ) );
			exos( c, V3( 0, 0, - 1 ), 0.7, t0 + 0.2, 1.4, z, tY - 0.2 );
			c.hud.stat( c.t, t0 + 1.2, tY - 0.2, 'billions of planets', c.sx, c.L.statY, c.L.statSize * 0.5, '#ffffff' );
			burst( c, 1, V3( 0, 0, - 2 ), 5.5, tY, c.t1 + 0.4 );
			stat( c, tY + 0.1, c.t1 - 0.1, 'YOU CAN.', undefined, PALETTE.pink );
			c.hud.stat( c.t, tF + 0.2, c.t1 - 0.1, 'never forget it ♥', c.sx, c.L.statY + c.L.statSize * 0.85, c.L.statSize * 0.38, '#ffffff' );
			// host steps to centre-stage for the emotional beat
			const sl = c.slot( 'L' );
			const toC = easeInOutCubic( remap( c.t, tY - 0.2, tY + 0.8 ) );
			const x = lerp( sl.x, c.V ? 0 : - 0.15, toC );
			c.hostAt( x, sl.y + ( c.V ? 0 : 0.12 * toC ), { ...c.poses( [ [ t0, 'explain' ], [ tY, 'hold_sign' ] ] ), bubble: c.bubbles( [ [ tY + 0.4, c.t1 - 0.1, 'happy' ] ] ) } );
		},
	},
	// 19 ── "Space is truly amazing. And this is only the beginning."
	{
		key: 'amazing', name: '19 Ending', start: () => at( 'amazing' ),
		render( c ) {
			const t0 = c.t0, tB = at( 'beginning' );
			const w = c.w;
			w.milky.visible = true;
			w.milky.rotation.set( 1.05, 0, 0.3 );
			w.milky.children[ 0 ].rotation.y = c.t * 0.03;
			const drift = ( c.t - t0 ) * 1.5;
			c.frame( V3( 0, 0, 0 ), 30 + drift );
			planet( c, V3( - 6, 4, 12 ), 2.4 * bounceIn( c, t0 + 0.2 ), { spin: 0.3 } );
			earth( c, V3( 7, - 3, 10 ), 2.0 * bounceIn( c, t0 + 0.4 ), 0.3 );
			c.hud.stat( c.t, t0 + 0.3, tB - 0.1, 'Space is amazing!', c.sx, c.L.titleY, c.L.titleSize * 0.8, PALETTE.yellow );
			const s = spring( c.t - tB );
			c.hud.text( 'this is only', c.sx, c.L.titleY, c.L.titleSize * 0.6, { scale: s, fill: '#ffffff' } );
			c.hud.text( 'THE BEGINNING', c.sx, c.L.titleY + c.L.titleSize * 0.9, c.L.titleSize, { scale: spring( c.t - tB - 0.25 ), fill: PALETTE.peach } );
			const sl = c.slot( 'R' );
			c.hostAt( c.V ? 0 : sl.x, sl.y, { ...c.poses( [ [ t0, 'star_board' ], [ tB, 'shocked_wave' ] ] ), faceRight: false, bubble: c.bubbles( [ [ t0 + 0.4, tB - 0.1, 'happy' ] ] ) } );
			// fade out on the final second
			c.flash = Math.max( c.flash, 0 );
		},
	},
];

/** Resolve start/end of each scene (once). */
export function resolveScenes( duration: number ) {
	const starts = SCENES.map( ( s ) => s.start() );
	return SCENES.map( ( s, i ) => ( { ...s, t0: starts[ i ], t1: i + 1 < SCENES.length ? starts[ i + 1 ] : duration } ) );
}

export { atEnd };
