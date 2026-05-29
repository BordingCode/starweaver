// Single-pointer input mapped to world coords. Drag-to-move with the ship floating
// ABOVE the finger (so the thumb never hides it). Exposes a simple polled state.
export class Input {
  constructor(canvas, view) {
    this.view = view;
    this.active = false;        // finger/mouse down on the play field
    this.x = 0; this.y = 0;     // current pointer world pos
    this.dx = 0; this.dy = 0;   // delta since last frame (world units)
    this._px = 0; this._py = 0;
    this._moved = 0;            // accumulated movement magnitude this frame
    this.justDown = false;

    const onDown = (e) => {
      // ignore taps that originate on UI buttons (they have pointer-events)
      if (e.target && e.target.closest && e.target.closest('.spell-btn, .btn, .card, .mute-btn')) return;
      this.active = true;
      this.justDown = true;
      const p = view.toWorld(e.clientX, e.clientY);
      this.x = p.x; this.y = p.y; this._px = p.x; this._py = p.y;
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!this.active) return;
      const p = view.toWorld(e.clientX, e.clientY);
      this.x = p.x; this.y = p.y;
      e.preventDefault();
    };
    const onUp = () => { this.active = false; };

    canvas.addEventListener('pointerdown', onDown, { passive: false });
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  // called once per sim step to compute deltas; returns movement magnitude
  consume() {
    this.dx = this.x - this._px;
    this.dy = this.y - this._py;
    this._px = this.x; this._py = this.y;
    const m = Math.hypot(this.dx, this.dy);
    this.justDown = false;
    return m;
  }
}
