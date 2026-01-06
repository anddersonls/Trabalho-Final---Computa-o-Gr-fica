let gl, canvas, program;

const UI = {};
const state = {
  // projeção
  fov: 60,
  near: 0.1,
  far: 60,
  aspect: 1.5,

  // câmera
  target: vec3(0.0, 0.8, 0.0),
  radius: 4.0,
  theta: 0.9,
  phi: 1.1,

  // mouse
  mouse: {
    down: false,
    button: 0,
    lastX: 0,
    lastY: 0,
  },

  // tempo
  t0: 0,

  //animação
  sceneRotation: 0,
  rotationSpeed: 20,
};

const loc = {
  aPosition: null,
  aNormal: null,
  aTexCoord: null,
  uModelView: null,
  uProj: null,
  uNormalMatrix: null,

  uLightPosEye0: null,
  uLightPosEye1: null,
  uLightColor0: null,
  uLightColor1: null,
  uLightIntensity0: null,
  uLightIntensity1: null,
  uLightAtten0: null,
  uLightAtten1: null,

  uGlobalAmbient: null,

  uKa: null,
  uKd: null,
  uKs: null,
  uShininess: null,
  uKe: null,

  uUseBlinn: null,

  uTex0: null,
  uUseTexture: null,
  uTexMode: null,
  uBlendFactor: null,
};

let tex0 = null;
const meshes = {};
const sceneObjects = [];
const lights = [
  // Luz ambiente
  {
    type: "directional",
    directionWorld: vec3(-1.4, 1.9, 1.0),
    color: vec3(0.9, 0.9, 1.0),       
    intensity: 1.5,                     
    atten: vec3(1.0, 0.0, 0.0),
  },
  // Abajur
  {
    type: "point",
    positionWorld: vec3(0.7, 1.1, -0.3),
    color: vec3(1.0, 0.85, 0.6),
    intensity: 2.0,
    atten: vec3(1.0, 0.25, 0.08),
  },
];

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function mulMat4Vec4(m, v) {
  return [
    m[0][0]*v[0] + m[0][1]*v[1] + m[0][2]*v[2] + m[0][3]*v[3],
    m[1][0]*v[0] + m[1][1]*v[1] + m[1][2]*v[2] + m[1][3]*v[3],
    m[2][0]*v[0] + m[2][1]*v[1] + m[2][2]*v[2] + m[2][3]*v[3],
    m[3][0]*v[0] + m[3][1]*v[1] + m[3][2]*v[2] + m[3][3]*v[3],
  ];
}

function resizeCanvasToDisplaySize() {
  const dpr = window.devicePixelRatio || 1;
  const displayW = Math.floor(canvas.clientWidth * dpr);
  const displayH = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== displayW || canvas.height !== displayH) {
    canvas.width = displayW;
    canvas.height = displayH;
  }
}

function getAspect() {
  if (canvas.height === 0) {
    return 1.5; 
  }
  const aspect = canvas.width / canvas.height;
  return Math.max(0.5, Math.min(3.0, aspect));
}

function orbitEye() {
  const r = state.radius;
  const th = state.theta;
  const ph = state.phi;

  const x = state.target[0] + r * Math.sin(ph) * Math.sin(th);
  const y = state.target[1] + r * Math.cos(ph);
  const z = state.target[2] + r * Math.sin(ph) * Math.cos(th);
  return vec3(x, y, z);
}


