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

const KEY = 'moa_editorial_v4';
const LEGACY_KEY = 'allowance-plan-v3';
const GOAL_KEY = 'moa-goals-v1';
const SYNCED = [KEY, LEGACY_KEY, GOAL_KEY];

const parse = raw => { try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return null; } };

const validStore = s => {
  if (!s) return false;
  if (Array.isArray(s.accounts) && Array.isArray(s.transactions)) return true;
  if (s.months && typeof s.months === 'object') return true;
  return false;
};

const normalizeToV4 = raw => {
  try {
    const s = parse(raw);
    if (!s) return null;
    if (Array.isArray(s.accounts) && Array.isArray(s.transactions)) {
      return typeof raw === 'string' ? raw : JSON.stringify(s);
    }
    if (s.months && typeof s.months === 'object') {
      const txs = [];
      let totalBudget = 500000;
      Object.entries(s.months).forEach(([monthKey, m]) => {
        if (m && typeof m.allowance === 'number') totalBudget = m.allowance;
        if (m && Array.isArray(m.expenses)) {
          m.expenses.forEach((ex, idx) => {
            txs.push({
              id: ex.id || (Date.now() - idx * 1000),
              type: 'expense',
              date: ex.date || (monthKey + '-01'),
              name: ex.desc || ex.title || ex.memo || '지출',
              category: ex.category || '기타',
              account: 'toss',
              amount: Number(ex.amount) || 0
            });
          });
        }
      });
      const v4State = {
        accounts: [
          { id: 'toss', name: '토스뱅크', sub: '입출금 통장', balance: 1420000, type: 'toss' },
          { id: 'kakao', name: '카카오뱅크', sub: '저축 통장', balance: 2850000, type: 'kakao' },
          { id: 'cash', name: '현금', sub: '지갑', balance: 80000, type: 'cash' }
        ],
        transactions: txs.length > 0 ? txs : [
          { id: 1, type: 'expense', date: '2026-10-31', name: '오후의 커피', category: '카페', account: 'toss', amount: 5900 }
        ],
        budget: totalBudget
      };
      return JSON.stringify(v4State);
    }
    return null;
  } catch(e) {
    return null;
  }
};

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
  const localData = () => ({
    store: localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY) || '',
    goals: localStorage.getItem(GOAL_KEY) || ''
  });

  const upload = async () => {
    if (!user) return;
    const d = localData();
    if (d.store && !validStore(parse(d.store))) throw new Error('저장할 데이터 형식이 올바르지 않아요.');
    await setDoc(userDoc(), { ...d, updatedAt: serverTimestamp() }, { merge: true });
    notify(`클라우드에 저장했어요 · ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`);
  };
  const applyRemote = r => {
    applying = true;
    if (r.store) {
      const v4 = normalizeToV4(r.store);
      nativeSetItem.call(localStorage, KEY, v4 || r.store);
    }
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
