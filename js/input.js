/**
 * Unified input. Emits 4 actions: left, right, jump, slide.
 * Keyboard + touch swipes + tap zones.
 */

export class Input {
  constructor() {
    this.handlers = { left: [], right: [], jump: [], slide: [], pause: [] };
    this._wireKeyboard();
    this._wireTouch();
  }

  on(action, fn) {
    this.handlers[action]?.push(fn);
  }

  _emit(action) {
    for (const fn of this.handlers[action] || []) fn();
  }

  _wireKeyboard() {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      switch (e.key) {
        case "a":
        case "A":
        case "ArrowLeft":
          this._emit("left");
          break;
        case "d":
        case "D":
        case "ArrowRight":
          this._emit("right");
          break;
        case "w":
        case "W":
        case "ArrowUp":
        case " ":
          this._emit("jump");
          e.preventDefault();
          break;
        case "s":
        case "S":
        case "ArrowDown":
          this._emit("slide");
          break;
        case "p":
        case "P":
        case "Escape":
          this._emit("pause");
          break;
      }
    });
  }

  _wireTouch() {
    // Swipe detection
    let startX = 0,
      startY = 0,
      startT = 0,
      tracking = false;
    const SWIPE_MIN = 30; // px

    window.addEventListener(
      "touchstart",
      (e) => {
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        startT = performance.now();
        tracking = true;
      },
      { passive: true }
    );

    window.addEventListener(
      "touchend",
      (e) => {
        if (!tracking) return;
        tracking = false;
        const t = e.changedTouches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        const elapsed = performance.now() - startT;
        if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
        if (elapsed > 600) return; // too slow to be a swipe
        if (Math.abs(dx) > Math.abs(dy)) {
          this._emit(dx > 0 ? "right" : "left");
        } else {
          this._emit(dy > 0 ? "slide" : "jump");
        }
      },
      { passive: true }
    );

    // Tap zones (corner buttons on touch UI)
    document.querySelectorAll(".touch-zone").forEach((el) => {
      el.addEventListener("touchstart", (e) => {
        e.preventDefault();
        this._emit(el.dataset.action);
      });
      el.addEventListener("click", () => this._emit(el.dataset.action));
    });

    // Show touch UI on touch devices
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
      document.body.classList.add("touch");
    }
  }
}
