// GLSL for the Earth surface, cloud shell, atmosphere, and a cheap procedural
// fallback — exported as template strings (per CLAUDE.md). ShaderMaterial chunk
// includes (#include <...>) are used for correct output color management.

// Shared vertex: pass uv, world-space normal, world-space position.
export const surfaceVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// ── HQ Earth surface ──────────────────────────────────────────────────────
export const surfaceFrag = /* glsl */ `
  uniform vec3 uSun;
  uniform sampler2D uDay, uNight, uClouds, uOcean, uBump;
  uniform float uCloudsOn, uOceanOn, uBumpOn, uCloudShift, uThermal;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 n = normalize(vWorldNormal);

    // 1) Bump: finite-difference the topography map and perturb the normal in a
    //    tangent frame so mountain relief shows along the terminator.
    if (uBumpOn > 0.5) {
      float t = 1.0 / 5400.0;
      float hL = texture2D(uBump, vUv - vec2(t, 0.0)).r;
      float hR = texture2D(uBump, vUv + vec2(t, 0.0)).r;
      float hD = texture2D(uBump, vUv - vec2(0.0, t)).r;
      float hU = texture2D(uBump, vUv + vec2(0.0, t)).r;
      vec3 up = abs(n.y) > 0.999 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
      vec3 T = normalize(cross(up, n));
      vec3 B = cross(n, T);
      float strength = 8.0;
      n = normalize(n + (T * (hL - hR) + B * (hD - hU)) * strength);
    }

    float dif = dot(n, uSun);

    // 2) Day diffuse
    float day = smoothstep(-0.10, 0.28, dif);
    vec3 dayTex = texture2D(uDay, vUv).rgb;
    vec3 dayCol = dayTex * (0.22 + 1.05 * max(dif, 0.0));

    // 3) Cloud shadows on the ground (drifting cloud map)
    if (uCloudsOn > 0.5) {
      float cs = texture2D(uClouds, vec2(vUv.x + uCloudShift, vUv.y)).r;
      dayCol *= 1.0 - cs * 0.32;
    }

    // 4) Ocean sun glint (day-side, masked by ocean texture)
    if (uOceanOn > 0.5) {
      vec3 V = normalize(cameraPosition - vWorldPos);
      vec3 R = reflect(-uSun, n);
      float spec = pow(max(dot(R, V), 0.0), 140.0);
      float oceanMask = texture2D(uOcean, vUv).r;
      dayCol += spec * oceanMask * day * vec3(1.0, 0.96, 0.88) * 1.5;
    }

    // 5) Night city lights
    vec3 nightTex = texture2D(uNight, vUv).rgb;
    vec3 nightCol = pow(nightTex, vec3(1.35)) * vec3(1.0, 0.85, 0.6) * 2.2;
    float nightAmt = 1.0 - day;

    vec3 col = dayCol * day + nightCol * nightAmt;

    // 6a) Warm terminator band (gaussian around the terminator)
    float band = exp(-(dif * dif) / (2.0 * 0.11 * 0.11));
    col += band * vec3(1.0, 0.5, 0.18) * 0.22;

    // 6b) Blue atmospheric fresnel rim
    vec3 Vr = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(n, Vr), 0.0), 3.0);
    col += fres * vec3(0.30, 0.52, 1.0) * 0.55 * smoothstep(-0.25, 0.25, dif);

    // 7) Thermal / IR false-color (uThermal lerps 0→1 on toggle)
    if (uThermal > 0.001) {
      float lat = 1.0 - abs(normalize(vWorldPos).y); // warm equator, cool poles
      float relief = uBumpOn > 0.5 ? texture2D(uBump, vUv).r : 0.5;
      vec3 dayIR = mix(vec3(0.22, 0.02, 0.0), vec3(0.95, 0.45, 0.06), lat * 0.7 + relief * 0.3);
      vec3 nTex = texture2D(uNight, vUv).rgb;
      float lights = max(nTex.r, max(nTex.g, nTex.b));
      vec3 nightIR = vec3(pow(lights, 0.55)) * vec3(1.0, 0.96, 0.9); // white-hot specks
      vec3 ir = dayIR * day + nightIR * (1.0 - day);
      ir += fres * vec3(0.45, 0.05, 0.0) * 0.7; // deep-red atmosphere rim
      col = mix(col, ir, clamp(uThermal, 0.0, 1.0));
    }

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// ── Cloud shell ───────────────────────────────────────────────────────────
export const cloudFrag = /* glsl */ `
  uniform vec3 uSun;
  uniform sampler2D uClouds;
  uniform float uShift;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 n = normalize(vWorldNormal);
    float c = texture2D(uClouds, vec2(vUv.x + uShift, vUv.y)).r;
    float dif = max(dot(n, uSun), 0.0);
    float lit = 0.12 + 0.98 * dif;
    // limb fade so clouds soften toward the silhouette
    vec3 V = normalize(cameraPosition - vWorldPos);
    float limb = smoothstep(0.0, 0.45, dot(n, V));
    float a = c * limb;
    gl_FragColor = vec4(vec3(lit), a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// ── Atmosphere shell (BackSide, additive) ─────────────────────────────────
export const atmosphereVert = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const atmosphereFrag = /* glsl */ `
  uniform vec3 uSun;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - abs(dot(n, V)), 3.0);
    float sunW = 0.30 + 0.70 * max(dot(n, uSun), 0.0); // sun-side weighted
    vec3 col = vec3(0.30, 0.55, 1.0) * fres * sunW * 1.4;
    gl_FragColor = vec4(col, fres * sunW);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// ── Cheap procedural fallback (two-tone, self-lit) ────────────────────────
export const fallbackFrag = /* glsl */ `
  uniform vec3 uSun;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vec3 n = normalize(vWorldNormal);
    float d = smoothstep(-0.10, 0.30, dot(n, uSun));
    vec3 ocean = vec3(0.02, 0.09, 0.22);
    vec3 land = vec3(0.05, 0.16, 0.09);
    // crude continents from a hashed coarse grid
    vec2 cell = floor(vUv * vec2(18.0, 9.0));
    float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 base = mix(ocean, land, step(0.55, h));
    vec3 col = base * (0.05 + 0.95 * d);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
