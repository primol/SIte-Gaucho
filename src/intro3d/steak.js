import * as THREE from 'three';
import { proceduralMaterial } from './materials.js';
import { fbm2 } from './util.js';

// Dimensões do bife (unidades da cena)
const A = 1.3;    // meio comprimento (x)
const B = 0.86;   // meia largura (z)
const TT = 0.25;  // espessura acima de y=0
const TB = 0.19;  // espessura abaixo de y=0
const R = 0.13;   // raio do arredondamento da borda
export const FATW = 0.13; // largura da capa de gordura

export function outlineR(th) {
  const c = Math.cos(th), s = Math.sin(th);
  const re = (A * B) / Math.sqrt((B * c) ** 2 + (A * s) ** 2);
  return re * (1 + 0.05 * Math.sin(2 * th + 0.6) + 0.035 * Math.cos(3 * th + 0.3) + 0.02 * Math.sin(5 * th + 1.2));
}
function measure(x, z) {
  const th = Math.atan2(z, x);
  const r = outlineR(th);
  return { r, s: Math.hypot(x, z) / r };
}
function dist(x, z) { const m = measure(x, z); return Math.max(0, (1 - m.s) * m.r); }
function prof(d) { const k = Math.min(d / R, 1); return Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k))); }
export function hTop(x, z) {
  const p = prof(dist(x, z));
  const q = Math.min(1, (x * x) / (A * A) + (z * z) / (B * B));
  return p * (TT + 0.015 * (1 - q) + (fbm2(x * 2.6 + 3.0, z * 2.6) - 0.45) * 0.045 + (fbm2(x * 9.0, z * 9.0 + 4.0) - 0.45) * 0.012);
}
export function hBot(x, z) { return -TB * prof(dist(x, z)); }
export const BOTTOM = -TB;
export const zEdgePos = outlineR(Math.PI / 2);   // borda em x=0, lado +z
export const zEdgeNeg = -outlineR(-Math.PI / 2); // borda em x=0, lado -z

const CRUST = /* glsl */ `
vec3 p = vLocal;
float topness = smoothstep(0.25, 0.85, vObjN.y);
float n1 = gfFbm(p * 5.0);
float n2 = gfFbm(p * 19.0 + 3.1);
float n3 = gfNoise(p * 70.0);
vec3 base = mix(vec3(0.07, 0.022, 0.009), vec3(0.24, 0.075, 0.025), smoothstep(0.2, 0.8, n1));
base = mix(base, vec3(0.38, 0.14, 0.045), smoothstep(0.62, 0.9, n2) * 0.45);
base = mix(base, vec3(0.03, 0.012, 0.006), smoothstep(0.55, 0.8, gfNoise(p * 26.0)) * 0.5);
base *= (0.8 + 0.4 * n3) * mix(0.34, 1.0, topness);
float g1 = abs(fract((p.x * 0.78 + p.z * 0.62) * 2.4 + (n1 - 0.5) * 0.18) - 0.5);
float g2 = abs(fract((p.x * 0.62 - p.z * 0.78) * 2.4 + (n2 - 0.5) * 0.15) - 0.5);
float mk = (1.0 - smoothstep(0.1, 0.16, g1)) + (1.0 - smoothstep(0.07, 0.12, g2)) * 0.5;
mk = clamp(mk, 0.0, 1.0) * topness * smoothstep(0.2, 0.55, gfNoise(p * 9.0) + 0.3);
vec3 col = mix(base, vec3(0.012, 0.005, 0.003), mk);
float ang = atan(p.z, p.x);
float fat = smoothstep(0.86, 0.97, sin(ang)) * (1.0 - smoothstep(uFatW * 0.6, uFatW, v_aEdge));
vec3 fatCol = mix(vec3(0.2, 0.07, 0.018), vec3(0.46, 0.22, 0.06), gfFbm(p * 14.0));
fatCol = mix(fatCol, vec3(0.05, 0.02, 0.008), max(mk * 0.85, smoothstep(0.55, 0.8, gfNoise(p * 18.0)) * 0.6));
col = mix(col, fatCol, fat);
float salt = step(0.991, gfHash13(floor(p * 75.0))) * topness;
float pep = step(0.982, gfHash13(floor(p * 52.0) + 17.0)) * topness;
col = mix(col, vec3(0.92, 0.9, 0.86), salt);
col = mix(col, vec3(0.015, 0.012, 0.01), pep * 0.9);
diffuseColor.rgb = col;
gfH = n2 * 0.55 + n3 * 0.35 - mk * 0.7 + salt * 1.2 + pep * 0.7;
gfRough = clamp(mix(mix(0.78, 0.32, fat), 0.3 + n2 * 0.28 - salt * 0.2 + mk * 0.3, topness), 0.12, 0.95);
`;

