// 日食・月食の設定画面: 観測地点で次に見られる食を探して、その最大の瞬間へ移動する。
import { describeEclipse, nextVisibleLunarEclipse, nextVisibleSolarEclipse } from './eclipses.js';

const $ = id => document.getElementById(id);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function setupEclipseUI(observer, environment, experience, notice) {
  const A = globalThis.Astronomy;

  const jump = type => {
    const place = new A.Observer(
      clamp(Number($('latitude').value) || 0, -90, 90),
      clamp(Number($('longitude').value) || 0, -180, 180),
      0,
    );
    const timezone = Number($('timezone').value) || 0;
    const search = type === 'solar' ? nextVisibleSolarEclipse : nextVisibleLunarEclipse;
    const eclipse = search(A, observer.date, place);
    $('eclipseStatus').textContent = describeEclipse(eclipse, timezone);
    if (!eclipse) return notice('この地点で見られる食は、近いうちには見つかりませんでした');

    // 食の最大の瞬間へ(日時の入力欄は現地時刻)
    $('date').value = new Date(eclipse.peak.getTime() + timezone * 3600000).toISOString().slice(0, 19);
    $('date').dispatchEvent(new Event('change', { bubbles: true }));
    $('timeFlow').value = '0';
    $('timeFlow').dispatchEvent(new Event('change', { bubbles: true }));
    $('observe').checked = true;
    $('observe').dispatchEvent(new Event('change', { bubbles: true }));
    if (type === 'solar') {
      // 昼の空が暗くなる様子も見えるように、昼夜の明るさの再現を入れる
      $('atmosphere').checked = true;
      $('atmosphere').dispatchEvent(new Event('change', { bubbles: true }));
    }
    notice(type === 'solar' ? '日食の最大の瞬間へ移動しました' : '月食の最大の瞬間へ移動しました');
    // 日時を反映した位置が計算されるのを待ってから、太陽・月へ視線を向ける
    setTimeout(() => {
      const direction = type === 'solar' ? environment.sunDirection() : environment.moonDirection();
      experience.lookAt(direction, type === 'solar' ? 10 : 10);
    }, 400);
  };

  $('nextSolarEclipse').onclick = () => jump('solar');
  $('nextLunarEclipse').onclick = () => jump('lunar');
}
