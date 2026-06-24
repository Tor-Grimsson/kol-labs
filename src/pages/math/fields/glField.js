// WebGL2 colormap for the complex domain-coloring field. Replaces the per-frame
// CPU paintField pixel loop (the frame-drop source on /math/fields — millions of
// hsv() calls + a fresh ImageData every rAF frame) with one full-screen draw. The
// shader math is byte-for-byte the same as paintField (parity-checked), uploaded at
// the SAME canvas resolution, so output is identical — only the per-frame remap
// moves to the GPU. computeField stays the field source; PNG export still uses the
// CPU paintField. Returns null if WebGL2 is unavailable → editor falls back to CPU.

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){
  // canvas-top (clip y=+1) samples texture row 0 = field py 0, matching paintHeat's
  // top-down row order, so the GL output is oriented like the CPU putImageData.
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uField;   // R=arg, G=logmod, B=bad(0/1)
uniform int uColoring;      // 0 rings · 1 smooth · 2 contour
uniform float uHue;
uniform float uRing;
uniform float uShade;
in vec2 vUv;
out vec4 frag;
const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;
vec3 hsv2rgb(float h, float v){ // == render.js hsv() at s=1 (proven identical)
  vec3 c = abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0;
  return v * clamp(c, 0.0, 1.0);
}
void main(){
  vec4 d = texture(uField, vUv);
  if (d.b > 0.5) { frag = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float arg = d.r;
  float logmod = d.g;
  float H = fract(arg / TAU + 1.0 + uHue);
  float V = 1.0;
  if (uColoring == 1) {
    V = 0.35 + 0.65 * (2.0 / PI) * atan(exp2(logmod));
  } else {
    float k = logmod + uRing;
    V = 0.55 + 0.45 * fract(k);
    if (uColoring == 2) {
      float a2 = (arg + uHue * TAU) / (PI / 6.0);
      V *= 0.4 + 0.6 * min(1.0, abs(a2 - floor(a2 + 0.5)) * 6.0);
    }
  }
  frag = vec4(hsv2rgb(H, V * (1.0 - uShade)), 1.0);
}`

const COLOR_ID = { rings: 0, smooth: 1, contour: 2 }

function compile(gl, type, src) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('glField shader:', gl.getShaderInfoLog(sh)); gl.deleteShader(sh); return null
  }
  return sh
}

export function createGlField() {
  const canvas = document.createElement('canvas')
  // preserveDrawingBuffer so the 2D blit (drawImage of this canvas) always reads a
  // valid frame even if the compositor times the present oddly.
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false })
  if (!gl) return null
  const vs = compile(gl, gl.VERTEX_SHADER, VERT)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
  if (!vs || !fs) return null
  const prog = gl.createProgram()
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error('glField link:', gl.getProgramInfoLog(prog)); return null }
  gl.useProgram(prog)

  const vbo = gl.createBuffer() // one full-screen triangle
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST) // 1:1, no filtering — match putImageData
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  const uColoring = gl.getUniformLocation(prog, 'uColoring')
  const uHue = gl.getUniformLocation(prog, 'uHue')
  const uRing = gl.getUniformLocation(prog, 'uRing')
  const uShade = gl.getUniformLocation(prog, 'uShade')
  gl.uniform1i(gl.getUniformLocation(prog, 'uField'), 0)

  let packed = null // reused across fits (only realloc'd when resolution changes)
  let pw = 0, ph = 0

  return {
    canvas,
    upload(field) {
      const { w, h, arg, logmod, bad } = field
      const n = w * h
      if (!packed || packed.length !== n * 4) packed = new Float32Array(n * 4)
      for (let i = 0, j = 0; i < n; i++, j += 4) { packed[j] = arg[i]; packed[j + 1] = logmod[i]; packed[j + 2] = bad[i] }
      canvas.width = w; canvas.height = h; pw = w; ph = h
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, packed)
    },
    draw({ coloring = 'rings', huePhase = 0, ringPhase = 0, shade = 0 }) {
      if (!pw) return
      gl.viewport(0, 0, pw, ph)
      gl.uniform1i(uColoring, COLOR_ID[coloring] ?? 0)
      gl.uniform1f(uHue, huePhase)
      gl.uniform1f(uRing, ringPhase)
      gl.uniform1f(uShade, shade)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose() { gl.getExtension('WEBGL_lose_context')?.loseContext() },
  }
}
