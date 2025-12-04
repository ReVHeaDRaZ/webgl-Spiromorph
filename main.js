// Main renderer + bloom pipeline (WebGL1) - Multi-Spiromorph with Individual Controls
const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl', { antialias: true });
if(!gl) alert('WebGL not supported');

function createShader(gl, src, type){
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
    console.error(gl.getShaderInfoLog(s));
  }
  return s;
}
function createProgram(gl, vsSource, fsSource){
  const vs = createShader(gl, vsSource, gl.VERTEX_SHADER);
  const fs = createShader(gl, fsSource, gl.FRAGMENT_SHADER);
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(p));
  return p;
}

// programs
const sceneProg = createProgram(gl, sceneVS, sceneFS);
const quadProg = createProgram(gl, quadVS, brightFS);
const blurProg = createProgram(gl, quadVS, blurFS);
const compProg = createProgram(gl, quadVS, compositeFS);

// full-screen quad (NDC) with UVs
const quadBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
const quadData = new Float32Array([
  -1,-1,  0,0,
   1,-1,  1,0,
  -1, 1,  0,1,
   1, 1,  1,1
]);
gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);

// helper to create a texture + FBO
function createFBO(w,h){
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

  const ok = (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex, w, h, ok };
}

// initial options
const defaultOptions = {
  window_width: window.innerWidth,
  window_height: window.innerHeight,
  base_resolution: 1024,
  number_of_elements: 6,
  envelopes_in_phase: 3,
  amplitude: 0.8,
  envelope_speed: 0.15,
  element_freq_max: 12
};

// Multi-spiromorph management
const spiromorphs = [];
let nextId = 0;

function createSpiromorph() {
  const opts = Object.assign({}, defaultOptions, {
    window_width: window.innerWidth,
    window_height: window.innerHeight
  });
  const spiro = new Spiromorph(opts);
  spiro.id = nextId++;
  return spiro;
}

function addSpiromorph() {
  const spiro = createSpiromorph();
  spiromorphs.push(spiro);
  createSpiromorphUI(spiro);
  updateSpiromorphCount();
}

function removeSpiromorph(id) {
  const index = spiromorphs.findIndex(s => s.id === id);
  if (index !== -1 && spiromorphs.length > 1) {
    spiromorphs.splice(index, 1);
    removeSpiromorphUI(id);
    updateSpiromorphCount();
  }
}

function updateSpiromorphCount() {
  const countEl = document.getElementById('spiromorphCount');
  if (countEl) countEl.textContent = spiromorphs.length;
}

function createSpiromorphUI(spiro) {
  const container = document.getElementById('spiromorphControls');
  
  const section = document.createElement('div');
  section.className = 'param-section spiromorph-item';
  section.id = `spiro-${spiro.id}`;
  
  section.innerHTML = `
    <h3 onclick="toggleSection(this)">SPIROMORPH ${spiro.id + 1}</h3>
    <div class="param-content">
      <button onclick="removeSpiromorph(${spiro.id})" style="width: 100%; padding: 8px; margin-bottom: 10px; background: #a33; color: white; border: 1px solid #c44; border-radius: 4px; cursor: pointer;">Remove This Spiromorph</button>
      
      <label for="spd-${spiro.id}">Speed</label>
      <input id="spd-${spiro.id}" type="range" min="0.01" max="1" step="0.01" value="0.15" oninput="updateSpiroValue(${spiro.id}, 'spd')">
      <output id="spd-${spiro.id}-value">0.15</output>
      
      <label for="amp-${spiro.id}">Amplitude</label>
      <input id="amp-${spiro.id}" type="range" min="0.1" max="2.5" step="0.01" value="0.8" oninput="updateSpiroValue(${spiro.id}, 'amp')">
      <output id="amp-${spiro.id}-value">0.8</output>

      <label for="elements-${spiro.id}">No. of elements</label>
      <input id="elements-${spiro.id}" type="range" min="1" max="6" step="1" value="6" oninput="updateSpiroValue(${spiro.id}, 'elements')">
      <output id="elements-${spiro.id}-value">6</output>

      <label for="envinphase-${spiro.id}">Envelopes in phase</label>
      <input id="envinphase-${spiro.id}" type="range" min="1" max="5" step="1" value="3" oninput="updateSpiroValue(${spiro.id}, 'envinphase')">
      <output id="envinphase-${spiro.id}-value">3</output>
    </div>
  `;
  
  container.appendChild(section);
}

function removeSpiromorphUI(id) {
  const section = document.getElementById(`spiro-${id}`);
  if (section) section.remove();
}

window.updateSpiroValue = function(id, param) {
  const input = document.getElementById(`${param}-${id}`);
  const output = document.getElementById(`${param}-${id}-value`);
  if (output) output.textContent = input.value;
};

// Initialize with 1 spiromorph
addSpiromorph();

// Bloom UI bindings
const thresholdEl = document.getElementById('threshold');
const itersEl = document.getElementById('iters');
const intensityEl = document.getElementById('intensity');
const downEl = document.getElementById('down');

// FBOs (scene + bloom ping-pong)
let sceneFBO = null;
let bloomFBO = null;
let ping = null;
let pong = null;

function resize(){
  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(window.innerWidth * dpr);
  const h = Math.floor(window.innerHeight * dpr);
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  gl.viewport(0,0,w,h);

  // scene at full resolution
  sceneFBO = createFBO(w, h);

  // bloom downsampled
  const down = Math.max(1, parseInt(downEl.value));
  const bw = Math.max(2, Math.floor(w / down));
  const bh = Math.max(2, Math.floor(h / down));
  bloomFBO = createFBO(bw, bh);
  ping = createFBO(bw, bh);
  pong = createFBO(bw, bh);

  // Reinit all spiromorphs
  spiromorphs.forEach(spi => {
    spi.reinit(window.innerHeight * (window.devicePixelRatio || 1));
  });
}
window.addEventListener('resize', resize);
resize();

