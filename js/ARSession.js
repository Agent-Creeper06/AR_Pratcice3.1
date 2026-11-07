// Жизненный цикл WebXR-сессии и hit-test.
// События в шину: ar:start, ar:end, ar:hit (bool), ar:select, ar:error (текст).
export class ARSession {
  constructor({ renderer, scene, bus, reticle, overlayRoot }) {
    this.renderer = renderer;
    this.bus = bus;
    this.reticle = reticle;
    this.overlayRoot = overlayRoot;
    this.hitTestSource = null;
    this._lastVisible = null;

    // тап по экрану в AR = событие select
    this.controller = renderer.xr.getController(0);
    this.controller.addEventListener('select', () => bus.emit('ar:select'));
    scene.add(this.controller);

    renderer.xr.addEventListener('sessionstart', () => this._onStart());
    renderer.xr.addEventListener('sessionend', () => this._onEnd());
  }

  async checkSupport() {
    if (!window.isSecureContext) {
      return { ok: false, reason: 'Нужен HTTPS (или localhost). Откройте страницу по https://' };
    }
    if (!('xr' in navigator)) {
      return { ok: false, reason: 'WebXR недоступен в этом браузере. Нужен Chrome на Android или WebXR Emulator.' };
    }
    try {
      const ok = await navigator.xr.isSessionSupported('immersive-ar');
      return ok
        ? { ok: true }
        : { ok: false, reason: 'Режим immersive-ar не поддерживается. Нужен Android с ARCore и Chrome, либо WebXR Emulator.' };
    } catch (e) {
      return { ok: false, reason: 'Ошибка проверки WebXR: ' + e.message };
    }
  }

  // Вызывать прямо из обработчика клика (требование браузера)
  async start() {
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['local-floor', 'dom-overlay'],
      domOverlay: { root: this.overlayRoot }
    });
    await this.renderer.xr.setSession(session);
  }

  end() {
    this.renderer.xr.getSession()?.end();
  }

  async _onStart() {
    const session = this.renderer.xr.getSession();
    this.bus.emit('ar:start');
    try {
      const viewerSpace = await session.requestReferenceSpace('viewer');
      this.hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
    } catch (e) {
      console.error('Hit-test недоступен:', e);
      this.bus.emit('ar:error', 'Hit-test недоступен на этом устройстве');
    }
  }

  _onEnd() {
    this.hitTestSource?.cancel();
    this.hitTestSource = null;
    this.reticle.hide();
    this._lastVisible = null;
    this.bus.emit('ar:end');
  }

  // Вызывать каждый кадр
  update(frame) {
    if (!frame || !this.hitTestSource) return;

    const referenceSpace = this.renderer.xr.getReferenceSpace();
    const results = frame.getHitTestResults(this.hitTestSource);
    const pose = results.length ? results[0].getPose(referenceSpace) : null;

    if (pose) this.reticle.setPose(pose.transform.matrix);
    else this.reticle.hide();

    if (this.reticle.visible !== this._lastVisible) {
      this._lastVisible = this.reticle.visible;
      this.bus.emit('ar:hit', this.reticle.visible);
    }
  }
}
