const SCOPE = 'https://www.googleapis.com/auth/drive.file';
let loading;
function script(src) {
  return new Promise((resolve, reject) => {
    const element = document.createElement('script');
    element.src = src; element.onload = resolve;
    element.onerror = () => { element.remove(); reject(new Error('Googleの読み込みに失敗しました。通信を確認して再試行してください。')); };
    document.head.append(element);
  });
}
export function prepareDrive() {
  if (!loading) loading = Promise.all([
    globalThis.google?.accounts?.oauth2 ? undefined : script('https://accounts.google.com/gsi/client'),
    globalThis.gapi ? undefined : script('https://apis.google.com/js/api.js')
  ]).then(() => new Promise((resolve, reject) => {
    gapi.load('picker', { callback: resolve, onerror: () => reject(new Error('Googleのファイル選択を読み込めませんでした。')), timeout: 15000, ontimeout: () => reject(new Error('Googleの読み込みがタイムアウトしました。')) });
  })).catch(error => { loading = null; throw error; });
  return loading;
}
function authorize(config) {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: config.clientId, scope: SCOPE, include_granted_scopes: false,
      callback: response => {
        if (response.error || !response.access_token || !google.accounts.oauth2.hasGrantedAllScopes(response, SCOPE)) {
          reject(new Error('Googleドライブへのアクセスが許可されませんでした。')); return;
        }
        resolve(response.access_token);
      },
      error_callback: () => reject(new Error('Googleの認可を中止しました。ポップアップが許可されているか確認してください。'))
    });
    // Always request fresh authorization from this user gesture.
    client.requestAccessToken({ prompt: 'consent select_account' });
  });
}
function pick(config, token) {
  return new Promise((resolve, reject) => {
    let picker;
    const finish = value => { picker.setVisible(false); picker.dispose(); picker = null; resolve(value); };
    try {
      picker = new google.picker.PickerBuilder()
        .addView(new google.picker.DocsView().setIncludeFolders(true).setSelectFolderEnabled(false))
        .setOAuthToken(token).setDeveloperKey(config.apiKey).setAppId(config.appId)
        .setOrigin(location.origin).setLocale('ja')
        .setCallback(data => {
          if (data.action === google.picker.Action.CANCEL) finish(null);
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs[0]; finish({ id: doc.id, name: doc.name });
          }
        }).build();
      picker.setVisible(true);
    } catch { picker?.dispose(); reject(new Error('Googleのファイル選択を開けませんでした。')); }
  });
}
export async function downloadDriveFile(file, token, fetcher = fetch) {
  const response = await fetcher(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('認可の有効期限が切れました。もう一度更新してください。');
    if ([403, 404].includes(response.status)) throw new Error('前回のファイルにアクセスできません。アカウントを確認するか、ファイルを選び直してください。');
    throw new Error('Googleドライブから取得できませんでした。通信を確認して再試行してください。');
  }
  return response.text();
}
export async function readDriveFile(config, previous, { beforePick = () => {}, afterPick = () => {} } = {}) {
  let token;
  try {
    token = await authorize(config);
    let file = previous;
    if (!file) {
      beforePick();
      try { file = await pick(config, token); } finally { afterPick(); }
    }
    if (!file) return null;
    return { file, text: await downloadDriveFile(file, token) };
  } finally {
    // No token is written to storage or retained for another operation.
    token = null;
  }
}
