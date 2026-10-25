import * as T from './three.module.js';
import { normalizeSkyQuery, tonightValue, rangeLabel } from './interface-utils.js';
const $ = id => document.getElementById(id);
const emit = id => $(id).dispatchEvent(new Event('change', { bubbles: true }));
const change = (id, value) => {
  const node = $(id);
  if (node.type === 'checkbox') node.checked = value;
  else node.value = value;
  emit(id);
};
export class SkyInterface {
  constructor(experience, observer, planets) {
    this.e = experience;
    this.observer = observer;
    this.planets = planets;
    this.direction = new T.Vector3();
    this.elapsed = 0;
    this.filter = 'all';
    this.query = '';
    this.panel = null;
    this.panelTrigger = null;
    $('settingsButton').onclick = () => this.togglePanel('settings', $('settingsButton'));
    $('settingsClose').onclick = () => this.closePanel();
    $('searchOpen').onclick = () => this.togglePanel('searchPanel', $('searchOpen'));
    $('searchClose').onclick = () => this.closePanel();
    $('observationSettings').onclick = () => {
      this.openPanel('settings', $('observationSettings'));
      this.selectTab('observe');
      $('tab-observe').focus();
    };
    $('skySearch').onkeydown = event => {
      if (event.isComposing) return;
      if (event.key === 'Enter' || event.key === 'ArrowDown') {
        const first = $('searchResults').querySelector('button');
        if (first) {
          event.preventDefault();
          if (event.key === 'Enter') first.click();
          else first.focus();
        }
      }
    };
    $('skySearch').oninput = () => {
      this.query = $('skySearch').value;
      this.search();
    };
    $('searchResults').onkeydown = event => {
      const results = [...$('searchResults').querySelectorAll('button')];
      const index = results.indexOf(document.activeElement);
      if (index < 0 || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? results.length - 1
            : event.key === 'ArrowDown'
              ? Math.min(index + 1, results.length - 1)
              : index - 1;
      if (next < 0) $('skySearch').focus();
      else results[next].focus();
    };
    const tabs = [...document.querySelectorAll('[data-tab]')];
    for (const tab of tabs) {
      tab.onclick = () => this.selectTab(tab.dataset.tab);
      tab.onkeydown = event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const index = tabs.indexOf(tab);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        this.selectTab(tabs[next].dataset.tab);
        tabs[next].focus();
      };
    }
    document.querySelectorAll('[data-filter]').forEach(button => {
      button.onclick = () => {
        this.filter = button.dataset.filter;
        for (const item of document.querySelectorAll('[data-filter]')) {
          item.classList.toggle('active', item === button);
          item.setAttribute('aria-pressed', String(item === button));
        }
        this.search();
      };
    });
    document.querySelectorAll('[data-view]').forEach(button => {
      button.onclick = () => {
        this.closePanel(false);
        this.setView(button.dataset.view);
      };
    });
    document.querySelectorAll('[data-preset]').forEach(button => {
      button.onclick = () => {
        this.setView('space');
        const preset = button.dataset.preset;
        change('journey', preset === 'flight' ? 'cruise' : preset === 'guide' ? 'tour' : 'walk');
        change('speed', preset === 'flight' ? 0.4 : 0.08);
        if (preset === 'guide') change('tourKind', 'all');
        if ($('pause').getAttribute('aria-pressed') === 'true') $('pause').click();
        experience.notice(button.textContent.trim() + 'に切り替えました');
      };
    });
    $('tonight').onclick = () => {
      change('timeFlow', '0');
      change('season', '');
      change('date', tonightValue(new Date(), Number($('timezone').value)));
      this.setView('observe');
      experience.notice('観測地点の今夜21時の空に切り替えました');
    };
    this.rangeOutputs = [];
    document.querySelectorAll('input[type="range"]').forEach(input => {
      const wrapper = document.createElement('span');
      wrapper.className = 'range-control';
      const output = document.createElement('output');
      output.htmlFor = input.id;
      // The slider announces its value; the adjacent readout is visual only.
      output.setAttribute('aria-hidden', 'true');
      input.before(wrapper);
      wrapper.append(input, output);
      const sync = () => {
        const label = rangeLabel(input.id, input.value);
        output.textContent = label;
        input.setAttribute('aria-valuetext', label);
      };
      input.addEventListener('input', sync);
      this.rangeOutputs.push(sync);
    });
    $('revealUI').onclick = () => {
      $('ui').classList.remove('hidden');
      $('hide').focus();
    };
    $('stopNarration').onclick = () => experience.narrator.stop();
    for (const id of ['photo', 'inspect', 'narrate']) {
      $(id).addEventListener('click', () => this.closePanel());
    }
    // Help lives outside #ui so hiding the controls never hides its close action.
    $('info').onclick = () => {
      this.closePanel(false);
      $('help').style.display = 'block';
      $('ui').inert = true;
      $('close').focus();
    };
    $('close').onclick = () => this.closeHelp();
    new MutationObserver(() => {
      const hidden = $('ui').classList.contains('hidden');
      $('revealUI').hidden = !hidden;
      if (hidden) {
        this.closePanel(false);
        if ($('ui').contains(document.activeElement)) $('revealUI').focus();
      }
    }).observe($('ui'), { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('pointerdown', event => {
      if (this.panel && !$(this.panel).contains(event.target) && !this.panelTrigger?.contains(event.target))
        this.closePanel(false);
    });
    for (const id of ['settings', 'searchPanel', 'help']) {
      $(id).addEventListener('keydown', event => {
        // Arrow keys in panels scroll/select; they must never steer the sky.
        if (event.key.startsWith('Arrow')) event.stopPropagation();
        if (event.key !== 'Tab') return;
        const nodes = [
          ...$(id).querySelectorAll(
            'button:not(:disabled),input:not([hidden]),select:not([hidden]),a[href],summary',
          ),
        ].filter(node => node.tabIndex >= 0 && node.getClientRects().length);
        const first = nodes[0],
          last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      });
    }
    addEventListener('keydown', event => {
      const editing =
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) || event.target.isContentEditable;
      if (event.key === 'Escape') {
        if ($('help').style.display !== 'none') this.closeHelp();
        else this.closePanel();
      }
      if (event.key === '/' && !editing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        this.closeHelp(false);
        $('ui').classList.remove('hidden');
        this.openPanel('searchPanel', $('searchOpen'));
      }
    });
    const dock = document.querySelector('.bottom-dock');
    const resize = () => {
      document.documentElement.style.setProperty('--dock-height', dock.offsetHeight + 'px');
      $('narrationPanel').style.bottom = innerHeight - dock.getBoundingClientRect().top + 12 + 'px';
    };
    this.dockObserver = new ResizeObserver(resize);
    this.dockObserver.observe(dock);
    addEventListener('resize', resize);
    resize();
    observer.active = $('observe').checked;
    observer.ground.visible = observer.active;
    experience.atlasReady.then(() => {
      if (experience.atlasError) {
        $('loadingDetail').textContent = '星図を読み込めませんでした。もう一度開いて再試行してください。';
        $('retryLoad').hidden = false;
        return;
      }
      this.search();
      $('loadingDetail').textContent = '星空の準備ができました';
      $('loading').classList.add('done');
      setTimeout(() => ($('loading').hidden = true), 700);
    });
    $('latitude').addEventListener('change', () => this.location());
    $('longitude').addEventListener('change', () => this.location());
  }
  openPanel(id, trigger) {
    this.closePanel(false);
    this.panel = id;
    this.panelTrigger = trigger;
    if (id === 'settings') $('settings').style.display = 'flex';
    else $(id).hidden = false;
    const button = $(id === 'settings' ? 'settingsButton' : 'searchOpen');
    button.setAttribute('aria-expanded', 'true');
    if (id === 'searchPanel') {
      this.search();
      $('skySearch').focus();
    } else $(id).querySelector('button:not(:disabled)')?.focus();
  }
  togglePanel(id, trigger) {
    if (this.panel === id) this.closePanel();
    else this.openPanel(id, trigger);
  }
  closePanel(restore = true) {
    if (!this.panel) return;
    const id = this.panel,
      trigger = this.panelTrigger;
    if (id === 'settings') $('settings').style.display = 'none';
    else $(id).hidden = true;
    $(id === 'settings' ? 'settingsButton' : 'searchOpen').setAttribute('aria-expanded', 'false');
    this.panel = null;
    this.panelTrigger = null;
    if (restore) trigger?.focus();
  }
  closeHelp(restore = true) {
    if ($('help').style.display === 'none') return;
    $('help').style.display = 'none';
    $('ui').inert = false;
    if (restore) {
      this.openPanel('settings', $('settingsButton'));
      this.selectTab('device');
      $('info').focus();
    }
  }
  selectTab(key) {
    for (const tab of document.querySelectorAll('[data-tab]')) {
      const active = tab.dataset.tab === key;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    document
      .querySelectorAll('[data-settings]')
      .forEach(panel => (panel.hidden = panel.dataset.settings !== key));
    document.querySelector('.settings-body').scrollTop = 0;
  }
  syncControls(solar) {
    const journey = $('journey').value;
    for (const button of document.querySelectorAll('[data-preset]')) {
      const mode = { relax: 'walk', flight: 'cruise', guide: 'tour' }[button.dataset.preset];
      button.setAttribute(
        'aria-pressed',
        String(
          !solar &&
            !this.observer.active &&
            (mode === 'cruise'
              ? ['flight', 'forward', 'cruise', 'warp'].includes(journey)
              : mode === journey),
        ),
      );
    }
    for (const id of ['explainSelected', 'inspect', 'narrate']) {
      $(id).disabled = solar;
      $(id).title = solar ? '星空または地上観測で使えます' : '';
    }
    const showRow = (id, show) => ($(id).closest('.setting-row').hidden = !show);
    showRow('artOpacity', $('artDisplay').value !== 'off');
    showRow('neuralVoice', $('speechEngine').value === 'neural');
    showRow('voice', $('speechEngine').value === 'system');
    showRow('depth', $('mode').value === 'sbs');
    showRow('tourKind', ['tour', 'cruise'].includes(journey));
    showRow('tourInterval', ['tour', 'cruise'].includes(journey));
    this.rangeOutputs.forEach(sync => sync());
    $('timePlay').setAttribute('aria-pressed', String(Number($('timeFlow').value) !== 0));
  }
  setView(view) {
    this.e.narrator?.stop();
    this.e.guide.release();
    this.e.focus.restore();
    this.e.focus.enabled = false;
    if (view === 'solar') {
      change('planetMode', 'solar');
    } else {
      change('planetMode', view === 'observe' ? 'sky' : 'off');
      change('observe', view === 'observe');
      this.observer.update(0);
      let key = this.e.currentDestination,
        d = this.e.routes[key];
      if (view === 'observe' && d) {
        const ra = (d[0] * Math.PI) / 180,
          dec = (d[1] * Math.PI) / 180,
          v = new T.Vector3(Math.cos(dec) * Math.cos(ra), Math.sin(dec), Math.cos(dec) * Math.sin(ra));
        if (this.observer.vector(v).y < 0.15) {
          let best = null,
            highest = -2;
          for (const item of this.e.constellationCenters) {
            const altitude = this.observer.vector(item.vector).normalize().y;
            if (altitude > highest) {
              best = item;
              highest = altitude;
            }
          }
          if (best) {
            key = 'c_' + best.id;
            d = this.e.routes[key];
          }
        }
      }
      if (d) {
        $('card').textContent = d[3] || '名前をたどって、その星の物語へ。';
        this.e.go(key);
      }
    }
    this.update(1, 0);
  }
  location() {
    $('locationName').textContent =
      `${Math.abs(Number($('latitude').value)).toFixed(3)}° ${Number($('latitude').value) < 0 ? 'S' : 'N'} / ${Math.abs(Number($('longitude').value)).toFixed(3)}° ${Number($('longitude').value) < 0 ? 'W' : 'E'}`;
  }
  search() {
    const q = normalizeSkyQuery(this.query);
    const results = Object.entries(this.e.routes).filter(
      ([key, d]) =>
        key !== 'random' &&
        !['orion', 'cygnus', 'andromeda'].includes(key) &&
        (this.filter === 'all' || (this.filter === 'star' ? key.startsWith('s_') : key.startsWith('c_'))) &&
        (!q || normalizeSkyQuery(d[2] + ' ' + key).includes(q)),
    );
    $('searchCount').textContent = `${results.length}件${q ? 'の検索結果' : 'の天体・名所'}`;
    const root = $('searchResults');
    root.replaceChildren();
    for (const [key, d] of results) {
      const button = document.createElement('button');
      button.className = 'search-result';
      button.type = 'button';
      const name = document.createElement('strong');
      name.textContent = d[2];
      const kind = document.createElement('small');
      kind.textContent = key.startsWith('s_')
        ? '恒星'
        : key === 'c_SummerTriangle'
          ? '空の目印'
          : key.startsWith('c_')
            ? '星座'
            : '星空の名所';
      button.append(name, kind);
      button.onclick = () => {
        if (this.planets.mode === 'solar') this.setView('space');
        this.e.narrator.stop();
        this.e.focus.restore();
        this.e.focus.enabled = false;
        this.e.go(key);
        $('destination').dispatchEvent(new Event('change', { bubbles: true }));
        const id =
          { core: 'Sgr', cygnus: 'Cyg', orion: 'Ori', pleiades: 'Tau', andromeda: 'And' }[key] ||
          key.replace(/^c_/, '');
        this.e.guide.lock(id, d);
        this.closePanel();
      };
      root.append(button);
    }
    if (!results.length) {
      const p = document.createElement('p');
      p.className = 'quiet';
      p.textContent = this.e.named
        ? '見つかりませんでした。短い名前でも検索できます。'
        : '星図を準備しています。';
      root.append(p);
    }
  }
  update(dt, t, live = false) {
    this.elapsed += dt;
    if (this.elapsed < 0.2) return;
    this.elapsed = 0;
    const solar = this.planets.mode === 'solar',
      ground = this.observer.active && !solar,
      view = solar ? 'solar' : ground ? 'observe' : 'space';
    for (const button of document.querySelectorAll('[data-view]')) {
      const active = button.dataset.view === view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    $('ui').dataset.viewState = view;
    $('card').hidden = solar;
    this.syncControls(solar);
    const current = this.e.routes[this.e.currentDestination];
    const selected = this.planets.objects.find(p => p.body === $('planetTarget').value);
    $('routeTitle').textContent = solar
      ? selected?.name || '太陽系を巡る'
      : (this.e.focus.active?.name || current?.[2] || '星々の海へ。').replace(' / ', '\n');
    if (current && $('card').textContent.startsWith(current[2] + ' — '))
      $('card').textContent = $('card').textContent.slice(current[2].length + 3);
    $('viewEyebrow').textContent = solar
      ? 'OUR SOLAR SYSTEM'
      : ground
        ? 'YOUR PLACE IN THE UNIVERSE'
        : 'THE NIGHT IS YOURS';
    $('timeReadout').textContent = $('date').value.slice(0, 16).replace('T', ' ').replace(/-/g, '/');
    $('timeReadout').dateTime = $('date').value;
    $('timeReadout').title =
      `観測地点の時刻（UTC${Number($('timezone').value) >= 0 ? '+' : ''}${$('timezone').value}）`;
    $('solarControls').hidden = !solar;
    $('trackingBadge').textContent = live ? '頭の動きに追従中' : 'ドラッグで見渡す';
    $('trackingBadge').classList.toggle('connected', live);
    const camera = solar ? this.planets.solarCamera : this.e.camera;
    camera.getWorldDirection(this.direction);
    const alt = (Math.asin(T.MathUtils.clamp(this.direction.y, -1, 1)) * 180) / Math.PI,
      az = ((Math.atan2(this.direction.x, -this.direction.z) * 180) / Math.PI + 360) % 360;
    const dirs = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
    $('compassReadout').textContent = ground
      ? `${dirs[Math.round(az / 45) % 8]} ${Math.round(az)}° · 高度 ${Math.round(alt)}°`
      : solar
        ? 'ドラッグで周囲を眺める'
        : '自由な星空の旅';
    const n = this.e.narrator;
    const narrating = n?.speaking || n?.preparing;
    $('narrationPanel').hidden = !narrating;
    if (narrating) {
      $('narrationState').textContent = n.preparing
        ? '自然な声を準備しています'
        : n.usingNeural
          ? '自然な日本語の声'
          : '日本語の星空解説';
      $('narrationProgress').textContent = n.segmentTotal ? `${n.segmentIndex || 0} / ${n.segmentTotal}` : '';
      $('narrationBar').style.width =
        (n.segmentTotal ? (100 * (n.segmentIndex || 0)) / n.segmentTotal : 0) + '%';
    }
    if (ground) this.location();
    if (solar) $('skyConditions').textContent = $('planetStatus').textContent;
    else if (ground)
      $('skyConditions').textContent = this.e.environment?.description || '日時と場所に合わせた星空';
    else $('skyConditions').textContent = '118,216の恒星 · 88の星座';
  }
}