const INTERIOR = /* glsl */ `
float dv = min(v_aTop - vLocal.y, vLocal.y - v_aBot);
float d = min(dv, v_aEdge);
float fib = gfFbm(vec3(vLocal.z * 30.0, vLocal.y * 9.0, 2.0));
float fib2 = gfNoise(vec3(vLocal.z * 140.0, vLocal.y * 45.0, 5.0));
float depth = clamp(d / 0.16, 0.0, 1.0);
vec3 inner = mix(vec3(0.4, 0.03, 0.065), vec3(0.2, 0.004, 0.022), smoothstep(0.05, 1.0, depth));
inner *= 0.72 + 0.5 * fib + 0.14 * fib2;
float band = 1.0 - smoothstep(0.018, 0.05, d);
float crust = 1.0 - smoothstep(0.006, 0.016, d);
float marb = gfFbm(vec3(vLocal.z * 9.0, vLocal.y * 22.0, 3.0));
float vein = smoothstep(0.64, 0.7, marb);
inner = mix(inner, vec3(0.6, 0.36, 0.34), vein * 0.55);
vec3 col = mix(inner, vec3(0.14, 0.06, 0.04) * (0.9 + 0.2 * fib), band);
col = mix(col, vec3(0.09, 0.03, 0.012), crust);
float fat = smoothstep(uFatZ - 0.012, uFatZ + 0.012, vLocal.z);
col = mix(col, vec3(0.7, 0.52, 0.3) * (0.9 + 0.15 * fib), fat * (1.0 - crust * 0.6));
diffuseColor.rgb = col;
gfH = fib * 0.6 + fib2 * 0.3;
gfRough = clamp(0.28 + fib * 0.25 + fat * 0.2 + crust * 0.3, 0.1, 0.9);
`;

export function createSteakMaterials() {
  const crust = proceduralMaterial({
    params: { color: 0xffffff, roughness: 0.42, clearcoat: 0.22, clearcoatRoughness: 0.4, specularIntensity: 0.55 },
    attributes: ['aEdge'],
    uniforms: { uFatW: { value: FATW } },
    code: CRUST,
    bump: 0.35
  });
  const interior = proceduralMaterial({
    params: { color: 0xffffff, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.3 },
    attributes: ['aTop', 'aBot', 'aEdge'],
    uniforms: { uFatZ: { value: zEdgePos - FATW } },
    code: INTERIOR,
    bump: 0.25
  });
  return { crust, interior };
}

/**
 * Constrói as duas metades do bife (x >= 0 e x <= 0). Juntas formam um bife inteiro sem emenda.
 * Cada metade fica dentro de um pivô na borda externa inferior, para "tombar" ao abrir.
 */
