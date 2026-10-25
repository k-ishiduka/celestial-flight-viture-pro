// 流星群の設定画面: 状態の説明と「極大の夜へ移動」。
import { activeShowers, chooseShower, describeShower, nextShower, peakNight } from './meteor-showers.js';

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');

export function setupMeteorShowerUI(observer, notice) {
  const refresh = () => {
    $('showerStatus').textContent = describeShower($('meteorShower').value, observer.date);
  };
  $('meteorShower').addEventListener('change', refresh);
  setInterval(refresh, 1000);
  refresh();

  $('showerJump').onclick = () => {
    const mode = $('meteorShower').value;
    const date = observer.date;
    // 選択中の流星群 → 自動のときは活動中の先頭 → なければ次の流星群
    const shower =
      (mode !== 'off' && chooseShower(mode, date)?.shower) ||
      activeShowers(date)[0]?.shower ||
      nextShower(date).shower;
    const night = peakNight(shower, date.getUTCFullYear());
    observer.prepareObservation();
    $('date').value = `${night.year}-${pad(night.month)}-${pad(night.day)}T${pad(night.hour)}:00:00`;
    $('date').dispatchEvent(new Event('change', { bubbles: true }));
    $('meteorShower').value = shower.id;
    $('meteorShower').dispatchEvent(new Event('change', { bubbles: true }));
    $('timeFlow').value = '0';
    $('timeFlow').dispatchEvent(new Event('change', { bubbles: true }));
    observer.update(0);
    notice(`${shower.name}の見ごろ(${night.month}/${night.day} ${night.hour}時ごろ)へ移動しました`);
    refresh();
  };
}
