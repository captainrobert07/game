import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

/**
 * FBX Hanna — wraps a loaded FBX model behind the same interface as the
 * procedural Hanna in hanna.js (group, setPosition, setState, update,
 * setShield, setDouble) so game.js doesn't care which is in use.
 *
 * Animation strategy:
 *   - If the FBX ships with named animation clips, we map them to states.
 *   - If not (this model is likely T-pose only), we apply procedural
 *     transforms to the *root* group: lean forward when running, drop & tilt
 *     when sliding, hop offset when jumping. It's not a real run cycle, but
 *     it reads correctly from the camera's distance.
 */
export class HannaFBX {
  constructor(fbxRoot) {
    // Wrap so we can position/scale freely without touching the imported root
    this.group = new THREE.Group();
    this.group.name = "Hanna";

    // The model from Mixamo / many stock packs is enormous (~100 units tall).
    // Auto-fit to ~2 units high so it matches our world scale.
    const tmpBox = new THREE.Box3().setFromObject(fbxRoot);
    const size = new THREE.Vector3();
    tmpBox.getSize(size);
    const targetHeight = 2.4; // game-world meters — slightly tall for presence
    const scale = targetHeight / Math.max(0.01, size.y);
    fbxRoot.scale.setScalar(scale);

    // Re-measure to ground the feet at y=0
    const groundedBox = new THREE.Box3().setFromObject(fbxRoot);
    fbxRoot.position.y -= groundedBox.min.y;

    // Many FBX models face -Z by default; our world has Hanna run toward +Z.
    fbxRoot.rotation.y = Math.PI;

    // Enable shadows on every mesh
    fbxRoot.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
        // The model may use MeshPhong; convert to a toon-like look so it
        // matches our stylized world. Comment this out if you want the model's
        // original shading.
        if (c.material) {
          // Some FBX exports give arrays of materials per submesh
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          for (const m of mats) {
            if (m.map) {
              m.map.anisotropy = 4;
              m.map.colorSpace = THREE.SRGBColorSpace;
            }
          }
        }
      }
    });

    // Body root for procedural transforms
    this.body = new THREE.Group();
    this.body.add(fbxRoot);
    this.group.add(this.body);

    // Soft fake shadow disc under the feet
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 24),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    this.shadow = shadow;
    this.group.add(shadow);

    // Powerup auras — match the procedural version's API
    this.shieldAura = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 18, 18),
      new THREE.MeshBasicMaterial({
        color: 0x55aaff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    this.shieldAura.position.y = 1.2;
    this.body.add(this.shieldAura);

    this.doubleRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.05, 6, 24),
      new THREE.MeshBasicMaterial({
        color: 0xff66ff,
        transparent: true,
        opacity: 0,
      })
    );
    this.doubleRing.rotation.x = -Math.PI / 2;
    this.doubleRing.position.y = 0.03;
    this.group.add(this.doubleRing);

    // Set up animation mixer if any clips came with the FBX
    this.mixer = new THREE.AnimationMixer(fbxRoot);
    this.actions = {};
    if (fbxRoot.animations && fbxRoot.animations.length > 0) {
      for (const clip of fbxRoot.animations) {
        this.actions[clip.name.toLowerCase()] = this.mixer.clipAction(clip);
      }
      // Try common name guesses for our 4 states
      this.runAction = this._findAction(["run", "running", "walk"]);
      this.jumpAction = this._findAction(["jump", "jumping"]);
      this.slideAction = this._findAction(["slide", "sliding", "crouch"]);
      this.hitAction = this._findAction(["hit", "stumble", "death", "fall"]);
      this.idleAction = this._findAction(["idle", "tpose", "rest"]) || this.runAction;
      if (this.idleAction) this.idleAction.play();
    }

    this.t = 0;
    this.state = "run";
    this.prevState = "run";
    this.stateTime = 0;
    this._shieldActive = false;
    this._doubleActive = false;
  }

  _findAction(candidates) {
    for (const name of candidates) {
      if (this.actions[name]) return this.actions[name];
    }
    // Fuzzy: any clip whose name contains one of these substrings
    for (const name of candidates) {
      for (const key of Object.keys(this.actions)) {
        if (key.includes(name)) return this.actions[key];
      }
    }
    return null;
  }

  setPosition(x, y, z) {
    this.group.position.set(x, y, z);
  }

  setState(s) {
    if (s === this.state) return;
    this.prevState = this.state;
    this.state = s;
    this.stateTime = 0;

    // Cross-fade animation actions if available
    if (this.mixer) {
      const next = this._actionForState(s);
      const prev = this._actionForState(this.prevState);
      if (next && next !== prev) {
        next.reset();
        next.play();
        if (prev) prev.fadeOut(0.15);
        next.fadeIn(0.15);
      }
    }
  }

  _actionForState(s) {
    if (s === "run") return this.runAction || this.idleAction;
    if (s === "jump") return this.jumpAction || this.runAction || this.idleAction;
    if (s === "slide") return this.slideAction || this.runAction || this.idleAction;
    if (s === "hit") return this.hitAction || this.idleAction;
    return this.idleAction;
  }

  setShield(active) { this._shieldActive = active; }
  setDouble(active) { this._doubleActive = active; }

  update(dt) {
    this.t += dt;
    this.stateTime += dt;
    if (this.mixer) this.mixer.update(dt);

    // Procedural state pose — applied ON TOP of any animation. If the model
    // has no animations, this is the entire visual difference between states.
    if (this.state === "run") {
      // Slight forward lean + bouncy bob
      this.body.rotation.x = 0.08;
      this.body.position.y = Math.abs(Math.sin(this.t * 9)) * 0.08;
    } else if (this.state === "jump") {
      // Tucked posture (tilt forward, no extra bob — gravity drives Y)
      this.body.rotation.x = 0.18;
      this.body.position.y = 0;
    } else if (this.state === "slide") {
      // Drop and tilt back like she's leaning into a slide
      const t = Math.min(1, this.stateTime * 6);
      this.body.rotation.x = -0.6 * t;
      this.body.position.y = -0.3 * t;
    } else if (this.state === "hit") {
      this.body.rotation.x = -0.4 * Math.sin(this.t * 14);
      this.body.rotation.z = 0.2 * Math.sin(this.t * 10);
    } else {
      this.body.rotation.x *= 0.9;
      this.body.position.y = Math.sin(this.t * 2) * 0.03;
    }

    // Auras
    const targetShield = this._shieldActive ? 0.25 + Math.sin(this.t * 6) * 0.05 : 0;
    this.shieldAura.material.opacity += (targetShield - this.shieldAura.material.opacity) * 0.2;
    const targetDouble = this._doubleActive ? 0.7 + Math.sin(this.t * 8) * 0.2 : 0;
    this.doubleRing.material.opacity += (targetDouble - this.doubleRing.material.opacity) * 0.2;
    this.doubleRing.scale.setScalar(1 + Math.sin(this.t * 6) * 0.08);
  }
}

/**
 * Try to load the FBX. Returns a Promise resolving to a HannaFBX instance,
 * or rejects so game.js can fall back to the procedural Hanna.
 */
export function loadHannaFBX(url = "models/hanna/hanna.fbx") {
  return new Promise((resolve, reject) => {
    const loader = new FBXLoader();
    loader.load(
      url,
      (fbx) => {
        try {
          resolve(new HannaFBX(fbx));
        } catch (err) {
          reject(err);
        }
      },
      undefined,
      (err) => reject(err)
    );
  });
}
