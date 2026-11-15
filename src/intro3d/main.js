/* =========================================================
   Gaúcho Figueiras Grill · intro 3D (Three.js)
   Bife na pedra, faca corta, metades se abrem, logo surge do corte,
   e a cena "queima" revelando o site.
   ========================================================= */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createSteakMaterials, buildSteak, hTop, BOTTOM, zEdgePos, zEdgeNeg, cutCurvePoints, outlineR } from './steak.js';
import { createKnife, KNIFE_TIP } from './knife.js';
import { createFire, createSparks, createSmoke, createJuice, createRays } from './fx.js';
import { createLogo } from './logo.js';
import { proceduralMaterial, NOISE } from './materials.js';
import { clamp01, lerp, phase, smooth, easeInCubic, easeOutCubic, easeInOutCubic, easeOutBack, noise1, rng } from './util.js';

const T = {
  fadeIn: [0, 1.0],
  knifeIn: [1.25, 2.05],
  slice: [2.05, 3.05],
  knifeOut: [3.05, 3.6],
  split: [3.3, 4.45],
  logo: [3.75, 5.35],
  tagline: 5.2,
  burn: [6.9, 8.0]
};
const SPLIT_T = T.split[0] + 0.04;
const LOGO_POS = new THREE.Vector3(0, 1.1, 0.1);

const CAM = [
  { t: 0.0, p: [3.1, 1.0, 2.45], l: [0.15, 0.02, 0] },
  { t: 1.25, p: [2.4, 1.4, 2.75], l: [0.05, 0.03, 0] },
  { t: 2.05, p: [1.9, 1.72, 2.62], l: [0, 0.06, 0] },
  { t: 3.05, p: [1.1, 2.0, 2.75], l: [0, 0.05, 0] },
  { t: 4.0, p: [0.25, 2.25, 3.3], l: [0, 0.22, 0] },
  { t: 5.35, p: [0, 1.45, 3.55], l: [0, 0.96, 0] },
  { t: 6.9, p: [0, 1.36, 3.15], l: [0, 1.02, 0] },
  { t: 8.0, p: [0, 1.3, 2.7], l: [0, 1.05, 0] }
];

const debug = /[?&]intro=debug/.test(location.search);
// níveis de luz e efeitos (ajustáveis em modo debug)
const L = { exposure: 1.05, key: 38, fill: 1.0, fire: 6, rim: 2.5, burst: 1.4, env: 0.3, bloom: 0.36, bloomThreshold: 1.0, bloomRadius: 0.35, fireGlow: 0.55, smoke: 1.0 };
const isMobile = Math.min(screen.width, screen.height) < 760 || /Mobi|Android/i.test(navigator.userAgent);

function catmull(p0, p1, p2, p3, u) {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}
function camAt(t, key, out) {
  const n = CAM.length;
  if (t <= CAM[0].t) return out.fromArray(CAM[0][key]);
  if (t >= CAM[n - 1].t) return out.fromArray(CAM[n - 1][key]);
  let i = 0;
  while (t > CAM[i + 1].t) i++;
  const u = (t - CAM[i].t) / (CAM[i + 1].t - CAM[i].t);
  const P = (k) => CAM[Math.max(0, Math.min(n - 1, k))][key];
  const a = P(i - 1), b = P(i), c = P(i + 1), d = P(i + 2);
  return out.set(catmull(a[0], b[0], c[0], d[0], u), catmull(a[1], b[1], c[1], d[1], u), catmull(a[2], b[2], c[2], d[2], u));
}

