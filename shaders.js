// ---------- scene shaders (draw lines, per-vertex color) ----------
const sceneVS = `
attribute vec2 a_position;
attribute vec3 a_color;
uniform vec2 u_resolution;
varying vec3 v_color;
void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clip = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clip * vec2(1, -1), 0.0, 1.0);
  v_color = a_color;
}
`;

const sceneFS = `
precision mediump float;
varying vec3 v_color;
void main() {
  gl_FragColor = vec4(v_color, 1.0);
}
`;

// ---------- fullscreen quad VS ----------
const quadVS = `
attribute vec2 a_pos;
attribute vec2 a_uv;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// ---------- bright pass ----------
const brightFS = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_scene;
uniform float u_threshold;
void main(){
  vec3 c = texture2D(u_scene, v_uv).rgb;
  float b = max(max(c.r,c.g), c.b);
  if(b > u_threshold) gl_FragColor = vec4(c,1.0);
  else gl_FragColor = vec4(0.0);
}
`;

// ---------- blur pass (separable) ----------
const blurFS = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texelOffset; // e.g. vec2(1/width, 0) or vec2(0,1/height)
void main(){
  // 5-tap gaussian approx
  vec3 result = texture2D(u_tex, v_uv).rgb * 0.227027;
  result += texture2D(u_tex, v_uv + u_texelOffset * 1.384615).rgb * 0.316216;
  result += texture2D(u_tex, v_uv - u_texelOffset * 1.384615).rgb * 0.316216;
  result += texture2D(u_tex, v_uv + u_texelOffset * 3.230769).rgb * 0.070270;
  result += texture2D(u_tex, v_uv - u_texelOffset * 3.230769).rgb * 0.070270;
  gl_FragColor = vec4(result, 1.0);
}
`;

// ---------- composite pass ----------
const compositeFS = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_intensity;
void main(){
  vec3 scene = texture2D(u_scene, v_uv).rgb;
  vec3 bloom = texture2D(u_bloom, v_uv).rgb;
  gl_FragColor = vec4(scene + bloom * u_intensity, 1.0);
}
`;