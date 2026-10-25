import { guideClues, starDescription, starLore } from './rich-guide.js';
import { BrowserVoice } from './browser-voice.js';
import { constellationStories as stories } from './constellation-stories.js';
import { constellationMyths as myths } from './constellation-myths.js';
const $ = id => document.getElementById(id);
export class Narrator {
  constructor(experience, music) {
    this.experience = experience;
    this.music = music;
    this.enabled = false;
    this.speaking = false;
    this.preparing = false;
    this.segmentIndex = 0;
    this.segmentTotal = 0;
    this.urls = new Set();
    this.token = 0;
    this.sequence = 0;
    this.voices = [];
    this.audio = new Audio();
    $('narrate').onclick = async () => {
      if (this.enabled || this.speaking) {
        this.stop();
        return;
      }
      await this.experience.atlasReady;
      this.refresh();
      this.experience.focus.restore();
      this.experience.focus.enabled = false;
      this.enabled = true;
      $('narrate').textContent = '解説を止める';
      this.experience.nextTour();
    };
    $('explainSelected').onclick = async () => {
      await this.experience.atlasReady;
      const key = $('destination').value,
        d = this.experience.routes[key];
      if (!d) return this.experience.notice('星図を準備しています');
      this.stop();
      this.experience.focus.restore();
      this.experience.focus.enabled = false;
      this.experience.go(key);
      this.say(key, d, true);
    };
    this.refresh();
    window.speechSynthesis?.addEventListener('voiceschanged', () => this.refresh());
  }
  refresh() {
    if (!window.speechSynthesis) return;
    const selected = $('voice').value;
    this.voices = speechSynthesis.getVoices().filter(v => /^ja/i.test(v.lang) && v.localService);
    $('voice').replaceChildren(...this.voices.map((v, i) => new Option(v.name, String(i))));
    if (selected) $('voice').value = selected;
  }
  stop() {
    this.enabled = false;
    this.token++;
    this.abort?.abort();
    this.audio.pause();
    this.audio.onended = null;
    this.audio.onerror = null;
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls.clear();
    speechSynthesis.cancel();
    this.speaking = false;
    this.preparing = false;
    this.music.duck(false);
    this.experience.guide.release();
    this.experience.focus.endNarrated();
    $('narrate').textContent = '音声つきで星座を巡る';
    $('subtitle').textContent = '';
  }
  build(key, d) {
    const e = this.experience,
      id =
        { core: 'Sgr', cygnus: 'Cyg', orion: 'Ori', pleiades: 'Tau', andromeda: 'And' }[key] ||
        key.replace('c_', '');
    const star = key.startsWith('s_') ? e.named?.find(s => s.name === key.slice(2)) : null;
    const introductions = [
      `${d[2]}へ、少し視線を移してみましょう。`,
      `続いては、${d[2]}です。`,
      `今度は${d[2]}を、ゆっくり眺めてみましょう。`,
    ];
    const detail = star ? starDescription(star, d[2]) : stories[id] || d[3] || '';
    const firstSentence = !star && key !== 'star' ? detail.match(/^[^。]*。/)?.[0] || detail : detail;
    const segments = [{ text: introductions[this.sequence++ % introductions.length] + firstSentence }];
    const members = star || key === 'star' ? [] : e.members?.[id] || [];
    members.forEach((s, index) => {
      const name = s.name ? e.starName(s) : e.focus.memberName(s, index),
        color =
          s.bv < 0.1 ? '青白い' : s.bv < 0.6 ? '白に近い' : s.bv < 1.2 ? '黄色みのある' : '赤みを帯びた';
      const transition =
        index === 0
          ? 'まず、'
          : index % 3 === 1
            ? '線をたどって、次は'
            : index % 3 === 2
              ? '続いて見えるのは'
              : 'さらに目を向けたいのは';
      segments.push({
        member: index,
        text:
          `${transition}${name}です。${s.mag.toFixed(1)}等級で、${color}星です。` + (starLore[s.name] || ''),
      });
    });
    if (key !== 'star') {
      const context = detail.slice(firstSentence.length) + guideClues(e, d);
      if (context) segments.push({ text: context });
    }
    segments.push({
      finishMembers: true,
      text: members.length
        ? `ひとつずつの星が、線で結ばれました。${$('art').checked ? 'この並びに、星座の姿を重ねてみましょう。' : 'この星の並びが、星座の形を描いています。'}星は隣り合って見えても、宇宙では大きく離れていることがあります。`
        : 'その周りの淡い光にも、目を向けてみましょう。',
    });
    // 星の説明のあと、設定でオンなら、その星座の神話・由来を語る
    const myth = star || key === 'star' ? '' : myths[id];
    if (myth && $('mythNarration')?.checked) {
      segments.push({ text: `ここからは、${d[2]}にまつわるお話です。` + myth });
    }
    const paced = segments.flatMap(segment => {
      const parts = segment.text.match(/[^。！？]+[。！？]?/g) || [segment.text];
      const chunks = [];
      let text = '';
      for (const part of parts) {
        if (text && text.length + part.length > 85) {
          chunks.push(text);
          text = '';
        }
        text += part;
      }
      if (text) chunks.push(text);
      return chunks.map((text, index) => (index === 0 ? { ...segment, text } : { text }));
    });
    return { id, segments: paced };
  }
  async say(key, d, force = false) {
    if (!this.enabled && !force) return;
    if ($('planetMode')?.value === 'solar') {
      const continueGuide = this.enabled;
      this.experience.setView('space');
      this.enabled = continueGuide;
    }
    this.refresh();
    const token = ++this.token;
    this.abort?.abort();
    this.audio.pause();
    this.audio.onended = null;
    this.audio.onerror = null;
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls.clear();
    speechSynthesis.cancel();
    this.speaking = true;
    this.preparing = true;
    this.segmentIndex = 0;
    this.segmentTotal = 0;
    $('subtitle').textContent = d[2] + 'の星空解説を準備しています。';
    $('narrate').textContent = '解説を止める';
    await this.experience.atlasReady;
    if (token !== this.token) return;
    const { id, segments } = this.build(key, d);
    this.segmentTotal = segments.length;
    const item = this.experience.constellationCenters.find(x => x.id === id);
    if (item) this.experience.focus.startNarrated(item);
    else {
      this.experience.focus.restore();
      this.experience.focus.enabled = false;
    }
    if ($('guideZoom').checked) this.experience.guide.lock(id, d);
    this.music.duck(true);
    let engine = $('speechEngine').value;
    if (engine === 'browser') {
      try {
        $('subtitle').textContent = '音声データを読み込んでいます(初回のみ・約70MB)。';
        this.browserVoice ??= new BrowserVoice();
        await this.browserVoice.load();
        if (token !== this.token) return;
      } catch {
        // オフラインなどで読み込めない場合は、この端末の読み上げで続ける
        engine = 'system';
        $('speechEngine').value = 'system';
        this.experience.notice(
          'ブラウザ内の音声を読み込めなかったため、この端末の読み上げに切り替えました。',
        );
      }
    }
    const neural = engine === 'neural' || engine === 'browser';
    this.usingNeural = neural;
    this.abort = new AbortController();
    const signal = this.abort.signal;
    let index = 0,
      preparation = Promise.resolve();
    const prepared = [];
    const finish = () => {
      if (token !== this.token) return;
      this.abort.abort();
      for (const url of this.urls) URL.revokeObjectURL(url);
      this.urls.clear();
      this.speaking = false;
      this.preparing = false;
      this.music.duck(false);
      this.experience.guide.release();
      this.experience.focus.endNarrated();
      this.experience.tourTime = 0;
      if (!this.enabled) $('narrate').textContent = '音声つきで星座を巡る';
    };
    const prepare = async segment => {
      if (!neural) return null;
      if (signal.aborted) return null;
      if (engine === 'browser') {
        const blob = await this.browserVoice.synthesize(segment.text, Number($('speechRate').value));
        if (signal.aborted) return null;
        const url = URL.createObjectURL(blob);
        this.urls.add(url);
        return url;
      }
      const response = await fetch('/api/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: segment.text,
          speed: Number($('speechRate').value),
          voice: $('neuralVoice').value,
        }),
        signal,
      });
      if (!response.ok) throw Error('natural voice unavailable');
      const blob = await response.blob();
      if (signal.aborted) return null;
      const url = URL.createObjectURL(blob);
      this.urls.add(url);
      return url;
    };
    // A bounded queue renders the next phrases during playback, in speaking order.
    const queue = i => {
      if (i >= segments.length || prepared[i]) return;
      prepared[i] = preparation
        .then(() => prepare(segments[i]))
        .then(
          url => ({ url }),
          error => ({ error }),
        );
      preparation = prepared[i];
    };
    for (let i = 0; i < 3; i++) queue(i);
    const next = async () => {
      if (token !== this.token) return;
      if (index >= segments.length) {
        finish();
        return;
      }
      const segment = segments[index];
      this.preparing = true;
      const result = await prepared[index];
      if (token !== this.token) return;
      if (result.error) {
        if (result.error.name === 'AbortError') return;
        this.enabled = false;
        finish();
        this.experience.notice(
          '自然な声の準備ができませんでした。少し待って、もう一度解説を押してください。',
        );
        $('subtitle').textContent = '自然な音声を準備できませんでした。解説ボタンで再試行できます。';
        return;
      }
      this.preparing = false;
      this.segmentIndex = index + 1;
      if (segment.member !== undefined) this.experience.focus.revealMember(segment.member);
      if (segment.finishMembers) this.experience.focus.endNarrated();
      $('subtitle').textContent = segment.text;
      index++;
      queue(index + 2);
      if (result.url) {
        this.audio.src = result.url;
        const release = () => {
          URL.revokeObjectURL(result.url);
          this.urls.delete(result.url);
        };
        this.audio.onended = () => {
          release();
          next();
        };
        this.audio.onerror = () => {
          release();
          this.enabled = false;
          finish();
          this.experience.notice('解説音声を再生できませんでした。もう一度解説を押してください。');
        };
        try {
          await this.audio.play();
        } catch {
          release();
          this.enabled = false;
          finish();
          this.experience.notice('解説ボタンをもう一度押してください');
        }
      } else {
        const utterance = new SpeechSynthesisUtterance(segment.text);
        utterance.lang = 'ja-JP';
        utterance.voice = this.voices[Number($('voice').value)] || this.voices[0];
        utterance.rate = Number($('speechRate').value);
        utterance.pitch = 1;
        utterance.volume = 0.9;
        utterance.onend = next;
        utterance.onerror = () => {
          if (token === this.token) {
            this.enabled = false;
            finish();
            this.experience.notice('読み上げを再生できませんでした。解説ボタンで再試行できます。');
          }
        };
        this.utterance = utterance;
        speechSynthesis.speak(utterance);
      }
    };
    next();
  }
}
