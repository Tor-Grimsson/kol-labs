/* GLSL for the gradient material: vertex noise displacement + a color ramp
 * driven by normal / fresnel rim / height, soft diffuse, rim emissive, grain.
 * No postprocessing — the glow is rim emissive + an additive sprite. */

/* 3D simplex noise — Ashima Arts / Stefan Gustavson (webgl-noise, MIT). */
const SNOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`

export const gradientVertex = /* glsl */ `
uniform float uTime;
uniform float uDistort;
uniform float uSeedOffset;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewDir;
${SNOISE}
void main() {
  vec3 p = position;
  float n = snoise(position * 1.4 + vec3(uSeedOffset) + vec3(0.0, 0.0, uTime * 0.35));
  p += normal * n * uDistort;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = cameraPosition - world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const gradientFragment = /* glsl */ `
uniform vec3 uColors[5];
uniform int uCount;
uniform int uDriver;
uniform float uTime;
uniform float uGlow;
uniform float uGrain;
uniform float uSeedOffset;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewDir;
${SNOISE}
vec3 ramp(float t) {
  float ft = clamp(t, 0.0, 1.0) * float(uCount - 1);
  int i = int(floor(ft));
  vec3 a = uColors[i];
  vec3 b = uColors[i + 1 < uCount ? i + 1 : uCount - 1];
  return mix(a, b, fract(ft));
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vViewDir);
  float fres = pow(1.0 - abs(dot(n, v)), 2.2);
  float t;
  if (uDriver == 0) t = 0.5 + 0.5 * dot(n, normalize(vec3(0.6, 0.8, 0.4)));
  else if (uDriver == 1) t = fres;
  else t = clamp(vWorldPos.y * 0.45 + 0.5, 0.0, 1.0);
  t += 0.12 * snoise(vWorldPos * 1.5 + vec3(uSeedOffset) + vec3(uTime * 0.12));
  vec3 col = ramp(t);
  float diff = 0.45 + 0.55 * max(dot(n, normalize(vec3(0.35, 0.9, 0.5))), 0.0);
  col *= diff;
  col += col * fres * (0.55 + uGlow);
  col += (hash(gl_FragCoord.xy) - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
}
`
