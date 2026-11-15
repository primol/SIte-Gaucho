import * as THREE from 'three';

// Ruído em GLSL compartilhado pelos materiais procedurais
export const NOISE = /* glsl */ `
float gfHash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float gfNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  float a = gfHash13(i), b = gfHash13(i + vec3(1,0,0)), c = gfHash13(i + vec3(0,1,0)), d = gfHash13(i + vec3(1,1,0));
  float e = gfHash13(i + vec3(0,0,1)), g = gfHash13(i + vec3(1,0,1)), h = gfHash13(i + vec3(0,1,1)), k = gfHash13(i + vec3(1,1,1));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}
float gfFbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * gfNoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.4); a *= 0.5; } return s; }
float gfFbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += a * gfNoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.4); a *= 0.5; } return s; }
`;

const PERTURB = /* glsl */ `
vec3 gfPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
  vec3 vSigmaX = normalize(dFdx(surf_pos));
  vec3 vSigmaY = normalize(dFdy(surf_pos));
  vec3 R1 = cross(vSigmaY, surf_norm);
  vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`;

function glslType(v) {
  if (typeof v === 'number') return 'float';
  if (v && v.isVector2) return 'vec2';
  if (v && (v.isVector3 || v.isColor)) return 'vec3';
  if (v && v.isTexture) return 'sampler2D';
  throw new Error('tipo de uniform não suportado');
}

let uid = 0;
/**
 * MeshPhysicalMaterial com cor, rugosidade e relevo calculados por shader (sem texturas).
 * O código GLSL recebe vLocal (posição no objeto), vObjN (normal no objeto) e v_<atributo>.
 * Deve escrever diffuseColor.rgb, gfH (altura para relevo) e gfRough.
 */
export function proceduralMaterial({ params = {}, attributes = [], uniforms = {}, code, bump = 1 }) {
  const mat = new THREE.MeshPhysicalMaterial(params);
  const key = 'gf' + uid++;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const aDecl = attributes.map((a) => `attribute float ${a};\nvarying float v_${a};`).join('\n');
    const aPass = attributes.map((a) => `v_${a} = ${a};`).join('\n');
    const vDecl = attributes.map((a) => `varying float v_${a};`).join('\n');
    const uDecl = Object.keys(uniforms).map((k) => `uniform ${glslType(uniforms[k].value)} ${k};`).join('\n');
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vLocal;\nvarying vec3 vObjN;\n${aDecl}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvLocal = position;\nvObjN = objectNormal;\n${aPass}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vLocal;\nvarying vec3 vObjN;\n${vDecl}\n${uDecl}\n${NOISE}\n${PERTURB}`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4( diffuse, opacity );\nfloat gfH = 0.0;\nfloat gfRough = roughness;\n{\n${code}\n}`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gfRough;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\nnormal = gfPerturb(-vViewPosition, normal, vec2(dFdx(gfH), dFdy(gfH)) * ${bump.toFixed(4)}, faceDirection);`);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}
