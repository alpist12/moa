(function (root) {
  const CLIENT_ID = '533555779141-pa3i6n2iuimumqs0c0p3rdid463qqpn4.apps.googleusercontent.com';
  const KEY = 'allowance-plan-v3';
  const ENABLED_KEY = 'moa-drive-enabled';
  const FILE_NAME = 'moa-data.json';
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

  const validMonth = value => value && typeof value.allowance === 'number' && !Number.isNaN(value.allowance) && Array.isArray(value.categories) && Array.isArray(value.expenses);
  const validStore = value => value && value.months && typeof value.months === 'object' && Object.values(value.months).every(validMonth);
  const envelope = (data, updatedAt = new Date().toISOString()) => ({ version: 1, updatedAt, data });
  const decodeRemote = raw => {
    const value = JSON.parse(raw);
    const data = value && value.version === 1 ? value.data : value;
    if (!validStore(data)) throw new Error('Drive 데이터 형식이 올바르지 않아요.');
    return { data, updatedAt: value.updatedAt || '' };
  };

  if (typeof module !== 'undefined') module.exports = { decodeRemote, envelope, validStore };
  if (typeof document === 'undefined' || location.hash.startsWith('#view=')) return;

  let token = '';
  let tokenClient;
  let fileId = '';
  let saveTimer;
  let ignoreLocalWrite = false;
  let currentStatus = '연결하면 앱 전용 공간에 안전하게 백업해요.';
  const nativeSetItem = Storage.prototype.setItem;

  const fallbackStoreRaw = () => {
    const now = new Date();
    const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const st = {
      current: ym,
      months: {
        [ym]: {
          month: ym,
          allowance: 0,
          categories: [
            { id: 'c1', name: '식비', amount: 0 },
            { id: 'c2', name: '교통', amount: 0 },
            { id: 'c3', name: '카페·간식', amount: 0 },
            { id: 'c4', name: '쇼핑', amount: 0 },
            { id: 'c5', name: '기타', amount: 0 }
          ],
          incomes: [],
          expenses: []
        }
      }
    };
    const raw = JSON.stringify(st);
    try { nativeSetItem.call(localStorage, KEY, raw); } catch (e) {}
    return raw;
  };

  const ui = document.createElement('section');
  ui.setAttribute('aria-label', 'Google Drive 동기화');
  ui.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:9998;font-family:"Pretendard Variable",Pretendard,"Noto Sans KR",sans-serif;max-width:calc(100vw - 36px)';
  ui.innerHTML = '<button type="button" data-drive-connect style="display:inline-flex;align-items:center;gap:8px;border:1px solid #e2efe8;border-radius:13px;background:#fff;color:#33684F;padding:12px 16px;box-shadow:0 8px 26px rgba(28,48,38,.12);font-size:12px;font-weight:800;cursor:pointer"><span style="width:8px;height:8px;border-radius:50%;background:#43956f" data-drive-dot></span><span data-drive-btn-text>Google Drive 연결</span></button><div data-drive-panel hidden style="margin-top:8px;width:300px;max-width:100%;padding:16px;border:1px solid #e2efe8;border-radius:16px;background:#fff;box-shadow:0 14px 36px rgba(28,48,38,.14)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><strong style="font-size:13px;color:#1F3A2E">Google Drive 동기화</strong><button type="button" data-drive-close style="border:0;background:transparent;color:#969d94;cursor:pointer;font-size:13px;padding:2px 4px">✕</button></div><p data-drive-status style="margin:0;color:#6E7A72;font-size:12px;line-height:1.55">연결하면 앱 전용 공간에 안전하게 백업해요.</p><div data-drive-actions style="display:none;gap:7px;margin-top:12px"><button type="button" data-drive-load style="flex:1;border:0;border-radius:9px;background:#e9faf5;color:#159d7b;padding:9px;font-size:11px;font-weight:800;cursor:pointer">Drive에서 불러오기</button><button type="button" data-drive-save style="flex:1;border:0;border-radius:9px;background:#43956f;color:#fff;padding:9px;font-size:11px;font-weight:800;cursor:pointer">현재 내용 저장</button></div></div>';
  document.body.appendChild(ui);

  const connectButton = ui.querySelector('[data-drive-connect]');
  const btnText = ui.querySelector('[data-drive-btn-text]');
  const dotEl = ui.querySelector('[data-drive-dot]');
  const closeButton = ui.querySelector('[data-drive-close]');
  const panel = ui.querySelector('[data-drive-panel]');
  const status = ui.querySelector('[data-drive-status]');
  const actions = ui.querySelector('[data-drive-actions]');
  const loadButton = ui.querySelector('[data-drive-load]');
  const saveButton = ui.querySelector('[data-drive-save]');
  let pendingRemote = null;

  const notify = (message, connected) => {
    try {
      root.dispatchEvent(new CustomEvent('moa-drive-change', { detail: { message, connected: !!connected, clientId: CLIENT_ID } }));
    } catch (e) {}
  };

  const setStatus = (message, connected = false) => {
    currentStatus = message;
    status.textContent = message;
    btnText.textContent = connected ? 'Drive 연결됨' : 'Google Drive 연결';
    if (dotEl) dotEl.style.background = connected ? '#159d7b' : '#b5bab4';
    notify(message, connected);
  };
  const showPanel = () => { panel.hidden = false; };
  if (closeButton) closeButton.addEventListener('click', () => { panel.hidden = true; });

  const api = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
    if (!response.ok) {
      if (response.status === 401) token = '';
      throw new Error(`Drive 요청 실패 (${response.status})`);
    }
    return response;
  };
  const findFile = async () => {
    const params = new URLSearchParams({ spaces: 'appDataFolder', q: `name='${FILE_NAME}' and trashed=false`, fields: 'files(id,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: '1' });
    const result = await (await api(`https://www.googleapis.com/drive/v3/files?${params}`)).json();
    fileId = result.files && result.files[0] ? result.files[0].id : '';
    return result.files && result.files[0];
  };
  const readRemote = async () => decodeRemote(await (await api(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`)).text());
  const writeRemote = async raw => {
    const data = JSON.parse(raw);
    if (!validStore(data)) throw new Error('저장할 데이터 형식이 올바르지 않아요.');
    if (!fileId) {
      const created = await (await api('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' })
      })).json();
      fileId = created.id;
    }
    await api(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope(data))
    });
    actions.style.display = 'none';
    setStatus(`마지막 저장 ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`, true);
  };
  const queueSave = raw => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => writeRemote(raw).catch(error => { showPanel(); setStatus(error.message); }), 900);
  };
  const reconcile = async () => {
    showPanel();
    setStatus('Drive 데이터를 확인하고 있어요…', true);
    const remoteFile = await findFile();
    const localRaw = localStorage.getItem(KEY);
    if (!remoteFile) {
      if (localRaw) await writeRemote(localRaw);
      else setStatus('연결됐어요. 다음 변경부터 자동 저장해요.', true);
      return;
    }
    const remote = await readRemote();
    if (!localRaw) {
      ignoreLocalWrite = true;
      nativeSetItem.call(localStorage, KEY, JSON.stringify(remote.data));
      location.reload();
      return;
    }
    if (JSON.stringify(remote.data) === localRaw) {
      setStatus('Drive와 최신 상태예요.', true);
      return;
    }
    pendingRemote = remote;
    actions.style.display = 'flex';
    setStatus('브라우저와 Drive 내용이 달라요. 사용할 내용을 선택하세요.', true);
  };
  const initClient = () => {
    if (!root.google || !root.google.accounts || !root.google.accounts.oauth2) return false;
    tokenClient = root.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: async response => {
        if (response.error) { showPanel(); setStatus('Google 연결이 취소됐어요.'); return; }
        token = response.access_token;
        nativeSetItem.call(localStorage, ENABLED_KEY, '1');
        try { await reconcile(); } catch (error) { showPanel(); setStatus(error.message); }
      }
    });
    return true;
  };
  const connect = prompt => {
    showPanel();
    setStatus('Google 로그인을 여는 중이에요…');
    if (!tokenClient && !initClient()) { setStatus('Google 로그인이 아직 준비되지 않았어요. 잠시 후 다시 눌러 주세요.'); return; }
    tokenClient.requestAccessToken({ prompt });
  };

  connectButton.addEventListener('click', () => token ? showPanel() : connect('consent'));
  loadButton.addEventListener('click', () => {
    if (!pendingRemote) return;
    ignoreLocalWrite = true;
    nativeSetItem.call(localStorage, KEY, JSON.stringify(pendingRemote.data));
    location.reload();
  });
  saveButton.addEventListener('click', () => {
    const raw = localStorage.getItem(KEY) || fallbackStoreRaw();
    writeRemote(raw).catch(error => setStatus(error.message));
  });
  Storage.prototype.setItem = function (key, value) {
    nativeSetItem.call(this, key, value);
    if (this === localStorage && key === KEY && token && !ignoreLocalWrite) queueSave(value);
  };

  root.moaDrive = {
    clientId: CLIENT_ID,
    connect: () => token ? showPanel() : connect('consent'),
    saveNow: () => {
      if (!token) return connect('consent');
      const raw = localStorage.getItem(KEY) || fallbackStoreRaw();
      showPanel();
      writeRemote(raw).catch(error => setStatus(error.message));
    },
    isConnected: () => !!token,
    getStatus: () => currentStatus
  };

  const readyTimer = setInterval(() => {
    if (!initClient()) return;
    clearInterval(readyTimer);
    if (localStorage.getItem(ENABLED_KEY) === '1') connect('');
  }, 250);
})(typeof window === 'undefined' ? globalThis : window);
