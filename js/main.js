import * as THREE from 'three';
import { EventBus } from './EventBus.js';
import { DEFAULTS, MODELS, ENVIRONMENTS, COLORS } from './config.js';
import { UIManager } from './UIManager.js';
import { EnvironmentManager } from './EnvironmentManager.js';
import { ModelLoader } from './ModelLoader.js';
import { ObjectController } from './ObjectController.js';
import { Reticle } from './Reticle.js';
import { ARSession } from './ARSession.js';

const _pos = new THREE.Vector3();
const _cam = new THREE.Vector3();

class App {
  constructor() {
    this.bus = new EventBus();
    this.ui = new UIManager(this.bus);
    this.clock = new THREE.Clock();
    this.hitVisible = false;
    this.currentModelId = null;
    this._flashTimer = null;

    this._initThree();
    this._initModules();
    this._bindEvents();
  }

  _initThree() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;   // PBR + HDRI выглядят естественнее
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType('local-floor');
    document.body.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _initModules() {
    this.env = new EnvironmentManager(this.renderer, this.scene);
    this.models = new ModelLoader();
    this.objects = new ObjectController({ scene: this.scene, modelLoader: this.models });
    this.reticle = new Reticle(this.scene);
    this.ar = new ARSession({
      renderer: this.renderer,
      scene: this.scene,
      bus: this.bus,
      reticle: this.reticle,
      overlayRoot: this.ui.overlayRoot
    });
  }

  // ---------- обработка событий ----------

  _bindEvents() {
    const { bus, ui, objects } = this;

    // запуск / выход
    bus.on('ui:start', () => {
      this.ar.start().catch((e) => {
        console.error(e);
        ui.setStatus('Не удалось запустить AR: ' + e.message);
      });
    });
    bus.on('ui:exit', () => this.ar.end());

    // события AR
    bus.on('ar:start', () => { ui.showAR(true); this._updateHint(); });
    bus.on('ar:end', () => {
      ui.showAR(false);
      objects.clear();
      this.hitVisible = false;
      this._resetTransformUi();
    });
    bus.on('ar:hit', (visible) => { this.hitVisible = visible; this._updateHint(); });
    bus.on('ar:select', () => this._placeObject());
    bus.on('ar:error', (text) => this._flash(text));

    // управление объектом
    bus.on('ui:model', (id) => this._changeModel(id));
    bus.on('ui:env', (id) => this._changeEnvironment(id));
    bus.on('ui:color', (hex) => { objects.setColor(hex); ui.setActiveColor(hex); });
    bus.on('ui:rotate', (deg) => { objects.rotateBy(deg); ui.setYaw(objects.getYawDeg()); });
    bus.on('ui:yaw', (deg) => objects.setYaw(deg));
    bus.on('ui:spin', (on) => {
      objects.setAutoSpin(on);
      if (!on) ui.setYaw(objects.getYawDeg());
    });
    bus.on('ui:roughness', (v) => objects.setRoughness(v));
    bus.on('ui:metalness', (v) => objects.setMetalness(v));
    bus.on('ui:scale', (v) => objects.setScale(v));
    bus.on('ui:resetMaterial', () => {
      ui.setMaterialValues(objects.resetMaterials());
      ui.setActiveColor(null);
    });
    bus.on('ui:clear', () => {
      objects.clear();
      this._resetTransformUi();
      this._updateHint();
    });
  }

  _placeObject() {
    if (!this.reticle.visible || !this.objects.model) return;
    this.reticle.getPosition(_pos);
    this.renderer.xr.getCamera().getWorldPosition(_cam);
    this.objects.placeAt(_pos, _cam);
    this._updateHint();
  }

  async _changeModel(id) {
    const entry = MODELS.find((m) => m.id === id);
    if (!entry || id === this.currentModelId) return;

    this.ui.setHint('Загрузка модели…');
    try {
      const snapshot = await this.objects.setModel(entry);
      if (snapshot) {
        this.currentModelId = id;
        this.ui.setActiveModel(id);
        this.ui.setActiveColor(null);
        this.ui.setMaterialValues(snapshot);
      }
    } catch (e) {
      console.error(e);
      this._flash(`Не удалось загрузить модель «${entry.label}»`);
      return;
    }
    this._updateHint();
  }

  async _changeEnvironment(id) {
    const entry = ENVIRONMENTS.find((e) => e.id === id);
    if (!entry) return;
    this.ui.setHint('Загрузка HDRI…');
    try {
      const { usedFallback } = await this.env.set(entry);
      this.ui.setActiveEnv(id);
      if (usedFallback) {
        this._flash('HDRI не загрузился, использована встроенная студия');
        return;
      }
    } catch (e) {
      console.error(e);
      this._flash('Не удалось применить освещение');
      return;
    }
    this._updateHint();
  }

  // ---------- вспомогательное ----------

  _updateHint() {
    let text;
    if (!this.hitVisible) text = 'Ищу горизонтальную поверхность: медленно поводите камерой';
    else if (this.objects.isPlaced) text = 'Нажмите на поверхность, чтобы переместить объект';
    else text = 'Нажмите, чтобы поставить объект';
    this.ui.setHint(text);
  }

  _flash(text) {
    this.ui.setHint(text);
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => this._updateHint(), 3000);
  }

  _resetTransformUi() {
    this.ui.setYaw(0);
    this.ui.setScale(1);
    this.ui.setSpin(false);
  }

  // ---------- запуск ----------

  async init() {
    this.ui.buildControls({ models: MODELS, environments: ENVIRONMENTS, colors: COLORS });

    this.renderer.setAnimationLoop((time, frame) => {
      const dt = Math.min(this.clock.getDelta(), 0.1);
      this.ar.update(frame);
      this.objects.update(dt);
      this.reticle.pulse(time);
      this.renderer.render(this.scene, this.camera);
    });

    const support = await this.ar.checkSupport();
    if (!support.ok) {
      this.ui.setStatus(support.reason);
      return;
    }

    try {
      this.ui.setStatus('Загрузка HDRI-освещения…');
      const envEntry = ENVIRONMENTS.find((e) => e.id === DEFAULTS.environment) ?? ENVIRONMENTS[0];
      const { usedFallback } = await this.env.set(envEntry);
      this.ui.setActiveEnv(envEntry.id);

      this.ui.setStatus('Загрузка модели…');
      const modelEntry = MODELS.find((m) => m.id === DEFAULTS.model) ?? MODELS[0];
      const snapshot = await this.objects.setModel(modelEntry);
      this.currentModelId = modelEntry.id;
      this.ui.setActiveModel(modelEntry.id);
      this.ui.setActiveColor(null);
      if (snapshot) this.ui.setMaterialValues(snapshot);

      this.ui.setStatus(
        usedFallback
          ? 'Готово (HDRI не загрузился, используется встроенная студия). Нажмите кнопку и разрешите доступ к камере.'
          : 'Готово. Нажмите кнопку и разрешите доступ к камере.'
      );
      this.ui.setStartEnabled(true);
    } catch (e) {
      console.error(e);
      this.ui.setStatus('Ошибка загрузки: ' + e.message);
    }
  }
}

new App().init();