// ======= Montagem geométrica =======
function createCube() {
  const P = [];
  const N = [];
  const T = [];

  function pushFace(a,b,c,d, normal) {
    const uvA = vec2(0,0), uvB = vec2(1,0), uvC = vec2(1,1), uvD = vec2(0,1);

    P.push(a,b,c,  a,c,d);
    N.push(normal,normal,normal,  normal,normal,normal);
    T.push(uvA,uvB,uvC,  uvA,uvC,uvD);
  }

  const v = [
    vec3(-0.5,-0.5, 0.5),
    vec3( 0.5,-0.5, 0.5),
    vec3( 0.5, 0.5, 0.5),
    vec3(-0.5, 0.5, 0.5),
    vec3(-0.5,-0.5,-0.5),
    vec3( 0.5,-0.5,-0.5),
    vec3( 0.5, 0.5,-0.5),
    vec3(-0.5, 0.5,-0.5),
  ];

  pushFace(v[0],v[1],v[2],v[3], vec3(0,0,1));
  pushFace(v[5],v[4],v[7],v[6], vec3(0,0,-1));
  pushFace(v[1],v[5],v[6],v[2], vec3(1,0,0));
  pushFace(v[4],v[0],v[3],v[7], vec3(-1,0,0));
  pushFace(v[3],v[2],v[6],v[7], vec3(0,1,0));
  pushFace(v[4],v[5],v[1],v[0], vec3(0,-1,0));

  return { positions: P, normals: N, texcoords: T, indices: null };
}

function createSphere(latBands = 16, lonBands = 16) {
  const P = [];
  const N = [];
  const T = [];
  const I = [];

  for (let lat=0; lat<=latBands; lat++) {
    const theta = lat * Math.PI / latBands;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);

    for (let lon=0; lon<=lonBands; lon++) {
      const phi = lon * 2*Math.PI / lonBands;
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);

      const x = sinT * cosP;
      const y = cosT;
      const z = sinT * sinP;

      P.push(vec3(x,y,z));
      N.push(vec3(x,y,z));
      T.push(vec2(lon/lonBands, 1 - lat/latBands));
    }
  }

  for (let lat=0; lat<latBands; lat++) {
    for (let lon=0; lon<lonBands; lon++) {
      const first = lat*(lonBands+1) + lon;
      const second = first + (lonBands+1);
      I.push(first, second, first+1);
      I.push(second, second+1, first+1);
    }
  }

  return { positions: P, normals: N, texcoords: T, indices: I };
}

function createMesh(geo) {
  const mesh = {
    pos: gl.createBuffer(),
    nor: gl.createBuffer(),
    uv:  gl.createBuffer(),
    idx: null,
    count: 0,
    indexed: false,
  };

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.pos);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(geo.positions), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nor);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(geo.normals), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(geo.texcoords), gl.STATIC_DRAW);

  if (geo.indices) {
    mesh.idx = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.indices), gl.STATIC_DRAW);
    mesh.count = geo.indices.length;
    mesh.indexed = true;
  } else {
    mesh.count = geo.positions.length;
    mesh.indexed = false;
  }

  return mesh;
}

function bindMesh(mesh) {
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.pos);
  gl.vertexAttribPointer(loc.aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc.aPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nor);
  gl.vertexAttribPointer(loc.aNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc.aNormal);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv);
  gl.vertexAttribPointer(loc.aTexCoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc.aTexCoord);

  if (mesh.indexed) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idx);
  }
}

function drawMesh(mesh) {
  if (mesh.indexed) gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  else gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
}

// ======= Textura =======
function createDefaultTexture() {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      const checker = ((x >> 3) ^ (y >> 3)) & 1;
      
      if (checker) {
        pixels[offset] = 180;
        pixels[offset + 1] = 140;
        pixels[offset + 2] = 100;
      } else {
        pixels[offset] = 120;
        pixels[offset + 1] = 80;
        pixels[offset + 2] = 60;
      }
      pixels[offset + 3] = 255;
    }
  }
  
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.generateMipmap(gl.TEXTURE_2D);
  
  return t;
}

function isPowerOf2(v) { return (v & (v - 1)) === 0; }

