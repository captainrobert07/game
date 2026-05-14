import * as THREE from "three";
import { LANE, LANES } from "./world.js";

/**
 * Obstacle / coin / powerup spawning.
 *
 * Spawn pattern is a forward-marching seed: every SPAWN_INTERVAL meters of Z,
 * we decide what occupies each lane. We avoid impossible patterns (all 3 lanes
 * blocked) so the run is always survivable.
 */

const SPAWN_INTERVAL = 6; // meters between obstacle "rows"
const SPAWN_AHEAD = 90; // how far ahead to spawn
const DESPAWN_BEHIND = 6;

const PALETTE = {
  hay: 0xe8c87a,
  hayDark: 0xc8a85a,
  log: 0x6b3e20,
  logBark: 0x4a2810,
  rock: 0x8a8a8a,
  pipe: 0x6a8a78,
  pipeRing: 0x4a6a58,
  scarecrow: 0xfff3d6,
  coin: 0xffd54a,
  coinDark: 0xc89422,
  magnet: 0xff5566,
  shield: 0x55aaff,
  double: 0xff66ff,
};

function toon(color) {
  return new THREE.MeshToonMaterial({ color });
}
function basic(color) {
  return new THREE.MeshBasicMaterial({ color });
}

const TYPE = {
  // Obstacles
  HAYBALE: "haybale", // jump over (low, blocks low)
  LOG: "log", // jump over (medium)
  ROCK: "rock", // change lane (tall, blocks all)
  PIPE: "pipe", // slide under (high, blocks high)
  SCARECROW: "scarecrow", // change lane (tall, blocks all)
  // Pickups
  COIN: "coin",
  PU_MAGNET: "pu_magnet",
  PU_SHIELD: "pu_shield",
  PU_DOUBLE: "pu_double",
};

/** Single AABB hitbox per spawned thing. */
class Spawn {
  constructor(type, mesh, lane, z, hitbox, blocks) {
    this.type = type;
    this.mesh = mesh;
    this.lane = lane;
    this.z = z;
    this.hitbox = hitbox; // { halfX, halfY, halfZ, cy } — cy = box center Y
    this.blocks = blocks; // "low" | "high" | "all"
    this.collected = false;
  }
}

export class ObstacleManager {
  constructor(scene) {
    this.scene = scene;
    this.spawns = [];
    this.lastSpawnZ = 8; // start spawning a bit ahead of Hanna
    // Run-tunable: how often a powerup appears among coins
    this.powerupChance = 0.06;
    this._rng = Math.random;
  }

  reset() {
    for (const s of this.spawns) this.scene.remove(s.mesh);
    this.spawns = [];
    this.lastSpawnZ = 8;
  }

