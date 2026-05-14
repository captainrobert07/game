import * as THREE from "three";

/**
 * Endless meadow world.
 * - 3 lanes (x = -LANE, 0, +LANE)
 * - Path recycles in CHUNK-sized segments as the camera advances
 * - Decorative props scattered alongside (fences, sunflowers, bushes, hills)
 */

export const LANE = 1.6;
export const LANES = [-LANE, 0, LANE];
export const CHUNK = 16; // length of one recyclable segment along Z
export const PATH_WIDTH = LANE * 2 + 1.0; // covers all 3 lanes + margin
export const VIEW_AHEAD = 6; // segments visible ahead
export const VIEW_BEHIND = 1; // segments still visible behind

const PALETTE = {
  pathLight: 0xc9a978,
  pathDark: 0xb08a52,
  grassLight: 0x9bcc6e,
  grassDark: 0x7eb558,
  fence: 0x8b5a2b,
  fenceLight: 0xb88a55,
  hillNear: 0x6fa84d,
  hillFar: 0x4f8a3d,
  flowerYellow: 0xffd54a,
  flowerPink: 0xff96b8,
  flowerWhite: 0xffffff,
  bush: 0x5fa044,
  cloud: 0xffffff,
};

function toon(color) {
  return new THREE.MeshToonMaterial({ color });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function sphere(r, color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), toon(color));
  m.castShadow = true;
  return m;
}

function cyl(rTop, rBot, h, color) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBot, h, 8),
    toon(color)
  );
  m.castShadow = true;
  return m;
}

/** One reusable chunk of meadow path + decor along the Z axis. */
class Chunk {
  constructor() {
    this.group = new THREE.Group();

    // Path (the brown strip Hanna runs on)
    const path = box(PATH_WIDTH, 0.1, CHUNK, PALETTE.pathLight);
    path.position.y = 0.05;
    path.receiveShadow = true;
    this.group.add(path);

    // Lane stripes (subtle dirt color variation)
    for (const x of [-LANE, LANE]) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(0.04, CHUNK),
        new THREE.MeshBasicMaterial({
          color: PALETTE.pathDark,
          transparent: true,
          opacity: 0.4,
        })
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, 0.11, 0);
      this.group.add(stripe);
    }

    // Grass on either side
    const sideW = 30;
    for (const sign of [-1, 1]) {
      const grass = box(sideW, 0.08, CHUNK, sign === -1 ? PALETTE.grassLight : PALETTE.grassDark);
      grass.position.set(sign * (PATH_WIDTH / 2 + sideW / 2), 0.04, 0);
      grass.receiveShadow = true;
      this.group.add(grass);
    }

    this.decor = new THREE.Group();
    this.group.add(this.decor);

    // Far hills (parallax-ish — they live in the chunk)
    for (const sign of [-1, 1]) {
      const hill = sphere(2.4 + Math.random() * 1.0, PALETTE.hillNear);
      hill.scale.set(2.5, 0.6, 2.0);
      hill.position.set(sign * (12 + Math.random() * 4), 1.2, (Math.random() - 0.5) * CHUNK);
      this.decor.add(hill);

      const farHill = sphere(3.2 + Math.random() * 1.4, PALETTE.hillFar);
      farHill.scale.set(2.5, 0.5, 2.0);
      farHill.position.set(sign * (18 + Math.random() * 6), 1.5, (Math.random() - 0.5) * CHUNK);
      this.decor.add(farHill);
    }

    // Random props alongside the path
    const propsPerSide = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < propsPerSide * 2; i++) {
      const sign = i < propsPerSide ? -1 : 1;
      const z = (Math.random() - 0.5) * (CHUNK - 1);
      const x = sign * (PATH_WIDTH / 2 + 0.6 + Math.random() * 4);
      const r = Math.random();
      let prop;
      if (r < 0.3) prop = this._makeFence();
      else if (r < 0.55) prop = this._makeBush();
      else if (r < 0.8) prop = this._makeSunflower();
      else prop = this._makeHayBale();
      prop.position.set(x, 0, z);
      prop.rotation.y = Math.random() * Math.PI * 2;
      this.decor.add(prop);
    }
  }

  _makeFence() {
    const g = new THREE.Group();
    // Two posts + crossbar
    for (const x of [-0.4, 0.4]) {
      const post = box(0.08, 0.6, 0.08, PALETTE.fence);
      post.position.set(x, 0.3, 0);
      g.add(post);
    }
    const bar = box(0.95, 0.06, 0.06, PALETTE.fenceLight);
    bar.position.y = 0.45;
    g.add(bar);
    const bar2 = box(0.95, 0.06, 0.06, PALETTE.fenceLight);
    bar2.position.y = 0.2;
    g.add(bar2);
    return g;
  }

  _makeBush() {
    const g = new THREE.Group();
    g.add(sphere(0.35, PALETTE.bush));
    const b2 = sphere(0.28, PALETTE.bush);
    b2.position.set(0.25, 0.05, 0.1);
    g.add(b2);
    const b3 = sphere(0.22, PALETTE.bush);
    b3.position.set(-0.2, 0.0, -0.05);
    g.add(b3);
    g.position.y = 0.25;
    return g;
  }

  _makeSunflower() {
    const g = new THREE.Group();
    const stem = cyl(0.025, 0.025, 1.0, 0x4a8c3a);
    stem.position.y = 0.5;
    g.add(stem);
    const head = sphere(0.12, 0x6a3a14);
    head.position.y = 1.05;
    g.add(head);
    // Petals
    const petalGeom = new THREE.SphereGeometry(0.06, 6, 6);
    const petalMat = toon(PALETTE.flowerYellow);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = new THREE.Mesh(petalGeom, petalMat);
      p.position.set(Math.cos(a) * 0.16, 1.05, Math.sin(a) * 0.16);
      p.scale.set(1, 0.5, 0.5);
      g.add(p);
    }
    return g;
  }

  _makeHayBale() {
    const g = new THREE.Group();
    const bale = cyl(0.4, 0.4, 0.7, 0xe8c87a);
    bale.rotation.z = Math.PI / 2;
    bale.position.y = 0.4;
    g.add(bale);
    return g;
  }
}

