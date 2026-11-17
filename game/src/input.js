// Neon Void — keyboard and mouse state. The game polls this every frame
// instead of reacting to events, which keeps movement smooth and lets the
// autopilot used for screenshots drive the same interface.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 480, y: 270, down: false };
    this.clicked = null; // {x, y} for one frame after a click lands
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      this.lastKey = e.code;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });

    canvas.addEventListener('mousemove', (e) => this.setMouse(e));
    canvas.addEventListener('mousedown', (e) => {
      this.setMouse(e);
      this.mouse.down = true;
      this.clicked = { x: this.mouse.x, y: this.mouse.y };
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
  }

  setMouse(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.mouse.x = (event.clientX - rect.left) * scaleX;
    this.mouse.y = (event.clientY - rect.top) * scaleY;
  }

  down(...codes) {
    return codes.some((code) => this.keys.has(code));
  }

  axisX() {
    return (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
  }

  axisY() {
    return (this.down('KeyS', 'ArrowDown') ? 1 : 0) - (this.down('KeyW', 'ArrowUp') ? 1 : 0);
  }

  consumeClick() {
    const click = this.clicked;
    this.clicked = null;
    return click;
  }

  consumeKey() {
    const key = this.lastKey;
    this.lastKey = null;
    return key;
  }
}
