import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

/* ---- Config ---- */
const PHOTOS_PER_WALL = 2;
const WALL_WIDTH = 4.8;
const WALL_GAP = 0.4;
const CORRIDOR_W = 6.0;
const WALL_H = 5.2;
const LOWER_Y = 1.1;
const UPPER_Y = 3.5;
const MEZZ_Y = 2.6;
const MOVE_SPEED = 3.5;

/* ---- State ---- */
let scene, camera, renderer, controls;
let raycaster, pointer, intersected = null;
let albumData = [];
let npcs = [];
let allPhotoMeshes = [];
let clock = new THREE.Clock();
let outerR, innerR, midR;
let keys = { w: false, a: false, s: false, d: false };
let vel = new THREE.Vector3();
let dir = new THREE.Vector3();
let entered = false, animating = false;
let camTarget = new THREE.Vector3();
let camStart = new THREE.Vector3();
let animProgress = 0;
let isNightMode = false;
let accentLights = [];
let hemiLight, ambLight;
/* Mobile touch controls */
let isMobile = false;
let touchMove = { x: 0, z: 0 };
let lookYaw = 0, lookPitch = 0;
let joystickTouchId = null, lookTouchId = null;
let lookPrevX = 0, lookPrevY = 0;
/* Lazy loading for wall textures */
const WALL_LOAD_DIST = 18;
const WALL_UNLOAD_DIST = 28;
const LOAD_CHECK_INTERVAL = 8;
const MAX_CONCURRENT_LOADS = 4;
let allPhotoEntries = [];
let frameCount = 0;
let activeLoads = 0;
let loadQueue = [];
let texLoader = new THREE.TextureLoader();

/* ---- Init ---- */
function init() {
  const container = document.getElementById('exhibition-container');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x59595c);
  scene.fog = new THREE.Fog(0x59595c, 18, 45);

  camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 35, 5);
  camera.lookAt(0, 0, 0);

  document.getElementById('entrance-btn').disabled = true;
  document.getElementById('entrance-btn').textContent = '正在布展...';

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = false;
  container.appendChild(renderer.domElement);

  controls = new PointerLockControls(camera, document.body);

  /* Mobile detection + touch controls setup */
  isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth < 768);
  if (isMobile) {
    const jBase = document.createElement('div');
    jBase.id = 'joystick-base';
    jBase.innerHTML = '<div id="joystick-thumb"></div>';
    container.appendChild(jBase);
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: false });
    container.addEventListener('touchcancel', onTouchEnd, { passive: false });
  }

  /* ---- Gallery ambient light (low base, accent spotlights added in buildScene) ---- */
  hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 0.25);
  scene.add(hemiLight);
  ambLight = new THREE.AmbientLight(0xffffff, 0.06);
  scene.add(ambLight);
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  /* ---- Events ---- */
  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('click', onCanvasClick);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  document.addEventListener('keydown', e => { if (e.key in keys) keys[e.key] = true; });
  document.addEventListener('keyup', e => { if (e.key in keys) keys[e.key] = false; });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && entered) {
      if (controls.isLocked) controls.unlock();
      else { document.exitPointerLock?.(); window.location.href = '/'; }
    }
  });

  document.getElementById('ex-close').addEventListener('click', () => window.location.href = '/');

  document.getElementById('entrance-btn').addEventListener('click', enterGallery);
  document.getElementById('exhibition-entrance').addEventListener('click', enterGallery);
  document.getElementById('mode-toggle').addEventListener('click', () => {
    toggleGalleryMode();
    document.getElementById('mode-toggle').textContent = isNightMode ? '☾ 沉浸' : '☀ 日间';
  });

  loadAlbums();
  animate();
}

function enterGallery() {
  if (entered || animating) return;
  const btn = document.getElementById('entrance-btn');
  if (btn.disabled) return;
  animating = true;
  animProgress = 0;
  document.getElementById('exhibition-entrance').classList.add('hidden');
  document.getElementById('exhibition-top').classList.add('visible');
}

