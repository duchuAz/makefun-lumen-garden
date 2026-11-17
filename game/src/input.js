// Keyboard and mouse input. Held keys give a movement axis; one-shot presses are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost and never
// counted twice. Shift is a dash, Space or a left click sends a pulse, Enter confirms, P pauses,
// M mutes.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_DASH = 8;
export const ACTION_PULSE = 16;
export const ACTION_CLICK = 32;

const MOVEMENT = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
};

const DASH = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Enter', 'NumpadEnter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const PULSE = new Set(['Space']);

export function createInput(target) {
  const held = { left: false, right: false, up: false, down: false };
  let actions = 0;
  const pointer = { x: 0, y: 0, inside: false };

  function onKeyDown(event) {
    const move = MOVEMENT[event.code];
    if (move) {
      held[move] = true;
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (DASH.has(event.code)) actions |= ACTION_DASH;
    else if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (PULSE.has(event.code)) actions |= ACTION_PULSE;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else return;
    event.preventDefault();
  }

  function onKeyUp(event) {
    const move = MOVEMENT[event.code];
    if (!move) return;
    held[move] = false;
    event.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.left = false;
    held.right = false;
    held.up = false;
    held.down = false;
  });

  target.addEventListener('pointerdown', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.inside = true;
    actions |= ACTION_CLICK;
    event.preventDefault();
  });
  target.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });

  return {
    /** The movement axis: x and y each -1, 0 or 1, normalised when both are held. */
    axis() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x !== 0 && y !== 0) return { x: x * 0.7071, y: y * 0.7071 };
      return { x, y };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    pointer,
  };
}
