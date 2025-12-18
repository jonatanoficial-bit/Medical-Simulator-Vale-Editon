// Engine - EventBus (Pub/Sub)
// Mantém baixo acoplamento: engine emite eventos, UI apenas escuta.

window.MedSim = window.MedSim || {};
window.MedSim.Engine = window.MedSim.Engine || {};

window.MedSim.Engine.createEventBus = function createEventBus() {
  const listeners = Object.create(null);

  function on(eventName, cb) {
    if (!listeners[eventName]) listeners[eventName] = new Set();
    listeners[eventName].add(cb);
    return () => off(eventName, cb);
  }

  function off(eventName, cb) {
    if (!listeners[eventName]) return;
    listeners[eventName].delete(cb);
  }

  function emit(eventName, payload) {
    const set = listeners[eventName];
    if (!set) return;
    for (const cb of Array.from(set)) {
      try { cb(payload); } catch (e) { console.error("EventBus listener error", e); }
    }
  }

  return { on, off, emit };
};