/* ---- Data ---- */
function loadAlbums(retries = 0) {
  const cached = sessionStorage.getItem('albums_data');
  if (cached) {
    try {
      const d = JSON.parse(cached);
      if (d.albums && d.albums.length > 0) {
        albumData = d.albums.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        buildScene();
        return;
      }
    } catch(e) {}
  }

  const loadingEl = document.getElementById('exhibition-loading');
  loadingEl.innerHTML = '<div class="ex-spinner"></div><span>正在布展...</span>';
  loadingEl.classList.remove('hidden');

  const base = location.hostname === 'localhost' ? 'http://localhost:1023' : '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  fetch(base + '/.netlify/functions/albums', { signal: controller.signal })
    .then(r => { clearTimeout(timeout); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(d => {
      if (d.albums && d.albums.length > 0) {
        albumData = d.albums.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      }
      buildScene();
    })
    .catch(() => {
      if (retries < 2) {
        setTimeout(() => loadAlbums(retries + 1), 2000 * (retries + 1));
      } else {
        loadingEl.innerHTML = '加载失败，<a href="#" id="ex-retry" style="color:rgba(255,255,255,0.3)">点击重试</a>';
        document.getElementById('ex-retry')?.addEventListener('click', e => { e.preventDefault(); loadAlbums(); });
      }
    });
}

/* ---- Geometry ---- */
function calcDimensions(total) {
  const nWalls = Math.max(1, Math.ceil(total / PHOTOS_PER_WALL));
  const perRing = Math.ceil(nWalls / 2);
  const arc = WALL_WIDTH + WALL_GAP;
  const midR = (perRing * arc) / (2 * Math.PI);
  return {
    outerR: midR + CORRIDOR_W / 2 + 0.5,
    innerR: midR - CORRIDOR_W / 2 - 0.5,
    midR, perRing, nWalls,
  };
}

/* ---- Build ---- */
function buildScene() {
  document.getElementById('exhibition-loading').classList.add('hidden');

  /* Flatten all photos from all albums, group by wall (2 per wall) */
  const allPhotos = [];
  for (let ai = 0; ai < albumData.length; ai++) {
    const album = albumData[ai];
    const albumPhotos = getPhotos(album);
    for (const photo of albumPhotos) allPhotos.push({ photo, albumIdx: ai });
  }
  /* Enable entrance immediately (textures load lazily while walking) */
  const btn = document.getElementById('entrance-btn');
  btn.disabled = false;
  btn.textContent = '进入展厅';
  const total = allPhotos.length;
  const wallGroups = [];
  for (let i = 0; i < allPhotos.length; i += PHOTOS_PER_WALL) {
    wallGroups.push(allPhotos.slice(i, i + PHOTOS_PER_WALL));
  }

  const dim = calcDimensions(total);
  outerR = dim.outerR;
  innerR = dim.innerR;

  midR = (outerR + innerR) / 2;
  camTarget.set(0, 1.6, -midR);
  camStart.set(0, 5.0, 0.01);
  camera.position.copy(camStart);
  camera.lookAt(outerR, 1.6, 0);

  createFloor();
  createMazeRings(dim, wallGroups);
  createMezzanine();
  createOutdoor();
  createAccentLights();
  createNPCs();
}

/* ---- Floor ---- */
function createFloor() {
  const maxR = Math.max(outerR + 10, 35);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x66635e, roughness: 0.9, metalness: 0.0,
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(maxR, 80), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.05;
  scene.add(floor);

  /* Corridor path (polished strip) */
  const path = new THREE.Mesh(
    new THREE.RingGeometry(innerR + 0.2, outerR - 0.2, 80),
    new THREE.MeshStandardMaterial({
      color: 0x726f69, roughness: 0.55, metalness: 0.05,
    })
  );
  path.rotation.x = -Math.PI / 2;
  path.position.y = 0.005;
  scene.add(path);
}

/* ---- Maze Rings (double-height) ---- */
function createMazeRings(dim, wallGroups) {
  const { outerR, innerR, perRing, nWalls } = dim;
  const outerWalls = Math.min(perRing, nWalls, wallGroups.length);
  const innerWalls = Math.min(nWalls - outerWalls, wallGroups.length - outerWalls);

  function buildRing(isOuter, ringWalls, startWallIdx) {
    if (ringWalls === 0) return;
    const r = isOuter ? outerR : innerR;
    const wallAngle = (360 / ringWalls) * (WALL_WIDTH / (WALL_WIDTH + WALL_GAP));
    const halfWall = wallAngle / 2;
    const actualW = 2 * r * Math.sin(halfWall * Math.PI / 180);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xf3f3f1, roughness: 0.9, metalness: 0.0,
    });

    for (let i = 0; i < ringWalls; i++) {
      const wallIdx = startWallIdx + i;
      if (wallIdx >= wallGroups.length) break;
      const photos = wallGroups[wallIdx];

      const midAngle = ((i / ringWalls) * 360 + halfWall) * Math.PI / 180;
      const x = r * Math.sin(midAngle);
      const z = r * Math.cos(midAngle);

      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.lookAt(0, 0, 0);
      if (!isOuter) group.rotation.y += Math.PI;


      /* Wall (thickened for depth) */
      const wall = new THREE.Mesh(new THREE.BoxGeometry(actualW, WALL_H, 0.06), wallMat);
      wall.castShadow = true;
      group.add(wall);

      /* Edge line */
      const edgeLines = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(actualW, WALL_H, 0.06)),
        new THREE.LineBasicMaterial({ color: 0x3a3a3e, transparent: true, opacity: 0.3 })
      );
      edgeLines.position.set(0, 0, 0);
      group.add(edgeLines);

      /* Baseboard */
      const baseboard = new THREE.Mesh(
        new THREE.BoxGeometry(actualW + 0.06, 0.03, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.05 })
      );
      baseboard.position.set(0, -WALL_H / 2 + 0.015, 0.04);
      group.add(baseboard);

      /* Photos on this wall */
      const nPhotos = photos.length;
      for (let j = 0; j < nPhotos; j++) {
        const { photo, albumIdx } = photos[j];
        const spacing = Math.min(2.6, (actualW - 0.4) / nPhotos);
        const imgAR = (photo.width && photo.height) ? photo.width / photo.height : 1.5;
        let photoW = spacing * 0.85;
        let photoH = photoW / imgAR;
        const maxPH = 2.4;
        if (photoH > maxPH) { photoH = maxPH; photoW = photoH * imgAR; }
        const cx = (j - (nPhotos - 1) / 2) * spacing;
        const cy = 1.3;
        const pz = 0.055;

        /* Frame (light gray thin matte) */
        const matMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(photoW + 0.08, photoH + 0.08),
          new THREE.MeshStandardMaterial({ color: 0xe0dfdb, roughness: 0.8, metalness: 0 })
        );
        matMesh.position.set(cx, cy, 0.04);
        group.add(matMesh);

        /* Photo */
        const pMat = new THREE.MeshBasicMaterial({ color: 0x444444 });
        const pMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(photoW, photoH),
          pMat
        );
        pMesh.position.set(cx, cy, pz);
        pMesh.userData = { isPhoto: true, albumIdx };
        group.add(pMesh);
        allPhotoMeshes.push(pMesh);

        /* Inner ring: also mirror photo on back side */
        let pMat2 = null, pMesh2 = null, mat2 = null;
        if (!isOuter) {
          pMat2 = pMat.clone();
          pMesh2 = new THREE.Mesh(
            new THREE.PlaneGeometry(photoW, photoH),
            pMat2
          );
          pMesh2.position.set(cx, cy, -0.055);
          pMesh2.rotation.y = Math.PI;
          pMesh2.userData = { isPhoto: true, albumIdx };
          group.add(pMesh2);
          allPhotoMeshes.push(pMesh2);

          mat2 = new THREE.Mesh(
            new THREE.PlaneGeometry(photoW + 0.08, photoH + 0.08),
            new THREE.MeshStandardMaterial({ color: 0xe0dfdb, roughness: 0.8, metalness: 0 })
          );
          mat2.position.set(cx, cy, -0.04);
          group.add(mat2);
        }

        /* Store for lazy loading */
        allPhotoEntries.push({
          pos: new THREE.Vector3(x, 0, z),
          pMat, pMesh, matMesh, pMat2, pMesh2, mat2,
          photoW, photoH, url: photo.url,
          loaded: false, loading: false, retried: false, texture: null,
        });
      }

      scene.add(group);
    }
  }

  buildRing(true, outerWalls, 0);
  if (innerWalls > 0) buildRing(false, innerWalls, Math.min(outerWalls, wallGroups.length));
}

