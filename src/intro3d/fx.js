import * as THREE from 'three';
import { NOISE } from './materials.js';
import { rng } from './util.js';

/* ---------------- Fogo ao fundo ---------------- */
export function createFire() {
  const group = new THREE.Group();
  const uniforms = { uTime: { value: 0 }, uIntensity: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uSeed: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform float uTime; uniform float uIntensity; uniform float uSeed;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv;
        float t = uTime * 1.1 + uSeed * 10.0;
        float tongues = gfFbm3(vec3(uv.x * 4.0 + uSeed * 7.0, t * 0.35, 1.0));
        float height = 0.18 + tongues * tongues * 1.3;
        float n = gfFbm3(vec3(uv.x * 7.0, uv.y * 2.4 - t * 1.6, t * 0.3));
        float n2 = gfNoise(vec3(uv.x * 18.0, uv.y * 6.0 - t * 3.0, t));
        float shape = 1.0 - uv.y / height + (n - 0.5) * 1.1 + (n2 - 0.5) * 0.25;
        float flame = smoothstep(0.0, 0.75, shape);
        flame *= smoothstep(0.0, 0.22, uv.x) * smoothstep(1.0, 0.78, uv.x) * mix(0.35, 1.0, smoothstep(0.03, 0.22, uv.y));
        vec3 col = mix(vec3(0.35, 0.03, 0.005), vec3(1.0, 0.3, 0.03), smoothstep(0.05, 0.55, flame));
        col = mix(col, vec3(1.0, 0.78, 0.35), smoothstep(0.7, 1.0, flame));
        gl_FragColor = vec4(col * flame * uIntensity * 1.3, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
  });
  const mats = [];
  [[-1.9, -3.3, 3.4, 0.1], [1.8, -3.5, 3.6, 0.45], [0.1, -4.1, 5.0, 0.8], [-4.0, -4.4, 3.4, 0.3], [4.1, -4.6, 3.6, 0.65]].forEach(([x, z, w, seed]) => {
    const m = mat.clone();
    m.uniforms.uSeed.value = seed;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.62), m);
    mesh.position.set(x, -0.42 + w * 0.31, z);
    mesh.renderOrder = -2;
    group.add(mesh);
    mats.push(m);
  });

  // brilho difuso das brasas
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uIntensity; varying vec2 vUv;
      void main(){ vec2 p = vUv - vec2(0.5, 0.15); p.x *= 2.2; float g = exp(-dot(p, p) * 5.0);
        gl_FragColor = vec4(vec3(0.85, 0.22, 0.03) * g * 0.55 * uIntensity, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
  }));
  glow.position.set(0, 0.6, -5.5);
  glow.renderOrder = -3;
  group.add(glow);

  return {
    group,
    update(t, intensity) {
      mats.forEach((m) => { m.uniforms.uTime.value = t; m.uniforms.uIntensity.value = intensity; });
      uniforms.uIntensity.value = intensity;
    }
  };
}