  // ---------- Geometry builders ----------
  _makeHaybale() {
    const g = new THREE.Group();
    const bale = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 1.1, 12),
      toon(PALETTE.hay)
    );
    bale.rotation.z = Math.PI / 2;
    bale.position.y = 0.5;
    bale.castShadow = true;
    g.add(bale);
    // Rope
    for (const x of [-0.3, 0.3]) {
      const rope = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.03, 6, 12),
        toon(PALETTE.hayDark)
      );
      rope.rotation.y = Math.PI / 2;
      rope.position.set(x, 0.5, 0);
      g.add(rope);
    }
    return g;
  }

  _makeLog() {
    const g = new THREE.Group();
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 1.4, 12),
      toon(PALETTE.log)
    );
    log.rotation.z = Math.PI / 2;
    log.position.y = 0.4;
    log.castShadow = true;
    g.add(log);
    // Bark rings
    for (const x of [-0.6, 0.6]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.04, 6, 12),
        toon(PALETTE.logBark)
      );
      ring.rotation.y = Math.PI / 2;
      ring.position.set(x, 0.4, 0);
      g.add(ring);
    }
    return g;
  }

  _makeRock() {
    const g = new THREE.Group();
    const r = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.7, 0),
      toon(PALETTE.rock)
    );
    r.position.y = 0.7;
    r.castShadow = true;
    g.add(r);
    const r2 = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.35, 0),
      toon(PALETTE.rock)
    );
    r2.position.set(0.5, 0.4, 0.2);
    g.add(r2);
    return g;
  }

  _makePipe() {
    const g = new THREE.Group();
    // Two posts holding a horizontal pipe at ~head height
    for (const x of [-0.8, 0.8]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 2.2, 8),
        toon(PALETTE.rock)
      );
      post.position.set(x, 1.1, 0);
      post.castShadow = true;
      g.add(post);
    }
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 1.7, 12),
      toon(PALETTE.pipe)
    );
    pipe.rotation.z = Math.PI / 2;
    pipe.position.y = 1.85;
    pipe.castShadow = true;
    g.add(pipe);
    // Decorative rings
    for (const x of [-0.5, 0.5]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.025, 6, 12),
        toon(PALETTE.pipeRing)
      );
      ring.rotation.y = Math.PI / 2;
      ring.position.set(x, 1.85, 0);
      g.add(ring);
    }
    return g;
  }

  _makeScarecrow() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.7, 8),
      toon(PALETTE.log)
    );
    pole.position.y = 0.85;
    pole.castShadow = true;
    g.add(pole);
    const cross = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.06, 0.06),
      toon(PALETTE.log)
    );
    cross.position.y = 1.4;
    g.add(cross);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      toon(PALETTE.scarecrow)
    );
    head.position.y = 1.75;
    head.castShadow = true;
    g.add(head);
    // Eyes
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), basic(0));
    eye.position.set(-0.07, 1.78, 0.2);
    g.add(eye);
    const eye2 = eye.clone();
    eye2.position.x = 0.07;
    g.add(eye2);
    // Hat
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.04, 12),
      toon(0x6a3a14)
    );
    brim.position.y = 1.94;
    g.add(brim);
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.2, 0.18, 12),
      toon(0x6a3a14)
    );
    top.position.y = 2.05;
    g.add(top);
    return g;
  }

  _makeCoin() {
    const g = new THREE.Group();
    const c = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16),
      toon(PALETTE.coin)
    );
    c.rotation.x = Math.PI / 2;
    g.add(c);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.03, 6, 16),
      toon(PALETTE.coinDark)
    );
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    g.position.y = 1.0;
    g.userData.spin = true;
    return g;
  }

  _makePowerup(color) {
    const g = new THREE.Group();
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.32, 0),
      toon(color)
    );
    orb.castShadow = true;
    g.add(orb);
    // Glow ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.03, 6, 24),
      basic(color)
    );
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    g.position.y = 1.1;
    g.userData.spin = true;
    return g;
  }

  // ---------- Spawning ----------
  /**
   * Generate a row at z. Returns the Spawn objects placed in this row.
   * Guarantees: never blocks all 3 lanes the same way.
   */
  _spawnRow(z) {
    // Decide row "kind":
    // 0–0.65 → 1-2 obstacles + coins in free lanes
    // 0.65–0.95 → coin train in one lane (no obstacles in that lane)
    // 0.95–1 → powerup (rare, exciting)
    const r = this._rng();
    if (r < 0.65) this._spawnObstacleRow(z);
    else if (r < 0.95) this._spawnCoinTrain(z);
    else this._spawnPowerup(z);
  }

  _spawnObstacleRow(z) {
    // Pick 1 or 2 lanes to obstruct, leave at least 1 clear.
    const laneCount = this._rng() < 0.6 ? 1 : 2;
    const all = [0, 1, 2];
    const occupied = [];
    for (let i = 0; i < laneCount; i++) {
      const idx = Math.floor(this._rng() * all.length);
      occupied.push(all.splice(idx, 1)[0]);
    }
    for (const li of occupied) {
      const x = LANES[li];
      const types = [TYPE.HAYBALE, TYPE.LOG, TYPE.PIPE, TYPE.ROCK, TYPE.SCARECROW];
      // PIPE only spawns alone in its lane to be clearable by sliding without
      // surprises (no double-stack).
      const t = types[Math.floor(this._rng() * types.length)];
      this._spawnOne(t, li, x, z);
    }
    // Fill at least one un-occupied lane with coins
    const free = all;
    if (free.length > 0) {
      const coinLane = free[Math.floor(this._rng() * free.length)];
      this._spawnOne(TYPE.COIN, coinLane, LANES[coinLane], z);
    }
  }

  _spawnCoinTrain(z) {
    const li = Math.floor(this._rng() * 3);
    const x = LANES[li];
    for (let i = 0; i < 5; i++) {
      this._spawnOne(TYPE.COIN, li, x, z + i * 1.0);
    }
  }

  _spawnPowerup(z) {
    const li = Math.floor(this._rng() * 3);
    const x = LANES[li];
    const r = this._rng();
    let t;
    if (r < 0.4) t = TYPE.PU_MAGNET;
    else if (r < 0.75) t = TYPE.PU_SHIELD;
    else t = TYPE.PU_DOUBLE;
    this._spawnOne(t, li, x, z);
  }

  _spawnOne(type, lane, x, z) {
    let mesh, hitbox, blocks;
    switch (type) {
      case TYPE.HAYBALE:
        mesh = this._makeHaybale();
        hitbox = { halfX: 0.55, halfY: 0.5, halfZ: 0.55, cy: 0.5 };
        blocks = "low";
        break;
      case TYPE.LOG:
        mesh = this._makeLog();
        hitbox = { halfX: 0.7, halfY: 0.4, halfZ: 0.4, cy: 0.4 };
        blocks = "low";
        break;
      case TYPE.ROCK:
        mesh = this._makeRock();
        // Lower hitbox so jumping clears it cleanly
        hitbox = { halfX: 0.55, halfY: 0.45, halfZ: 0.55, cy: 0.45 };
        blocks = "low";
        break;
      case TYPE.PIPE:
        mesh = this._makePipe();
        // Hitbox is the horizontal pipe at head height
        hitbox = { halfX: 0.85, halfY: 0.25, halfZ: 0.25, cy: 1.85 };
        blocks = "high";
        break;
      case TYPE.SCARECROW:
        mesh = this._makeScarecrow();
        hitbox = { halfX: 0.5, halfY: 1.0, halfZ: 0.5, cy: 1.0 };
        blocks = "all";
        break;
      case TYPE.COIN:
        mesh = this._makeCoin();
        hitbox = { halfX: 0.32, halfY: 0.32, halfZ: 0.32, cy: 1.0 };
        blocks = null;
        break;
      case TYPE.PU_MAGNET:
        mesh = this._makePowerup(PALETTE.magnet);
        hitbox = { halfX: 0.45, halfY: 0.45, halfZ: 0.45, cy: 1.1 };
        blocks = null;
        break;
      case TYPE.PU_SHIELD:
        mesh = this._makePowerup(PALETTE.shield);
        hitbox = { halfX: 0.45, halfY: 0.45, halfZ: 0.45, cy: 1.1 };
        blocks = null;
        break;
      case TYPE.PU_DOUBLE:
        mesh = this._makePowerup(PALETTE.double);
        hitbox = { halfX: 0.45, halfY: 0.45, halfZ: 0.45, cy: 1.1 };
        blocks = null;
        break;
    }
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.spawns.push(new Spawn(type, mesh, lane, z, hitbox, blocks));
  }

  /** Make sure we have spawns covering up to (camZ + SPAWN_AHEAD). */
  update(dt, camZ) {
    // Spawn ahead
    while (this.lastSpawnZ < camZ + SPAWN_AHEAD) {
      this._spawnRow(this.lastSpawnZ);
      this.lastSpawnZ += SPAWN_INTERVAL;
    }
    // Despawn behind + animate
    const keep = [];
    for (const s of this.spawns) {
      if (s.collected || s.z < camZ - DESPAWN_BEHIND) {
        this.scene.remove(s.mesh);
      } else {
        keep.push(s);
        if (s.mesh.userData.spin) {
          s.mesh.rotation.y += dt * 3;
          s.mesh.position.y = s.hitbox.cy + Math.sin(performance.now() * 0.004 + s.z) * 0.08;
        }
      }
    }
    this.spawns = keep;
  }
}

export { TYPE };