/* ---- Lazy Texture Loading ---- */
function loadPhotoTexture(entry) {
  if (entry.loading || entry.loaded) return;
  entry.loading = true;
  entry.retried = false;
  loadQueue.push(entry);
  processLoadQueue();
}

function processLoadQueue() {
  while (activeLoads < MAX_CONCURRENT_LOADS && loadQueue.length > 0) {
    const entry = loadQueue.shift();
    activeLoads++;

    const loadUrl = (tryBest) => {
      let u;
      try {
        u = tryBest
          ? entry.url.replace('/f_auto,q_auto/', '/w_1600,q_80,f_jpg/')
          : entry.url.replace('/f_auto,q_auto/', '/w_800,q_80,f_jpg/');
      } catch(e) { u = entry.url; }
      return u;
    };

    function applyTexture(tex) {
      if (!entry.loading) { tex.dispose?.(); return; }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tex.needsUpdate = true;
      entry.pMat.map = tex;
      entry.pMat.color.set(0xffffff);
      entry.pMat.needsUpdate = true;
      if (entry.pMat2) { entry.pMat2.map = tex; entry.pMat2.color.set(0xffffff); entry.pMat2.needsUpdate = true; }
      const img = tex.image;
      if (img) {
        const ar = img.width / img.height;
        const displayW = entry.photoW * 0.92;
        const displayH = displayW / ar;
        const maxH = entry.photoH * 0.92;
        const fw = displayH > maxH ? displayH * ar : displayW;
        const fh = displayH > maxH ? maxH : displayH;
        const sx = fw / entry.photoW;
        const sy = fh / entry.photoH;
        entry.pMesh.scale.set(sx, sy, 1);
        const mx = 1 + (Math.max(fw, fh) / Math.min(fw, fh) - 1) * 0.06;
        entry.matMesh.scale.set(mx, mx, 1);
        if (entry.pMesh2) entry.pMesh2.scale.copy(entry.pMesh.scale);
        if (entry.mat2) entry.mat2.scale.copy(entry.matMesh.scale);
      }
      if (entry.texture && entry.texture !== tex) entry.texture.dispose();
      entry.texture = tex;
      entry.loaded = true;
      entry.loading = false;
    }

    function fallbackGray() {
      if (!entry.loading) return;
      entry.pMat.color.set(0x777777);
      entry.pMat.needsUpdate = true;
      if (entry.pMat2) { entry.pMat2.color.set(0x777777); entry.pMat2.needsUpdate = true; }
      entry.loaded = true;
      entry.loading = false;
    }

    function onLoadDone() {
      activeLoads--;
      processLoadQueue();
    }

    texLoader.load(loadUrl(true), (tex) => { applyTexture(tex); onLoadDone(); }, undefined, () => {
      if (!entry.loading) { onLoadDone(); return; }
      if (!entry.retried) {
        entry.retried = true;
        texLoader.load(loadUrl(false), (tex) => { applyTexture(tex); onLoadDone(); }, undefined, () => {
          fallbackGray();
          onLoadDone();
        });
      } else {
        fallbackGray();
        onLoadDone();
      }
    });
  }
}

