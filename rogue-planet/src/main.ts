// Entry: builds the world and exposes ONE timeline function, render(t).
// Preview: render(audio.currentTime). Capture (scripts/*.mjs): render(i / 30).
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import './style.css';
import * as THREE from 'three';
import { Hud } from './engine/hud';
import { createPost } from './engine/post';
import { clamp } from './engine/math';
import { Luna } from './luna';
import { buildWorld } from './world';
import { Stage, SIZES, type Mode } from './stage';
import { SCENES } from './scenes-rogue';
import { buildRogue } from './rogue-props';
import { AUDIO_END, buildCaptions, sceneTimings, type Caption } from './timeline';

const params = new URLSearchParams( location.search );
const capture = params.has( 'capture' );
if ( capture ) document.body.classList.add( 'capture' );

const canvas = document.getElementById( 'view' ) as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer( { canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' } );
renderer.setPixelRatio( 1 );
renderer.outputColorSpace = THREE.SRGBColorSpace;

const world = buildWorld();
const hud = new Hud();
const luna = new Luna();
world.overlay.add( luna.group );
luna.body.add( world.jackets );           // jackets ride along with her hops and tilt
const rogue = buildRogue( world );
luna.body.add( rogue.torch );           // the flashlight hops with her
const stage = new Stage( world, hud, luna );
stage.r = rogue;
const post = createPost( renderer, world.scene, world.overlay, stage.camera, hud.texture );

const DEFS = new Map( SCENES.map( ( s ) => [ s.key, s ] ) );
let duration = AUDIO_END + 1.5;
let scenes = sceneTimings( duration );
let captions: Caption[] = [];
let mode: Mode = 'vertical';

function setMode( m: Mode ) {
	mode = m;
	const [ w, h ] = SIZES[ m ];
	renderer.setSize( w, h, false );
	post.setSize( w, h );
	hud.resize( w, h );
	stage.setMode( m );
	captions = buildCaptions( stage.L.capWords );
	if ( ! capture ) {
		canvas.style.aspectRatio = `${ w } / ${ h }`;
		canvas.style.width = w > h ? '100%' : 'auto';
		canvas.style.height = w > h ? 'auto' : '100%';
	}
	const btn = document.getElementById( 'mode' );
	if ( btn ) btn.textContent = m === 'vertical' ? 'Vertical 9:16' : 'Wide 16:9';
}

function resetWorld() {
	world.hideAll();
	world.scene.background = new THREE.Color( '#0f1438' );
	world.stars.visible = true; world.neb.visible = true;
	( world.stars.material as THREE.ShaderMaterial ).uniforms.uTwinkle.value = 1;
	world.key.position.set( - 4, 3, 5 ); world.key.target.position.set( 0, 0, 0 ); world.key.intensity = 2.8;
	world.hemi.intensity = 1.3;
	world.ship.group.rotation.set( 0, 0, 0 );
	for ( const p of Object.values( world.P ) ) p.group.rotation.set( 0, 0, 0 );
	( world.helmetGlow.material as THREE.MeshBasicMaterial ).color.set( '#ffffff' );
	stage.flash = 0; stage.shimmer = 0; stage.dim = 0; stage.vignette = 0.38; stage.luna = null;
	stage.sx = stage.V ? stage.W / 2 - 30 : stage.W / 2;
	stage.torch = null; rogue.spot.intensity = 0;
	// per-frame resets for things scenes tweak
	( world.stars.material as THREE.ShaderMaterial ).uniforms.uOpacity.value = 1;
	world.hemi.color.set( '#cfd8ff' ); world.key.color.set( '#fff1e4' );
	world.hill.children[ world.hill.children.length - 1 ].visible = true; world.hill.children[ world.hill.children.length - 2 ].visible = true;
	( ( world.star.userData.halo as THREE.Mesh ).material as THREE.MeshBasicMaterial ).opacity = 0.45;
	( ( world.milky.children[ 0 ] as THREE.Points ).material as THREE.PointsMaterial ).opacity = 0.95;
	rogue.small.rotation.set( 0, 0, 0 );
}

/** THE timeline function. Same t -> same frame. */
function render( t: number ) {
	t = Math.max( 0, Math.min( t, duration ) );
	resetWorld();
	hud.begin();
	let i = scenes.findIndex( ( s ) => t >= s.t0 && t < s.t1 );
	if ( i < 0 ) i = scenes.length - 1;
	const sc = scenes[ i ];
	stage.t = t; stage.t0 = sc.t0; stage.t1 = sc.t1;
	if ( i > 0 ) stage.cuts( sc.t0 );
	DEFS.get( sc.key )!.render( stage );
	const sm = world.stars.material as THREE.ShaderMaterial;
	sm.uniforms.uTime.value = t;
	sm.uniforms.uScale.value = stage.H / 1920 * ( mode === 'wide' ? 1.4 : 1 );
	( world.hostStars.material as THREE.ShaderMaterial ).uniforms.uTime.value = t;
	world.key.target.updateMatrixWorld();

	hud.captions( t, captions, stage.L.capX, stage.L.capY, stage.L.capW, stage.L.capSize );
	hud.end();
	if ( stage.luna ) {
		// keep reaction bubbles inside the frame: Luna near the left edge -> bubble on her right, and vice versa
		const b = stage.luna.bubble;
		if ( b && b.side === undefined ) {
			const x = stage.px( stage.luna.pos ).x / stage.W;
			if ( x < 0.3 ) b.side = 1; else if ( x > 0.7 ) b.side = - 1;
		}
		luna.update( t, stage.luna, stage.camera );
	}
	else luna.group.visible = false;
	placeTorch( t );

	const fin = post.final.uniforms;
	fin.uTime.value = t;
	fin.uShimmer.value = stage.shimmer;
	fin.uVignette.value = stage.vignette;
	const fadeIn = 1 - clamp( t / 0.4 );
	const fadeOut = clamp( ( t - ( duration - 1.5 ) ) / 1.4 );
	const dark = Math.max( fadeIn, fadeOut, stage.dim );
	if ( dark > stage.flash ) { fin.uFlashColor.value.set( '#070a1e' ); fin.uFlash.value = dark; }
	else { fin.uFlashColor.value.set( '#fff6ea' ); fin.uFlash.value = stage.flash; }
	post.composer.render();
	return sc.name;
}

/** Flashlight: torch sprite in her hand, a real SpotLight and a soft additive cone toward stage.torch.aim. */
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3( 0, - 1, 0 );
function placeTorch( t: number ) {
	const T = stage.torch, L = stage.luna;
	const inHand = !! ( T && L && ! T.origin && T.on > 0 );
	rogue.torch.visible = inHand || !! ( T && L && ! T.origin && T.on === 0 );
	if ( L && T && ! T.origin ) {
		const H = L.height, face = L.face ?? - 1;
		const sit = /sit/.test( L.sprite );
		rogue.torch.position.set( face * H * 0.24, H * ( sit ? 0.2 : 0.3 ), 0.01 );   // in her hand, below the face
		rogue.torch.scale.setScalar( H * 0.17 );
		// aim the torch body toward the target in screen space
		const hp = stage.px( L.pos.clone().add( new THREE.Vector3( face * H * 0.24, H * 0.3, 0 ) ) ), ap = stage.px( T.aim );
		rogue.torch.rotation.z = Math.atan2( - ( ap.y - hp.y ), ap.x - hp.x ) - ( L.tilt ?? 0 ) - luna.body.rotation.z;
	}
	const on = T ? T.on : 0;
	rogue.cone.visible = rogue.torchGlow.visible = on > 0.01;
	if ( ! T || on <= 0.01 ) { rogue.spot.intensity = 0; return; }
	if ( T.origin ) _a.copy( T.origin );
	else ( rogue.torch.userData.lens as THREE.Mesh ).getWorldPosition( _a );
	_b.copy( T.aim );
	const dir = _b.clone().sub( _a ), len = dir.length();
	const spread = T.spread ?? 0.42;
	rogue.cone.position.copy( _a );
	rogue.cone.quaternion.setFromUnitVectors( _up, dir.clone().normalize() );
	rogue.cone.scale.set( Math.tan( spread ) * len, len, Math.tan( spread ) * len );
	( rogue.cone.material as THREE.ShaderMaterial ).uniforms.uOpacity.value = 0.42 * on * ( 0.97 + 0.03 * Math.sin( t * 13 ) );
	rogue.torchGlow.position.copy( _a ).add( new THREE.Vector3( 0, 0, 0.05 ) );
	rogue.torchGlow.scale.setScalar( ( L ? L.height : 0.5 ) * 0.5 * on );
	rogue.spot.position.copy( _a ); rogue.spot.target.position.copy( _b ); rogue.spot.target.updateMatrixWorld();
	rogue.spot.angle = spread; rogue.spot.distance = len * 2.5;
	rogue.spot.intensity = ( T.intensity ?? 30 ) * on * 0.35;   // soft: lights the ice without a glare streak
}

async function grab(): Promise<string> {
	const gl = renderer.getContext();
	const [ w, h ] = SIZES[ mode ];
	const px = new Uint8Array( w * h * 4 );
	gl.bindFramebuffer( gl.FRAMEBUFFER, null );
	gl.readPixels( 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px );
	const url: string = await new Promise( ( res ) => { const r = new FileReader(); r.onload = () => res( r.result as string ); r.readAsDataURL( new Blob( [ px ] ) ); } );
	return url.slice( url.indexOf( ',' ) + 1 );
}

async function boot() {
	setMode( ( params.get( 'mode' ) as Mode ) || 'vertical' );
	await Promise.all( [ document.fonts.load( '700 64px Fredoka' ), document.fonts.load( '500 64px Fredoka' ), luna.load() ] );
	await document.fonts.ready;
	world.ship.setFaces( luna.heads );
	const audio = document.getElementById( 'audio' ) as HTMLAudioElement;
	audio.src = params.get( 'audio' ) || '/narration.mp3';
	const urlDur = parseFloat( params.get( 'duration' ) || '' );
	if ( isFinite( urlDur ) && urlDur > 0 ) duration = urlDur;
	else if ( ! capture ) {
		await new Promise<void>( ( res ) => { audio.addEventListener( 'loadedmetadata', () => res(), { once: true } ); audio.addEventListener( 'error', () => res(), { once: true } ); setTimeout( res, 4000 ); } );
		if ( isFinite( audio.duration ) && audio.duration > 0 ) duration = audio.duration + 1.5;
	}
	scenes = sceneTimings( duration );
	render( 0 );

	( window as any ).__app = {
		duration: () => duration,
		render: ( t: number ) => render( t ),
		frame: async ( t: number ) => { render( t ); return grab(); },
		scenes: () => scenes,
	};
	( window as any ).__ready = true;
	if ( capture ) return;

	const play = document.getElementById( 'play' ) as HTMLButtonElement;
	const seek = document.getElementById( 'seek' ) as HTMLInputElement;
	const time = document.getElementById( 'time' )!;
	const sceneEl = document.getElementById( 'scene' )!;
	const modeBtn = document.getElementById( 'mode' ) as HTMLButtonElement;
	const fmt = ( s: number ) => `${ Math.floor( s / 60 ) }:${ ( s % 60 ).toFixed( 1 ).padStart( 4, '0' ) }`;
	// The audio clock is t while the audio plays; the extra 1.5 s tail after the audio
	// ends is scrubbable through the seek bar (t = slider value).
	let tailT = - 1, scrubbing = false, lastT = - 1;
	const now = () => ( tailT >= 0 ? tailT : audio.currentTime );
	play.onclick = () => { if ( audio.paused ) { tailT = - 1; audio.play(); } else audio.pause(); };
	audio.onplay = () => ( play.textContent = '❚❚ Pause' );
	audio.onpause = () => ( play.textContent = '▶ Play' );
	seek.oninput = () => {
		scrubbing = true;
		const t = ( +seek.value / 10000 ) * duration;
		if ( t > ( audio.duration || duration ) ) { tailT = t; audio.pause(); } else { tailT = - 1; audio.currentTime = t; }
		lastT = - 1;
	};
	seek.onchange = () => { scrubbing = false; };
	modeBtn.onclick = () => { setMode( mode === 'vertical' ? 'wide' : 'vertical' ); lastT = - 1; };
	window.addEventListener( 'keydown', ( e ) => {
		if ( e.code === 'Space' ) { e.preventDefault(); play.click(); }
		if ( e.code === 'ArrowRight' ) audio.currentTime = Math.min( audio.duration || duration, audio.currentTime + 2 );
		if ( e.code === 'ArrowLeft' ) audio.currentTime = Math.max( 0, audio.currentTime - 2 );
	} );
	const tick = () => {
		const t = now();
		if ( t !== lastT ) {
			sceneEl.textContent = 'Scene: ' + render( t );
			lastT = t;
			time.textContent = `${ fmt( t ) } / ${ fmt( duration ) }`;
			if ( ! scrubbing ) seek.value = String( Math.round( ( t / duration ) * 10000 ) );
		}
		requestAnimationFrame( tick );
	};
	tick();
}

boot().catch( ( e ) => { console.error( e ); ( window as any ).__error = String( e?.stack || e ); } );
