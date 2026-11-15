import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { proceduralMaterial } from './materials.js';

// Faca de chef: lâmina no plano YZ (fina em X), fio em y = 0, ponta para -Z, calcanhar em z = 0
export const KNIFE_TIP = new THREE.Vector3(0, 0.16, -1.92);

export function createKnife() {
  const group = new THREE.Group();

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(1.45, 0);
  shape.quadraticCurveTo(1.78, 0.02, 1.92, 0.16);
  shape.quadraticCurveTo(1.6, 0.3, 1.1, 0.36);
  shape.lineTo(0, 0.38);
  shape.lineTo(0, 0);
  const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.005, bevelSegments: 2, curveSegments: 24 });
  bladeGeo.translate(0, 0, -0.007);
  bladeGeo.rotateY(Math.PI / 2);
  const steel = proceduralMaterial({
    params: { color: 0xe4e8ec, metalness: 1, roughness: 0.2, envMapIntensity: 1.6 },
    code: /* glsl */ `
      float brush = gfNoise(vec3(vLocal.z * 3.0, vLocal.y * 160.0, vLocal.x * 4.0)) * 0.35 + 0.5;
      float edgeShine = smoothstep(0.05, 0.0, vLocal.y);
      diffuseColor.rgb = mix(vec3(0.62, 0.66, 0.72), vec3(0.92, 0.95, 1.0), brush * 0.5 + edgeShine * 0.5 + smoothstep(0.3, 0.38, vLocal.y) * 0.3);
      gfH = brush * 0.06;
      gfRough = mix(0.16, 0.28, brush) - edgeShine * 0.08;
    `,
    bump: 0.3
  });
  const blade = new THREE.Mesh(bladeGeo, steel);
  blade.castShadow = true;

  const wood = proceduralMaterial({
    params: { color: 0xffffff, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3 },
    code: /* glsl */ `
      float g = gfFbm(vec3(vLocal.z * 1.5, vLocal.y * 22.0, vLocal.x * 22.0));
      float rings = 0.5 + 0.5 * sin(vLocal.y * 90.0 + g * 9.0);
      diffuseColor.rgb = mix(vec3(0.05, 0.022, 0.012), vec3(0.16, 0.07, 0.035), rings * 0.55 + g * 0.45);
      gfH = rings * 0.2;
      gfRough = 0.4 + 0.2 * g;
    `,
    bump: 0.2
  });
  const handle = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.17, 0.95, 4, 0.04), wood);
  handle.position.set(0, 0.17, 0.53);
  handle.castShadow = true;

  const metal = new THREE.MeshPhysicalMaterial({ color: 0xc9ced4, metalness: 1, roughness: 0.25 });
  const bolster = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.4, 0.09, 3, 0.03), metal);
  bolster.position.set(0, 0.19, 0.03);
  bolster.castShadow = true;
  const rivetGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.095, 16);
  rivetGeo.rotateZ(Math.PI / 2);
  [0.3, 0.55, 0.8].forEach((z) => {
    const r = new THREE.Mesh(rivetGeo, metal);
    r.position.set(0, 0.17, z);
    group.add(r);
  });

  group.add(blade, handle, bolster);
  return group;
}