function unloadPhotoTexture(entry) {
  if (!entry.loaded || entry.loading) return;
  if (entry.texture) { entry.texture.dispose(); entry.texture = null; }
  entry.pMat.color.set(0x444444);
  entry.pMat.map = null;
  entry.pMat.needsUpdate = true;
  if (entry.pMat2) { entry.pMat2.color.set(0x444444); entry.pMat2.map = null; entry.pMat2.needsUpdate = true; }
  entry.pMesh.scale.set(1, 1, 1);
  entry.matMesh.scale.set(1, 1, 1);
  if (entry.pMesh2) entry.pMesh2.scale.set(1, 1, 1);
  if (entry.mat2) entry.mat2.scale.set(1, 1, 1);
  entry.loaded = false;
  entry.retried = false;
}

function updateTextureLoading(cameraPos) {
  frameCount++;
  if (frameCount % LOAD_CHECK_INTERVAL !== 0) return;
  const p = new THREE.Vector3(cameraPos.x, 0, cameraPos.z);
  for (const entry of allPhotoEntries) {
    const dist = p.distanceTo(entry.pos);
    if (dist < WALL_LOAD_DIST && !entry.loaded && !entry.loading) {
      loadPhotoTexture(entry);
    } else if (dist > WALL_UNLOAD_DIST && entry.loaded && !entry.loading) {
      unloadPhotoTexture(entry);
    }
  }
}

