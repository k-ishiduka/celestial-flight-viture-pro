// Each view keeps its own controls and camera; observing date and location stay shared.
export const viewSettingIDs = [
  'journey',
  'speed',
  'tourKind',
  'tourInterval',
  'fov',
  'starStyle',
  'light',
  'nebula',
  'lines',
  'constellationLabels',
  'names',
  'artDisplay',
  'artOpacity',
];
const $ = id => document.getElementById(id);
const read = id => ($(id).type === 'checkbox' ? $(id).checked : $(id).value);
const write = (id, value, notify = false) => {
  const node = $(id);
  if (node.type === 'checkbox') node.checked = value === true;
  else {
    if (node.tagName === 'SELECT' && !Array.from(node.options).some(o => o.value === String(value))) return;
    if (node.type === 'range' && !Number.isFinite(Number(value))) return;
    node.value = value;
  }
  if (notify) node.dispatchEvent(new Event('change', { bubbles: true }));
};

export class ViewModes {
  constructor(experience, observer, planets, pilot, saved = {}) {
    this.e = experience;
    this.observer = observer;
    this.planets = planets;
    this.pilot = pilot;
    this.current = 'space';
    const settings = this.readSettings();
    this.states = {};
    for (const view of ['space', 'observe', 'solar']) {
      this.states[view] = {
        settings: {
          ...settings,
          ...(view === 'space'
            ? {}
            : {
                journey: 'walk',
                speed: '0',
                fov: view === 'solar' ? '55' : '70',
              }),
        },
        flow: '0',
        resumeFlow: view === 'solar' ? 86400 : 60,
        paused: false,
        tourTime: 0,
        tourIndex: -1,
      };
      for (const id of viewSettingIDs) {
        if (saved?.[view]?.[id] !== undefined) this.states[view].settings[id] = saved[view][id];
      }
    }
  }
  readSettings() {
    return Object.fromEntries(viewSettingIDs.map(id => [id, read(id)]));
  }
  preferences() {
    return Object.fromEntries(
      Object.entries(this.states).map(([view, state]) => [
        view,
        view === this.current ? this.readSettings() : { ...state.settings },
      ]),
    );
  }
  switch(view) {
    if (!this.states[view] || view === this.current) return false;
    this.switching = true;
    const e = this.e,
      old = this.states[this.current],
      next = this.states[view];
    old.settings = this.readSettings();
    old.pose = this.pilot.capture();
    old.paused = $('pause').getAttribute('aria-pressed') === 'true';
    old.flow = read('timeFlow');
    old.resumeFlow = this.observer.flowBeforePause;
    old.destination = e.currentDestination;
    old.target = e.target && !e.guide.active && !e.guide.remaining ? { ...e.target } : null;
    old.tourTime = e.tourTime;
    old.tourIndex = e.tourIndex;
    old.forwardDirection = e.forwardDirection?.clone();
    // Capture the visible pose before cancelling speech and its temporary framing.
    e.narrator?.stop();
    e.guide.interrupt();
    e.focus.restore();
    e.focus.enabled = false;
    e.keys.clear();
    e.cancelTurn();
    e.velocity = 0;
    this.current = view;
    for (const id of viewSettingIDs) {
      // Restoring a tour must not select the next destination or restart the tour.
      write(id, next.settings[id], !['journey', 'tourKind', 'fov'].includes(id));
    }
    write('observe', view === 'observe', true);
    write('planetMode', view === 'solar' ? 'solar' : view === 'observe' ? 'sky' : 'off', true);
    this.observer.update(0);
    this.observer.setDate(this.observer.date);
    write('timeFlow', view === 'space' ? '0' : next.flow, true);
    this.observer.flowBeforePause = next.resumeFlow;
    this.pilot.setPaused(view === 'space' && next.paused);
    if (view === 'solar') {
      this.planets.solarCamera.fov = Number(read('fov'));
      this.planets.solarCamera.updateProjectionMatrix();
      e.cancelTurn();
    } else {
      if (!next.pose) {
        const key = this.firstGroundTarget();
        if (key) e.go(key);
        next.pose = {
          ...old.pose,
          yaw: e.target?.yaw ?? 0,
          pitch: Math.max(0.3, e.target?.pitch ?? 0.45),
          fov: Number(read('fov')),
        };
        next.destination = e.currentDestination;
        next.target = null;
      }
      this.pilot.restore(next.pose);
      e.currentDestination = next.destination;
      write('destination', next.destination);
      const route = e.routes[next.destination];
      $('card').textContent = route ? route[3] : '空を見渡して、気になる星を探してみましょう。';
      // A ground target uses the old date's coordinates: keep the horizontal view instead.
      e.target = view === 'space' && next.target ? { ...next.target } : null;
      e.tourTime = next.tourTime;
      e.tourIndex = next.tourIndex;
      e.forwardDirection = next.forwardDirection?.clone();
    }
    this.switching = false;
    document.dispatchEvent(new Event('celestial-viewchange'));
    return true;
  }
  firstGroundTarget() {
    let best = null,
      highest = 0.15;
    for (const item of this.e.constellationCenters) {
      const altitude = this.observer.vector(item.vector).normalize().y;
      if (altitude > highest) {
        best = 'c_' + item.id;
        highest = altitude;
      }
    }
    return best;
  }
}
