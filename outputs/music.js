const $ = id => document.getElementById(id);
export class NightMusic {
  constructor(notice) {
    this.notice = notice;
    this.audio = new Audio();
    // 曲の長さは playlist.json にあるため、再生を押すまで音声ファイルは取得しない
    this.audio.preload = 'none';
    this.audio.volume = +$('volume').value;
    this.audio.loop = $('musicOrder').value === 'one';
    this.index = 0;
    this.playlist = [];
    $('audio').disabled = true;
    $('nextTrack').disabled = true;
    this.ready = this.load();
    $('audio').onclick = async () => {
      await this.ready;
      if (!this.playlist.length) return;
      if (!this.audio.paused) {
        this.audio.pause();
        return;
      }
      await this.play();
    };
    $('musicTrack').onchange = () => {
      const resume = !this.audio.paused;
      this.select(+$('musicTrack').value);
      if (resume) this.play();
    };
    $('volume').oninput = () => this.duck(this.ducked);
    $('musicOrder').onchange = () => (this.audio.loop = $('musicOrder').value === 'one');
    $('nextTrack').onclick = () => this.next(true);
    this.audio.addEventListener('playing', () => {
      $('audio').textContent = '音楽を止める';
      $('audio').setAttribute('aria-pressed', 'true');
    });
    this.audio.addEventListener('pause', () => {
      $('audio').textContent = '音楽';
      $('audio').setAttribute('aria-pressed', 'false');
    });
    this.audio.addEventListener('ended', () => this.next(false));
    this.audio.addEventListener('error', () =>
      this.notice('曲を読み込めませんでした。ページを再読み込みしてください。'),
    );
  }
  duck(enabled) {
    this.ducked = enabled;
    clearInterval(this.fade);
    const target = Number($('volume').value) * (enabled ? 0.25 : 1);
    this.fade = setInterval(() => {
      const delta = target - this.audio.volume;
      if (Math.abs(delta) < 0.003) {
        this.audio.volume = target;
        clearInterval(this.fade);
      } else this.audio.volume += delta * 0.15;
    }, 30);
  }
  async load() {
    try {
      const response = await fetch('./playlist.json');
      if (!response.ok) throw Error('曲を準備中です');
      this.playlist = await response.json();
      $('musicTrack').replaceChildren(
        ...this.playlist.map(
          (track, i) => new Option(`${String(i + 1).padStart(2, '0')} · ${track.title}`, String(i)),
        ),
      );
      let saved = {};
      try {
        saved = JSON.parse(localStorage.getItem('celestial-preferences') || '{}');
      } catch {}
      this.select(Math.max(0, Math.min(this.playlist.length - 1, Number(saved.musicTrack) || 0)));
      $('audio').disabled = false;
      $('nextTrack').disabled = false;
    } catch (e) {
      this.notice(e.message);
    }
  }
  select(index) {
    this.index = index;
    const track = this.playlist[index];
    if (!track) return;
    this.audio.src = track.file;
    this.audio.load();
    $('musicTrack').value = String(index);
    $('musicDescription').textContent =
      `${track.description} · ${track.bpm} BPM · ${Math.round((track.seconds / 60) * 10) / 10}分`;
  }
  async play() {
    try {
      await this.audio.play();
    } catch {
      this.notice('「音楽」をもう一度押してください。');
    }
  }
  next(manual) {
    const playing = !this.audio.paused || !manual;
    let next = (this.index + 1) % this.playlist.length;
    if ($('musicOrder').value === 'random' && this.playlist.length > 1)
      next = (this.index + 1 + Math.floor(Math.random() * (this.playlist.length - 1))) % this.playlist.length;
    this.select(next);
    $('musicTrack').dispatchEvent(new Event('change', { bubbles: true }));
    if (playing) this.play();
  }
}