/* ---- Mezzanine ---- */
function createMezzanine() {
  const platMat = new THREE.MeshStandardMaterial({
    color: 0x6a6763, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x555350, roughness: 0.4, metalness: 0.2,
  });
  const colMat = new THREE.MeshStandardMaterial({
    color: 0x484643, roughness: 0.4, metalness: 0.2,
  });

  /* Platform ring */
  const plat = new THREE.Mesh(
    new THREE.RingGeometry(innerR + 0.15, outerR - 0.15, 48),
    platMat
  );
  plat.rotation.x = -Math.PI / 2;
  plat.position.y = MEZZ_Y;
  plat.receiveShadow = true;
  plat.material.side = THREE.DoubleSide;
  scene.add(plat);

  /* Support columns behind walls (outside corridor, doesn't block photos) */
  const colGeo = new THREE.CylinderGeometry(0.05, 0.07, MEZZ_Y, 5);
  const colMesh = new THREE.InstancedMesh(colGeo, colMat, 48);
  colMesh.castShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    dummy.position.set((innerR - 0.25) * Math.sin(a), MEZZ_Y / 2, (innerR - 0.25) * Math.cos(a));
    dummy.updateMatrix();
    colMesh.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < 24; i++) {
    const a = ((i + 0.5) / 24) * Math.PI * 2;
    dummy.position.set((outerR + 0.25) * Math.sin(a), MEZZ_Y / 2, (outerR + 0.25) * Math.cos(a));
    dummy.updateMatrix();
    colMesh.setMatrixAt(i + 24, dummy.matrix);
  }
  colMesh.instanceMatrix.needsUpdate = true;
  scene.add(colMesh);

  /* Railing (inner) - simplified */
  const railGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4);
  const railMesh = new THREE.InstancedMesh(railGeo, railMat, 32);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const cr = innerR + 0.15;
    dummy.position.set(cr * Math.sin(a), MEZZ_Y + 0.3, cr * Math.cos(a));
    dummy.updateMatrix();
    railMesh.setMatrixAt(i, dummy.matrix);
  }
  railMesh.instanceMatrix.needsUpdate = true;
  scene.add(railMesh);

  /* Horizontal rail ring */
  const hRailRing = new THREE.Mesh(
    new THREE.TorusGeometry(innerR + 0.15, 0.012, 4, 48),
    railMat
  );
  hRailRing.rotation.x = Math.PI / 2;
  hRailRing.position.y = MEZZ_Y + 0.6;
  scene.add(hRailRing);

  /* Stair markers on floor */
  const stairMat = new THREE.MeshBasicMaterial({
    color: 0x908c85, transparent: true, opacity: 0.06,
  });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const sr = outerR - 0.5;
    const step = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.3), stairMat);
    step.rotation.x = -Math.PI / 2;
    step.position.set(sr * Math.sin(a), 0.01, sr * Math.cos(a) + i * 0.3 * Math.cos(a));
    scene.add(step);
  }
}

