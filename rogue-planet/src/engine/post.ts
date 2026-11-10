import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const FinalShader = {
	uniforms: {
		tDiffuse: { value: null as THREE.Texture | null },
		tHud: { value: null as THREE.Texture | null },
		uTime: { value: 0 },
		uRes: { value: new THREE.Vector2( 1, 1 ) },
		uShimmer: { value: 0 },
		uFlash: { value: 0 },
		uFlashColor: { value: new THREE.Color( '#fff6ea' ) },
		uVignette: { value: 0.38 },
		uGrain: { value: 0.045 },
	},
	vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
	fragmentShader: /* glsl */`
		uniform sampler2D tDiffuse; uniform sampler2D tHud;
		uniform float uTime, uShimmer, uFlash, uVignette, uGrain; uniform vec2 uRes; uniform vec3 uFlashColor;
		varying vec2 vUv;
		float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
		float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
			return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
		void main(){
			vec2 uv = vUv;
			// wavy cartoon heat shimmer
			float sh = uShimmer;
			uv.x += sin(uv.y*38. + uTime*9.)*0.0045*sh + sin(uv.y*91. - uTime*13.)*0.0018*sh;
			uv.y += sin(uv.x*26. + uTime*7.)*0.003*sh;
			vec3 c = texture2D(tDiffuse, uv).rgb;
			c = mix(c, c*vec3(1.08,0.97,0.9), sh*0.6);
			// paper texture: fibres + blotches, static (doesn't depend on time)
			vec2 px = vUv*uRes;
			float paper = (vnoise(px/2.5)-.5)*0.05 + (vnoise(px/40.)-.5)*0.05 + (vnoise(vUv*vec2(5.,8.))-.5)*0.05;
			c *= 1. + paper;
			// HUD on top
			vec4 hud = texture2D(tHud, vUv);
			c = mix(c, hud.rgb, hud.a);
			// vignette
			float d = distance(vUv, vec2(.5)) * 1.25;
			c *= mix(1., smoothstep(1.05, .25, d), uVignette);
			// film grain (seeded by frame time -> deterministic)
			float gr = h21(px + fract(uTime*7.31)*vec2(97.,31.)) - .5;
			c += gr*uGrain;
			c = mix(c, uFlashColor, clamp(uFlash,0.,1.));
			gl_FragColor = vec4(c, 1.);
		}`,
};

/** overlay: drawn after bloom (the host sprite stays crisp, her white suit never glows). */
export function createPost( renderer: THREE.WebGLRenderer, scene: THREE.Scene, overlay: THREE.Scene, camera: THREE.Camera, hud: THREE.Texture ) {
	const rt = new THREE.WebGLRenderTarget( 2, 2, { samples: 4, type: THREE.HalfFloatType } );
	const composer = new EffectComposer( renderer, rt );
	composer.addPass( new RenderPass( scene, camera ) );
	const bloom = new UnrealBloomPass( new THREE.Vector2( 2, 2 ), 0.5, 0.45, 0.95 );
	composer.addPass( bloom );
	const over = new RenderPass( overlay, camera );
	over.clear = false;
	composer.addPass( over );
	composer.addPass( new OutputPass() );
	const final = new ShaderPass( FinalShader );
	final.uniforms.tHud.value = hud;
	composer.addPass( final );
	return {
		composer, bloom, final,
		setSize( w: number, h: number ) { composer.setPixelRatio( 1 ); composer.setSize( w, h ); final.uniforms.uRes.value.set( w, h ); },
	};
}