/** Manager: keeps a rolling window of chunks centered around the camera. */
export class World {
  constructor(scene) {
    this.scene = scene;
    this.chunks = []; // { z: number (start of chunk), group: Group }

    // Master ground (keeps fog from showing seams)
    const farGround = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800),
      toon(PALETTE.grassLight)
    );
    farGround.rotation.x = -Math.PI / 2;
    farGround.position.y = -0.05;
    scene.add(farGround);

    // Sky dome — large hemisphere with gradient feel via fog
    // (Three.js fog handles atmosphere; this is just visual depth.)

    // Clouds (decorative, drift slowly)
    this.clouds = new THREE.Group();
    scene.add(this.clouds);
    for (let i = 0; i < 12; i++) {
      const c = this._makeCloud();
      c.position.set(
        (Math.random() - 0.5) * 80,
        12 + Math.random() * 8,
        (Math.random() - 0.5) * 200
      );
      this.clouds.add(c);
    }

    // Build initial chunks
    for (let i = -VIEW_BEHIND; i < VIEW_AHEAD; i++) {
      this._addChunk(i * CHUNK);
    }
  }

  _makeCloud() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: PALETTE.cloud,
      transparent: true,
      opacity: 0.85,
    });
    for (let i = 0; i < 4; i++) {
      const r = 0.7 + Math.random() * 0.6;
      const p = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), mat);
      p.position.set((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.6);
      g.add(p);
    }
    return g;
  }

  _addChunk(zStart) {
    const c = new Chunk();
    c.group.position.z = zStart + CHUNK / 2;
    this.scene.add(c.group);
    this.chunks.push({ z: zStart, group: c.group });
    return c;
  }

  /** Advance the world so it always covers around `camZ`. */
  update(camZ, dt) {
    // Cloud drift
    this.clouds.position.x += dt * 0.6;
    if (this.clouds.position.x > 40) this.clouds.position.x -= 80;

    // Recycle chunks that are too far behind, append ahead
    while (this.chunks.length > 0 && this.chunks[0].z + CHUNK < camZ - VIEW_BEHIND * CHUNK) {
      const old = this.chunks.shift();
      this.scene.remove(old.group);
    }
    const lastZ = this.chunks.length > 0 ? this.chunks[this.chunks.length - 1].z : Math.floor(camZ / CHUNK) * CHUNK;
    while (lastZ + CHUNK * VIEW_AHEAD < camZ + VIEW_AHEAD * CHUNK) {
      const next = this.chunks[this.chunks.length - 1].z + CHUNK;
      this._addChunk(next);
    }
  }

}
