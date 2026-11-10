// Props for "The Planet With No Sun". Built once, posed from t.
import * as THREE from 'three';
import { addOutline, hullOutline, PALETTE, rimShell, toon, toonBall } from './engine/toon';
import { canvas, radialTexture, tex } from './engine/textures';
import { rng } from './engine/math';
import { planetTextures } from './planets';
import type { World } from './world';

export type Rogue = ReturnType<typeof buildRogue>;

export function buildRogue( w: World ) {
	const scene = w.scene, overlay = w.overlay;
	const add = <T extends THREE.Object3D>( o: T, parent: THREE.Object3D = scene ) => { parent.add( o ); w.all.push( o ); return o; };

	// the rogue planet: dark, cold, with a faint icy rim so it always reads
	const rogue = add( new THREE.Group() );
	const rogueSpin = new THREE.Group(); rogue.add( rogueSpin );
	const rogueBall = new THREE.Mesh( new THREE.SphereGeometry( 1, 64, 32 ), toon( '#ffffff', { map: planetTextures( 'rogue', 31 ).map } ) );
	addOutline( rogueBall, 0.03, '#05060f' );
	rogueSpin.add( rogueBall ); rogueSpin.rotation.z = 0.4;
	rogue.add( rimShell( 1.05, '#9fb4ff', 2.6, 0.9 ) );

	// a crowd of tiny dark planets (instanced) for "billions"
	const N = 160;
	const tinyGeo = new THREE.SphereGeometry( 1, 16, 8 );
	const tiny = add( new THREE.InstancedMesh( tinyGeo, toon( '#5b5878' ), N ) );
	const tinyOl = new THREE.InstancedMesh( hullOutline( tinyGeo, 1.14, '#9fb4ff' ).geometry, hullOutline( tinyGeo, 1.14, '#9fb4ff' ).material, N );
	tiny.add( tinyOl ); tiny.frustumCulled = tinyOl.frustumCulled = false;
	const tinyData = ( () => { const r = rng( 404 ); return Array.from( { length: N }, () => ( { x: ( r() - .5 ) * 2, y: ( r() - .5 ) * 2, z: ( r() - .5 ) * 0.6, s: 0.4 + r() * 0.6, d: r() } ) ); } )();

	// orbit rings for the toon solar system
	const orbits = add( new THREE.Group() );
	for ( let i = 0; i < 4; i ++ ) {
		const m = new THREE.Mesh( new THREE.TorusGeometry( 1, 0.012, 6, 96 ), new THREE.MeshBasicMaterial( { color: '#8fa8ff', transparent: true, opacity: 0.5 } ) );
		m.rotation.x = Math.PI / 2 - 0.35; orbits.add( m );
	}
	const orbitPlanets = [ '#a8f0c8', '#ffb8d2', '#8fd6ff', '#ffe07a' ].map( ( c ) => add( toonBall( 1, c, 0.06, 24 ) ) );

	// dotted wandering path (instanced pills)
	const dots = add( new THREE.InstancedMesh( new THREE.SphereGeometry( 1, 10, 6 ), new THREE.MeshBasicMaterial( { color: new THREE.Color( '#c9d6ff' ) } ), 80 ) );
	dots.frustumCulled = false;

	// small planet with a face (for the kick-out)
	const small = add( new THREE.Group() );
	{
		const b = toonBall( 1, '#ffffff', 0.05, 40, { map: planetTextures( 'ocean', 41 ).map } );
		small.add( b );
		const faceTex = ( mood: 'happy' | 'sad' ) => {
			const [ c, g ] = canvas( 256, 256 );
			g.fillStyle = PALETTE.ink;
			g.beginPath(); g.ellipse( 90, 110, 14, 20, 0, 0, 7 ); g.fill(); g.beginPath(); g.ellipse( 166, 110, 14, 20, 0, 0, 7 ); g.fill();
			g.lineWidth = 10; g.lineCap = 'round'; g.strokeStyle = PALETTE.ink; g.beginPath();
			if ( mood === 'happy' ) g.arc( 128, 140, 34, 0.2, Math.PI - 0.2 ); else g.arc( 128, 196, 34, Math.PI + 0.3, - 0.3 );
			g.stroke();
			if ( mood === 'sad' ) { g.fillStyle = '#8fd6ff'; g.beginPath(); g.ellipse( 70, 150, 9, 16, 0, 0, 7 ); g.fill(); }
			g.fillStyle = 'rgba(255,140,170,0.6)'; g.beginPath(); g.ellipse( 60, 150, 18, 10, 0, 0, 7 ); g.fill(); g.beginPath(); g.ellipse( 196, 150, 18, 10, 0, 0, 7 ); g.fill();
			return tex( c );
		};
		const face = new THREE.Mesh( new THREE.PlaneGeometry( 1.3, 1.3 ), new THREE.MeshBasicMaterial( { map: faceTex( 'happy' ), transparent: true, depthTest: false } ) );
		face.position.z = 1.02; face.renderOrder = 5;
		small.add( face );
		small.userData = { face, happy: faceTex( 'happy' ), sad: faceTex( 'sad' ) };
	}

	// flashlight: a little code-drawn torch in her hand (overlay) + a real SpotLight and a soft cone (main scene)
	const torch = add( new THREE.Group(), overlay );
	{
		const mat = ( c: string ) => new THREE.MeshBasicMaterial( { color: c, transparent: true, depthTest: false, depthWrite: false } );
		const body = new THREE.Mesh( new THREE.CapsuleGeometry( 0.12, 0.42, 4, 12 ), mat( '#ffb27a' ) ); body.rotation.z = Math.PI / 2;
		const bodyOl = new THREE.Mesh( new THREE.CapsuleGeometry( 0.15, 0.44, 4, 12 ), mat( PALETTE.ink ) ); bodyOl.rotation.z = Math.PI / 2;
		const head = new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0.15, 0.2, 16 ), mat( '#ffe07a' ) ); head.rotation.z = - Math.PI / 2; head.position.x = 0.32;
		const lens = new THREE.Mesh( new THREE.CircleGeometry( 0.17, 16 ), mat( '#fffbe0' ) ); lens.position.x = 0.43; lens.rotation.y = Math.PI / 2;
		bodyOl.renderOrder = 24; body.renderOrder = 25; head.renderOrder = 25; lens.renderOrder = 26;
		torch.add( bodyOl, body, head, lens );
		torch.userData = { lens };
	}
	const spot = new THREE.SpotLight( '#ffe2b0', 0, 12, 0.42, 0.55, 1.2 );
	scene.add( spot, spot.target );
	const coneMat = new THREE.ShaderMaterial( {
		uniforms: { uOpacity: { value: 0.4 }, uColor: { value: new THREE.Color( '#ffe7b8' ) } },
		vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
		fragmentShader: `uniform float uOpacity; uniform vec3 uColor; varying float vY; varying vec3 vN; varying vec3 vV;
			void main(){ float along = smoothstep(-1., 0.9, vY); float edge = pow(abs(dot(vN, vV)), 1.5); float a = along * edge * uOpacity; gl_FragColor = vec4(uColor * a, a); }`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	} );
	const coneGeo = new THREE.ConeGeometry( 1, 1, 40, 1, true ); coneGeo.translate( 0, - 0.5, 0 ); // apex at origin, opening along -y
	const cone = add( new THREE.Mesh( coneGeo, coneMat ) );
	const torchGlow = add( new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: radialTexture( 'rgba(255,230,180,0.9)', 'rgba(255,200,140,0)' ), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } ) ) );

	// ice crystals on the ground (instanced, lit by the flashlight)
	const CR = 70;
	const crystalGeo = new THREE.OctahedronGeometry( 1, 0 ); crystalGeo.scale( 0.35, 1, 0.35 );
	const crystals = add( new THREE.InstancedMesh( crystalGeo, toon( '#bfe6ff', { emissive: '#3a5a90', emissiveIntensity: 0.25 } ), CR ) );
	const crOl = new THREE.InstancedMesh( hullOutline( crystalGeo, 1.15, '#0b1030' ).geometry, hullOutline( crystalGeo, 1.15, '#0b1030' ).material, CR );
	crystals.add( crOl ); crystals.frustumCulled = crOl.frustumCulled = false;
	const crystalData = ( () => { const r = rng( 77 ); return Array.from( { length: CR }, () => ( { x: ( r() - .5 ) * 2, z: r(), s: 0.4 + r() * 0.8, ry: r() * 6, tilt: ( r() - .5 ) * 0.5 } ) ); } )();
	// icy ground: big dark sphere top
	const ground = add( new THREE.Mesh( new THREE.SphereGeometry( 1, 96, 48 ), toon( '#ffffff', { map: planetTextures( 'rogue', 52 ).map } ) ) );
	addOutline( ground, 0.004, '#05060f' );

	// ice slabs for the chase (instanced boxes)
	const SL = 18;
	const slabGeo = new THREE.BoxGeometry( 1, 0.3, 1.4 );
	const slabs = add( new THREE.InstancedMesh( slabGeo, toon( '#7f8fc8', { emissive: '#1a2550', emissiveIntensity: 0.3 } ), SL ) );
	const slabOl = new THREE.InstancedMesh( hullOutline( slabGeo, 1.06, '#05060f' ).geometry, hullOutline( slabGeo, 1.06, '#05060f' ).material, SL );
	slabs.add( slabOl ); slabs.frustumCulled = slabOl.frustumCulled = false;

	// toon space telescope
	const telescope = add( new THREE.Group() );
	{
		const tube = new THREE.Mesh( new THREE.CylinderGeometry( 0.35, 0.35, 1.6, 32 ), toon( '#dfe6ff' ) ); tube.rotation.z = Math.PI / 2; addOutline( tube, 0.03 );
		const rim = new THREE.Mesh( new THREE.TorusGeometry( 0.36, 0.06, 10, 32 ), toon( '#ffd36e' ) ); rim.rotation.y = Math.PI / 2; rim.position.x = 0.8; addOutline( rim, 0.02 );
		const lens = new THREE.Mesh( new THREE.CircleGeometry( 0.32, 32 ), new THREE.MeshBasicMaterial( { color: new THREE.Color( '#8fd6ff' ).multiplyScalar( 1.4 ) } ) ); lens.rotation.y = Math.PI / 2; lens.position.x = 0.81;
		const panelGeo = new THREE.BoxGeometry( 0.9, 0.04, 0.5 );
		for ( const s of [ - 1, 1 ] ) { const p = new THREE.Mesh( panelGeo, toon( '#7a8cff' ) ); p.position.set( - 0.1, 0, s * 0.75 ); p.rotation.x = Math.PI / 2; addOutline( p, 0.02 ); telescope.add( p ); }
		const back = toonBall( 0.3, '#ffb8d2', 0.06 ); back.position.x = - 0.85;
		telescope.add( tube, rim, lens, back );
	}
	const scanBeam = add( new THREE.Mesh( coneGeo, coneMat.clone() ) );
	( scanBeam.material as THREE.ShaderMaterial ).uniforms.uColor.value = new THREE.Color( '#8fd6ff' );

	// dawn sky glow + sun disc for the Earth sunrise / hill
	const dawn = add( new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), new THREE.MeshBasicMaterial( { map: radialTexture( 'rgba(255,170,120,0.85)', 'rgba(255,120,160,0)' ), transparent: true, depthWrite: false } ) ) );
	const sunDisc = add( new THREE.Mesh( new THREE.CircleGeometry( 1, 48 ), new THREE.MeshBasicMaterial( { color: new THREE.Color( '#ffe2a0' ).multiplyScalar( 1.6 ) } ) ) );

	{
		const { shell, water } = w.iceCut.userData as { shell: THREE.Mesh; water: THREE.Mesh };
		( shell.material as THREE.MeshToonMaterial ).color.set( '#d6dcff' );
		const wm = water.material as THREE.MeshToonMaterial; wm.color.set( '#2f6fe0' ); wm.emissive.set( '#3f8cff' ).multiplyScalar( 0.9 );
		const core = w.iceCut.children[ 2 ] as THREE.Mesh;
		const cm = core.material as THREE.MeshToonMaterial; cm.color.set( '#ffb27a' ); cm.emissive = new THREE.Color( '#ff7a3c' ).multiplyScalar( 1.3 );
		const glow = w.iceCut.children[ 3 ] as THREE.Mesh;
		( glow.material as THREE.MeshBasicMaterial ).map = radialTexture( 'rgba(255,170,110,0.85)', 'rgba(255,140,90,0)' );
		glow.scale.setScalar( 1.6 );
	}
	return { rogue, rogueSpin, tiny, tinyOl, tinyData, orbits, orbitPlanets, dots, small, torch, spot, cone, torchGlow,
		crystals, crOl, crystalData, ground, slabs, slabOl, telescope, scanBeam, dawn, sunDisc };
}