export function buildSteak(mats) {
  const NX = 140, NZ = 96, X0 = -1.5, X1 = 1.5, Z0 = -1.05, Z1 = 1.05;
  const W = NX + 1;
  const grid = [];
  for (let i = 0; i <= NX; i++) {
    for (let j = 0; j <= NZ; j++) {
      let x = X0 + ((X1 - X0) * i) / NX;
      let z = Z0 + ((Z1 - Z0) * j) / NZ;
      if (i === NX / 2) x = 0;
      const m = measure(x, z);
      const inside = m.s < 1;
      if (!inside) { x /= m.s * 1.0001; z /= m.s * 1.0001; }
      const d = inside ? (1 - m.s) * m.r : 0;
      grid[j * W + i] = { x, z, inside, d, top: hTop(x, z), bot: hBot(x, z) };
    }
  }
  const e = 0.004;
  const sAt = (x, z) => measure(x, z).s;
  const nEdge = (x, z) => new THREE.Vector3((sAt(x + e, z) - sAt(x - e, z)), 0, (sAt(x, z + e) - sAt(x, z - e))).normalize();
  const nTop = (x, z) => new THREE.Vector3(-(hTop(x + e, z) - hTop(x - e, z)) / (2 * e), 1, -(hTop(x, z + e) - hTop(x, z - e)) / (2 * e)).normalize();
  const nBot = (x, z) => new THREE.Vector3((hBot(x + e, z) - hBot(x - e, z)) / (2 * e), -1, (hBot(x, z + e) - hBot(x, z - e)) / (2 * e)).normalize();

  function half(sign) {
    const i0 = sign > 0 ? NX / 2 : 0;
    const i1 = sign > 0 ? NX : NX / 2;
    const pos = [], nor = [], edge = [], idx = [];
    const mapTop = new Map(), mapBot = new Map();
    const vert = (map, i, j, top) => {
      const k = j * W + i;
      if (map.has(k)) return map.get(k);
      const g = grid[k];
      const n = g.inside ? (top ? nTop(g.x, g.z) : nBot(g.x, g.z)) : nEdge(g.x, g.z);
      const id = pos.length / 3;
      pos.push(g.x, top ? g.top : g.bot, g.z);
      nor.push(n.x, n.y, n.z);
      edge.push(g.d);
      map.set(k, id);
      return id;
    };
    const area = (a, b, c) => Math.abs((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z));
    for (let i = i0; i < i1; i++) {
      for (let j = 0; j < NZ; j++) {
        const ka = j * W + i, kb = j * W + i + 1, kc = (j + 1) * W + i + 1, kd = (j + 1) * W + i;
        const ga = grid[ka], gb = grid[kb], gc = grid[kc], gd = grid[kd];
        if (!(ga.inside || gb.inside || gc.inside || gd.inside)) continue;
        const tris = [[ga, gc, gb, [i, j], [i + 1, j + 1], [i + 1, j]], [ga, gd, gc, [i, j], [i, j + 1], [i + 1, j + 1]]];
        for (const [p, q, r, a, b, c] of tris) {
          if (area(p, q, r) < 1e-7) continue;
          idx.push(vert(mapTop, a[0], a[1], true), vert(mapTop, b[0], b[1], true), vert(mapTop, c[0], c[1], true));
          idx.push(vert(mapBot, a[0], a[1], false), vert(mapBot, c[0], c[1], false), vert(mapBot, b[0], b[1], false));
        }
      }
    }
    const crustGeo = new THREE.BufferGeometry();
    crustGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    crustGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    crustGeo.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
    crustGeo.setIndex(idx);

    // face do corte (plano x = 0)
    const wp = [], wn = [], wt = [], wb = [], we = [], wi = [];
    const ic = NX / 2;
    for (let j = 0; j <= NZ; j++) {
      const g = grid[j * W + ic];
      wp.push(0, g.top, g.z, 0, g.bot, g.z);
      wn.push(-sign, 0, 0, -sign, 0, 0);
      wt.push(g.top, g.top); wb.push(g.bot, g.bot); we.push(g.d, g.d);
    }
    for (let j = 0; j < NZ; j++) {
      const g0 = grid[j * W + ic], g1 = grid[(j + 1) * W + ic];
      if (!(g0.inside || g1.inside)) continue;
      const T0 = j * 2, B0 = j * 2 + 1, T1 = (j + 1) * 2, B1 = (j + 1) * 2 + 1;
      if (sign > 0) wi.push(T0, B0, T1, B0, B1, T1);
      else wi.push(T0, T1, B0, B0, T1, B1);
    }
    const wallGeo = new THREE.BufferGeometry();
    wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
    wallGeo.setAttribute('normal', new THREE.Float32BufferAttribute(wn, 3));
    wallGeo.setAttribute('aTop', new THREE.Float32BufferAttribute(wt, 1));
    wallGeo.setAttribute('aBot', new THREE.Float32BufferAttribute(wb, 1));
    wallGeo.setAttribute('aEdge', new THREE.Float32BufferAttribute(we, 1));
    wallGeo.setIndex(wi);

    const crustMesh = new THREE.Mesh(crustGeo, mats.crust);
    const wallMesh = new THREE.Mesh(wallGeo, mats.interior);
    crustMesh.castShadow = wallMesh.castShadow = true;
    crustMesh.receiveShadow = wallMesh.receiveShadow = true;

    const pivotX = sign * 1.2;
    const pivot = new THREE.Group();
    pivot.position.set(pivotX, -TB, 0);
    const inner = new THREE.Group();
    inner.position.set(-pivotX, TB, 0);
    inner.add(crustMesh, wallMesh);
    pivot.add(inner);
    return { pivot, sign, baseX: pivotX };
  }

  return [half(1), half(-1)];
}

// Curva sobre o topo do bife em x = 0 (usada pelo brilho do corte)
export function cutCurvePoints(n = 120) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const z = zEdgeNeg + ((zEdgePos - zEdgeNeg) * k) / n;
    pts.push(new THREE.Vector3(0, hTop(0, z) + 0.004, z));
  }
  return pts;
}