const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uFade: { value: 0 }, uBurn: { value: 0 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    ${NOISE}
    uniform sampler2D tDiffuse; uniform float uFade; uniform float uBurn; uniform float uTime; uniform vec2 uRes;
    varying vec2 vUv;
    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      vec2 p = vUv - 0.5; p.x *= uRes.x / uRes.y;
      float vig = smoothstep(1.15, 0.2, length(p));
      col *= mix(0.42, 1.0, vig);
      col += (gfHash13(vec3(floor(vUv * uRes), floor(uTime * 24.0))) - 0.5) * 0.028;
      col *= uFade;
      if (uBurn <= 0.0) { gl_FragColor = vec4(col, 1.0); return; }
      float n = gfFbm(vec3(p * 3.2, 0.5));
      float field = n * 0.7 + (1.0 - length(p)) * 0.5;
      float m = field - 1.48 + uBurn * 1.8;
      float alpha = 1.0 - smoothstep(0.0, 0.015, m);
      float charr = smoothstep(-0.16, -0.01, m) * alpha;
      col *= 1.0 - charr * 0.8;
      float edge = exp(-pow(m / 0.035, 2.0));
      vec3 fire = mix(vec3(1.0, 0.28, 0.03), vec3(1.0, 0.88, 0.5), edge);
      float a = max(alpha, edge * 0.85);
      gl_FragColor = vec4(col * alpha + fire * edge * 1.3, a);
    }`
};

async function start() {
  const api = window.GFIntro;
  const host = document.getElementById('intro');
  if (!host || !api || !api.claim()) return;

  let aborted = false;
  const guard = setTimeout(() => { aborted = true; api.fail(); }, 7000);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: debug });
  } catch (e) {
    clearTimeout(guard);
    api.fail();
    return;
  }

  try {
    const canvas = renderer.domElement;
    canvas.className = 'intro__gl';
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = L.exposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070504);
    scene.fog = new THREE.Fog(0x070504, 7, 15);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 40);

    // ---------- ambiente para reflexos (fogo + softbox) ----------
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0.02, 0.012, 0.008);
    const panel = (rgb, pos, w, h) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), side: THREE.DoubleSide }));
      m.position.set(...pos); m.lookAt(0, 0, 0); envScene.add(m);
    };
    panel([3.2, 0.9, 0.2], [0, -1.2, -6], 16, 4);
    panel([2.2, 2.3, 2.5], [-6, 1.5, -1], 3, 5);
    panel([4, 3.8, 3.6], [-4, 6, 3], 6, 3.5);
    panel([1.6, 1.7, 1.9], [3, 4, 5], 4, 2);
    panel([0.6, 0.7, 1.0], [6, 2, -1], 2, 6);
    panel([1.2, 0.5, 0.2], [0, -4, 4], 10, 3);
    panel([2.4, 2.5, 2.7], [5, -2, -4], 6, 4);
    panel([1.8, 1.9, 2.1], [5, 3, 1], 3, 4);
    scene.environment = pmrem.fromScene(envScene, 0.03).texture;
    scene.environmentIntensity = L.env;

    // ---------- luzes ----------
    const key = new THREE.SpotLight(0xffeedd, 120, 0, 0.55, 0.75, 2);
    key.position.set(-2.6, 4.6, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.camera.near = 2; key.shadow.camera.far = 12;
    scene.add(key, key.target);
    const fireLight = new THREE.PointLight(0xff5a1a, 22, 0, 2);
    fireLight.position.set(0, 0.15, -3.2);
    const rim = new THREE.PointLight(0xff8a40, 9, 0, 2);
    rim.position.set(3.4, 1.8, -2.6);
    const burst = new THREE.PointLight(0xffb060, 0, 0, 2);
    burst.position.set(0, 1.1, 0.9);
    const fill = new THREE.PointLight(0xffd2a8, 3, 0, 2);
    fill.position.set(2.5, 1.6, 3.2);
    scene.add(fireLight, rim, burst, fill, new THREE.HemisphereLight(0x3a2416, 0x050302, 0.35));

    // ---------- mesa e pedra ----------
    const table = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), proceduralMaterial({
      params: { color: 0xffffff, roughness: 0.7 },
      code: /* glsl */ `
        float g = gfFbm(vec3(vLocal.x * 0.5, vLocal.y * 5.0, 0.0));
        float rings = 0.5 + 0.5 * sin(vLocal.y * 9.0 + g * 7.0);
        diffuseColor.rgb = mix(vec3(0.02, 0.009, 0.005), vec3(0.075, 0.035, 0.016), rings * 0.55 + g * 0.45);
        gfH = rings * 0.4; gfRough = 0.55 + 0.3 * g;`,
      bump: 0.25
    }));
    table.rotation.x = -Math.PI / 2;
    table.position.y = BOTTOM - 0.14;
    table.receiveShadow = true;
    const slate = new THREE.Mesh(new RoundedBoxGeometry(4.4, 0.14, 2.9, 3, 0.05), proceduralMaterial({
      params: { color: 0xffffff, roughness: 0.8 },
      code: /* glsl */ `
        float n = gfFbm(vLocal * vec3(2.0, 2.0, 0.7) * 2.0);
        float fine = gfNoise(vLocal * 95.0);
        float streak = gfFbm(vec3(vLocal.x * 0.6, vLocal.z * 9.0, 1.0));
        vec3 col = mix(vec3(0.016, 0.016, 0.018), vec3(0.055, 0.054, 0.06), n * 0.7 + streak * 0.3);
        col *= 0.8 + 0.35 * fine;
        diffuseColor.rgb = col; gfH = n * 0.6 + fine * 0.25 + streak * 0.3; gfRough = 0.62 + 0.25 * fine;`,
      bump: 0.3
    }));
    slate.position.y = BOTTOM - 0.07;
    slate.receiveShadow = true;
    slate.castShadow = true;
    scene.add(table, slate);

    // sal grosso, pimenta e alecrim na pedra
    const R = rng(42);
    const saltMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshPhysicalMaterial({ color: 0xf6f3ec, roughness: 0.22, clearcoat: 0.6 }), 70);
    const pepMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 0.6 }), 30);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
    const scatter = (mesh, count, sMin, sMax) => {
      let k = 0;
      while (k < count) {
        const x = (R() - 0.5) * 4.0, z = (R() - 0.5) * 2.5;
        const th = Math.atan2(z, x);
        if (Math.hypot(x, z) < outlineR(th) * 1.15) continue;
        const s = sMin + R() * (sMax - sMin);
        e3.set(R() * 6, R() * 6, R() * 6); q.setFromEuler(e3);
        m4.compose(v3.set(x, BOTTOM + s * 0.55, z), q, s3.set(s, s * (0.7 + R() * 0.5), s));
        mesh.setMatrixAt(k++, m4);
      }
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh);
    };
    scatter(saltMesh, 70, 0.012, 0.03);
    scatter(pepMesh, 30, 0.01, 0.016);
    const stem = new THREE.CatmullRomCurve3([new THREE.Vector3(0.55, BOTTOM + 0.014, 1.12), new THREE.Vector3(1.05, BOTTOM + 0.018, 1.2), new THREE.Vector3(1.55, BOTTOM + 0.014, 1.08), new THREE.Vector3(1.85, BOTTOM + 0.012, 0.9)]);
    const herbMat = new THREE.MeshStandardMaterial({ color: 0x2c4a22, roughness: 0.55 });
    const stemMesh = new THREE.Mesh(new THREE.TubeGeometry(stem, 40, 0.009, 6), new THREE.MeshStandardMaterial({ color: 0x3b3320, roughness: 0.7 }));
    stemMesh.castShadow = true;
    const needles = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.008, 0.075, 3, 6), herbMat, 44);
    for (let i = 0; i < 44; i++) {
      const u = 0.03 + (i / 44) * 0.94;
      const p = stem.getPointAt(u);
      const tg = stem.getTangentAt(u);
      const side = i % 2 ? 1 : -1;
      const yaw = Math.atan2(tg.x, tg.z) + side * 0.75;
      q.setFromEuler(new THREE.Euler(0, yaw, 0)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - 0.3, 0, 0)));
      const off = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(0.042);
      m4.compose(v3.copy(p).add(off).setY(p.y + 0.008), q, s3.set(1, 1, 1));
      needles.setMatrixAt(i, m4);
    }
    needles.castShadow = true;
    scene.add(stemMesh, needles);

    // ---------- bife ----------
    const steakMats = createSteakMaterials();
    const halves = buildSteak(steakMats);
    halves.forEach((h) => scene.add(h.pivot));

    // brilho do corte
    const cutTube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cutCurvePoints()), 120, 0.006, 6);
    const cutGlow = new THREE.Mesh(cutTube, new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.35, 0.45), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const cutTotal = cutTube.index.count;
    scene.add(cutGlow);

    // ---------- faca ----------
    const knife = createKnife();
    scene.add(knife);
    const AX = new THREE.Vector3(1, 0, 0);
    const alpha0 = -0.42, alpha1 = 0.03;
    const tipTarget = new THREE.Vector3(0, hTop(0, zEdgeNeg + 0.06) + 0.01, zEdgeNeg - 0.02);
    const P0 = tipTarget.clone().sub(KNIFE_TIP.clone().applyAxisAngle(AX, alpha0));
    const P1 = new THREE.Vector3(0, BOTTOM + 0.004, 1.35);
    const contactZ = (t) => lerp(zEdgeNeg, zEdgePos, smooth(clamp01(easeInOutCubic(phase(t, T.slice)) / 0.9)));
    const contactAt = (t) => { const z = contactZ(t); return new THREE.Vector3(0, hTop(0, z) + 0.01, z); };

    // ---------- efeitos ----------
    const fire = createFire();
    scene.add(fire.group);
    const sparks = createSparks({ contactAt, sliceWindow: [T.slice[0] + 0.08, T.slice[1] - 0.05], splitTime: SPLIT_T, logoTime: T.logo[1] - 0.25, logoPos: LOGO_POS });
    scene.add(sparks.points);
    const smoke = createSmoke({ splitTime: SPLIT_T });
    scene.add(smoke.mesh);
    const juice = createJuice({ splitTime: SPLIT_T, floorY: BOTTOM });
    scene.add(juice.mesh);
    const rays = createRays();
    rays.mesh.position.copy(LOGO_POS).add(new THREE.Vector3(0, 0, -0.6));
    scene.add(rays.mesh);

    // ---------- logo ----------
    const tex = await new THREE.TextureLoader().loadAsync('assets/img/logo.webp');
    if (aborted || api.state !== 'claimed') { clearTimeout(guard); renderer.dispose(); return; }
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const logo = createLogo(tex, 1.5);
    scene.add(logo.group);

    // ---------- pós-processamento ----------
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: isMobile ? 2 : 4 });
    const composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), L.bloom, L.bloomRadius, L.bloomThreshold);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const finalPass = new ShaderPass(FinalShader);
    composer.addPass(finalPass);

    let pr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.75);
    let fit = 1;
    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h);
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const aspect = w / h;
      fit = aspect < 1.5 ? Math.min(2.4, Math.max(1, 1.55 / aspect)) : 1;
      finalPass.uniforms.uRes.value.set(w * pr, h * pr);
      sparks.setScale((h * pr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
    };
    resize();
    window.addEventListener('resize', resize);

    // ---------- estado da linha do tempo ----------
    let skipT = null;
    let revealed = false;
    let finished = false;
    let tagline = false;
    const burnStart = () => (skipT === null ? T.burn[0] : Math.min(T.burn[0], skipT));
    const burnDur = () => (skipT === null ? T.burn[1] - T.burn[0] : 0.8);
    const endTime = () => burnStart() + burnDur();
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();

    function renderAt(t) {
      // câmera
      camAt(t, 'p', camPos);
      camAt(t, 'l', camLook);
      camPos.sub(camLook).multiplyScalar(fit).add(camLook);
      const shake = t > SPLIT_T ? 0.035 * Math.exp(-(t - SPLIT_T) * 5) : 0;
      camPos.x += Math.sin(t * 0.9) * 0.02 + Math.sin(t * 40) * shake;
      camPos.y += Math.sin(t * 0.7 + 1) * 0.015 + Math.cos(t * 37) * shake;
      camera.position.copy(camPos);
      camera.lookAt(camLook);

      // faca
      if (t < T.knifeIn[0] || t > T.knifeOut[1]) knife.visible = false;
      else {
        knife.visible = true;
        if (t < T.slice[0]) {
          const k = 1 - easeOutCubic(phase(t, T.knifeIn));
          knife.position.copy(P0).add(v3.set(1.4 * k, 2.3 * k, -1.0 * k));
          knife.rotation.set(alpha0 - 0.6 * k, -0.5 * k, 0.8 * k);
        } else if (t < T.slice[1]) {
          const u = easeInOutCubic(phase(t, T.slice));
          knife.position.lerpVectors(P0, P1, u);
          knife.rotation.set(lerp(alpha0, alpha1, u), 0, 0);
        } else {
          const k = easeInCubic(phase(t, T.knifeOut));
          knife.position.copy(P1).add(v3.set(1.3 * k, 2.6 * k, 0.9 * k));
          knife.rotation.set(alpha1 - 0.4 * k, 0.4 * k, -0.7 * k);
        }
      }

      // brilho do corte
      const cutFrac = t < T.slice[0] ? 0 : (contactZ(t) - zEdgeNeg) / (zEdgePos - zEdgeNeg);
      const cutFade = 1 - smooth(phase(t, [SPLIT_T, SPLIT_T + 0.35]));
      cutGlow.visible = cutFrac > 0.002 && cutFade > 0;
      cutGlow.geometry.setDrawRange(0, Math.floor((cutFrac * cutTotal) / 36) * 36);
      cutGlow.material.opacity = cutFade;

      // metades se abrindo
      const s = phase(t, T.split);
      const rotE = easeOutBack(s, 1.4), gapE = easeOutCubic(s);
      halves.forEach((h) => {
        const drift = easeInOutCubic(phase(t, [T.split[1], T.burn[0]]));
        h.pivot.rotation.z = -h.sign * (0.3 * rotE + 0.06 * drift);
        h.pivot.position.x = h.baseX + h.sign * (0.42 * gapE + 0.55 * drift);
        h.pivot.position.y = BOTTOM + 0.05 * Math.sin(Math.PI * clamp01(s * 1.6));
      });

      // logo
      const l = phase(t, T.logo);
      logo.group.visible = t > T.logo[0];
      const settle = smooth(clamp01((t - T.logo[1]) / 0.8));
      logo.group.position.set(0, lerp(-0.05, LOGO_POS.y, easeOutBack(l, 1.1)) + 0.025 * Math.sin((t - T.logo[1]) * 2.2) * settle, LOGO_POS.z);
      logo.group.rotation.set(0.05 * Math.sin(t * 1.3) * settle, -Math.PI * 2 * (1 - easeOutCubic(l)) + 0.08 * Math.sin(t * 0.9) * settle, 0);
      logo.group.scale.setScalar(lerp(0.22, 1, easeOutCubic(clamp01(l * 1.3))));
      logo.shine.uShine.value = lerp(-0.7, 1.9, phase(t, [5.2, 5.95])) + (t > 6.2 ? lerp(-2.6, 0, phase(t, [6.2, 6.85])) : 0);
      logo.shine.uGlow.value = 0.12 * smooth(phase(t, [5.0, 5.6]));
      logo.halo.uAlpha.value = smooth(phase(t, [4.2, 5.3])) * (0.85 + 0.15 * Math.sin(t * 3));
      rays.uniforms.uAlpha.value = smooth(phase(t, [4.3, 5.6]));
      rays.uniforms.uTime.value = t;

      // luzes
      const flick = 0.75 + 0.35 * noise1(t * 7) + 0.1 * noise1(t * 23);
      const fireBoost = 1 + 0.6 * smooth(phase(t, [SPLIT_T - 0.1, SPLIT_T + 0.2])) * (1 - smooth(phase(t, [SPLIT_T + 0.3, SPLIT_T + 1.4])));
      fireLight.intensity = L.fire * flick * fireBoost;
      key.intensity = L.key; fill.intensity = L.fill; renderer.toneMappingExposure = L.exposure; scene.environmentIntensity = L.env;
      bloom.strength = L.bloom; bloom.threshold = L.bloomThreshold; bloom.radius = L.bloomRadius;
      rim.intensity = L.rim * (0.8 + 0.3 * noise1(t * 5 + 3));
      burst.intensity = L.burst * smooth(phase(t, [SPLIT_T - 0.05, SPLIT_T + 0.15])) * (1 - 0.85 * smooth(phase(t, [SPLIT_T + 0.3, SPLIT_T + 1.4])));
      fire.update(t, L.fireGlow * (0.9 + 0.25 * flick * fireBoost));

      // partículas
      sparks.update(t, smooth(phase(t, [0.2, 1.4])));
      smoke.update(t, smooth(phase(t, [0.0, 0.8])), L.smoke);
      juice.update(t);

      // composição final
      finalPass.uniforms.uTime.value = t;
      finalPass.uniforms.uFade.value = smooth(phase(t, T.fadeIn));
      finalPass.uniforms.uBurn.value = phase(t, [burnStart(), burnStart() + burnDur()]);
      composer.render();
    }

    // compila tudo com tudo visível para evitar travadas
    knife.visible = true; logo.group.visible = true; cutGlow.visible = true;
    host.appendChild(canvas);
    await (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve(renderer.compile(scene, camera)));
    if (aborted || api.state !== 'claimed') { clearTimeout(guard); renderer.dispose(); canvas.remove(); return; }
    renderAt(0);
    clearTimeout(guard);

    if (debug) {
      window.__gfIntro = { renderAt, T, L, scene, smoke, fire, sparks, logo, setSkip: (v) => { skipT = v; } };
      host.classList.add('is-playing');
      return;
    }

    function finish() {
      if (finished) return;
      finished = true;
      window.removeEventListener('resize', resize);
      api.done();
      setTimeout(() => {
        composer.dispose && composer.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
      }, 50);
    }

    api.skip = () => { if (skipT === null) skipT = clock; };
    let t0 = 0, clock = 0, frames = 0, slowAcc = 0;
    let last = 0;
    host.classList.add('is-playing');
    const frame = (now) => {
      if (finished) return;
      if (!t0) { t0 = now; last = now; }
      clock = (now - t0) / 1000;
      // adapta a resolução se o aparelho estiver sofrendo
      const dt = now - last; last = now;
      if (frames > 5 && frames < 60) {
        slowAcc += dt;
        if (frames === 59 && slowAcc / 54 > 42 && pr > 0.8) { pr = Math.max(0.75, pr * 0.66); resize(); }
      }
      frames++;
      if (!tagline && clock >= T.tagline && clock < burnStart()) { tagline = true; host.classList.add('show-tagline'); }
      if (!revealed && clock >= burnStart()) { revealed = true; host.classList.remove('show-tagline'); api.reveal(); }
      renderAt(Math.min(clock, endTime()));
      if (clock >= endTime()) finish();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  } catch (err) {
    clearTimeout(guard);
    console.error('[intro3d]', err);
    try { renderer.dispose(); renderer.domElement.remove(); } catch (e) { /* nada */ }
    api.fail();
  }
}

start();
