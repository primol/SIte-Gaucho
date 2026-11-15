import * as THREE from 'three';

// Emblema 3D do logo: várias camadas recortadas pelo alfa dão espessura; frente com brilho que percorre
export function createLogo(texture, width = 1.5) {
  const img = texture.image;
  const h = width * (img.height / img.width);
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(width, h);
  const layers = 18;
  const depth = 0.09;
  const sideVS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const sideFS = /* glsl */ `uniform sampler2D map; uniform vec3 uColor; varying vec2 vUv;
    void main(){ if (texture2D(map, vUv).a < 0.5) discard; gl_FragColor = vec4(uColor * (0.85 + 0.3 * vUv.y), 1.0); }`;
  for (let i = 0; i < layers; i++) {
    const k = i / (layers - 1);
    const shade = 0.1 + 0.3 * k;
    const m = new THREE.ShaderMaterial({ uniforms: { map: { value: texture }, uColor: { value: new THREE.Color(shade * 1.2, shade * 0.1, shade * 0.07) } }, vertexShader: sideVS, fragmentShader: sideFS, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.z = -depth + depth * k - 0.004;
    group.add(mesh);
  }
  const front = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.5 }));
  group.add(front);

  const shine = new THREE.ShaderMaterial({
    uniforms: { map: { value: texture }, uShine: { value: -1 }, uGlow: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform float uShine; uniform float uGlow; varying vec2 vUv;
      void main(){ vec4 t = texture2D(map, vUv); if (t.a < 0.5) discard;
        float band = smoothstep(0.09, 0.0, abs(vUv.x + vUv.y * 0.45 - uShine));
        vec3 c = vec3(1.0, 0.86, 0.6) * band * 1.6 + t.rgb * uGlow;
        gl_FragColor = vec4(c, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const shineMesh = new THREE.Mesh(geo, shine);
  shineMesh.position.z = 0.002;
  group.add(shineMesh);

  // halo quente atrás do emblema
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(width * 2.4, width * 2.4), new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uAlpha; varying vec2 vUv;
      void main(){ vec2 p = vUv - 0.5; float g = exp(-dot(p, p) * 14.0); gl_FragColor = vec4(vec3(1.4, 0.45, 0.08) * g * uAlpha, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  halo.position.z = -0.25;
  group.add(halo);

  return { group, shine: shine.uniforms, halo: halo.material.uniforms, height: h };
}