// Scene program attributes/uniforms
const aPos = gl.getAttribLocation(sceneProg, 'a_position');
const aColor = gl.getAttribLocation(sceneProg, 'a_color');
const uResScene = gl.getUniformLocation(sceneProg, 'u_resolution');

// Quad program attribute locations
function bindQuad(prog){
  gl.useProgram(prog);
  const a_pos = gl.getAttribLocation(prog, 'a_pos');
  const a_uv = gl.getAttribLocation(prog, 'a_uv');
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.enableVertexAttribArray(a_pos);
  gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 4*4, 0);
  gl.enableVertexAttribArray(a_uv);
  gl.vertexAttribPointer(a_uv, 2, gl.FLOAT, false, 4*4, 2*4);
}

// helper to render lines (scene) into framebuffer
function renderSceneToFBO(targetFBO){
  gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO.fbo);
  gl.viewport(0,0,targetFBO.w,targetFBO.h);
  gl.clearColor(0,0,0,1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(sceneProg);
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aColor);
  gl.uniform2f(uResScene, targetFBO.w, targetFBO.h);

  // Enable additive blending for overlapping spiromorphs
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

  // Render each spiromorph
  spiromorphs.forEach(spi => {
    const verts = spi.generate_points_and_colors(targetFBO.w, targetFBO.h);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STREAM_DRAW);

    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 5*4, 0);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 5*4, 2*4);

    // draw as line strip (including closing point)
    gl.drawArrays(gl.LINE_STRIP, 0, spi.base_resolution + 1);
    gl.deleteBuffer(vb);
  });

  gl.disable(gl.BLEND);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

// helper textures binding for quad programs (texture unit usage)
function bindTextureUnit0(tex){
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
}

// animation loop
let lastTime = performance.now();
function frame(now){
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  // Update each spiromorph with its individual parameters
  spiromorphs.forEach(spi => {
    const spdEl = document.getElementById(`spd-${spi.id}`);
    const ampEl = document.getElementById(`amp-${spi.id}`);
    const elementsEl = document.getElementById(`elements-${spi.id}`);
    const envInPhaseEl = document.getElementById(`envinphase-${spi.id}`);

    if (spdEl) spi.options.envelope_speed = parseFloat(spdEl.value);
    if (ampEl) spi.options.amplitude = parseFloat(ampEl.value);
    if (elementsEl) spi.options.number_of_elements = parseFloat(elementsEl.value);
    if (envInPhaseEl) spi.options.envelopes_in_phase = parseFloat(envInPhaseEl.value);
    
    spi.reinit(window.innerHeight * (window.devicePixelRatio || 1));
    spi.Update(dt);
  });

  // 1) Render scene to sceneFBO
  renderSceneToFBO(sceneFBO);

  // 2) Bright pass: sceneFBO -> bloomFBO (downsample)
  gl.bindFramebuffer(gl.FRAMEBUFFER, bloomFBO.fbo);
  gl.viewport(0,0,bloomFBO.w,bloomFBO.h);
  gl.clearColor(0,0,0,1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(quadProg);
  bindQuad(quadProg);
  bindTextureUnit0(sceneFBO.tex);
  gl.uniform1i(gl.getUniformLocation(quadProg, 'u_scene'), 0);
  gl.uniform1f(gl.getUniformLocation(quadProg, 'u_threshold'), parseFloat(thresholdEl.value));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // 3) Blur ping-pong (horizontal then vertical) for N iterations
  const iters = parseInt(itersEl.value);
  let srcTex = bloomFBO.tex;
  let dstFBO = ping;
  for(let i=0;i<iters;i++){
    // horizontal blur
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstFBO.fbo);
    gl.viewport(0,0,dstFBO.w,dstFBO.h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(blurProg);
    bindQuad(blurProg);
    bindTextureUnit0(srcTex);
    gl.uniform1i(gl.getUniformLocation(blurProg,'u_tex'), 0);
    gl.uniform2f(gl.getUniformLocation(blurProg,'u_texelOffset'), 1.0/dstFBO.w, 0.0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // vertical blur
    const tmp = srcTex;
    srcTex = dstFBO.tex;
    dstFBO = (dstFBO === ping) ? pong : ping;

    gl.bindFramebuffer(gl.FRAMEBUFFER, dstFBO.fbo);
    gl.viewport(0,0,dstFBO.w,dstFBO.h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    bindQuad(blurProg);
    bindTextureUnit0(srcTex);
    gl.uniform1i(gl.getUniformLocation(blurProg,'u_tex'), 0);
    gl.uniform2f(gl.getUniformLocation(blurProg,'u_texelOffset'), 0.0, 1.0/dstFBO.h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    srcTex = dstFBO.tex;
    dstFBO = (dstFBO === ping) ? pong : ping;
  }

  // 4) Composite: sceneFBO + blurred bloom -> screen
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0,0,canvas.width,canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(compProg);
  bindQuad(compProg);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sceneFBO.tex);
  gl.uniform1i(gl.getUniformLocation(compProg, 'u_scene'), 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.uniform1i(gl.getUniformLocation(compProg, 'u_bloom'), 1);
  gl.uniform1f(gl.getUniformLocation(compProg, 'u_intensity'), parseFloat(intensityEl.value));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);