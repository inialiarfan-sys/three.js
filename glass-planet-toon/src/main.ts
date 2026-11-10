// Entry: builds the world and exposes ONE timeline function, render(t).
// Preview mode plays the narration and calls render(audio.currentTime).
// Capture mode (used by scripts/render.mjs) calls render(i / fps) for every frame.
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import './style.css';
import * as THREE from 'three';
import { Hud } from './engine/hud';
import { createPost } from './engine/post';
import { Host } from './host';
import { buildWorld } from './world';
import { Stage, SIZES, type Mode } from './stage';
import { resolveScenes } from './scenes';
import { buildCaptions, SPEECH_END, type Caption } from './timeline';
import { clamp } from './engine/math';

const params = new URLSearchParams( location.search );
const capture = params.has( 'capture' );
if ( capture ) document.body.classList.add( 'capture' );

const canvas = document.getElementById( 'view' ) as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer( { canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' } );
renderer.setPixelRatio( 1 );
renderer.outputColorSpace = THREE.SRGBColorSpace;

const world = buildWorld();
const hud = new Hud();
const host = new Host();
world.overlay.add( host.group );
const stage = new Stage( world, hud, host );
const post = createPost( renderer, world.scene, world.overlay, stage.camera, hud.texture );

let duration = SPEECH_END + 1.5;
let scenes = resolveScenes( duration );
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
	fitCanvas();
	const btn = document.getElementById( 'mode' );
	if ( btn ) btn.textContent = m === 'vertical' ? 'Vertical 9:16' : 'Wide 16:9';
}

function fitCanvas() {
	if ( capture ) { canvas.style.width = '100%'; canvas.style.height = 'auto'; return; }
	const [ w, h ] = SIZES[ mode ];
	canvas.style.aspectRatio = `${ w } / ${ h }`;
	canvas.style.width = w > h ? '100%' : 'auto';
	canvas.style.height = w > h ? 'auto' : '100%';
}

function resetWorld() {
	world.hideAll();
	world.scene.background = new THREE.Color( '#0f1438' );
	world.stars.visible = true;
	world.neb.visible = true;
	world.key.position.set( - 4, 3, 5 ); world.key.target.position.set( 0, 0, 0 ); world.key.intensity = 2.8;
	world.hemi.intensity = 1.3;
	world.planetSpin.rotation.set( 0, 0, 0.35 );
	world.planetRoll.rotation.set( 0, 0, 0 );
	world.planetMat.emissiveIntensity = 0;
	( world.planetHeat.material as THREE.ShaderMaterial ).uniforms.uIntensity.value = 0;
	stage.flash = 0; stage.shimmer = 0; stage.hostState = null;
	stage.sx = stage.V ? stage.W / 2 - 30 : stage.W / 2;
}

/** THE timeline function. Same t -> same frame. */
function render( t: number ) {
	t = Math.max( 0, t );
	resetWorld();
	hud.begin();
	let i = scenes.findIndex( ( s ) => t >= s.t0 && t < s.t1 );
	if ( i < 0 ) i = scenes.length - 1;
	const sc = scenes[ i ];
	stage.t = t; stage.t0 = sc.t0; stage.t1 = sc.t1;
	if ( i > 0 ) stage.cuts( sc.t0 );
	sc.render( stage );
	( world.stars.material as THREE.ShaderMaterial ).uniforms.uTime.value = t;
	( world.stars.material as THREE.ShaderMaterial ).uniforms.uScale.value = stage.H / 1920 * ( mode === 'wide' ? 1.4 : 1 );
	world.key.target.updateMatrixWorld();

	hud.captions( t, captions, stage.L.capX, stage.L.capY, stage.L.capW, stage.L.capSize );
	hud.end();
	if ( stage.hostState ) host.update( t, stage.hostState, stage.camera );
	else host.group.visible = false;

	const fin = post.final.uniforms;
	fin.uTime.value = t;
	fin.uShimmer.value = stage.shimmer;
	// opening fade-in + closing fade to navy
	const fadeIn = 1 - clamp( t / 0.5 );
	const fadeOut = clamp( ( t - ( duration - 1.0 ) ) / 0.9 );
	if ( fadeIn > 0 || fadeOut > 0 ) {
		fin.uFlashColor.value.set( '#0f1438' );
		fin.uFlash.value = Math.max( fadeIn, fadeOut );
	} else {
		fin.uFlashColor.value.set( '#fff6ea' );
		fin.uFlash.value = stage.flash;
	}
	post.composer.render();
	return sc.name;
}

/** Read the finished frame as base64 RGBA (bottom-up rows; ffmpeg flips it). */
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
	await Promise.all( [ document.fonts.load( '700 64px Fredoka' ), document.fonts.load( '500 64px Fredoka' ), host.load() ] );
	await document.fonts.ready;
	const audio = document.getElementById( 'audio' ) as HTMLAudioElement;
	audio.src = '/narration/narration.mp3';
	if ( ! capture ) {
		await new Promise<void>( ( res ) => {
			const done = () => res();
			audio.addEventListener( 'loadedmetadata', done, { once: true } );
			audio.addEventListener( 'error', done, { once: true } );
			setTimeout( done, 4000 );
		} );
	}
	const urlDur = parseFloat( params.get( 'duration' ) || '' );
	if ( isFinite( urlDur ) && urlDur > 0 ) duration = urlDur;
	else if ( isFinite( audio.duration ) && audio.duration > 0 ) duration = audio.duration;
	scenes = resolveScenes( duration );
	render( 0 );

	( window as any ).__app = {
		duration: () => duration,
		setMode: ( m: Mode ) => setMode( m ),
		render: ( t: number ) => render( t ),
		frame: async ( t: number ) => { render( t ); return grab(); },
		scenes: () => scenes.map( ( s ) => ( { name: s.name, t0: s.t0, t1: s.t1 } ) ),
	};
	( window as any ).__ready = true;
	if ( capture ) return;

	// ---------- preview UI ----------
	const play = document.getElementById( 'play' ) as HTMLButtonElement;
	const seek = document.getElementById( 'seek' ) as HTMLInputElement;
	const time = document.getElementById( 'time' )!;
	const sceneEl = document.getElementById( 'scene' )!;
	const modeBtn = document.getElementById( 'mode' ) as HTMLButtonElement;
	const fmt = ( s: number ) => `${ Math.floor( s / 60 ) }:${ ( s % 60 ).toFixed( 1 ).padStart( 4, '0' ) }`;
	let scrubbing = false;
	let lastT = - 1;
	play.onclick = () => { if ( audio.paused ) audio.play(); else audio.pause(); };
	audio.onplay = () => ( play.textContent = '❚❚ Pause' );
	audio.onpause = () => ( play.textContent = '▶ Play' );
	seek.oninput = () => { scrubbing = true; audio.currentTime = ( +seek.value / 1000 ) * duration; lastT = - 1; };
	seek.onchange = () => { scrubbing = false; };
	modeBtn.onclick = () => { setMode( mode === 'vertical' ? 'wide' : 'vertical' ); lastT = - 1; };
	window.addEventListener( 'keydown', ( e ) => {
		if ( e.code === 'Space' ) { e.preventDefault(); play.click(); }
		if ( e.code === 'ArrowRight' ) audio.currentTime = Math.min( duration, audio.currentTime + 2 );
		if ( e.code === 'ArrowLeft' ) audio.currentTime = Math.max( 0, audio.currentTime - 2 );
	} );
	// rAF only *schedules* drawing; the frame content comes from audio.currentTime.
	const tick = () => {
		const t = audio.currentTime;
		if ( t !== lastT ) {
			sceneEl.textContent = render( t );
			lastT = t;
			time.textContent = `${ fmt( t ) } / ${ fmt( duration ) }`;
			if ( ! scrubbing ) seek.value = String( Math.round( ( t / duration ) * 1000 ) );
		}
		requestAnimationFrame( tick );
	};
	tick();
}

boot().catch( ( e ) => { console.error( e ); ( window as any ).__error = String( e?.stack || e ); } );
