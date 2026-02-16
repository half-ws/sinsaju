/**
 * state.js — EventBus + AppState manager
 * Simple reactive state without external dependencies.
 */

class EventBus {
  constructor() {
    this._listeners = {};
  }

  on(event, fn) {
    (this._listeners[event] ||= []).push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    this._listeners[event] = (this._listeners[event] || []).filter(f => f !== fn);
  }

  emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  }
}

class AppState {
  constructor() {
    this.bus = new EventBus();
    this._state = {
      personA: null,        // BirthMoment
      personB: null,        // BirthMoment (for gunghap)
      chartDataA: null,     // computed chart data
      chartDataB: null,
      activeView: 'single', // 'single' | 'gunghap' | 'fortune'
      waveScale: 'hour',
    };
  }

  get(key) {
    return this._state[key];
  }

  set(key, value) {
    this._state[key] = value;
    this.bus.emit(key, value);
    this.bus.emit('stateChange', { key, value });
  }

  on(event, fn) {
    return this.bus.on(event, fn);
  }
}

export const appState = new AppState();