/* ---- Outdoor & Ceiling ---- */
function createOutdoor() {
  /* Ceiling — ring above the corridor, center open so God view can see through */
  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0x59595c, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide,
  });
  const ceiling = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(innerR * 0.3, 3), Math.max(outerR + 2.5, 35), 64),
    ceilMat
  );
  ceiling.rotation.x = -Math.PI / 2;
  ceiling.position.y = WALL_H + 0.1;
  scene.add(ceiling);

  /* Warm light film ring — simulates backlit diffuser panels above the corridor */
  const filmMat = new THREE.MeshBasicMaterial({
    color: 0xfff0dd,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const film = new THREE.Mesh(
    new THREE.RingGeometry(innerR + 0.3, outerR - 0.3, 64),
    filmMat
  );
  film.rotation.x = -Math.PI / 2;
  film.position.y = WALL_H - 0.05;
  scene.add(film);

  /* Outer boundary wall */
  const boundMat = new THREE.MeshStandardMaterial({
    color: 0x59595c, roughness: 0.85, metalness: 0.0,
  });
  const boundary = new THREE.Mesh(
    new THREE.CylinderGeometry(outerR + 2.5, outerR + 3, WALL_H + 1, 64, 1, true),
    boundMat
  );
  boundary.position.y = (WALL_H + 1) / 2;
  scene.add(boundary);
}

/* ---- Accent Lights (12 ceiling-mounted gallery spots) ---- */
function createAccentLights() {
  const nLights = 12;
  const color = 0xffeedd;
  const intensity = 0.4;
  for (let i = 0; i < nLights; i++) {
    const angle = (i / nLights) * Math.PI * 2;
    const light = new THREE.SpotLight(color, intensity);
    /* Alternate outer/inner positions for better coverage */
    const side = (i % 2 === 0) ? 0.6 : -0.6;
    light.position.set(
      (midR + side) * Math.sin(angle),
      WALL_H - 0.3,
      (midR + side) * Math.cos(angle)
    );
    const tgt = new THREE.Object3D();
    const tgtOffset = (i % 2 === 0) ? 1.8 : -1.8;
    tgt.position.set((midR + tgtOffset) * Math.sin(angle), 0.8, (midR + tgtOffset) * Math.cos(angle));
    scene.add(tgt);
    light.target = tgt;
    light.angle = 0.4;
    light.penumbra = 0.5;
    light.decay = 1.5;
    light.distance = 18;
    light.castShadow = false;
    scene.add(light);
    accentLights.push(light);
  }
}

/* ---- Lighting Mode Toggle ---- */
function toggleGalleryMode() {
  isNightMode = !isNightMode;
  if (isNightMode) {
    hemiLight.intensity = 0.03;
    ambLight.intensity = 0.01;
    for (const l of accentLights) l.intensity = 0.55;
  } else {
    hemiLight.intensity = 0.25;
    ambLight.intensity = 0.06;
    for (const l of accentLights) l.intensity = 0.4;
  }
}

/* ---- NPCs ---- */
function createNPCs() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x000000, roughness: 0.9, metalness: 0,
    emissive: 0x222222, emissiveIntensity: 0.04,
  });

  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.10, 0.55, 6), mat);
    torso.position.set(0, 0.75, 0);
    g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 6), mat);
    head.position.set(0, 1.05, 0);
    g.add(head);
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.25, 4), mat);
      arm.position.set(s * 0.15, 0.88, 0);
      arm.rotation.z = s * 0.25;
      g.add(arm);
    }
    g.userData = {
      radius: outerR + 3.5 + Math.random() * 2,
      angle: (i / 5) * Math.PI * 2,
      speed: 0.06 + Math.random() * 0.04,
      phase: Math.random() * Math.PI * 2,
    };
    g.position.set(
      g.userData.radius * Math.sin(g.userData.angle), 0,
      g.userData.radius * Math.cos(g.userData.angle)
    );
    g.lookAt(0, 0, 0);
    scene.add(g);
    npcs.push(g);
  }
}

