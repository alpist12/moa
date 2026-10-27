// MOA cloud sync: Google sign-in (Firebase Auth) + one Firestore doc per user.
// Exposes the same window.moaDrive API / 'moa-drive-change' event the app UI
// already uses, so the header button works unchanged.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';

// Public web config (not a secret). Access is enforced by firestore.rules.
const firebaseConfig = {
  apiKey: 'AIzaSyC1JCh6x-qfTw32c062keDs6QLOnr8aoLk',
  authDomain: 'moa-consume.firebaseapp.com',
  projectId: 'moa-consume',
  storageBucket: 'moa-consume.firebasestorage.app',
  messagingSenderId: '384650798076',
  appId: '1:384650798076:web:b3c19a77ac78f5c63a4879',
  measurementId: 'G-H94WTS4BGE'
};

const KEY = 'allowance-plan-v3';
const GOAL_KEY = 'moa-goals-v1';
const SYNCED = [KEY, GOAL_KEY];

const validMonth = m => m && typeof m.allowance === 'number' && Array.isArray(m.categories) && Array.isArray(m.expenses);
const validStore = s => s && s.months && typeof s.months === 'object' && Object.values(s.months).every(validMonth);
const parse = raw => { try { return JSON.parse(raw); } catch (e) { return null; } };

if (!location.hash.startsWith('#view=')) {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const nativeSetItem = Storage.prototype.setItem;
  let user = null, saveTimer = 0, applying = false;
  let status = 'Google로 로그인하면 어느 기기에서든 같은 기록을 볼 수 있어요.';

  const notify = (message, connected = !!user) => {
    status = message;
    window.dispatchEvent(new CustomEvent('moa-drive-change', { detail: { message, connected, name: user ? (user.displayName || user.email || '') : '' } }));
  };
  const userDoc = () => doc(db, 'users', user.uid);
  const localData = () => ({ store: localStorage.getItem(KEY) || '', goals: localStorage.getItem(GOAL_KEY) || '' });

  const upload = async () => {
    if (!user) return;
    const d = localData();
    if (d.store && !validStore(parse(d.store))) throw new Error('저장할 데이터 형식이 올바르지 않아요.');
    await setDoc(userDoc(), { ...d, updatedAt: serverTimestamp() }, { merge: true });
    notify(`클라우드에 저장했어요 · ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`);
  };
  const applyRemote = r => {
    applying = true;
    if (r.store) nativeSetItem.call(localStorage, KEY, r.store);
    if (r.goals) nativeSetItem.call(localStorage, GOAL_KEY, r.goals);
    location.reload();
  };

  // On sign-in: empty cloud -> upload this device; same -> nothing; different -> ask once.
  const reconcile = async () => {
    notify('클라우드 기록을 확인하고 있어요…');
    const snap = await getDoc(userDoc());
    const local = localData();
    if (!snap.exists() || !snap.data().store) { await upload(); return; }
    const remote = snap.data();
    if (!validStore(parse(remote.store))) { notify('클라우드 데이터 형식이 올바르지 않아 불러오지 않았어요.'); return; }
    if (remote.store === local.store && (remote.goals || '') === local.goals) { notify('클라우드와 최신 상태예요.'); return; }
    if (!local.store) { applyRemote(remote); return; }
    const useCloud = window.confirm('이 계정에 저장된 기록이 있어요.\n\n[확인] 클라우드 기록 불러오기\n[취소] 이 기기의 기록으로 클라우드 덮어쓰기');
    if (useCloud) applyRemote(remote); else await upload();
  };

  // every local save of the ledger/goals is mirrored to the cloud (debounced)
  Storage.prototype.setItem = function (key, value) {
    nativeSetItem.call(this, key, value);
    if (this === localStorage && SYNCED.includes(key) && user && !applying) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => upload().catch(e => notify('저장 실패: ' + e.message)), 900);
    }
  };

  onAuthStateChanged(auth, u => {
    user = u;
    if (!u) { notify('Google로 로그인하면 어느 기기에서든 같은 기록을 볼 수 있어요.', false); return; }
    reconcile().catch(e => notify('동기화 실패: ' + e.message));
  });

  window.moaDrive = {
    connect: async () => {
      try {
        if (!user) await signInWithPopup(auth, new GoogleAuthProvider());
        else if (window.confirm(`${user.displayName || user.email} 계정에서 로그아웃할까요?\n이 기기의 기록은 그대로 남아요.`)) await signOut(auth);
      } catch (e) {
        notify(e && e.code === 'auth/popup-closed-by-user' ? '로그인이 취소됐어요.' : '로그인 실패: ' + (e && e.message));
      }
    },
    saveNow: () => (user ? upload().catch(e => notify('저장 실패: ' + e.message)) : window.moaDrive.connect()),
    isConnected: () => !!user,
    getStatus: () => status
  };
  notify(status, false);
}