/* ---------------- Partículas de brasa / faíscas (determinísticas no tempo) ---------------- */
export function createSparks({ contactAt, sliceWindow, splitTime, logoTime, logoPos }) {
  const R = rng(1234);
  const P = [];
  const add = (p) => P.push(p);
  const g = new THREE.Vector3(0, -2.4, 0);

  // brasas ambientes subindo do fogo
  for (let i = 0; i < 170; i++) {
    add({ kind: 'amb', base: new THREE.Vector3((R() - 0.5) * 9, -0.5 + R() * 0.3, -2.2 - R() * 2.6), life: 2.6 + R() * 3.4, off: R(), vy: 0.35 + R() * 0.55, drift: (R() - 0.5) * 0.5, wob: R() * 6.28, size: 0.012 + R() * 0.02 });
  }
  // faíscas no ponto de contato da faca
  for (let i = 0; i < 150; i++) {
    const tb = sliceWindow[0] + R() * (sliceWindow[1] - sliceWindow[0]);
    const a = R() * Math.PI * 2;
    const sp = 0.6 + R() * 1.8;
    add({ kind: 'burst', tb, o: contactAt(tb), v: new THREE.Vector3(Math.cos(a) * sp * 0.6, 1.0 + R() * 1.8, Math.sin(a) * sp * 0.6), life: 0.35 + R() * 0.55, size: 0.01 + R() * 0.014, g: 1 });
  }
  // explosão ao abrir o bife
  for (let i = 0; i < 170; i++) {
    const tb = splitTime + R() * 0.12;
    const z = (R() - 0.5) * 1.5;
    const side = R() < 0.5 ? -1 : 1;
    add({ kind: 'burst', tb, o: new THREE.Vector3((R() - 0.5) * 0.1, 0.1 + R() * 0.2, z), v: new THREE.Vector3(side * (0.3 + R() * 1.6), 1.2 + R() * 2.8, (R() - 0.5) * 1.4), life: 0.8 + R() * 1.0, size: 0.012 + R() * 0.02, g: 0.6 });
  }
  // espiral quando o logo chega
  for (let i = 0; i < 130; i++) {
    const tb = logoTime + R() * 0.5;
    const a = R() * Math.PI * 2;
    const sp = 0.8 + R() * 1.6;
    add({ kind: 'burst', tb, o: logoPos.clone().add(new THREE.Vector3(Math.cos(a) * 0.4, Math.sin(a) * 0.32, 0)), v: new THREE.Vector3(Math.cos(a) * sp, Math.sin(a) * sp * 0.8 + 0.5, (R() - 0.3) * 0.6), life: 1.0 + R() * 1.2, size: 0.01 + R() * 0.018, g: 0.25 });
  }

  const n = P.length;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), alpha = new Float32Array(n), size = new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 500 } },
    vertexShader: /* glsl */ `
      attribute float aAlpha; attribute float aSize; uniform float uScale; varying float vA;
      void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.0, aSize * uScale / -mv.z); }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); float a = smoothstep(0.5, 0.0, r); a *= a;
        vec3 col = mix(vec3(4.0, 1.1, 0.25), vec3(6.0, 3.6, 1.6), smoothstep(0.25, 0.0, r));
        gl_FragColor = vec4(col * a * vA, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  const tmp = new THREE.Vector3();
  return {
    points,
    setScale(s) { mat.uniforms.uScale.value = s; },
    update(t, ambient) {
      for (let i = 0; i < n; i++) {
        const p = P[i];
        let a = 0, s = p.size;
        if (p.kind === 'amb') {
          const age = (t + p.off * p.life) % p.life;
          const k = age / p.life;
          tmp.set(p.base.x + p.drift * age + Math.sin(age * 1.7 + p.wob) * 0.15, p.base.y + p.vy * age, p.base.z + Math.cos(age * 1.3 + p.wob) * 0.1);
          a = Math.sin(Math.PI * k) * (0.6 + 0.4 * Math.sin(t * 9 + p.wob)) * ambient;
          s *= 1 - k * 0.5;
        } else {
          const age = t - p.tb;
          if (age > 0 && age < p.life) {
            const k = age / p.life;
            tmp.copy(p.o).addScaledVector(p.v, age).addScaledVector(g, 0.5 * age * age * p.g);
            a = (1 - k) * (0.7 + 0.3 * Math.sin(t * 30 + i));
            s *= 1 - k * 0.6;
          } else tmp.set(0, -50, 0);
        }
        pos[i * 3] = tmp.x; pos[i * 3 + 1] = tmp.y; pos[i * 3 + 2] = tmp.z;
        alpha[i] = Math.max(0, a); size[i] = s;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
    }
  };
}

/* ---------------- Fumaça (billboards instanciados) ---------------- */
export function createSmoke({ splitTime }) {
  const R = rng(99);
  const S = [];
  for (let i = 0; i < 22; i++) S.push({ kind: 'sizzle', o: new THREE.Vector3((R() - 0.5) * 1.8, 0.28, (R() - 0.5) * 1.0), life: 2.4 + R() * 1.4, off: R(), vy: 0.22 + R() * 0.2, dx: (R() - 0.5) * 0.25, s0: 0.25, s1: 0.8 + R() * 0.4, a: 0.07 + R() * 0.03, rot: R() * 6.28, seed: R() });
  for (let i = 0; i < 12; i++) S.push({ kind: 'bg', o: new THREE.Vector3((R() - 0.5) * 7, 0.4, -2.4 - R() * 1.5), life: 4 + R() * 3, off: R(), vy: 0.25 + R() * 0.2, dx: (R() - 0.5) * 0.3, s0: 1.4, s1: 3.2, a: 0.045, rot: R() * 6.28, seed: R() });
  for (let i = 0; i < 12; i++) S.push({ kind: 'burst', tb: splitTime + R() * 0.15, o: new THREE.Vector3((R() - 0.5) * 0.3, 0.15, (R() - 0.5) * 1.3), v: new THREE.Vector3((R() - 0.5) * 1.2, 0.5 + R() * 0.7, (R() - 0.5) * 0.6), life: 1.4 + R() * 0.8, s0: 0.35, s1: 1.6, a: 0.14, rot: R() * 6.28, seed: R() });
  const n = S.length;
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.attributes.position = base.attributes.position;
  geo.attributes.uv = base.attributes.uv;
  const iPos = new Float32Array(n * 3), iData = new Float32Array(n * 4);
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('iData', new THREE.InstancedBufferAttribute(iData, 4).setUsage(THREE.DynamicDrawUsage));
  geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 iPos; attribute vec4 iData; varying vec2 vUv; varying float vA; varying float vSeed;
      void main(){ vUv = uv; vA = iData.z; vSeed = iData.w;
        vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
        float c = cos(iData.y), s = sin(iData.y);
        mv.xy += vec2(c * position.x - s * position.y, s * position.x + c * position.y) * iData.x;
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform float uTime; varying vec2 vUv; varying float vA; varying float vSeed;
      void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0;
        float n = gfFbm3(vec3(vUv * 2.6 + vSeed * 17.0, uTime * 0.12 + vSeed * 3.0));
        float a = smoothstep(1.0, 0.15, r) * smoothstep(0.25, 0.75, n + 0.25 - r * 0.2) * vA;
        vec3 col = mix(vec3(0.2, 0.17, 0.16), vec3(0.55, 0.36, 0.24), n * 0.7);
        gl_FragColor = vec4(col, a); }`,
    transparent: true, depthWrite: false, fog: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return {
    mesh,
    update(t, sizzle, gain = 1) {
      mat.uniforms.uTime.value = t;
      for (let i = 0; i < n; i++) {
        const p = S[i];
        let x = 0, y = -50, z = 0, size = 0.1, a = 0;
        if (p.kind === 'burst') {
          const age = t - p.tb;
          if (age > 0 && age < p.life) {
            const k = age / p.life;
            x = p.o.x + p.v.x * age; y = p.o.y + p.v.y * age; z = p.o.z + p.v.z * age;
            size = p.s0 + (p.s1 - p.s0) * Math.sqrt(k);
            a = p.a * Math.pow(1 - k, 1.5);
          }
        } else {
          const age = (t + p.off * p.life) % p.life;
          const k = age / p.life;
          x = p.o.x + p.dx * age; y = p.o.y + p.vy * age; z = p.o.z;
          size = p.s0 + (p.s1 - p.s0) * k;
          a = p.a * Math.sin(Math.PI * k) * (p.kind === 'sizzle' ? sizzle : 1);
        }
        iPos[i * 3] = x; iPos[i * 3 + 1] = y; iPos[i * 3 + 2] = z;
        iData[i * 4] = size; iData[i * 4 + 1] = p.rot + t * 0.15; iData[i * 4 + 2] = a * gain; iData[i * 4 + 3] = p.seed;
      }
      geo.attributes.iPos.needsUpdate = true;
      geo.attributes.iData.needsUpdate = true;
    }
  };
}