/* ---- Helpers ---- */
function getPhotos(album) {
  let p = [];
  if (album.images && album.images.length) {
    p = album.images.filter(i => i && i.url && i.url !== 'undefined' && i.url.startsWith('http'));
  }
  if (p.length === 0 && album.coverImage && album.coverImage !== 'undefined' && album.coverImage.startsWith('http')) {
    p = [{ url: album.coverImage }];
  }
  return p;
}



/* ---- Interaction ---- */
function onCanvasClick() {
  if (!entered) return;
  if (isMobile) return; /* mobile uses touch controls, no pointer lock */
  if (!controls.isLocked) {
    controls.lock();
    document.getElementById('exhibition-hud').classList.remove('visible');
  }
}

function getIntersects() {
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(allPhotoMeshes);
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  const hits = getIntersects();
  if (hits.length > 0) {
    const obj = hits[0].object;
    if (intersected !== obj) {
      if (intersected && intersected.material.color) intersected.material.color.set(0xffffff);
      intersected = obj;
      if (intersected.material.color) intersected.material.color.set(0xffeedd);
    }
  } else {
    if (intersected) {
      if (intersected.material.color) intersected.material.color.set(0xffffff);
      intersected = null;
    }
  }
}

/* ---- Mobile Touch Controls ---- */
function getTouchPos(t) {
  const rect = renderer.domElement.getBoundingClientRect();
  return { x: t.clientX - rect.left, y: t.clientY - rect.top };
}

function onTouchStart(e) {
  if (!entered || animating) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    const pos = getTouchPos(t);
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    /* Left 35% or bottom 50% = joystick zone */
    if (pos.x < w * 0.35 && !joystickTouchId) {
      joystickTouchId = t.identifier;
      updateJoystick(t);
    } else if (!lookTouchId) {
      lookTouchId = t.identifier;
      lookPrevX = pos.x;
      lookPrevY = pos.y;
    }
  }
}

function onTouchMove(e) {
  if (!entered || animating) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joystickTouchId) {
      updateJoystick(t);
    } else if (t.identifier === lookTouchId) {
      const pos = getTouchPos(t);
      const dx = pos.x - lookPrevX;
      const dy = pos.y - lookPrevY;
      lookPrevX = pos.x;
      lookPrevY = pos.y;
      lookYaw -= dx * 0.005;
      lookPitch -= dy * 0.005;
      lookPitch = Math.max(-1.4, Math.min(1.4, lookPitch));
    }
  }
}

function onTouchEnd(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === joystickTouchId) {
      joystickTouchId = null;
      touchMove.x = 0;
      touchMove.z = 0;
      const thumb = document.getElementById('joystick-thumb');
      if (thumb) thumb.style.transform = 'translate(0,0)';
    }
    if (t.identifier === lookTouchId) lookTouchId = null;
  }
}

