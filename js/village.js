import * as THREE from "three";

const TILE = 2;
const GRID = 16; // 16x16 grid of tiles, ~32x32 units
const HALF = (GRID * TILE) / 2;

const PALETTE = {
  grassA: 0x82c267,
  grassB: 0x6fb058,
  dirt: 0x8b5a2b,
  stone: 0x8a8a8a,
  trunk: 0x6b3e20,
  leaves: 0x3fa34d,
  leavesDark: 0x2c7a37,
  water: 0x4ca6e0,
  flower: 0xffd96b,
  roof: 0xc94c3a,
  wall: 0xfff3d6,
  wood: 0x8b5a2b,
  hay: 0xe8c87a,
};

function toon(color) {
  return new THREE.MeshToonMaterial({ color });
}

/**
 * The world: ground, decorations, and placed buildings on a grid.
 */
export class Village {
  constructor() {
    this.group = new THREE.Group();
    this.tile = TILE;
    this.grid = GRID;
    this.half = HALF;

    // Track what occupies each tile: null | "tree" | "rock" | "farm" | "house" | "well"
    this.cells = Array.from({ length: GRID }, () => new Array(GRID).fill(null));
    this.tileMeshes = Array.from({ length: GRID }, () => new Array(GRID).fill(null));

    // Buildings keyed by `${gx},${gz}` so save/load can rebuild
    this.buildings = new Map();

    this._buildGround();
    this._scatterDecor();
    this._buildBorder();

    // Hover highlight tile
    const hi = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE * 0.92, TILE * 0.92),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
      })
    );
    hi.rotation.x = -Math.PI / 2;
    hi.position.y = 0.05;
    hi.visible = false;
    this.hover = hi;
    this.group.add(hi);
  }

  _buildGround() {
    // Single big plane plus a checker overlay for tile feel
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(GRID * TILE, GRID * TILE, GRID, GRID),
      toon(PALETTE.grassA)
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Per-tile color variation using vertex colors
    const colors = [];
    const c1 = new THREE.Color(PALETTE.grassA);
    const c2 = new THREE.Color(PALETTE.grassB);
    const pos = ground.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const useB = Math.random() < 0.45;
      const c = useB ? c2 : c1;
      colors.push(c.r, c.g, c.b);
    }
    ground.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );
    ground.material = new THREE.MeshToonMaterial({ vertexColors: true });

    // Picking tiles (invisible, used for raycast)
    const tileGeom = new THREE.PlaneGeometry(TILE, TILE);
    const tileMat = new THREE.MeshBasicMaterial({
      visible: false,
    });
    for (let gx = 0; gx < GRID; gx++) {
      for (let gz = 0; gz < GRID; gz++) {
        const tile = new THREE.Mesh(tileGeom, tileMat);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(this._tileX(gx), 0.02, this._tileZ(gz));
        tile.userData = { gx, gz, isTile: true };
        this.tileMeshes[gx][gz] = tile;
        this.group.add(tile);
      }
    }
  }

  _scatterDecor() {
    // Randomly place trees, rocks, flowers — never on the center spawn tile
    const center = Math.floor(GRID / 2);
    for (let gx = 0; gx < GRID; gx++) {
      for (let gz = 0; gz < GRID; gz++) {
        if (Math.abs(gx - center) <= 1 && Math.abs(gz - center) <= 1) continue;
        const r = Math.random();
        if (r < 0.08) this._placeTree(gx, gz);
        else if (r < 0.11) this._placeRock(gx, gz);
        else if (r < 0.18) this._placeFlowers(gx, gz);
      }
    }
  }

  _buildBorder() {
    // A ring of taller hills/trees around the playable area for charm
    const ringR = HALF + 3;
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const x = Math.cos(a) * (ringR + (Math.random() - 0.5) * 1.5);
      const z = Math.sin(a) * (ringR + (Math.random() - 0.5) * 1.5);
      const tree = this._makeTree(0.8 + Math.random() * 0.4);
      tree.position.set(x, 0, z);
      this.group.add(tree);
    }
  }

  _tileX(gx) {
    return gx * TILE - HALF + TILE / 2;
  }
  _tileZ(gz) {
    return gz * TILE - HALF + TILE / 2;
  }

  _makeTree(scale = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.8, 8),
      toon(PALETTE.trunk)
    );
    trunk.position.y = 0.4;
    trunk.castShadow = true;
    g.add(trunk);
    const leaf1 = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55, 0),
      toon(PALETTE.leaves)
    );
    leaf1.position.y = 1.1;
    leaf1.castShadow = true;
    g.add(leaf1);
    const leaf2 = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.4, 0),
      toon(PALETTE.leavesDark)
    );
    leaf2.position.set(0.2, 1.45, 0);
    leaf2.castShadow = true;
    g.add(leaf2);
    g.scale.setScalar(scale);
    return g;
  }

  _makeRock() {
    const g = new THREE.Group();
    const r = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.35, 0),
      toon(PALETTE.stone)
    );
    r.position.y = 0.25;
    r.castShadow = true;
    g.add(r);
    return g;
  }

  _makeFlowers() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6),
        toon(0x4caf50)
      );
      stem.position.set((Math.random() - 0.5) * 0.6, 0.13, (Math.random() - 0.5) * 0.6);
      g.add(stem);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 8),
        toon(Math.random() < 0.5 ? PALETTE.flower : 0xff8a8a)
      );
      head.position.copy(stem.position);
      head.position.y = 0.3;
      g.add(head);
    }
    return g;
  }

  _placeTree(gx, gz) {
    const tree = this._makeTree();
    tree.position.set(this._tileX(gx), 0, this._tileZ(gz));
    tree.userData = { kind: "tree", gx, gz };
    this.group.add(tree);
    this.cells[gx][gz] = "tree";
    this.buildings.set(`${gx},${gz}`, { kind: "tree", mesh: tree });
  }

  _placeRock(gx, gz) {
    const rock = this._makeRock();
    rock.position.set(this._tileX(gx), 0, this._tileZ(gz));
    rock.userData = { kind: "rock", gx, gz };
    this.group.add(rock);
    this.cells[gx][gz] = "rock";
    this.buildings.set(`${gx},${gz}`, { kind: "rock", mesh: rock });
  }

  _placeFlowers(gx, gz) {
    const f = this._makeFlowers();
    f.position.set(this._tileX(gx), 0, this._tileZ(gz));
    this.group.add(f);
    // Flowers are decorative — leave the cell free for building
  }

  // ---------- Buildings ----------
  makeFarm() {
    const g = new THREE.Group();
    const field = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.1, 1.7),
      toon(PALETTE.dirt)
    );
    field.position.y = 0.05;
    field.castShadow = true;
    field.receiveShadow = true;
    g.add(field);
    // Crop rows
    for (let i = -2; i <= 2; i++) {
      const row = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.18, 0.18),
        toon(PALETTE.hay)
      );
      row.position.set(0, 0.18, i * 0.3);
      g.add(row);
    }
    // Scarecrow
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6),
      toon(PALETTE.trunk)
    );
    pole.position.set(0.6, 0.5, 0.6);
    g.add(pole);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      toon(PALETTE.hay)
    );
    head.position.set(0.6, 0.95, 0.6);
    g.add(head);
    return g;
  }

  makeHouse() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1, 1.4),
      toon(PALETTE.wall)
    );
    wall.position.y = 0.5;
    wall.castShadow = true;
    g.add(wall);
    // Wood beams
    for (const x of [-0.7, 0.7]) {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 1, 0.08),
        toon(PALETTE.wood)
      );
      beam.position.set(x, 0.5, 0.71);
      g.add(beam);
    }
    // Roof
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 0.7, 4),
      toon(PALETTE.roof)
    );
    roof.position.y = 1.35;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);
    // Door
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.5, 0.05),
      toon(PALETTE.wood)
    );
    door.position.set(0, 0.25, 0.71);
    g.add(door);
    // Chimney
    const chim = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.4, 0.2),
      toon(PALETTE.stone)
    );
    chim.position.set(0.4, 1.45, 0.0);
    g.add(chim);
    return g;
  }

  makeWell() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.55, 0.5, 12),
      toon(PALETTE.stone)
    );
    base.position.y = 0.25;
    base.castShadow = true;
    g.add(base);
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12),
      toon(PALETTE.water)
    );
    water.position.y = 0.48;
    g.add(water);
    // Roof posts
    for (const x of [-0.45, 0.45]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1, 6),
        toon(PALETTE.wood)
      );
      post.position.set(x, 1, 0);
      g.add(post);
    }
    // Mini roof
    const r = new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 0.4, 4),
      toon(PALETTE.roof)
    );
    r.position.y = 1.65;
    r.rotation.y = Math.PI / 4;
    g.add(r);
    return g;
  }

  /** Try to place a building at grid (gx, gz). Returns the mesh or null. */
  place(kind, gx, gz) {
    if (gx < 0 || gz < 0 || gx >= GRID || gz >= GRID) return null;
    if (this.cells[gx][gz]) return null;
    let mesh;
    if (kind === "farm") mesh = this.makeFarm();
    else if (kind === "house") mesh = this.makeHouse();
    else if (kind === "well") mesh = this.makeWell();
    else if (kind === "tree") mesh = this._makeTree();
    else return null;
    mesh.position.set(this._tileX(gx), 0, this._tileZ(gz));
    mesh.userData = { kind, gx, gz };
    mesh.traverse((c) => {
      if (c.isMesh) c.castShadow = true;
    });
    this.group.add(mesh);
    this.cells[gx][gz] = kind;
    this.buildings.set(`${gx},${gz}`, { kind, mesh });
    return mesh;
  }

  /** Remove whatever is at a tile (used when chopping a tree). */
  remove(gx, gz) {
    const key = `${gx},${gz}`;
    const b = this.buildings.get(key);
    if (!b) return null;
    this.group.remove(b.mesh);
    this.buildings.delete(key);
    this.cells[gx][gz] = null;
    return b.kind;
  }

  /** Build state suitable for save/load. */
  serialize() {
    const arr = [];
    for (const [key, b] of this.buildings.entries()) {
      const [gx, gz] = key.split(",").map(Number);
      arr.push({ gx, gz, kind: b.kind });
    }
    return arr;
  }

  /** Replace world state from serialized data. */
  rebuild(data) {
    // Wipe current placements (keep ground/border decor)
    for (const [, b] of this.buildings) {
      this.group.remove(b.mesh);
    }
    this.buildings.clear();
    this.cells = Array.from({ length: GRID }, () => new Array(GRID).fill(null));
    for (const { gx, gz, kind } of data) {
      this.place(kind, gx, gz);
    }
  }

  /** Convert world position to grid coords. */
  worldToGrid(x, z) {
    const gx = Math.floor((x + HALF) / TILE);
    const gz = Math.floor((z + HALF) / TILE);
    return { gx, gz };
  }

  /** All tile meshes flat — for raycast. */
  getPickables() {
    const out = [];
    for (let gx = 0; gx < GRID; gx++) {
      for (let gz = 0; gz < GRID; gz++) {
        out.push(this.tileMeshes[gx][gz]);
      }
    }
    for (const b of this.buildings.values()) {
      out.push(b.mesh);
    }
    return out;
  }

  showHover(gx, gz) {
    if (gx < 0 || gz < 0 || gx >= GRID || gz >= GRID) {
      this.hover.visible = false;
      return;
    }
    this.hover.visible = true;
    this.hover.position.set(this._tileX(gx), 0.05, this._tileZ(gz));
    const free = !this.cells[gx][gz];
    this.hover.material.color.set(free ? 0xffffff : 0xff6b6b);
  }

  hideHover() {
    this.hover.visible = false;
  }
}