/* ---------------- Gotas de suco ---------------- */
export function createJuice({ splitTime, floorY }) {
  const R = rng(7);
  const n = 46;
  const D = [];
  for (let i = 0; i < n; i++) {
    const side = R() < 0.5 ? -1 : 1;
    D.push({ tb: splitTime + R() * 0.25, o: new THREE.Vector3(side * 0.02, -0.05 + R() * 0.3, (R() - 0.5) * 1.4), v: new THREE.Vector3(side * (0.25 + R() * 0.9), 0.6 + R() * 1.6, (R() - 0.5) * 0.7), s: 0.008 + R() * 0.013 });
  }
  const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.12, 0.012, 0.008), roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0, envMapIntensity: 0.5 });
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), mat, n);
  mesh.frustumCulled = false;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  return {
    mesh,
    update(t) {
      for (let i = 0; i < n; i++) {
        const d = D[i];
        const age = t - d.tb;
        if (age <= 0) { m4.makeScale(0, 0, 0); mesh.setMatrixAt(i, m4); continue; }
        p.copy(d.o).addScaledVector(d.v, age);
        p.y += -0.5 * 4.2 * age * age;
        let sx = d.s, sy = d.s * 1.25;
        if (p.y < floorY + d.s * 0.3) { p.y = floorY + d.s * 0.3; sx = d.s * 1.8; sy = d.s * 0.35; p.x = d.o.x + d.v.x * Math.min(age, 0.6); p.z = d.o.z + d.v.z * Math.min(age, 0.6); }
        sc.set(sx, sy, sx);
        m4.compose(p, q, sc);
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
}

/* ---------------- Raios de luz atrás do logo ---------------- */
export function createRays() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uAlpha; varying vec2 vUv;
      void main(){ vec2 p = vUv - 0.5; float r = length(p); float a = atan(p.y, p.x);
        float rays = pow(0.5 + 0.5 * sin(a * 13.0 + uTime * 0.5), 7.0) + 0.7 * pow(0.5 + 0.5 * sin(a * 7.0 - uTime * 0.35 + 1.3), 9.0);
        float fall = smoothstep(0.5, 0.04, r);
        float core = smoothstep(0.22, 0.0, r);
        vec3 col = mix(vec3(1.0, 0.38, 0.06), vec3(1.0, 0.82, 0.45), core);
        gl_FragColor = vec4(col * (rays * 0.55 * fall + core * 1.1) * uAlpha, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), mat);
  mesh.renderOrder = 1;
  return { mesh, uniforms: mat.uniforms };
}