function updateJoystick(t) {
  const base = document.getElementById('joystick-base');
  if (!base) return;
  const baseRect = base.getBoundingClientRect();
  const cx = baseRect.left + baseRect.width / 2;
  const cy = baseRect.top + baseRect.height / 2;
  const maxR = baseRect.width / 2;
  let dx = t.clientX - cx;
  let dy = t.clientY - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > maxR) { dx = dx / dist * maxR; dy = dy / dist * maxR; }
  const thumb = document.getElementById('joystick-thumb');
  if (thumb) thumb.style.transform = `translate(${dx}px, ${dy}px)`;
  touchMove.x = THREE.MathUtils.clamp(dx / maxR, -1, 1);
  touchMove.z = THREE.MathUtils.clamp(dy / maxR, -1, 1);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/* ---- Animate ---- */
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  /* Entry animation: God's eye → corridor first-person */
  if (animating) {
    animProgress += delta;
    /* Hold at top for 1.5s to see the layout, then descend */
    const effective = Math.max(0, animProgress - 1.5);
    const t = Math.min(effective / 2.6, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(camStart, camTarget, ease);
    camera.fov = 80 - ease * 20;
    camera.updateProjectionMatrix();
    /* Phase 1: look at center; Phase 2: rotate to face corridor */
    const lookBlend = Math.max(0, (t - 0.55) / 0.45);
    const smoothLook = 1 - Math.pow(1 - lookBlend, 2);
    const lookEnd = new THREE.Vector3(midR, 1.6, 0);
    const lookStart = new THREE.Vector3(outerR, 1.6, 0);
    const lookAtTarget = new THREE.Vector3().lerpVectors(lookStart, lookEnd, smoothLook);
    camera.lookAt(lookAtTarget);
    if (t >= 1) {
      animating = false;
      entered = true;
      if (isMobile) {
        const eul = new THREE.Euler(0, 0, 0, 'YXZ');
        eul.setFromQuaternion(camera.quaternion);
        lookYaw = eul.y;
        lookPitch = eul.x;
        document.getElementById('exhibition-hud-mobile')?.classList.add('visible');
      } else {
        document.getElementById('exhibition-hud').classList.add('visible');
      }
    }
  }

  if (isMobile && entered && !animating) {
    /* Mobile: camera rotation from touch look */
    camera.quaternion.setFromEuler(new THREE.Euler(lookPitch, lookYaw, 0, 'YXZ'));

    /* Movement from joystick */
    vel.x -= vel.x * 0.92;
    vel.z -= vel.z * 0.92;
    const speed = MOVE_SPEED * delta;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0; forward.normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0; right.normalize();
    vel.addScaledVector(forward, -touchMove.z * speed);
    vel.addScaledVector(right, touchMove.x * speed);
    camera.position.x += vel.x;
    camera.position.z += vel.z;

    /* Simple radial collision */
    const dist = Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2);
    if (dist > outerR - 0.3) {
      const r = (outerR - 0.3) / dist;
      camera.position.x *= r; camera.position.z *= r;
    }
    if (dist < innerR + 0.3) {
      const r = (innerR + 0.3) / dist;
      camera.position.x *= r; camera.position.z *= r;
    }
  } else if (controls.isLocked) {
    vel.x -= vel.x * 0.92;
    vel.z -= vel.z * 0.92;

    const speed = MOVE_SPEED * delta;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0; forward.normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0; right.normalize();

    vel.addScaledVector(forward, (Number(keys.w) - Number(keys.s)) * speed);
    vel.addScaledVector(right, (Number(keys.d) - Number(keys.a)) * speed);

    camera.position.x += vel.x;
    camera.position.z += vel.z;

    /* Simple radial collision (original before per-wall) */
    const dist = Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2);
    if (dist > outerR - 0.3) {
      const r = (outerR - 0.3) / dist;
      camera.position.x *= r; camera.position.z *= r;
    }
    if (dist < innerR + 0.3) {
      const r = (innerR + 0.3) / dist;
      camera.position.x *= r; camera.position.z *= r;
    }
  }

  /* NPCs */
  for (const npc of npcs) {
    const d = npc.userData;
    d.angle += delta * d.speed * 0.12;
    npc.position.x = d.radius * Math.sin(d.angle);
    npc.position.z = d.radius * Math.cos(d.angle);
    npc.lookAt(0, 0, 0);
    npc.position.y = Math.sin(Date.now() * 0.001 + d.phase) * 0.02;
  }

  /* Lazy texture loading (starts during entry animation) */
  if (scene) updateTextureLoading(camera.position);

  renderer.render(scene, camera);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
