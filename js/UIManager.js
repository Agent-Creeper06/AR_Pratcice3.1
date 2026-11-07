// HTML-интерфейс. Ничего не знает о Three.js: только показывает состояние
// и отправляет события в шину (ui:*).
//
// В AR выбор модели/HDRI сделан кнопками, а не <select>: нативный выпадающий список
// может не открываться поверх AR-сессии.

// Нажатия на интерфейс не должны ставить объект в AR
function blockXRSelect(el) {
  el.addEventListener('beforexrselect', (e) => e.preventDefault());
}

export class UIManager {
  constructor(bus) {
    this.bus = bus;
    this.el = {};
    [
      'start', 'status', 'startBtn', 'overlay', 'hint', 'panel', 'togglePanel',
      'modelChips', 'colorChips', 'envChips', 'rotL', 'rotR', 'yaw', 'spin',
      'rough', 'metal', 'scale', 'resetMat', 'clearBtn', 'exitBtn'
    ].forEach((id) => { this.el[id] = document.getElementById(id); });
    this._bindStatic();
  }

  get overlayRoot() { return this.el.overlay; }

  // ---------- построение списков из конфига ----------

  buildControls({ models, environments, colors }) {
    this._fillChips(this.el.modelChips,
      models.map((m) => ({ id: m.id, label: m.label })),
      (id) => this.bus.emit('ui:model', id));

    this._fillChips(this.el.envChips,
      environments.map((e) => ({ id: e.id, label: e.label })),
      (id) => this.bus.emit('ui:env', id));

    const colorItems = [
      { id: '', label: 'Исходный' },
      ...colors.map((c) => ({ id: c.hex, label: c.label, color: c.hex }))
    ];
    this._fillChips(this.el.colorChips, colorItems, (id) => this.bus.emit('ui:color', id || null));
  }

  _fillChips(container, items, onPick) {
    container.textContent = '';
    for (const item of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.id = item.id;
      if (item.color) {
        b.classList.add('swatch');
        b.style.background = item.color;
        b.title = item.label;
        b.setAttribute('aria-label', item.label);
      } else {
        b.textContent = item.label;
      }
      b.addEventListener('click', () => onPick(item.id));
      container.appendChild(b);
    }
  }

  _setActive(container, id) {
    const value = id ?? '';
    for (const b of container.children) b.classList.toggle('active', b.dataset.id === value);
  }

  // ---------- статические элементы ----------

  _bindStatic() {
    const { bus, el } = this;

    blockXRSelect(el.panel);
    blockXRSelect(el.togglePanel);

    el.startBtn.addEventListener('click', () => bus.emit('ui:start'));
    el.exitBtn.addEventListener('click', () => bus.emit('ui:exit'));
    el.clearBtn.addEventListener('click', () => bus.emit('ui:clear'));
    el.resetMat.addEventListener('click', () => bus.emit('ui:resetMaterial'));

    el.togglePanel.addEventListener('click', () => {
      const collapsed = el.panel.classList.toggle('collapsed');
      el.togglePanel.textContent = collapsed ? '⚙ Настройки' : '✕ Скрыть';
    });

    el.rotL.addEventListener('click', () => bus.emit('ui:rotate', -15));
    el.rotR.addEventListener('click', () => bus.emit('ui:rotate', 15));
    el.spin.addEventListener('click', () => {
      const on = el.spin.classList.toggle('active');
      bus.emit('ui:spin', on);
    });

    el.yaw.addEventListener('input', () => bus.emit('ui:yaw', parseFloat(el.yaw.value)));
    el.rough.addEventListener('input', () => bus.emit('ui:roughness', parseFloat(el.rough.value)));
    el.metal.addEventListener('input', () => bus.emit('ui:metalness', parseFloat(el.metal.value)));
    el.scale.addEventListener('input', () => bus.emit('ui:scale', parseFloat(el.scale.value)));
  }

  // ---------- состояние интерфейса ----------

  showAR(on) {
    this.el.overlay.style.display = on ? 'block' : 'none';
    this.el.start.style.display = on ? 'none' : 'flex';
  }

  setStatus(text) { this.el.status.textContent = text; }
  setStartEnabled(on) { this.el.startBtn.disabled = !on; }
  setHint(text) { this.el.hint.textContent = text; }

  setActiveModel(id) { this._setActive(this.el.modelChips, id); }
  setActiveEnv(id) { this._setActive(this.el.envChips, id); }
  setActiveColor(hex) { this._setActive(this.el.colorChips, hex); }

  setYaw(deg) { this.el.yaw.value = deg; }
  setScale(v) { this.el.scale.value = v; }
  setSpin(on) { this.el.spin.classList.toggle('active', on); }
  setMaterialValues({ roughness, metalness }) {
    this.el.rough.value = roughness;
    this.el.metal.value = metalness;
  }
}