function uploadTextureFromImage(img) {
  gl.bindTexture(gl.TEXTURE_2D, tex0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

  if (isPowerOf2(img.width) && isPowerOf2(img.height)) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

// ======= construção da cena =======
function addObject(params) {
  sceneObjects.push({
    name: params.name,
    mesh: params.mesh,
    baseT: params.baseT || vec3(0,0,0),
    baseR: params.baseR || vec3(0,0,0),
    baseS: params.baseS || vec3(1,1,1),
    material: params.material,
    textured: !!params.textured,
    anim: params.anim || null,
    isLightMarker: !!params.isLightMarker,
  });
}

function buildScene() {
  const wood = { ka: vec3(0.25,0.18,0.12), kd: vec3(0.65,0.45,0.25), ks: vec3(0.20,0.20,0.20), shininess: 32, ke: vec3(0,0,0) };
  const dark = { ka: vec3(0.10,0.10,0.10), kd: vec3(0.20,0.20,0.20), ks: vec3(0.30,0.30,0.30), shininess: 64, ke: vec3(0,0,0) };
  const plastic = { ka: vec3(0.12,0.12,0.12), kd: vec3(0.35,0.35,0.38), ks: vec3(0.35,0.35,0.35), shininess: 64, ke: vec3(0,0,0) };
  const screen = { ka: vec3(0.05,0.05,0.05), kd: vec3(0.10,0.10,0.10), ks: vec3(0.10,0.10,0.10), shininess: 8,  ke: vec3(0.03,0.08,0.10) };
  const bulb = { ka: vec3(0.05,0.05,0.05), kd: vec3(0.10,0.10,0.10), ks: vec3(0.0,0.0,0.0),  shininess: 1,  ke: vec3(0.9,0.75,0.45) };

  addObject({
    name: "chao",
    mesh: meshes.cube,
    baseT: vec3(0, -0.025, 0),
    baseS: vec3(6, 0.05, 6),
    material: dark,
    anim: { type: "none" }
  });
  addObject({
    name: "mesa_topo",
    mesh: meshes.cube,
    baseT: vec3(0, 0.78, 0),
    baseS: vec3(1.6, 0.08, 0.9),
    material: wood,
    textured: true,
    anim: { type: "none" }
  });

  const legS = vec3(0.08, 0.75, 0.08);
  const legY = 0.38;
  const dx = 0.72, dz = 0.38;
  [
    vec3( dx, legY,  dz),
    vec3(-dx, legY,  dz),
    vec3( dx, legY, -dz),
    vec3(-dx, legY, -dz),
  ].forEach((p, i) => addObject({
    name: `mesa_perna_${i}`,
    mesh: meshes.cube,
    baseT: p,
    baseS: legS,
    material: wood,
    anim: { type: "none" }
  }));
  addObject({
    name: "gabinete",
    mesh: meshes.cube,
    baseT: vec3(-0.50, 1.195, -0.10),
    baseS: vec3(0.35, 0.75, 0.55),
    material: plastic,
    anim: { type: "none" }
  });
  addObject({
    name: "monitor",
    mesh: meshes.cube,
    baseT: vec3(0.20, 1.05, -0.25),
    baseS: vec3(0.55, 0.32, 0.06),
    material: screen,
    anim: { type: "none" }
  });
  addObject({
    name: "monitor_base",
    mesh: meshes.cube,
    baseT: vec3(0.20, 0.86, -0.25),
    baseS: vec3(0.18, 0.10, 0.18),
    material: plastic,
    anim: { type: "none" }
  });
  addObject({
    name: "teclado",
    mesh: meshes.cube,
    baseT: vec3(0.15, 0.83, 0.12),
    baseS: vec3(0.62, 0.03, 0.20),
    material: plastic,
    anim: { type: "none" }
  });
  addObject({
  name: "mouse",
  mesh: meshes.sphere,
  baseT: vec3(0.60, 0.83, 0.12),
  baseR: vec3(-15, 0, 0),
  baseS: vec3(0.08, 0.05, 0.12),
  material: {
    ka: vec3(0.10, 0.10, 0.12),
    kd: vec3(0.4, 0.4, 0.45),    
    ks: vec3(0.5, 0.5, 0.5),     
    shininess: 10,               
    ke: vec3(0, 0, 0)
  },
  anim: { type: "none" }
  });
  addObject({
    name: "cadeira_assento",
    mesh: meshes.cube,
    baseT: vec3(0.0, 0.48, 0.95),
    baseS: vec3(0.50, 0.05, 0.50),
    material: dark,
    anim: { type: "none" }
  });
  addObject({
    name: "cadeira_encosto",
    mesh: meshes.cube,
    baseT: vec3(0.0, 0.75, 1.18),
    baseS: vec3(0.50, 0.55, 0.06),
    material: dark,
    anim: { type: "none" }
  });
 [
    vec3(-0.22, 0.23, 0.725),
    vec3(0.22, 0.23, 0.725),
    vec3(-0.22, 0.23, 1.175),
    vec3(0.22, 0.23, 1.175),
  ].forEach((pos, i) => {
    addObject({
      name: `cadeira_pe_${i}`,
      mesh: meshes.cube,
      baseT: pos,
      baseS: vec3(0.05, 0.46, 0.05),
      material: dark,
      anim: { type: "none" }
    });
  });
  addObject({
    name: "abajur_base",
    mesh: meshes.cube,
    baseT: vec3(0.70, 0.82, -0.30),
    baseS: vec3(0.18, 0.02, 0.18),
    material: plastic,
    anim: { type: "none" }
  });
  addObject({
    name: "abajur_haste",
    mesh: meshes.cube,
    baseT: vec3(0.70, 0.96, -0.30),
    baseS: vec3(0.04, 0.26, 0.04),
    material: plastic,
    anim: { type: "none" }
  });
  addObject({
    name: "abajur_cupula_tmp",
    mesh: meshes.cube,
    baseT: vec3(0.70, 1.18, -0.30),
    baseS: vec3(0.26, 0.22, 0.26),
    material: wood,
    anim: { type: "none" }
  });
  addObject({
    name: "abajur_bulbo",
    mesh: meshes.sphere,
    baseT: vec3(0.70, 1.10, -0.30),
    baseS: vec3(0.06, 0.06, 0.06),
    material: bulb,
    anim: { type: "none" },
    isLightMarker: true
  });
  addObject({
    name: "luz_quarto_marker",
    mesh: meshes.sphere,
    baseT: vec3(-1.4, 1.9, 1.0),
    baseS: vec3(0.05, 0.05, 0.05),
    material: { ...bulb, ke: vec3(0.6,0.6,0.9) },
    anim: { type: "none" },
    isLightMarker: true
  });
}

// ======= WEBGL Init =======
function cacheLocations() {
  loc.aPosition = gl.getAttribLocation(program, "aPosition");
  loc.aNormal   = gl.getAttribLocation(program, "aNormal");
  loc.aTexCoord = gl.getAttribLocation(program, "aTexCoord");

  loc.uModelView     = gl.getUniformLocation(program, "uModelView");
  loc.uProj          = gl.getUniformLocation(program, "uProj");
  loc.uNormalMatrix  = gl.getUniformLocation(program, "uNormalMatrix");

  loc.uLightPosEye0 = gl.getUniformLocation(program, "uLightPosEye0");
  loc.uLightPosEye1 = gl.getUniformLocation(program, "uLightPosEye1");
  loc.uLightColor0 = gl.getUniformLocation(program, "uLightColor0");
  loc.uLightColor1 = gl.getUniformLocation(program, "uLightColor1");
  loc.uLightIntensity0 = gl.getUniformLocation(program, "uLightIntensity0");
  loc.uLightIntensity1 = gl.getUniformLocation(program, "uLightIntensity1");
  loc.uLightAtten0 = gl.getUniformLocation(program, "uLightAtten0");
  loc.uLightAtten1 = gl.getUniformLocation(program, "uLightAtten1");

  loc.uGlobalAmbient = gl.getUniformLocation(program, "uGlobalAmbient");

  loc.uKa        = gl.getUniformLocation(program, "uKa");
  loc.uKd        = gl.getUniformLocation(program, "uKd");
  loc.uKs        = gl.getUniformLocation(program, "uKs");
  loc.uShininess = gl.getUniformLocation(program, "uShininess");
  loc.uKe        = gl.getUniformLocation(program, "uKe");

  loc.uUseBlinn  = gl.getUniformLocation(program, "uUseBlinn");

  loc.uTex0        = gl.getUniformLocation(program, "uTex0");
  loc.uUseTexture  = gl.getUniformLocation(program, "uUseTexture");
  loc.uTexMode     = gl.getUniformLocation(program, "uTexMode");
  loc.uBlendFactor = gl.getUniformLocation(program, "uBlendFactor");
}

function setLights(view) {
  const L0 = lights[0];
  
  const dirWorld4 = vec4(L0.directionWorld[0], L0.directionWorld[1], L0.directionWorld[2], 0.0);
  const dirEye4 = mulMat4Vec4(view, dirWorld4);
  const dirEye = vec4(dirEye4[0], dirEye4[1], dirEye4[2], 0.0);
  
  gl.uniform4fv(loc.uLightPosEye0, flatten(dirEye));
  gl.uniform3fv(loc.uLightColor0, flatten(L0.color));
  gl.uniform1f(loc.uLightIntensity0, L0.intensity);
  gl.uniform3fv(loc.uLightAtten0, flatten(L0.atten));

  const L1 = lights[1];
  const originalPos = vec3(0.7, 1.1, -0.3);
  const center = vec3(0, 0.8, 0);
  const T_to_center = translate(-center[0], -center[1], -center[2]);
  const R_rotation = rotate(state.sceneRotation, [0, 1, 0]);
  const T_back = translate(center[0], center[1], center[2]);
  const sceneRotationMatrix = mult(T_back, mult(R_rotation, T_to_center));
  
  const rotatedPos = mulMat4Vec4(sceneRotationMatrix, vec4(originalPos[0], originalPos[1], originalPos[2], 1.0));
  
  const pWorld4 = vec4(rotatedPos[0], rotatedPos[1], rotatedPos[2], 1.0);
  const pEye4 = mulMat4Vec4(view, pWorld4);
  const posEye1 = vec4(pEye4[0], pEye4[1], pEye4[2], 1.0);
  
  gl.uniform4fv(loc.uLightPosEye1, flatten(posEye1));
  gl.uniform3fv(loc.uLightColor1, flatten(L1.color));
  gl.uniform1f(loc.uLightIntensity1, L1.intensity);
  gl.uniform3fv(loc.uLightAtten1, flatten(L1.atten));
}

// ======= Interface e eventos =======
function hookUI() {
  UI.status = document.getElementById("status");

  UI.fov = document.getElementById("fov");
  UI.near = document.getElementById("near");
  UI.far = document.getElementById("far");
  UI.aspect = document.getElementById("aspect");
  UI.textureFile = document.getElementById("textureFile");
  UI.fov.addEventListener("input", () => state.fov = parseFloat(UI.fov.value));
  UI.near.addEventListener("change", () => state.near = parseFloat(UI.near.value));
  UI.far.addEventListener("change", () => state.far = parseFloat(UI.far.value));

  UI.textureFile.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      uploadTextureFromImage(img);
      UI.status.textContent = `Textura carregada: ${file.name}`;
    };

    const reader = new FileReader();
    reader.onload = () => img.src = reader.result;
    reader.readAsDataURL(file);
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("mousedown", (e) => {
    state.mouse.down = true;
    state.mouse.button = e.button;
    state.mouse.lastX = e.clientX;
    state.mouse.lastY = e.clientY;
  });

  window.addEventListener("mouseup", () => state.mouse.down = false);

  window.addEventListener("mousemove", (e) => {
    if (!state.mouse.down) return;

    const dx = e.clientX - state.mouse.lastX;
    const dy = e.clientY - state.mouse.lastY;
    state.mouse.lastX = e.clientX;
    state.mouse.lastY = e.clientY;

    if (state.mouse.button === 0) {
      state.theta += dx * 0.005;
      state.phi = clamp(state.phi + dy * 0.005, 0.12, Math.PI - 0.12);
    } else if (state.mouse.button === 2) {
      const panScale = 0.0025 * state.radius;
      state.target[0] -= dx * panScale;
      state.target[1] += dy * panScale;
    }
  });

  canvas.addEventListener("wheel", (e) => {
    const k = (e.deltaY > 0) ? 1.08 : 0.92;
    state.radius = clamp(state.radius * k, 1.2, 15.0);
  }, { passive: true });
}

// ====== Renderização ======
function applyAnimation(obj, t) {
  state.sceneRotation = (t * state.rotationSpeed) % 360;
  const center = vec3(0, 0.8, 0);
  
  const T_to_center = translate(-center[0], -center[1], -center[2]);
  const R_rotation = rotate(state.sceneRotation, [0, 1, 0]);
  const T_back = translate(center[0], center[1], center[2]);
  
  const sceneRotationMatrix = mult(T_back, mult(R_rotation, T_to_center));
  
  const localT = translate(obj.baseT[0], obj.baseT[1], obj.baseT[2]);
  const localR = rotate(obj.baseR[0], [1,0,0]);
  const localRy = rotate(obj.baseR[1], [0,1,0]);
  const localRz = rotate(obj.baseR[2], [0,0,1]);
  const localS = scalem(obj.baseS[0], obj.baseS[1], obj.baseS[2]);
  
  const localTransform = mult(localT, mult(localRz, mult(localRy, mult(localR, localS))));

  if (!obj.name.includes("luz_quarto") && obj.name !== "chao") {
    return mult(sceneRotationMatrix, localTransform);
  } else {
    return localTransform;
  }
}

function setMaterial(mat) {
  gl.uniform3fv(loc.uKa, flatten(mat.ka));
  gl.uniform3fv(loc.uKd, flatten(mat.kd));
  gl.uniform3fv(loc.uKs, flatten(mat.ks));
  gl.uniform1f(loc.uShininess, mat.shininess);
  gl.uniform3fv(loc.uKe, flatten(mat.ke));
}

function setGlobalParams() {
  gl.uniform1i(loc.uUseBlinn, 1);
  gl.uniform1i(loc.uTexMode, 0);
  gl.uniform1f(loc.uBlendFactor, 0.0);
  gl.uniform3fv(loc.uGlobalAmbient, flatten(vec3(0.18, 0.18, 0.20)));
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex0);
  gl.uniform1i(loc.uTex0, 0);
}

