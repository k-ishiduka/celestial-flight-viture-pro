function showStartupError(message) {
  const panel = document.getElementById('loading');
  if (panel?.classList.contains('done')) return;
  const label = document.getElementById('loadingDetail');
  if (label)
    label.textContent =
      '読み込みが完了しませんでした。起動ファイルから開き直してください。' + (message ? ' ' + message : '');
  const retry = document.getElementById('retryLoad');
  if (retry) retry.hidden = false;
}
addEventListener('error', event => showStartupError(event.message || ''));
addEventListener('unhandledrejection', event => showStartupError(event.reason?.message || ''));