function render(nowMs) {
  resizeCanvasToDisplaySize();
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const t = nowMs * 0.001;
  const eye = orbitEye();
  const view = lookAt(eye, state.target, vec3(0,1,0));
  const currentAspect = getAspect();
  if (UI.aspectValue) {
    UI.aspectValue.textContent = currentAspect.toFixed(2);
  }
  const proj = perspective(state.fov, currentAspect, state.near, state.far);

  gl.uniformMatrix4fv(loc.uProj, false, flatten(proj));

  setLights(view);
  setGlobalParams();

  for (const obj of sceneObjects) {
    const model = applyAnimation(obj, t);
    const modelView = mult(view, model);
    const nrm = normalMatrix(modelView, true);

    gl.uniformMatrix4fv(loc.uModelView, false, flatten(modelView));
    gl.uniformMatrix3fv(loc.uNormalMatrix, false, flatten(nrm));

    setMaterial(obj.material);

    const useTextureForObject = obj.textured ? 1 : 0;
    gl.uniform1i(loc.uUseTexture, useTextureForObject);

    bindMesh(obj.mesh);
    drawMesh(obj.mesh);
  }

  requestAnimationFrame(render);
}

window.onload = function main() {
  canvas = document.getElementById("glcanvas");
  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl) {
    alert("WebGL não disponível");
    return;
  }

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.04, 0.04, 0.06, 1.0);

  program = initShaders(gl, "vertex-shader", "fragment-shader");
  
  if (!program) {
    alert("Falha ao criar programa WebGL");
    return;
  }
  
  gl.useProgram(program);

  cacheLocations();
  hookUI();
  tex0 = createDefaultTexture();

  meshes.cube = createMesh(createCube());
  meshes.sphere = createMesh(createSphere(16, 16));
  buildScene();

  UI.status.textContent = "OK";

  requestAnimationFrame(render);
};
