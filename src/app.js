const KEY = 'allowance-plan-v3';
const GOAL_KEY = 'moa-goals-v1';
const LAST_PREF_KEY = 'moa-last-input-pref';
const clone = o => JSON.parse(JSON.stringify(o));
const won = n => '₩' + Math.abs(Number(n) || 0).toLocaleString('ko-KR');
const sgn = n => (n < 0 ? '-' : '') + won(n);
// 400000 -> '40만원', 35000 -> '3만 5천원', 3000 -> '3천원' (hint under amount inputs)
const kor = n => {
  n = Math.round(Number(n) || 0);
  if (n <= 0) return '';
  const p = [], eok = Math.floor(n / 1e8), man = Math.floor(n % 1e8 / 1e4), chun = Math.floor(n % 1e4 / 1000), rest = n % 1000;
  if (eok) p.push(eok.toLocaleString('ko-KR') + '억');
  if (man) p.push((man % 1000 ? man.toLocaleString('ko-KR') : man / 1000 + '천') + '만');
  if (chun) p.push(chun + '천');
  if (rest) p.push(rest);
  return p.join(' ') + '원';
};
const enc = o => { const b = new TextEncoder().encode(JSON.stringify(o)); let s = ''; b.forEach(c => s += String.fromCharCode(c)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const dec = s => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
const validM = o => o && typeof o.allowance === 'number' && !Number.isNaN(o.allowance) && Array.isArray(o.categories) && Array.isArray(o.expenses);
const toStore = o => { if (!o) return null; if (o.months && typeof o.months === 'object' && Object.values(o.months).every(validM)) return o; if (validM(o)) return { current: o.month, months: { [o.month]: o } }; return null; };
const persist = st => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
const _n = new Date();
const TODAY = _n.getFullYear() + '-' + String(_n.getMonth() + 1).padStart(2, '0') + '-' + String(_n.getDate()).padStart(2, '0');
const PALETTE = [['#f0466e', '#fff0f4'], ['#4f7bff', '#e7eeff'], ['#f59e0b', '#fff6e5'], ['#8b5cf6', '#f3e9ff'], ['#0f9d6a', '#e8f8f0'], ['#8b87a0', '#f0eff5']];
const GREEN = ['#0f9d6a', '#e8f8f0'];
// chart gradients (light -> deep), same order as PALETTE
const GRAD = [['#f0466e', '#f0466e'], ['#4f7bff', '#4f7bff'], ['#f59e0b', '#f59e0b'], ['#8b5cf6', '#8b5cf6'], ['#0f9d6a', '#0f9d6a'], ['#8b87a0', '#8b87a0']];
const IN_CATS = ['아르바이트', '선물·세뱃돈', '기타 수입'];
const OUT_METHODS = ['카드', '현금', '계좌·페이'];
const IN_METHODS = ['계좌·페이', '현금', '기타'];
const ALL_METHODS = ['카드', '현금', '계좌·페이', '기타'];
const DEF_PRESETS = [
  { kind: 'out', title: '점심 식사', category: '식비', method: '카드', amount: 9000 },
  { kind: 'out', title: '편의점·간식', category: '카페·간식', method: '카드', amount: 4500 },
  { kind: 'out', title: '대중교통', category: '교통', method: '카드', amount: 1500 },
  { kind: 'out', title: '카페·커피', category: '카페·간식', method: '카드', amount: 4500 },
  { kind: 'in', title: '용돈·추가수입', category: '선물·세뱃돈', method: '계좌·페이', amount: 50000 }
];
const DOW = '일월화수목금토';
const DEFAULT = () => ({
  month: TODAY.slice(0, 7), allowance: 0,
  categories: [{ id: 'c1', name: '식비', amount: 0 }, { id: 'c2', name: '교통', amount: 0 }, { id: 'c3', name: '카페·간식', amount: 0 }, { id: 'c4', name: '쇼핑', amount: 0 }, { id: 'c5', name: '기타', amount: 0 }],
  incomes: [],
  expenses: [],
  pendings: []
});
const DEFAULT_GOALS = () => ([]);
const isDemoMonth = m => m && m.allowance === 350000 && Array.isArray(m.expenses) && m.expenses.some(e => e.id === 1 && e.title === '간식' && e.amount === 8000);
const cleanDemoStore = st => {
  if (!st || !st.months) return st;
  let dirty = false;
  Object.keys(st.months).forEach(k => {
    const m = st.months[k];
    if (isDemoMonth(m)) {
      dirty = true;
      m.allowance = 0;
      (m.categories || []).forEach(c => { if ([120000, 45000, 60000, 65000, 35000].includes(c.amount)) c.amount = 0; });
      m.incomes = (m.incomes || []).filter(x => !(x.id === 101 && x.title === '주말 카페 아르바이트'));
      m.expenses = (m.expenses || []).filter(x => !(x.id >= 1 && x.id <= 10));
    }
  });
  if (dirty) persist(st);
  return st;
};
const OB_ICON = {
  food: 'M7 3v7a2 2 0 0 0 4 0V3M9 12v9M17 3c-2 1.5-3 4-3 8h3v10',
  bus: 'M6 4h12a2 2 0 0 1 2 2v10H4V6a2 2 0 0 1 2-2zM4 11h16M7 16v3M17 16v3',
  cup: 'M5 8h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M9 3v2M13 3v2'
};
const INTRO_KEY = 'moa-intro-seen';
const PAGES = {
  dash: ['대시보드', '내 용돈, 한눈에 보기', '이번 달 지출 계획부터 수입·지출까지, 차근차근 관리해 보세요.'],
  cal: ['달력', '가계부 달력', '날짜별로 들어온 돈과 나간 돈을 달력으로 확인해 보세요.'],
  stat: ['통계', '나의 소비 통계', '월·분기·연 단위로 지출 추이와 항목별 비율을 확인해 보세요.'],
  plan: ['지출 계획서', '지출 계획서', '항목별 지출 한도를 정하고 이번 달 소비 흐름을 계획해 보세요.'],
  goal: ['목표', '모으기 목표', '목표 금액과 기한을 정하고 차근차근 모아가 보세요.'],
  exp: ['가계부', '나의 가계부', '수입과 지출을 날짜순으로 기록하고 잔액을 확인해 보세요.'],
  share: ['공유 링크', '내 기록 공유하기', '링크 하나로 지출 계획서와 가계부를 보여 줄 수 있어요.']
};

class Component extends DCLogic {
  constructor(p) {
    super(p);
    const init = this.resolveInitialState();
    this.state = {
      ...init,
      q: '', filter: '', methodFilter: '', kind: 'all', sortOrder: 'dateDesc', viewMode: 'table', selectedKeys: [],
      statPeriod: 'month', goalTab: 'active',
      quick: this.blank(init.store.months[init.month], 'out'), quickExtras: [], quickError: '',
      modalOpen: false, draft: this.blank(init.store.months[init.month], 'out'), batchDrafts: [], draftError: '',
      goalModalOpen: false, goalDraft: { title: '', target: '200000', current: '0', deadline: TODAY },
      excelModalOpen: false, excelRows: [], excelPaste: '', excelError: '', excelFileName: '',
      settleModalOpen: false, settleDraft: { id: null, title: '', category: '식비', method: '카드', date: TODAY, totalAmt: 0, people: 2, roundMode: 'none', myAmt: '0', tag: '1/2 N빵' },
      toast: '', shareUrls: { plan: '', ledger: '' },
      driveConnected: !!(window.moaDrive && window.moaDrive.isConnected && window.moaDrive.isConnected()),
      driveStatus: (window.moaDrive && window.moaDrive.getStatus && window.moaDrive.getStatus()) || 'Google로 로그인하면 어느 기기에서든 같은 기록을 볼 수 있어요.'
    };
    let seen = false; try { seen = localStorage.getItem(INTRO_KEY) === '1'; } catch (e) {}
    this.state.intro = init.readOnly ? '' : 'splash'; this.state.obSeen = seen; this.state.obStep = 0;
  }
  resolveInitialState() {
    let store = null, readOnly = false, sharedAt = '', scope = null;
    const m = (location.hash || '').match(/^#view=(.+)$/);
    if (m) {
      try {
        const raw = dec(m[1]);
        const d = toStore(raw);
        if (d) {
          store = d;
          readOnly = true;
          scope = raw.scope || null;
          if (raw.t) sharedAt = new Date(raw.t).toLocaleString('ko-KR') + ' 기준 내용이에요.';
        }
      } catch (e) {}
    }
    if (!store) {
      for (const k of [KEY, 'allowance-plan-v2']) {
        try {
          const s = toStore(JSON.parse(localStorage.getItem(k)));
          if (s) { store = cleanDemoStore(s); break; }
        } catch (e) {}
      }
    }
    if (!store) {
      store = toStore(DEFAULT());
      if (!readOnly) persist(store);
    }
    let goals = null;
    try { goals = JSON.parse(localStorage.getItem(GOAL_KEY)); } catch (e) {}
    if (Array.isArray(goals)) {
      const cleaned = goals.filter(g => !((g.id === 'g1' && g.title === '비상금 통장 모으기') || (g.id === 'g2' && g.title === '무선 이어폰 구매')));
      if (cleaned.length !== goals.length) {
        goals = cleaned;
        try { localStorage.setItem(GOAL_KEY, JSON.stringify(goals)); } catch (e) {}
      }
    } else {
      goals = DEFAULT_GOALS();
    }
    const keys = Object.keys(store.months).sort(), tm = TODAY.slice(0, 7);
    const month = readOnly && store.months[store.current] ? store.current : store.months[tm] ? tm : store.months[store.current] ? store.current : keys[keys.length - 1];
    return {
      store, goals, month, selDay: this.defDay(month), readOnly, sharedAt, scope,
      page: scope === 'plan' ? 'plan' : scope === 'ledger' ? 'exp' : 'dash'
    };
  }
  componentDidMount() {
    window.addEventListener('resize', this._rs = () => { if (this.state.intro) this.forceUpdate(); });
    window.addEventListener('moa-drive-change', this._dc = ev => {
      if (ev && ev.detail) this.setState({ driveConnected: !!ev.detail.connected, driveStatus: ev.detail.message || '' });
    });
    window.addEventListener('hashchange', this._hc = () => {
      const next = this.resolveInitialState();
      this.setState({ ...next, q: '', filter: '', modalOpen: false });
    });
    if (this.state.intro === 'splash') {
      const wait = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ? 400 : 2500;
      this._it = setTimeout(this.leaveIntro, wait);
    }
  }
  componentWillUnmount() {
    clearTimeout(this._it);
    clearTimeout(this._t);
    clearTimeout(this._raf);
    window.removeEventListener('resize', this._rs);
    window.removeEventListener('moa-drive-change', this._dc);
    window.removeEventListener('hashchange', this._hc);
  }
  finishIntro = () => { try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) {} this.setState({ obSeen: true }); this.leaveIntro(); };
  // fade the current intro screen out (~0.38s), then show the next one (onboarding or the app)
  leaveIntro = () => {
    clearTimeout(this._it);
    if (this.state.introLeaving) return;
    this.setState({ introLeaving: true });
    this._it = setTimeout(() => this.setState(s => ({ introLeaving: false, intro: s.intro === 'splash' && !s.obSeen ? 'ob' : '' })), 380);
  };
  triggerDriveConnect = () => {
    if (window.moaDrive && window.moaDrive.connect) window.moaDrive.connect();
    else { const b = document.querySelector('[data-drive-connect]'); if (b) b.click(); }
  };
  introVals() {
    const { intro, obStep: step } = this.state, last = 2, ig = '#0f9d6a';
    if (!intro) return { showIntro: false };
    const v = {
      showIntro: true, showSplash: intro === 'splash', showOb: intro === 'ob', ig,
      // leaving to the app fades the whole overlay; splash -> onboarding fades only the splash
      introDlgClass: this.state.introLeaving && (intro === 'ob' || this.state.obSeen) ? 'intro-leave' : '',
      splashClass: this.state.introLeaving && intro === 'splash' && !this.state.obSeen ? 'intro-leave' : '',
      introSkipSplash: this.leaveIntro,
      obNotLast: step < last, obBtn: step < last ? '다음' : '가계부 시작하기',
      obNext: () => step < last ? this.setState({ obStep: step + 1 }) : this.finishIntro(),
      obSkip: () => this.finishIntro(),
      obStartWithDrive: () => {
        this.finishIntro();
        this.triggerDriveConnect();
      },
      obDots: [0, 1, 2].map(i => ({ w: i === step ? '22px' : '6px', bg: i === step ? ig : '#e2e0ea' })),
      obLedgerRows: [
        { sign: '+', title: '이번 달 수입 기록', cat: '수입 · 용돈/급여', amt: '+ 0원', color: '#0f9d6a', soft: '#e8f8f0', amtColor: '#0f9d6a', d: '.35s' },
        { sign: '−', title: '식비 지출 기록', cat: '지출 · 식비', amt: '− 0원', color: '#f0466e', soft: '#fff0f4', amtColor: '#34313f', d: '.5s' },
        { sign: '−', title: '교통비 지출 기록', cat: '지출 · 교통', amt: '− 0원', color: '#4f7bff', soft: '#e7eeff', amtColor: '#34313f', d: '.65s' }
      ],
      obSpend: [
        { name: '식비', amount: '예산 한도 설정', w: '64%', color: '#f0466e', soft: '#fff0f4', icon: OB_ICON.food, d1: '.35s', d2: '.45s' },
        { name: '교통', amount: '실시간 비중 확인', w: '46%', color: '#4f7bff', soft: '#e7eeff', icon: OB_ICON.bus, d1: '.48s', d2: '.58s' },
        { name: '카페·간식', amount: '소비 흐름 분석', w: '34%', color: '#f59e0b', soft: '#fff6e5', icon: OB_ICON.cup, d1: '.6s', d2: '.7s' }
      ]
    };
    for (let i = 0; i <= last; i++) v['ob' + i] = step === i;
    return v;
  }
  defDay(month) { return TODAY.startsWith(month) ? +TODAY.slice(8) : 1; }
  cur() { return this.state.store.months[this.state.month]; }
  blank(d, kind, date) {
    let lastCat = '', lastMethod = '';
    try {
      const lp = JSON.parse(localStorage.getItem(LAST_PREF_KEY) || '{}');
      lastCat = lp[kind] || '';
      lastMethod = lp[kind + 'Method'] || '';
    } catch (e) {}
    const defCat = kind === 'in'
      ? (IN_CATS.includes(lastCat) ? lastCat : IN_CATS[0])
      : ((d.categories.find(c => c.name === lastCat) || d.categories[0] || {}).name || '기타');
    const defMethod = kind === 'in'
      ? (IN_METHODS.includes(lastMethod) ? lastMethod : IN_METHODS[0])
      : (OUT_METHODS.includes(lastMethod) ? lastMethod : OUT_METHODS[0]);
    return { kind, title: '', amount: '', method: defMethod, category: defCat, date: date || (TODAY.startsWith(d.month) ? TODAY : d.month + '-01') };
  }
  upd(fn) {
    if (this.state.readOnly) return;
    this.setState(s => {
      const store = clone(s.store);
      const md = store.months[s.month];
      md.incomes = md.incomes || [];
      md.pendings = md.pendings || [];
      store.months[s.month] = fn(md);
      store.current = s.month;
      persist(store);
      return { store };
    });
  }
  saveGoals(goals) {
    try { localStorage.setItem(GOAL_KEY, JSON.stringify(goals)); } catch (e) {}
    this.setState({ goals });
  }
  say(msg) { this.setState({ toast: msg }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: '' }), 2400); }
  go = page => () => { this._tn = (this._tn || 0) + 1; this.setState({ page }); window.scrollTo({ top: 0 }); };
  shiftMonth = delta => () => {
    const { store, month, readOnly } = this.state;
    if (readOnly) {
      const keys = Object.keys(store.months).sort();
      const k = keys[keys.indexOf(month) + delta];
      if (k) this.setState({ month: k, selDay: this.defDay(k), q: '', filter: '', methodFilter: '', selectedKeys: [] });
      return;
    }
    const [y, mm] = month.split('-').map(Number);
    const dt = new Date(y, mm - 1 + delta, 1);
    const key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
    const st = clone(store);
    if (!st.months[key]) {
      const src = st.months[month];
      st.months[key] = { month: key, allowance: src.allowance, categories: src.categories.map(c => ({ ...c })), incomes: [], expenses: [], pendings: [] };
    }
    st.current = key;
    persist(st);
    this.setState({
      store: st, month: key, selDay: this.defDay(key),
      q: '', filter: '', methodFilter: '', selectedKeys: [],
      quick: this.blank(st.months[key], 'out'), quickExtras: [], quickError: '',
      shareUrls: { plan: '', ledger: '' }
    });
  };
  makeBlankRow(d, kind = 'out', date) {
    const b = this.blank(d, kind, date);
    return { ...b, uid: 'br_' + Date.now() + '_' + Math.floor(Math.random() * 100000) };
  }
  openWith = (kind, date) => this.setState({ modalOpen: true, draft: this.blank(this.cur(), kind, date), batchDrafts: [], draftError: '' });
  openBatchModal = (kind = 'out', date) => {
    const d = this.cur();
    this.setState({
      modalOpen: true,
      draft: this.blank(d, kind, date),
      batchDrafts: [this.makeBlankRow(d, kind, date), this.makeBlankRow(d, kind, date)],
      draftError: ''
    });
  };
  openEdit = x => this.setState({
    modalOpen: true,
    draft: {
      kind: x.k, title: x.title, amount: String(x.amount),
      method: x.method || (x.k === 'in' ? '계좌·페이' : '카드'),
      category: x.category, date: x.date, editId: x.id, editKind: x.k
    },
    batchDrafts: [],
    draftError: ''
  });
  makeShare = scope => () => {
    const m = this.state.month, src = this.state.store.months[m];
    const md = scope === 'plan' ? { month: m, allowance: src.allowance, categories: src.categories, incomes: [], expenses: [] } : { ...src, incomes: src.incomes || [] };
    const url = location.href.split('#')[0] + '#view=' + enc({ scope, current: m, months: { [m]: md }, t: Date.now() });
    this.setState(s => ({ shareUrls: { ...s.shareUrls, [scope]: url } }));
    this.say(scope === 'plan' ? '지출 계획서 공유 링크를 만들었어요.' : '가계부 공유 링크를 만들었어요.');
  };
  copyShare = scope => async () => {
    const u = this.state.shareUrls[scope];
    if (!u) return;
    try { await navigator.clipboard.writeText(u); this.say('공유 주소를 복사했어요.'); }
    catch (e) { window.prompt('아래 링크를 복사하세요', u); }
  };
  saveExpense = () => {
    const { draft, batchDrafts } = this.state, data = this.cur();
    const editing = draft.editId != null;
    if (editing) {
      const amount = Math.round(Number(draft.amount));
      if (!Number.isFinite(amount) || amount <= 0) return this.setState({ draftError: '올바른 금액을 입력하세요.' });
      if (!draft.date || !draft.date.startsWith(data.month)) return this.setState({ draftError: '이번 달 날짜만 등록할 수 있어요.' });
      const category = (draft.category || '').trim() || (draft.kind === 'in' ? IN_CATS[0] : '기타');
      const method = (draft.method || '').trim() || (draft.kind === 'in' ? IN_METHODS[0] : OUT_METHODS[0]);
      const title = (draft.title || '').trim() || category;
      const item = { id: draft.editId, title, category, method, date: draft.date, amount };
      this.upd(d => {
        const k = draft.editKind === 'in' ? 'incomes' : draft.editKind === 'pending' ? 'pendings' : 'expenses';
        d[k] = (d[k] || []).filter(e => e.id !== draft.editId);
        const targetKey = draft.kind === 'in' ? 'incomes' : draft.kind === 'pending' ? 'pendings' : 'expenses';
        d[targetKey] = d[targetKey] || [];
        d[targetKey].push(item);
        return d;
      });
      this.setState({ modalOpen: false, batchDrafts: [], draftError: '', selDay: +draft.date.slice(8) || 1 });
      this.say('기록을 수정했어요.');
      return;
    }

    const candidates = [...(batchDrafts || []), draft].filter(r => Math.round(Number(r.amount)) > 0);
    if (!candidates.length) return this.setState({ draftError: '금액이 입력된 내역이 없어요. 최소 1건 이상 금액(원)을 입력해 주세요.' });
    const badDate = candidates.find(r => !r.date || !r.date.startsWith(data.month));
    if (badDate) return this.setState({ draftError: `이번 달(${data.month}) 날짜만 등록할 수 있어요.` });

    const nowBase = Date.now();
    let seq = 0;
    const last = candidates[candidates.length - 1];
    try {
      const lp = JSON.parse(localStorage.getItem(LAST_PREF_KEY) || '{}');
      const pk = last.kind === 'in' ? 'in' : 'out';
      lp[pk] = (last.category || '').trim() || (last.kind === 'in' ? IN_CATS[0] : '기타');
      lp[pk + 'Method'] = (last.method || '').trim() || (last.kind === 'in' ? IN_METHODS[0] : OUT_METHODS[0]);
      localStorage.setItem(LAST_PREF_KEY, JSON.stringify(lp));
    } catch (e) {}

    this.upd(d => {
      candidates.forEach(r => {
        const amount = Math.round(Number(r.amount));
        const category = (r.category || '').trim() || (r.kind === 'in' ? IN_CATS[0] : '기타');
        const method = (r.method || '').trim() || (r.kind === 'in' ? IN_METHODS[0] : OUT_METHODS[0]);
        const title = (r.title || '').trim() || category;
        const item = { id: nowBase + (++seq), title, category, method, date: r.date, amount };
        const targetKey = r.kind === 'in' ? 'incomes' : r.kind === 'pending' ? 'pendings' : 'expenses';
        d[targetKey] = d[targetKey] || [];
        d[targetKey].push(item);
      });
      return d;
    });
    this.setState({ modalOpen: false, batchDrafts: [], draftError: '', selDay: +last.date.slice(8) || 1 });
    if (candidates.length > 1) this.say(`✅ 총 ${candidates.length}건의 가계부 내역을 한꺼번에 저장했어요!`);
    else this.say(last.kind === 'in' ? '수입을 저장했어요.' : last.kind === 'pending' ? '⏳ 임시 지출예상 내역으로 적어두었어요.' : '지출을 저장했어요.');
  };
  saveQuick = () => {
    const { quick, quickExtras } = this.state, data = this.cur();
    const candidates = [quick, ...(quickExtras || [])].filter(r => Math.round(Number(r.amount)) > 0);
    if (!candidates.length) return this.setState({ quickError: '금액을 입력해 주세요. (예: 9000)' });
    const badDate = candidates.find(r => !r.date || !r.date.startsWith(data.month));
    if (badDate) return this.setState({ quickError: `선택된 달(${data.month})의 날짜만 등록할 수 있어요.` });

    const nowBase = Date.now();
    let seq = 0;
    const last = candidates[candidates.length - 1];
    try {
      const lp = JSON.parse(localStorage.getItem(LAST_PREF_KEY) || '{}');
      const pk = last.kind === 'in' ? 'in' : 'out';
      lp[pk] = (last.category || '').trim() || (last.kind === 'in' ? IN_CATS[0] : '기타');
      lp[pk + 'Method'] = (last.method || '').trim() || (last.kind === 'in' ? IN_METHODS[0] : OUT_METHODS[0]);
      localStorage.setItem(LAST_PREF_KEY, JSON.stringify(lp));
    } catch (e) {}

    this.upd(d => {
      candidates.forEach(r => {
        const amount = Math.round(Number(r.amount));
        const category = (r.category || '').trim() || (r.kind === 'in' ? IN_CATS[0] : '기타');
        const method = (r.method || '').trim() || (r.kind === 'in' ? IN_METHODS[0] : OUT_METHODS[0]);
        const title = (r.title || '').trim() || category;
        const item = { id: nowBase + (++seq), title, category, method, date: r.date, amount };
        const targetKey = r.kind === 'in' ? 'incomes' : r.kind === 'pending' ? 'pendings' : 'expenses';
        d[targetKey] = d[targetKey] || [];
        d[targetKey].push(item);
      });
      return d;
    });
    this.setState(s => ({
      quick: { ...s.quick, title: '', amount: '' },
      quickExtras: [],
      quickError: '',
      selDay: +last.date.slice(8) || 1
    }));
    if (candidates.length > 1) {
      const sumAll = candidates.reduce((a, r) => a + Math.round(Number(r.amount) || 0), 0);
      this.say(`⚡ 총 ${candidates.length}건 (${won(sumAll)}) 내역을 한꺼번에 등록했어요!`);
    } else {
      const amt0 = Math.round(Number(last.amount));
      const t0 = (last.title || '').trim() || (last.category || '내역');
      this.say(last.kind === 'pending' ? `⏳ '${t0}' (${won(amt0)})을 임시 지출예상 내역에 적어두었어요.` : `${t0} (${won(amt0)}) 내역을 빠르게 등록했어요.`);
    }
  };
  downloadCsv = () => {
    const d = this.cur();
    const items = [
      ...(d.allowance > 0 ? [{ date: d.month + '-01', k: '수입', method: '예산', category: '용돈', title: '이번 달 예산', amount: d.allowance }] : []),
      ...(d.incomes || []).map(x => ({ ...x, k: '수입', method: x.method || '계좌·페이' })),
      ...d.expenses.map(x => ({ ...x, k: '지출', method: x.method || '카드' })),
      ...(d.pendings || []).map(x => ({ ...x, k: '임시', method: x.method || '카드' }))
    ].sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    const rows = [
      ['날짜', '구분', '결제수단', '분류', '사용내역', '수입(원)', '지출(원)', '임시·미정(원)', '확정잔액(원)'],
      ...items.map(x => {
        if (x.k === '수입') running += x.amount;
        else if (x.k === '지출') running -= x.amount;
        return [
          x.date, x.k, x.method, x.category, x.title,
          x.k === '수입' ? x.amount : '',
          x.k === '지출' ? x.amount : '',
          x.k === '임시' ? x.amount : '',
          running
        ];
      })
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = d.month + '_가계부.csv';
    a.click();
  };
  downloadTemplate = () => {
    const d = this.cur(), m = d.month;
    const rows = [
      ['날짜(YYYY-MM-DD)', '구분(지출/수입/임시)', '결제수단(카드/현금/계좌·페이)', '분류(카테고리)', '내용(사용내역)', '금액(원)'],
      [m + '-02', '지출', '카드', '식비', '학생식당 점심 식사', '7000'],
      [m + '-03', '지출', '현금', '간식·카페', '아이스 아메리카노', '4500'],
      [m + '-05', '수입', '계좌·페이', '아르바이트', '주말 아르바이트 급여', '80000'],
      [m + '-08', '지출', '카드', '교통', '시내버스·지하철 교통카드 충전', '30000'],
      [m + '-09', '임시', '카드', '식비', '친구들과 저녁 삼겹살 (N빵할지 사줄지 미정)', '36000']
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `MOA_${m}_가계부_일괄등록_양식.csv`;
    a.click();
    this.say('엑셀(CSV) 일괄등록 양식을 다운로드했어요.');
  };
  parseCsvLine(line, sep) {
    const out = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === sep) { out.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  }
  normalizeExcelDate(raw, defMonth) {
    const s = String(raw || '').trim().replace(/[년월/.]/g, '-').replace(/일/g, '').replace(/\s+/g, '');
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      const yy = m[1], mm = String(Math.min(12, Math.max(1, +m[2]))).padStart(2, '0'), dd = String(Math.min(31, Math.max(1, +m[3]))).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    }
    m = s.match(/^(\d{1,2})-(\d{1,2})$/);
    if (m) {
      const yy = defMonth.slice(0, 4), mm = String(Math.min(12, Math.max(1, +m[1]))).padStart(2, '0'), dd = String(Math.min(31, Math.max(1, +m[2]))).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    }
    m = s.match(/^(\d{1,2})$/);
    if (m) {
      const dd = String(Math.min(31, Math.max(1, +m[1]))).padStart(2, '0');
      return `${defMonth}-${dd}`;
    }
    return '';
  }
  parseExcelText(text) {
    const defMonth = this.state.month;
    const lines = String(text || '').replace(/\uFEFF/g, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const sep = lines[0].includes('\t') ? '\t' : (lines[0].split(';').length > lines[0].split(',').length ? ';' : ',');
    const rawRows = lines.map(l => this.parseCsvLine(l, sep));
    let startIdx = 0;
    let colMap = { date: 0, kind: 1, method: 2, cat: 3, title: 4, amt: 5, inAmt: -1, outAmt: -1 };
    const h0 = rawRows[0].map(c => c.replace(/\s+/g, '').toLowerCase());
    const isHeader = h0.some(c => c.includes('날짜') || c.includes('일자') || c.includes('date') || c.includes('금액') || c.includes('내용') || c.includes('내역') || c.includes('수입') || c.includes('지출'));
    if (isHeader) {
      startIdx = 1;
      const findCol = keys => h0.findIndex(c => keys.some(k => c.includes(k)));
      const dIdx = findCol(['날짜', '일자', 'date']);
      const kIdx = findCol(['구분', '유형', '종류', 'type', 'kind']);
      const mIdx = findCol(['결제', '수단', '카드', 'method']);
      const cIdx = findCol(['분류', '카테고리', '항목', 'category']);
      const tIdx = findCol(['내용', '사용내역', '내역', '메모', '적요', 'title', 'memo']);
      const aIdx = findCol(['금액', 'amount', '합계']);
      const inIdx = findCol(['수입(', '수입금액', '입금']);
      const outIdx = findCol(['지출(', '지출금액', '출금']);
      if (dIdx >= 0) colMap.date = dIdx;
      if (kIdx >= 0) colMap.kind = kIdx; else if (rawRows[0].length <= 4) colMap.kind = -1;
      if (mIdx >= 0) colMap.method = mIdx; else if (rawRows[0].length <= 5) colMap.method = -1;
      if (cIdx >= 0) colMap.cat = cIdx; else if (rawRows[0].length <= 4) colMap.cat = -1;
      if (tIdx >= 0) colMap.title = tIdx;
      if (aIdx >= 0) colMap.amt = aIdx;
      if (inIdx >= 0 && outIdx >= 0) { colMap.inAmt = inIdx; colMap.outAmt = outIdx; }
    } else if (rawRows[0].length === 4) {
      colMap = { date: 0, kind: 1, method: -1, cat: -1, title: 2, amt: 3, inAmt: -1, outAmt: -1 };
    } else if (rawRows[0].length === 5) {
      colMap = { date: 0, kind: 1, method: -1, cat: 2, title: 3, amt: 4, inAmt: -1, outAmt: -1 };
    }
    const parsed = [];
    let seq = 0;
    for (let i = startIdx; i < rawRows.length; i++) {
      const r = rawRows[i];
      if (!r || !r.length || r.every(c => !c)) continue;
      const date = this.normalizeExcelDate(r[colMap.date], defMonth);
      if (!date) continue;
      const rawMethod = colMap.method >= 0 ? (r[colMap.method] || '').trim() : '';
      if (rawMethod === '예산' || (r[colMap.title] || '').trim() === '이번 달 예산') continue;
      let kind = 'out';
      const rawKind = colMap.kind >= 0 ? (r[colMap.kind] || '').trim().toLowerCase() : '';
      if (rawKind.includes('임시') || rawKind.includes('미정') || rawKind.includes('보류') || rawKind.includes('예상') || rawKind === 'pending') kind = 'pending';
      else if (rawKind.includes('수입') || rawKind.includes('입금') || rawKind === '+' || rawKind === 'in' || rawKind === 'income') kind = 'in';
      else if (rawKind.includes('지출') || rawKind.includes('출금') || rawKind === '-' || rawKind === 'out' || rawKind === 'expense') kind = 'out';
      let amount = 0;
      if (colMap.inAmt >= 0 && colMap.outAmt >= 0) {
        const inV = Math.round(Number(String(r[colMap.inAmt] || '').replace(/[^0-9.-]/g, '')) || 0);
        const outV = Math.round(Number(String(r[colMap.outAmt] || '').replace(/[^0-9.-]/g, '')) || 0);
        if (inV > 0 && !rawKind.includes('지출')) { kind = 'in'; amount = inV; }
        else { kind = 'out'; amount = outV || inV; }
      } else {
        const rawAmt = String(r[colMap.amt] ?? r[r.length - 1] ?? '').trim();
        if (colMap.kind < 0 && rawAmt.startsWith('+')) kind = 'in';
        amount = Math.abs(Math.round(Number(rawAmt.replace(/[^0-9.-]/g, '')) || 0));
      }
      if (!amount || amount <= 0) continue;
      let method = kind === 'in' ? '계좌·페이' : '카드';
      if (rawMethod.includes('현금')) method = '현금';
      else if (rawMethod.includes('계좌') || rawMethod.includes('페이') || rawMethod.includes('이체') || rawMethod.includes('통장')) method = '계좌·페이';
      else if (rawMethod.includes('카드') || rawMethod.includes('체크') || rawMethod.includes('신용')) method = '카드';
      const category = (colMap.cat >= 0 ? (r[colMap.cat] || '').trim() : '') || (kind === 'in' ? IN_CATS[0] : '기타');
      const title = (colMap.title >= 0 ? (r[colMap.title] || '').trim() : '') || category;
      parsed.push({ uid: 'ex_' + Date.now() + '_' + (++seq), date, kind, method, category, title, amount });
    }
    return parsed;
  }
  triggerExcelUpload = () => {
    if (this.state.readOnly) return;
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.csv,.txt,.tsv,text/csv,application/vnd.ms-excel';
    inp.onchange = ev => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        const buf = e.target.result;
        let text = '';
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
        } catch (err) {
          try { text = new TextDecoder('euc-kr').decode(buf); }
          catch (err2) { text = new TextDecoder().decode(buf); }
        }
        const rows = this.parseExcelText(text);
        if (!rows.length) {
          this.setState({ excelModalOpen: true, excelFileName: file.name, excelError: '파일에서 유효한 내역을 찾지 못했어요. 날짜(YYYY-MM-DD)와 금액(원)이 올바른지 확인해 주세요.' });
          return;
        }
        this.setState({ excelModalOpen: true, excelFileName: file.name, excelRows: rows, excelError: '' });
        this.say(`'${file.name}'에서 ${rows.length}건의 내역을 불러왔어요.`);
      };
      reader.readAsArrayBuffer(file);
    };
    inp.click();
  };
  commitExcelUpload = () => {
    const { excelRows, readOnly } = this.state;
    if (readOnly || !excelRows || !excelRows.length) return;
    let seq = 0;
    const nowBase = Date.now();
    const monthsTouched = new Set();
    this.setState(s => {
      const store = clone(s.store);
      excelRows.forEach(r => {
        const mk = r.date.slice(0, 7);
        monthsTouched.add(mk);
        if (!store.months[mk]) {
          const src = store.months[s.month] || DEFAULT();
          store.months[mk] = { month: mk, allowance: src.allowance, categories: src.categories.map(c => ({ ...c })), incomes: [], expenses: [] };
        }
        const md = store.months[mk];
        md.incomes = md.incomes || [];
        md.expenses = md.expenses || [];
        md.pendings = md.pendings || [];
        if (r.kind !== 'in' && r.category && !md.categories.some(c => c.name === r.category)) {
          md.categories.push({ id: 'c_' + nowBase + '_' + (++seq), name: r.category, amount: 0 });
        }
        const item = { id: nowBase + (++seq), title: r.title, category: r.category, method: r.method, date: r.date, amount: r.amount };
        if (r.kind === 'in') md.incomes.push(item);
        else if (r.kind === 'pending') md.pendings.push(item);
        else md.expenses.push(item);
      });
      const targetMonth = monthsTouched.has(s.month) ? s.month : [...monthsTouched].sort().pop();
      store.current = targetMonth;
      persist(store);
      return {
        store,
        month: targetMonth,
        excelModalOpen: false,
        excelRows: [],
        excelPaste: '',
        excelFileName: '',
        excelError: ''
      };
    });
    this.say(`총 ${excelRows.length}건의 가계부 내역을 일괄 등록했어요!`);
  };
  cu(key, target) {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return target;
    const s = (this._cu = this._cu || {}), now = performance.now();
    let a = s[key];
    if (!a) a = s[key] = { from: 0, to: target, t0: now };
    else if (a.to !== target) { a.from = this.cuVal(a, now); a.to = target; a.t0 = now; }
    const v = this.cuVal(a, now);
    if (v !== a.to && !this._raf) this._raf = setTimeout(() => { this._raf = 0; this.forceUpdate(); }, 16);
    return v;
  }
  cuVal(a, now) { const p = Math.min(1, (now - a.t0) / 700); return Math.round(a.from + (a.to - a.from) * (1 - Math.pow(1 - p, 3))); }
  renderVals() {
    const { store, goals, month, selDay, readOnly, sharedAt, scope, page, q, filter, methodFilter, kind, sortOrder, viewMode, selectedKeys, quick, quickExtras, quickError, statPeriod, goalTab, modalOpen, draft, batchDrafts, draftError, goalModalOpen, goalDraft, excelModalOpen, excelRows, excelPaste, excelError, excelFileName, settleModalOpen, settleDraft, toast, shareUrls, driveConnected, driveStatus } = this.state;
    const shareObj = k => ({ url: shareUrls[k], has: !!shareUrls[k], make: this.makeShare(k), copy: this.copyShare(k), preview: () => shareUrls[k] && window.open(shareUrls[k], '_blank', 'noopener') });
    const data = store.months[month] || DEFAULT(), incomes = data.incomes || [], pendings = data.pendings || [];
    const mkeys = Object.keys(store.months).sort(), mi = mkeys.indexOf(month);
    const allowance = Math.max(0, Number(data.allowance) || 0);
    const spent = data.expenses.reduce((a, x) => a + (Number(x.amount) || 0), 0);
    const income = incomes.reduce((a, x) => a + (Number(x.amount) || 0), 0);
    const pendingSum = pendings.reduce((a, x) => a + (Number(x.amount) || 0), 0);
    const cardSpent = data.expenses.filter(x => (x.method || '카드') === '카드').reduce((a, x) => a + (Number(x.amount) || 0), 0);
    const cashSpent = data.expenses.filter(x => x.method === '현금').reduce((a, x) => a + (Number(x.amount) || 0), 0);
    const accSpent = data.expenses.filter(x => x.method === '계좌·페이').reduce((a, x) => a + (Number(x.amount) || 0), 0);
    const avail = allowance + income;
    const planned = data.categories.reduce((a, c) => a + (Number(c.amount) || 0), 0);
    const left = avail - spent, gap = allowance - planned;
    const pct = avail > 0 ? Math.round(spent / avail * 100) : 0, pc = Math.min(100, Math.max(0, pct));
    const [y, mo] = data.month.split('-');
    const days = new Date(+y, +mo, 0).getDate(), thisMonth = TODAY.startsWith(data.month), todayD = +TODAY.slice(8);
    const day = thisMonth ? todayD : (data.month < TODAY.slice(0, 7) ? days : 0), rem = Math.max(1, days - day + 1);
    const colorOf = {}, gradOf = {};
    data.categories.forEach((c, i) => { colorOf[c.name] = PALETTE[i % 5]; gradOf[c.name] = i % 5; });
    const by = {};
    data.expenses.forEach(x => { const amt = Number(x.amount) || 0; if (amt > 0) by[x.category] = (by[x.category] || 0) + amt; });
    const editField = (id, k, num) => ev => {
      const raw = ev.target.value;
      const v = num ? (raw === '' ? 0 : Math.max(0, Math.round(Number(raw) || 0))) : raw;
      this.upd(d => {
        const c = d.categories.find(x => x.id === id);
        if (!c) return d;
        if (k === 'name' && v) d.expenses.forEach(x => { if (x.category === c.name) x.category = v; });
        c[k] = v;
        return d;
      });
    };
    const catRows = data.categories.map((c, i) => {
      const s = by[c.name] || 0, a = Math.max(0, Number(c.amount) || 0), remAmt = a - s;
      const over = a > 0 && s > a, warn = !over && a > 0 && (s / a) >= 0.8, col = PALETTE[i % 5][0];
      return {
        ...c, amount: a > 0 ? String(a) : '', color: col, amountFmt: won(a), spentFmt: won(s), spentColor: over ? '#f0466e' : '#6c6880',
        remFmt: (remAmt >= 0 ? '+' : '-') + won(Math.abs(remAmt)), remColor: remAmt < 0 ? '#f0466e' : '#0f9d6a',
        hasAlert: over || warn, alertText: over ? '초과' : '주의', alertBg: over ? '#fff0f4' : '#fff6e5', alertFg: over ? '#f0466e' : '#f59e0b',
        barW: Math.min(100, a > 0 ? s / a * 100 : (s > 0 ? 100 : 0)) + '%',
        barColor: over ? '#f0466e' : GRAD[i % 5][1],
        share: allowance > 0 ? Math.round(a / allowance * 100) + '%' : '',
        setName: editField(c.id, 'name'), setAmount: editField(c.id, 'amount', true), amountKor: kor(c.amount),
        usePct: a > 0 ? Math.round(s / a * 100) + '%' : '-', soft: PALETTE[i % 5][1], initial: String(c.name || '?').slice(0, 1),
        remove: () => this.upd(d => { d.categories = d.categories.filter(x => x.id !== c.id); return d; })
      };
    });
    const ledger = [
      ...(allowance > 0 ? [{ id: 'allow', k: 'in', fixed: true, method: '예산', title: '이번 달 예산', category: '용돈', date: data.month + '-01', amount: allowance }] : []),
      ...incomes.map(x => ({ ...x, k: 'in', method: x.method || '계좌·페이' })),
      ...data.expenses.map(x => ({ ...x, k: 'out', method: x.method || '카드' }))
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.fixed ? -1 : b.fixed ? 1 : 0) || (Number(a.id) - Number(b.id)));
    let bal = 0; const balOf = {};
    ledger.forEach(x => { bal += x.k === 'in' ? x.amount : -x.amount; balOf[x.k + x.id] = bal; });
    const selSet = new Set(selectedKeys || []);
    const methodBadge = m => {
      if (m === '카드') return { bg: '#e7eeff', fg: '#4f7bff' };
      if (m === '현금') return { bg: '#fff6e5', fg: '#d97706' };
      if (m === '계좌·페이') return { bg: '#e8f8f0', fg: '#0f9d6a' };
      return { bg: '#f0eff5', fg: '#6c6880' };
    };
    const row = x => {
      const isIn = x.k === 'in', c = isIn ? GREEN : (colorOf[x.category] || PALETTE[5]);
      const rk = x.k + ':' + x.id, checked = selSet.has(rk);
      const mLabel = x.method || (isIn ? '계좌·페이' : '카드'), mb = methodBadge(mLabel);
      const dt = new Date(+x.date.slice(0, 4), +x.date.slice(5, 7) - 1, +x.date.slice(8));
      const dowCh = DOW[dt.getDay()] || '';
      return {
        ...x, color: c[0], soft: c[1], sign: isIn ? '+' : '−',
        dateShort: x.date.slice(5).replace('-', '.'),
        dateWithDow: `${x.date.slice(5).replace('-', '.')} (${dowCh})`,
        kindLabel: isIn ? '수입' : '지출',
        kindBg: isIn ? '#e8f8f0' : '#fff0f4',
        kindFg: isIn ? '#0f9d6a' : '#f0466e',
        methodLabel: mLabel, methodBg: mb.bg, methodFg: mb.fg,
        amountFmt: (isIn ? '+' : '-') + won(x.amount), amtColor: isIn ? '#0f9d6a' : '#34313f',
        inCol: isIn ? '+' + won(x.amount) : '', outCol: isIn ? '' : '-' + won(x.amount), balanceFmt: sgn(balOf[x.k + x.id]),
        canRemove: !x.fixed, cursor: !readOnly && !x.fixed ? 'pointer' : 'default',
        checked,
        chkBg: checked ? '#0f9d6a' : '#fff',
        chkBd: checked ? '#0f9d6a' : '#d5d4df',
        chkMark: checked ? '✓' : '',
        rowBg: checked ? '#f4fbf7' : 'transparent',
        toggleCheck: () => {
          if (readOnly || x.fixed) return;
          this.setState(s => {
            const cur = new Set(s.selectedKeys || []);
            if (cur.has(rk)) cur.delete(rk); else cur.add(rk);
            return { selectedKeys: [...cur] };
          });
        },
        duplicate: () => {
          if (readOnly || x.fixed) return;
          const dupDate = TODAY.startsWith(data.month) ? TODAY : data.month + '-' + String(selDay).padStart(2, '0');
          const copy = { id: Date.now() + Math.floor(Math.random() * 100), title: x.title, category: x.category, method: mLabel, date: dupDate, amount: x.amount };
          this.upd(d => { (isIn ? d.incomes : d.expenses).push(copy); return d; });
          this.say(`'${x.title}' 내역을 ${dupDate.slice(5)} 날짜로 복제했어요.`);
        },
        rowClick: () => { if (!readOnly && !x.fixed) this.openEdit(x); },
        edit: () => this.openEdit(x),
        remove: () => {
          if (confirm('이 기록을 삭제할까요?')) {
            this.upd(d => {
              if (isIn) d.incomes = d.incomes.filter(e => e.id !== x.id);
              else d.expenses = d.expenses.filter(e => e.id !== x.id);
              return d;
            });
            this.setState(s => ({ selectedKeys: (s.selectedKeys || []).filter(k => k !== rk) }));
            this.say('기록을 삭제했어요.');
          }
        }
      };
    };
    const desc = [...ledger].reverse();
    const ql = q.trim().toLowerCase(), qn = ql.replace(/[,₩원\s]/g, '');
    const hit = x => x.title.toLowerCase().includes(ql) || x.category.toLowerCase().includes(ql) || (x.method || '').toLowerCase().includes(ql) || (/^\d+$/.test(qn) && String(x.amount).includes(qn)) || x.date.slice(5).replace('-', '.').includes(ql) || x.date.includes(ql);
    const foundRaw = ledger.filter(x => (kind === 'all' || x.k === kind) && (!methodFilter || (x.method || (x.k === 'in' ? '계좌·페이' : '카드')) === methodFilter) && (!filter || x.category === filter) && (!ql || hit(x)));
    const found = [...foundRaw].sort((a, b) => {
      if (sortOrder === 'dateAsc') return a.date.localeCompare(b.date) || (Number(a.id) - Number(b.id));
      if (sortOrder === 'amtDesc') return b.amount - a.amount;
      if (sortOrder === 'amtAsc') return a.amount - b.amount;
      return b.date.localeCompare(a.date) || (Number(b.id) - Number(a.id));
    });
    const P = PAGES[page] || PAGES.dash;
    const firstDow = new Date(+y, +mo - 1, 1).getDay();
    const outT = {}, inT = {}, pendT = {};
    data.expenses.forEach(x => { const d = +x.date.slice(8); outT[d] = (outT[d] || 0) + x.amount; });
    ledger.filter(x => x.k === 'in').forEach(x => { const d = +x.date.slice(8); inT[d] = (inT[d] || 0) + x.amount; });
    pendings.forEach(x => { const d = +x.date.slice(8); pendT[d] = (pendT[d] || 0) + (Number(x.amount) || 0); });
    const maxT = Math.max(1, ...Object.values(outT));
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push({ isDay: false });
    for (let d = 1; d <= days; d++) {
      const t = outT[d] || 0, ti = inT[d] || 0, tp = pendT[d] || 0, dow = (firstDow + d - 1) % 7, sel = d === selDay, isToday = thisMonth && d === todayD;
      cells.push({
        isDay: true, day: d, amt: t ? '-' + t.toLocaleString('ko-KR') : '', inAmt: ti ? '+' + ti.toLocaleString('ko-KR') : '',
        pendAmt: tp ? '⏳' + tp.toLocaleString('ko-KR') : '',
        hasDot: t > 0 || ti > 0 || tp > 0, dotColor: sel ? '#fff' : t > 0 ? '#f0466e' : tp > 0 ? '#f59e0b' : '#0f9d6a',
        bg: sel ? '#0f9d6a' : t ? `rgba(47,107,79,${(0.05 + 0.2 * t / maxT).toFixed(3)})` : tp ? '#fffbeb' : '#fff',
        border: sel ? '1px solid #0f9d6a' : isToday ? '1.5px solid #0f9d6a' : tp ? '1px solid #fde68a' : '1px solid #f0eff5',
        numColor: sel ? '#fff' : dow === 0 ? '#f0466e' : dow === 6 ? '#4f7bff' : '#34313f',
        amtColor: sel ? '#fff' : '#0f9d6a', inColor: sel ? '#e8f8f0' : '#0f9d6a', pendColor: sel ? '#fde68a' : '#d97706', todayMark: isToday ? '오늘' : '',
        pick: () => this.setState(s => ({ selDay: d, quick: { ...s.quick, date: data.month + '-' + String(d).padStart(2, '0') } }))
      });
    }
    while (cells.length % 7) cells.push({ isDay: false });
    const spendDays = Object.keys(outT).length, noSpend = Math.max(0, day - Object.keys(outT).filter(d => +d <= day).length);
    const sdow = (firstDow + selDay - 1) % 7;
    const selList = ledger.filter(x => +x.date.slice(8) === selDay);

    // 통계 (월/분기/연)
    let statMonths = [month];
    if (statPeriod === 'quarter') {
      const [cy, cm] = month.split('-').map(Number);
      statMonths = [-2, -1, 0].map(off => { const d = new Date(cy, cm - 1 + off, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); });
    } else if (statPeriod === 'year') {
      statMonths = Array.from({ length: 12 }, (_, idx) => `${y}-${String(idx + 1).padStart(2, '0')}`);
    }
    let statOutSum = 0, statInSum = 0; const statCatMap = {}, statTrendRaw = [];
    if (statPeriod === 'month') {
      const weeks = [{ label: '1주차 (1~7일)', amt: 0, count: 0 }, { label: '2주차 (8~14일)', amt: 0, count: 0 }, { label: '3주차 (15~21일)', amt: 0, count: 0 }, { label: `4주차 (22~${days}일)`, amt: 0, count: 0 }];
      statInSum = avail;
      data.expenses.forEach(x => {
        const amt = Number(x.amount) || 0;
        statOutSum += amt;
        statCatMap[x.category] = (statCatMap[x.category] || 0) + amt;
        const wi = Math.min(3, Math.max(0, Math.floor((+x.date.slice(8) - 1) / 7)));
        weeks[wi].amt += amt;
        weeks[wi].count++;
      });
      weeks.forEach(w => statTrendRaw.push(w));
    } else {
      statMonths.forEach(mk => {
        const md = store.months[mk];
        const mOut = md ? md.expenses.reduce((a, x) => a + (Number(x.amount) || 0), 0) : 0;
        const mCnt = md ? md.expenses.length : 0;
        const mIn = md ? (Number(md.allowance) || 0) + (md.incomes || []).reduce((a, x) => a + (Number(x.amount) || 0), 0) : 0;
        statOutSum += mOut; statInSum += mIn;
        if (md) md.expenses.forEach(x => { const amt = Number(x.amount) || 0; statCatMap[x.category] = (statCatMap[x.category] || 0) + amt; });
        if (statPeriod === 'quarter' || mOut > 0 || mk === month) statTrendRaw.push({ label: `${+mk.slice(5)}월`, amt: mOut, count: mCnt });
      });
    }
    const maxTrend = Math.max(1, ...statTrendRaw.map(r => r.amt));
    const statTrendRows = statTrendRaw.map(r => ({ ...r, amtFmt: won(r.amt), w: Math.max(r.amt ? 4 : 0, Math.round(r.amt / maxTrend * 100)) + '%',
      short: String(r.label).split(' ')[0], h: Math.max(4, Math.round(r.amt / maxTrend * 100)) + '%',
      bg: r.amt && r.amt === maxTrend ? '#0f9d6a' : '#e8f8f0', amtShort: r.amt ? kor(r.amt).replace('원', '') : '0' }));
    let catAcc = 0;
    const sortedStatCats = Object.entries(statCatMap).filter(([, amt]) => amt > 0).sort((a, b) => b[1] - a[1]);
    const statCatRows = sortedStatCats.map(([name, amt], i) => {
      const len = statOutSum > 0 ? Math.round(503 * amt / statOutSum) : 0, off = -catAcc; catAcc += len;
      const gi = gradOf[name] ?? i % 5, g = GRAD[gi];
      return { name, grad: 'url(#sg-' + gi + ')', dot: g[1], len, off, pct: statOutSum > 0 ? Math.round(amt / statOutSum * 100) + '%' : '0%', amtFmt: won(amt) };
    });
    const topCat = sortedStatCats[0];
    const statDaysDenom = statPeriod === 'month' ? Math.max(1, day || days) : statPeriod === 'quarter' ? 90 : 365;

    // 목표
    const enrichedGoals = goals.map(g => {
      const target = Math.max(1, Number(g.target) || 1), current = Math.max(0, Number(g.current) || 0);
      const pctG = Math.min(100, Math.round(current / target * 100)), isDone = current >= target;
      const diffDays = Math.ceil((new Date(g.deadline) - new Date(TODAY)) / 86400000);
      return {
        ...g, pct: pctG, isDone, notDone: !isDone, barW: pctG + '%', currentFmt: won(current), targetFmt: won(target),
        ddayLabel: isDone ? '달성 완료' : !Number.isFinite(diffDays) ? '기한 미정' : diffDays >= 0 ? `D-${diffDays}` : '기한 지남',
        badgeBg: isDone ? '#e8f8f0' : '#e8f8f0', badgeFg: isDone ? '#0f9d6a' : '#0f9d6a',
        addSavings: () => { this.saveGoals(goals.map(it => it.id === g.id ? { ...it, current: (Number(it.current) || 0) + 10000 } : it)); this.say('10,000원을 모았어요.'); },
        remove: () => { if (confirm('이 목표를 삭제할까요?')) { this.saveGoals(goals.filter(it => it.id !== g.id)); this.say('목표를 삭제했어요.'); } }
      };
    });
    const activeGoals = enrichedGoals.filter(g => !g.isDone), doneGoals = enrichedGoals.filter(g => g.isDone);
    const shownGoals = goalTab === 'done' ? doneGoals : activeGoals;
    const goalTotalTarget = enrichedGoals.reduce((a, g) => a + (Number(g.target) || 0), 0);
    const goalTotalCur = enrichedGoals.reduce((a, g) => a + (Number(g.current) || 0), 0);
    const goalAvgPct = enrichedGoals.length ? Math.round(enrichedGoals.reduce((a, g) => a + g.pct, 0) / enrichedGoals.length) : 0;
    const presetGoals = [
      { title: '비상금 30만 원 모으기', target: 300000, desc: '갑작스러운 지출에 대비하는 든든한 비상금' },
      { title: '여행·나들이 자금 50만 원', target: 500000, desc: '방학·연휴 여행을 위한 설레는 저축 목표' },
      { title: '위시리스트 전자기기 구매', target: 250000, desc: '갖고 싶었던 이어폰·주변기기 내 돈으로 사기' },
      { title: '이번 달 소액 저축 챌린지', target: 100000, desc: '커피·배달 줄여서 가볍게 10만 원 달성하기' }
    ].map(pg => ({
      ...pg, targetFmt: won(pg.target),
      add: () => {
        if (readOnly) return;
        this.saveGoals([...goals, { id: 'g' + Date.now(), title: pg.title, target: pg.target, current: 0, deadline: data.month + '-28' }]);
        this.say(`'${pg.title}' 목표를 시작했어요!`);
      }
    }));

    // 결제수단별 분석 (현재 월 & 선택 통계 기간)
    const cardPctNum = spent > 0 ? Math.round(cardSpent / spent * 100) : 0;
    const cashPctNum = spent > 0 ? Math.round(cashSpent / spent * 100) : 0;
    const accPctNum = spent > 0 ? Math.max(0, 100 - cardPctNum - cashPctNum) : 0;
    const methodStatRows = [
      { name: '카드', amt: cardSpent, cnt: data.expenses.filter(x => (x.method || '카드') === '카드').length, color: '#4f7bff', bg: '#e7eeff' },
      { name: '현금', amt: cashSpent, cnt: data.expenses.filter(x => x.method === '현금').length, color: '#d97706', bg: '#fff6e5' },
      { name: '계좌·페이', amt: accSpent, cnt: data.expenses.filter(x => x.method === '계좌·페이').length, color: '#0f9d6a', bg: '#e8f8f0' }
    ].map(m => {
      const p = spent > 0 ? Math.round(m.amt / spent * 100) : 0;
      return { ...m, amtFmt: won(m.amt), pct: p + '%', barW: Math.max(m.amt > 0 ? 6 : 0, p) + '%', pick: () => this.setState({ page: 'exp', methodFilter: m.name, kind: 'out' }) };
    });

    // --- home dashboard extras ---
    const hr = new Date().getHours();
    const greet = `${+TODAY.slice(5, 7)}월 ${+TODAY.slice(8)}일 ${DOW[new Date().getDay()]}요일`; // dated like a ledger page
    const prevD = new Date(+y, +mo - 2, 1), prevKey = prevD.getFullYear() + '-' + String(prevD.getMonth() + 1).padStart(2, '0');
    const prevM = store.months[prevKey];
    const prevSpent = prevM ? prevM.expenses.reduce((a, x) => a + (Number(x.amount) || 0), 0) : 0;
    const chg = prevSpent > 0 ? Math.round((spent - prevSpent) / prevSpent * 100) : null;
    // cumulative spending line through the days that have passed (viewBox 0 0 300 90)
    const lastDay = Math.max(1, day || days);
    let cum = 0; const cumPts = [];
    for (let d = 1; d <= lastDay; d++) { cum += outT[d] || 0; cumPts.push(cum); }
    const maxCum = Math.max(1, cum);
    const px = i => (lastDay > 1 ? i / (lastDay - 1) * 300 : 150).toFixed(1), py = v => (84 - v / maxCum * 72).toFixed(1);
    const trendLine = cumPts.map((v, i) => (i ? 'L' : 'M') + px(i) + ' ' + py(v)).join(' ');
    // this week (Mon-Sun) across all stored months
    const byDate = {};
    Object.values(store.months).forEach(m => (m.expenses || []).forEach(x => { byDate[x.date] = (byDate[x.date] || 0) + (Number(x.amount) || 0); }));
    const anchor = thisMonth ? new Date(TODAY) : new Date(+y, +mo - 1, Math.max(1, day || days));
    const mon = new Date(anchor); mon.setDate(anchor.getDate() - (anchor.getDay() + 6) % 7);
    const iso = dt => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    const weekAmts = [0, 1, 2, 3, 4, 5, 6].map(i => { const dt = new Date(mon); dt.setDate(mon.getDate() + i); return byDate[iso(dt)] || 0; });
    const weekMax = Math.max(...weekAmts), weekTop = weekAmts.indexOf(weekMax), weekSum = weekAmts.reduce((a, b) => a + b, 0);
    const topGoal = activeGoals[0] || null;
    const homeVals = {
      greet,
      heroTitle: left < 0 ? '예산을 조금 넘었어요.' : avail > 0 && pct > (day / days * 100) + 10 ? '조금 빠르게 쓰고 있어요.' : '이번 달도 잘하고 있어요.',
      heroSub1: `지금까지 ${won(spent)}을 기록했어요.`,
      heroSub2: left >= 0 ? `예산까지 ${won(left)} 남았어요.` : `예산보다 ${won(-left)} 더 썼어요.`,
      trendLine, trendArea: trendLine ? trendLine + ` L${px(cumPts.length - 1)} 90 L${px(0)} 90 Z` : '',
      trendEndX: px(cumPts.length - 1), trendEndY: py(cum),
      trendText: chg === null ? '지난달 기록이 없어요' : chg <= 0 ? `지난달보다 ${-chg}% 줄었어요` : `지난달보다 ${chg}% 늘었어요`,
      trendBadge: chg === null ? '' : (chg <= 0 ? '↓ ' : '↑ ') + Math.abs(chg) + '%', trendBadgeColor: chg !== null && chg > 0 ? '#f0466e' : '#0f9d6a',
      monthStartLabel: `${+mo}월 1일`, monthNowLabel: `${+mo}월 ${lastDay}일`,
      weekBars: '월화수목금토일'.split('').map((l, i) => ({ l, h: (weekMax ? Math.max(6, Math.round(weekAmts[i] / weekMax * 100)) : 6) + '%', bg: weekMax && i === weekTop ? '#0f9d6a' : '#e8f8f0' })),
      weekMsg: weekMax ? `이번 주는 ${'월화수목금토일'[weekTop]}요일에 가장 많이 썼어요.` : '이번 주는 아직 지출이 없어요.',
      weekSub: `이번 주 지출 ${won(weekSum)}`,
      hasGoal: !!topGoal, noGoal: !topGoal,
      goalTitle: topGoal ? topGoal.title : '', goalCur: topGoal ? topGoal.currentFmt : '', goalTgt: topGoal ? topGoal.targetFmt : '',
      goalPct: topGoal ? topGoal.pct + '%' : '0%', goalW: topGoal ? topGoal.barW : '0%', goalDday: topGoal ? topGoal.ddayLabel : ''
    };

    const navItem = k => ({ bg: k === page ? '#e8f8f0' : 'transparent', color: k === page ? '#0f9d6a' : '#6c6880' });
    const seg = on => ({ bg: on ? '#fff' : 'transparent', color: on ? '#17161d' : '#6c6880', shadow: on ? '0 2px 6px rgba(28,48,38,.08)' : 'none' });
    const setD = k => ev => { const v = ev.target.value; this.setState(s => ({ draft: { ...s.draft, [k]: v }, draftError: '' })); };
    const setKind = k => () => this.setState(s => ({ draft: { ...s.draft, kind: k, method: k === 'in' ? IN_METHODS[0] : OUT_METHODS[0], category: k === 'in' ? IN_CATS[0] : ((data.categories[0] || {}).name || '기타') } }));
    const bumpAmt = delta => () => this.setState(s => ({ draft: { ...s.draft, amount: String(Math.max(0, Math.round(Number(s.draft.amount) || 0) + delta)) }, draftError: '' }));
    const isInDraft = draft.kind === 'in', isPendDraft = draft.kind === 'pending';

    const setQField = k => ev => { const v = ev.target.value; this.setState(s => ({ quick: { ...s.quick, [k]: v }, quickError: '' })); };
    const setQKind = k => () => this.setState(s => ({
      quick: {
        ...s.quick, kind: k,
        method: k === 'in' ? IN_METHODS[0] : OUT_METHODS[0],
        category: k === 'in' ? IN_CATS[0] : ((data.categories[0] || {}).name || '기타')
      },
      quickError: ''
    }));
    const bumpQuickAmt = delta => () => this.setState(s => ({ quick: { ...s.quick, amount: String(Math.max(0, Math.round(Number(s.quick.amount) || 0) + delta)) }, quickError: '' }));
    const isInQuick = quick.kind === 'in', isPendQuick = quick.kind === 'pending';

    // 임시·미정 지출예상 내역 (N빵할지 사주는건지 몰라서 적어두는 보류 내역)
    const resolvePending = (p, finalAmt, tag) => {
      if (readOnly) return;
      this.upd(d => {
        d.pendings = (d.pendings || []).filter(x => x.id !== p.id);
        if (finalAmt > 0) {
          d.expenses.push({
            id: Date.now() + Math.floor(Math.random() * 100),
            title: tag ? `${p.title} (${tag})` : p.title,
            category: p.category || '식비',
            method: p.method || '카드',
            date: p.date,
            amount: finalAmt
          });
        }
        return d;
      });
      if (finalAmt > 0) this.say(`'${p.title}' 내역을 ${tag ? tag + ' ' : ''}${won(finalAmt)} 지출로 확정했어요.`);
      else this.say(`🎉 얻어먹기/면제! '${p.title}' 내역을 지출 0원으로 종결했어요.`);
    };
    const calcSplitAmt = (totalAmt, people, roundMode) => {
      const n = Math.max(1, Number(people) || 1);
      const raw = totalAmt / n;
      if (roundMode === 'up100') return Math.ceil(raw / 100) * 100;
      if (roundMode === 'down100') return Math.floor(raw / 100) * 100;
      if (roundMode === 'down1000') return Math.floor(raw / 1000) * 1000;
      return Math.round(raw);
    };
    const openSettleModal = p => {
      if (readOnly) return;
      const amt = Math.max(0, Number(p.amount) || 0);
      const myAmt = calcSplitAmt(amt, 2, 'none');
      this.setState({
        settleModalOpen: true,
        settleDraft: {
          id: p.id,
          title: p.title,
          category: p.category || '식비',
          method: p.method || '카드',
          date: p.date,
          totalAmt: amt,
          people: 2,
          roundMode: 'none',
          myAmt: String(myAmt),
          tag: '1/2 N빵'
        }
      });
    };
    const pendingRows = [...pendings].sort((a, b) => b.date.localeCompare(a.date) || (Number(b.id) - Number(a.id))).map(p => {
      const amt = Math.max(0, Number(p.amount) || 0);
      const half = Math.round(amt / 2), third = Math.round(amt / 3), quarter = Math.round(amt / 4);
      const mLabel = p.method || '카드', mb = methodBadge(mLabel);
      const catCol = colorOf[p.category] || PALETTE[0];
      const dt = new Date(+p.date.slice(0, 4), +p.date.slice(5, 7) - 1, +p.date.slice(8));
      const dowCh = DOW[dt.getDay()] || '';
      return {
        ...p,
        dateWithDow: `${p.date.slice(5).replace('-', '.')} (${dowCh})`,
        catColor: catCol[0], catBg: catCol[1],
        methodLabel: mLabel, methodBg: mb.bg, methodFg: mb.fg, methodColor: mb.fg,
        amountFmt: won(amt),
        halfFmt: won(half), thirdFmt: won(third), quarterFmt: won(quarter),
        split2: () => resolvePending(p, half, '1/2 N빵'),
        split3: () => resolvePending(p, third, '1/3 N빵'),
        split4: () => resolvePending(p, quarter, '1/4 N빵'),
        customSplit: () => openSettleModal(p),
        confirmFull: () => resolvePending(p, amt, '전액 부담'),
        resolveFree: () => resolvePending(p, 0, ''),
        edit: () => this.openEdit({ ...p, k: 'pending' }),
        remove: () => {
          if (readOnly) return;
          this.upd(d => { d.pendings = (d.pendings || []).filter(x => x.id !== p.id); return d; });
          this.say('임시 지출예상 내역을 삭제했어요.');
        }
      };
    });
    const selPendings = pendingRows.filter(p => +p.date.slice(8) === selDay);

    // 자주 쓰는 내역 프리셋 (최근 내역 빈도순 + 기본 프리셋)
    const presetMap = {};
    [...incomes.map(x => ({ ...x, kind: 'in' })), ...data.expenses.map(x => ({ ...x, kind: 'out' }))].forEach(x => {
      const key = `${x.kind}:${x.title}:${x.category}`;
      if (!presetMap[key]) presetMap[key] = { kind: x.kind, title: x.title, category: x.category, method: x.method || (x.kind === 'in' ? '계좌·페이' : '카드'), amount: x.amount, cnt: 0 };
      presetMap[key].cnt++;
      presetMap[key].amount = x.amount;
    });
    const userPresets = Object.values(presetMap).sort((a, b) => b.cnt - a.cnt);
    const mergedPresets = [...userPresets, ...DEF_PRESETS.filter(dp => !userPresets.some(up => up.title === dp.title))].slice(0, 5);
    const quickPresets = mergedPresets.map(p => ({
      label: `${p.kind === 'in' ? '+' : ''}${p.title} (${kor(p.amount) || won(p.amount)})`,
      pick: () => this.setState(s => ({
        quick: {
          ...s.quick,
          kind: p.kind,
          title: p.title,
          category: p.category,
          method: p.method || (p.kind === 'in' ? IN_METHODS[0] : OUT_METHODS[0]),
          amount: String(p.amount)
        },
        quickError: ''
      }))
    }));

    // 다중 선택 및 일괄 작업 계산
    const selectableFound = found.filter(x => !x.fixed);
    const selectedItems = selectableFound.filter(x => selSet.has(x.k + ':' + x.id));
    const selectedCount = selectedItems.length;
    const allChecked = selectableFound.length > 0 && selectedCount === selectableFound.length;
    const selSumIn = won(selectedItems.filter(x => x.k === 'in').reduce((a, x) => a + x.amount, 0));
    const selSumOut = won(selectedItems.filter(x => x.k === 'out').reduce((a, x) => a + x.amount, 0));

    const foundInAmt = found.filter(x => x.k === 'in').reduce((a, x) => a + x.amount, 0);
    const foundOutAmt = found.filter(x => x.k === 'out').reduce((a, x) => a + x.amount, 0);
    const foundNetAmt = foundInAmt - foundOutAmt;
    const foundCardAmt = found.filter(x => x.k === 'out' && (x.method || '카드') === '카드').reduce((a, x) => a + x.amount, 0);
    const foundCashAmt = found.filter(x => x.k === 'out' && x.method === '현금').reduce((a, x) => a + x.amount, 0);
    const foundAccAmt = found.filter(x => x.k === 'out' && x.method === '계좌·페이').reduce((a, x) => a + x.amount, 0);

    // 빠른쓰기 여러 건 몰아쓰기 (quickExtras)
    const qExtras = quickExtras || [];
    const updQExtra = (uid, patch) => this.setState(s => ({
      quickExtras: (s.quickExtras || []).map(r => r.uid === uid ? { ...r, ...patch } : r),
      quickError: ''
    }));
    const quickExtraRows = qExtras.map((r, idx) => {
      const isInQ = r.kind === 'in', isPendQ = r.kind === 'pending';
      return {
        ...r,
        rowNum: idx + 2,
        qOut: seg(r.kind === 'out'), qIn: seg(isInQ), qPend: seg(isPendQ),
        setOut: () => updQExtra(r.uid, { kind: 'out', method: OUT_METHODS[0], category: (data.categories[0] || {}).name || '기타' }),
        setIn: () => updQExtra(r.uid, { kind: 'in', method: IN_METHODS[0], category: IN_CATS[0] }),
        setPend: () => updQExtra(r.uid, { kind: 'pending', method: OUT_METHODS[0], category: (data.categories[0] || {}).name || '기타' }),
        setDate: ev => updQExtra(r.uid, { date: ev.target.value }),
        setMethod: ev => updQExtra(r.uid, { method: ev.target.value }),
        setCategory: ev => updQExtra(r.uid, { category: ev.target.value }),
        setTitle: ev => updQExtra(r.uid, { title: ev.target.value }),
        setAmount: ev => updQExtra(r.uid, { amount: ev.target.value }),
        methods: isInQ ? IN_METHODS : OUT_METHODS,
        cats: [...new Set([...(isInQ ? IN_CATS : data.categories.map(c => c.name)), r.category].filter(Boolean))],
        titlePh: isInQ ? '수입 내역' : isPendQ ? '미정 내역 (N빵/사줄지)' : `사용내역 #${idx + 2}`,
        amtPh: isPendQ ? '예상 금액(원)' : '금액 (원)',
        remove: () => this.setState(s => ({ quickExtras: (s.quickExtras || []).filter(x => x.uid !== r.uid) }))
      };
    });
    const quickAllValid = [quick, ...qExtras].filter(r => Math.round(Number(r.amount)) > 0);
    const quickTotalReadyCount = Math.max(1, quickAllValid.length);
    const quickBatchSum = quickAllValid.reduce((a, r) => a + Math.round(Number(r.amount) || 0), 0);

    // 모달 여러 건 몰아쓰기 (batchDrafts)
    const bDrafts = batchDrafts || [];
    const updBDraft = (uid, patch) => this.setState(s => ({
      batchDrafts: (s.batchDrafts || []).map(r => r.uid === uid ? { ...r, ...patch } : r),
      draftError: ''
    }));
    const batchDraftRows = bDrafts.map((r, idx) => {
      const isInB = r.kind === 'in', isPendB = r.kind === 'pending';
      return {
        ...r,
        rowNum: idx + 1,
        amtKor: kor(r.amount),
        bOut: seg(r.kind === 'out'), bIn: seg(isInB), bPend: seg(isPendB),
        setOut: () => updBDraft(r.uid, { kind: 'out', method: OUT_METHODS[0], category: (data.categories[0] || {}).name || '기타' }),
        setIn: () => updBDraft(r.uid, { kind: 'in', method: IN_METHODS[0], category: IN_CATS[0] }),
        setPend: () => updBDraft(r.uid, { kind: 'pending', method: OUT_METHODS[0], category: (data.categories[0] || {}).name || '기타' }),
        setDate: ev => updBDraft(r.uid, { date: ev.target.value }),
        setMethod: ev => updBDraft(r.uid, { method: ev.target.value }),
        setCategory: ev => updBDraft(r.uid, { category: ev.target.value }),
        setTitle: ev => updBDraft(r.uid, { title: ev.target.value }),
        setAmount: ev => updBDraft(r.uid, { amount: ev.target.value }),
        methods: isInB ? IN_METHODS : OUT_METHODS,
        cats: [...new Set([...(isInB ? IN_CATS : data.categories.map(c => c.name)), r.category].filter(Boolean))],
        titlePh: isInB ? '수입 메모' : isPendB ? '미정·N빵 메모' : '사용내역 메모',
        duplicate: () => this.setState(s => {
          const copy = { ...r, uid: 'br_' + Date.now() + '_' + Math.floor(Math.random() * 100000) };
          const arr = [...(s.batchDrafts || [])];
          arr.splice(idx + 1, 0, copy);
          return { batchDrafts: arr };
        }),
        remove: () => this.setState(s => ({ batchDrafts: (s.batchDrafts || []).filter(x => x.uid !== r.uid) }))
      };
    });
    const modalAllValid = [...bDrafts, draft].filter(r => Math.round(Number(r.amount)) > 0);
    const modalReadyCount = modalAllValid.length;
    const modalTotalSum = modalAllValid.reduce((a, r) => a + Math.round(Number(r.amount) || 0), 0);

    return {
      readOnly, editable: !readOnly, sharedAt, toast, modalOpen, draft, draftError, q, filter, methodFilter, sortOrder,
      quick, quickError, quickKor: kor(quick.amount),
      qOut: seg(quick.kind === 'out'), qIn: seg(isInQuick), qPend: seg(isPendQuick),
      setQuickOut: setQKind('out'), setQuickIn: setQKind('in'), setQuickPending: setQKind('pending'),
      setQuickDate: setQField('date'), setQuickMethod: setQField('method'), setQuickCategory: setQField('category'),
      setQuickTitle: setQField('title'), setQuickAmount: setQField('amount'),
      quickMethods: isInQuick ? IN_METHODS : OUT_METHODS,
      quickCats: [...new Set([...(isInQuick ? IN_CATS : data.categories.map(c => c.name)), quick.category].filter(Boolean))],
      quickTitlePh: isInQuick ? '수입 내역 입력 (예: 아르바이트, 용돈)' : isPendQuick ? '미정 내역 입력 (예: 친구랑 밥 — N빵/사줄지 미정)' : '사용내역 입력 (예: 편의점, 점심 식사)',
      quickAmtPh: isPendQuick ? '전체/예상 금액(원)' : '금액 (원)',
      quickBtnLabel: qExtras.length > 0 ? `✅ ${quickTotalReadyCount}건 일괄등록` : isPendQuick ? '⏳ 임시저장' : '등록',
      quickBtnBg: isPendQuick && !qExtras.length ? '#d97706' : '#0f9d6a',
      hasQuickExtras: qExtras.length > 0,
      quickExtraCount: qExtras.length + 1,
      quickBatchSumFmt: won(quickBatchSum),
      quickExtraRows,
      addQuickRow: () => this.setState(s => {
        const q0 = s.quick;
        if (Math.round(Number(q0.amount)) > 0) {
          const moved = { ...q0, uid: 'qr_' + Date.now() + '_' + Math.floor(Math.random() * 100000) };
          return {
            quickExtras: [...(s.quickExtras || []), moved],
            quick: { ...q0, title: '', amount: '' },
            quickError: ''
          };
        }
        return {
          quickExtras: [...(s.quickExtras || []), { ...this.makeBlankRow(data, q0.kind, q0.date), method: q0.method, category: q0.category }],
          quickError: ''
        };
      }),
      addQuick3Rows: () => this.setState(s => {
        const q0 = s.quick;
        const rows = [1, 2, 3].map(() => ({ ...this.makeBlankRow(data, q0.kind, q0.date), method: q0.method, category: q0.category }));
        return { quickExtras: [...(s.quickExtras || []), ...rows], quickError: '' };
      }),
      clearQuickExtras: () => this.setState({ quickExtras: [], quickError: '' }),
      hasPendings: pendingRows.length > 0,
      noPendings: pendingRows.length === 0,
      pendingCount: pendingRows.length,
      pendingSumFmt: won(pendingSum),
      leftAfterPendingFmt: sgn(left - pendingSum),
      pendingRows,
      openPendingModal: () => this.openWith('pending'),
      quickKey: ev => { if (ev.key === 'Enter') this.saveQuick(); },
      saveQuick: this.saveQuick,
      quickPresets,
      quickAdd1k: bumpQuickAmt(1000), quickAdd5k: bumpQuickAmt(5000), quickAdd10k: bumpQuickAmt(10000), quickAdd50k: bumpQuickAmt(50000),
      quickResetAmt: () => this.setState(s => ({ quick: { ...s.quick, amount: '' }, quickError: '' })),
      isTableView: viewMode === 'table', isListView: viewMode === 'list',
      vTable: seg(viewMode === 'table'), vList: seg(viewMode === 'list'),
      setViewTable: () => this.setState({ viewMode: 'table' }),
      setViewList: () => this.setState({ viewMode: 'list' }),
      setMethodFilter: ev => this.setState({ methodFilter: ev.target.value, selectedKeys: [] }),
      setSortOrder: ev => this.setState({ sortOrder: ev.target.value }),
      allMethods: ALL_METHODS,
      hasSelection: selectedCount > 0, selectedCount, selSumIn, selSumOut,
      allChkBg: allChecked ? '#0f9d6a' : '#fff',
      allChkBd: allChecked ? '#0f9d6a' : '#d5d4df',
      allChkMark: allChecked ? '✓' : '',
      toggleSelectAll: () => {
        if (readOnly) return;
        if (allChecked) this.setState({ selectedKeys: [] });
        else this.setState({ selectedKeys: selectableFound.map(x => x.k + ':' + x.id) });
      },
      clearSelection: () => this.setState({ selectedKeys: [] }),
      applyBulkMethod: ev => {
        const m = ev.target.value;
        if (!m || !selectedCount) return;
        this.upd(d => {
          d.incomes.forEach(x => { if (selSet.has('in:' + x.id)) x.method = m; });
          d.expenses.forEach(x => { if (selSet.has('out:' + x.id)) x.method = m; });
          return d;
        });
        this.say(`선택한 ${selectedCount}건의 결제수단을 '${m}'(으)로 변경했어요.`);
      },
      applyBulkCategory: ev => {
        const c = ev.target.value;
        if (!c || !selectedCount) return;
        this.upd(d => {
          d.incomes.forEach(x => { if (selSet.has('in:' + x.id)) x.category = c; });
          d.expenses.forEach(x => { if (selSet.has('out:' + x.id)) x.category = c; });
          return d;
        });
        this.say(`선택한 ${selectedCount}건의 분류를 '${c}'(으)로 변경했어요.`);
      },
      applyBulkDuplicate: () => {
        if (!selectedCount) return;
        const dupDate = TODAY.startsWith(data.month) ? TODAY : data.month + '-' + String(selDay).padStart(2, '0');
        let seq = 0;
        this.upd(d => {
          selectedItems.forEach(x => {
            const copy = { id: Date.now() + (++seq), title: x.title, category: x.category, method: x.method || (x.k === 'in' ? '계좌·페이' : '카드'), date: dupDate, amount: x.amount };
            (x.k === 'in' ? d.incomes : d.expenses).push(copy);
          });
          return d;
        });
        this.setState({ selectedKeys: [] });
        this.say(`선택한 ${selectedCount}건을 ${dupDate.slice(5)} 날짜로 복제했어요.`);
      },
      applyBulkDelete: () => {
        if (!selectedCount) return;
        if (confirm(`선택한 ${selectedCount}건의 내역을 일괄 삭제할까요?`)) {
          this.upd(d => {
            d.incomes = d.incomes.filter(x => !selSet.has('in:' + x.id));
            d.expenses = d.expenses.filter(x => !selSet.has('out:' + x.id));
            return d;
          });
          this.setState({ selectedKeys: [] });
          this.say(`선택한 ${selectedCount}건을 삭제했어요.`);
        }
      },
      draftKor: kor(draft.amount), allowanceKor: kor(data.allowance), goalTargetKor: kor(goalDraft.target), goalCurrentKor: kor(goalDraft.current),
      driveConnected, driveStatus,
      driveLabel: driveConnected ? '동기화 중' : 'Google 로그인',
      driveBtnText: driveConnected ? '로그아웃' : 'Google로 로그인',
      drivePillBg: driveConnected ? '#e8f8f0' : '#fff',
      drivePillFg: driveConnected ? '#0f9d6a' : '#0f9d6a',
      drivePillBd: driveConnected ? '#e8f8f0' : '#f0eff5',
      driveDotColor: driveConnected ? '#0f9d6a' : '#8b87a0',
      connectDrive: this.triggerDriveConnect,
      saveDriveNow: () => { if (window.moaDrive && window.moaDrive.saveNow) window.moaDrive.saveNow(); this.say('클라우드에 저장을 요청했어요.'); },
      sp: shareObj('plan'), sl: shareObj('ledger'),
      showDash: !scope, showCal: scope !== 'plan', showStat: scope !== 'plan', showPlan: scope !== 'ledger', showGoal: !scope, showExp: scope !== 'plan',
      bannerText: scope === 'plan' ? `${y}년 ${+mo}월 지출 계획서` : scope === 'ledger' ? `${y}년 ${+mo}월 가계부` : '공유 화면',
      nav: { dash: navItem('dash'), cal: navItem('cal'), stat: navItem('stat'), plan: navItem('plan'), goal: navItem('goal'), exp: navItem('exp'), share: navItem('share') },
      crumb: P[0], modeLabel: readOnly ? '읽기 전용으로 보는 중' : '내 기록 편집 중', dotColor: readOnly ? '#0f9d6a' : '#5fcf9f',
      isDash: page === 'dash', isCal: page === 'cal', isStat: page === 'stat', isPlan: page === 'plan', isGoal: page === 'goal', isExp: page === 'exp', isShare: page === 'share',
      eyebrow: `${y}년 ${+mo}월의 기록`, monthShort: `${+mo}월`, monthLabel: `${y}년 ${+mo}월`, title: page === 'dash' ? homeVals.greet : P[1], titleChars: [...(page === 'dash' ? homeVals.greet : P[1])].map((ch, i) => ({ ch, st: `animation-name:tp-letter-${(this._tn || 0) % 2};animation-delay:${i * 35}ms;--dx:${i % 2 ? -22 : 24}px` })), desc: P[2], showShareCta: !readOnly && page !== 'share',
      prevMonth: this.shiftMonth(-1), nextMonth: this.shiftMonth(1),
      prevOp: readOnly && mi <= 0 ? 0.3 : 1, nextOp: readOnly && mi >= mkeys.length - 1 ? 0.3 : 1,
      planLink: readOnly ? '자세히 보기 →' : '계획 수정 →',
      allowance: allowance > 0 ? String(allowance) : '', allowanceKor: kor(allowance), allowanceFmt: won(this.cu('allow', allowance)), incomeFmt: won(this.cu('income', income)), incomeCount: incomes.length, availFmt: won(avail), inTotalFmt: won(avail),
      spentFmt: won(this.cu('spent', spent)), cardSpentFmt: won(cardSpent), cashSpentFmt: won(cashSpent), accSpentFmt: won(accSpent),
      cardPct: cardPctNum + '%', cashPct: cashPctNum + '%', accPct: accPctNum + '%',
      cardBarW: Math.max(cardSpent > 0 ? 6 : 0, cardPctNum) + '%',
      cashBarW: Math.max(cashSpent > 0 ? 6 : 0, cashPctNum) + '%',
      accBarW: Math.max(accSpent > 0 ? 6 : 0, accPctNum) + '%',
      methodStatRows,
      totalGoalCount: enrichedGoals.length,
      goalTotalTargetFmt: won(goalTotalTarget),
      goalTotalCurFmt: won(goalTotalCur),
      goalAvgPct: goalAvgPct + '%',
      presetGoals,
      fillSampleData: () => {
        if (readOnly) return;
        const m = data.month;
        const nowId = Date.now();
        this.upd(d => {
          if (!d.allowance || d.allowance === 0) d.allowance = 400000;
          d.incomes = [
            ...(d.incomes || []),
            { id: nowId + 1, title: '주말 아르바이트 급여', category: '아르바이트', method: '계좌·페이', date: m + '-05', amount: 120000 },
            { id: nowId + 2, title: '중고책 판매', category: '기타수입', method: '계좌·페이', date: m + '-12', amount: 18000 }
          ];
          d.expenses = [
            ...(d.expenses || []),
            { id: nowId + 3, title: '교내 학생식당 점심', category: '식비', method: '카드', date: m + '-02', amount: 6500 },
            { id: nowId + 4, title: '시내버스·지하철 충전', category: '교통', method: '카드', date: m + '-03', amount: 30000 },
            { id: nowId + 5, title: '아이스 아메리카노', category: '간식·카페', method: '카드', date: m + '-04', amount: 4500 },
            { id: nowId + 6, title: '편의점 간식 및 음료', category: '간식·카페', method: '현금', date: m + '-06', amount: 5200 },
            { id: nowId + 7, title: '친구들과 저녁 삼겹살 더치페이', category: '식비', method: '계좌·페이', date: m + '-08', amount: 24000 },
            { id: nowId + 8, title: '영화 관람 및 팝콘', category: '문화·취미', method: '카드', date: m + '-10', amount: 19000 },
            { id: nowId + 9, title: '전공 필기 노트·볼펜 구매', category: '쇼핑·생활', method: '카드', date: m + '-11', amount: 11800 }
          ];
          d.pendings = [
            ...(d.pendings || []),
            { id: nowId + 10, title: '동기들과 저녁 삼겹살 (N빵할지 선배가 사줄지 미정)', category: '식비', method: '카드', date: m + '-12', amount: 36000 },
            { id: nowId + 11, title: '조별과제 카페 음료·디저트 (정산 대기)', category: '카페·간식', method: '계좌·페이', date: m + '-13', amount: 24000 }
          ];
          return d;
        });
        this.say('이달의 샘플 가계부 내역을 채웠어요!');
      },
      plannedFmt: won(planned), leftFmt: sgn(this.cu('left', left)), count: data.expenses.length,
      leftColor: left < 0 ? '#f0466e' : '#0f9d6a',
      leftHint: left < 0 ? '예산을 초과했어요' : day >= days ? '이번 달 마감' : `남은 ${rem}일, 하루 ${won(Math.floor(left / rem))}`,
      remDays: day >= days ? 0 : rem, dailyFmt: won(left > 0 && day < days ? Math.floor(left / rem) : 0),
      pctLabel: this.cu('pct', pct) + '%', pctW: pc + '%', ring: `conic-gradient(#5fcf9f 0 ${pc}%, #ffffffb3 ${pc}% 100%)`, planRing: `conic-gradient(#0f9d6a 0 ${pc}%, #f0eff5 ${pc}% 100%)`,
      dayLabel: day ? `${days}일 중 ${day}일째` : '아직 시작 전',
      heroMsg: left < 0 ? '예산 초과! 내역을 확인해요' : avail === 0 && spent === 0 ? '이번 달 지출 계획을 세워 보세요' : pct > (day / days * 100) + 10 ? '조금 빠른 속도예요' : '계획적인 소비 중!',
      gapFmt: sgn(gap), gapColor: gap < 0 ? '#f0466e' : '#0f9d6a',
      gapText: gap === 0 ? '지출 예산을 모두 배분했어요.' : gap > 0 ? `배분되지 않은 예산 ${won(gap)}` : `전체 예산보다 ${won(gap)} 많이 배분했어요.`,
      dashSegs: (() => {
        let acc = 0;
        return Object.entries(by).filter(([, amt]) => amt > 0).sort((a, b) => b[1] - a[1]).map(([name, amt], i) => {
          const len = spent > 0 ? Math.round(503 * amt / spent) : 0, off = -acc; acc += len;
          const gi = gradOf[name] ?? i % 5, g = GRAD[gi];
          return { name, color: g[1], grad: 'url(#mg-' + gi + ')', dot: g[1], len, off, pct: spent > 0 ? Math.round(amt / spent * 100) + '%' : '0%', amt: won(amt), d: (i * 0.12) + 's' };
        });
      })(),
      noSpend0: !spent,
      catRows,
      allCatNames: [...new Set(['용돈', ...IN_CATS, ...data.categories.map(c => c.name), ...incomes.map(i => i.category), ...data.expenses.map(e => e.category)].filter(Boolean))],
      draftMethods: [...new Set([...(isInDraft ? IN_METHODS : OUT_METHODS), draft.method].filter(Boolean))],
      draftCats: [...new Set([...(isInDraft ? IN_CATS : data.categories.map(c => c.name)), draft.category].filter(Boolean))],
      mHeading: draft.editId != null ? '기록 수정하기' : '가계부 기록하기',
      recentRows: desc.slice(0, 6).map(row), noLedger: !desc.length,
      kinds: [['all', '전체'], ['in', '수입'], ['out', '지출']].map(([k, label]) => ({ label, ...seg(kind === k), pick: () => this.setState({ kind: k, selectedKeys: [] }) })),
      allRows: found.map(row), noFound: !found.length, foundCount: found.length,
      // newest day first; each day shows its net total ("10월 12일 (일)  -₩42,500")
      ledgerGroups: (() => {
        const g = {};
        found.forEach(x => { (g[x.date] = g[x.date] || []).push(x); });
        const dKeys = Object.keys(g).sort();
        if (sortOrder !== 'dateAsc') dKeys.reverse();
        return dKeys.map(d => {
          const xs = g[d], net = xs.reduce((a, x) => a + (x.k === 'in' ? x.amount : -x.amount), 0);
          const dt = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8));
          return { label: `${+d.slice(5, 7)}월 ${+d.slice(8)}일 (${DOW[dt.getDay()]})`, total: (net < 0 ? '-' : '+') + won(net), totalColor: net < 0 ? '#17161d' : '#0f9d6a', rows: xs.map(row) };
        });
      })(),
      foundIn: won(foundInAmt), foundOut: won(foundOutAmt),
      foundNet: (foundNetAmt >= 0 ? '+' : '-') + won(foundNetAmt),
      foundNetColor: foundNetAmt >= 0 ? '#0f9d6a' : '#f0466e',
      foundCardOut: won(foundCardAmt), foundCashOut: won(foundCashAmt), foundAccOut: won(foundAccAmt),
      weekdays: [...DOW].map((l, i) => ({ l, color: i === 0 ? '#f0466e' : i === 6 ? '#4f7bff' : '#8b87a0' })),
      cells, spendDays, noSpend, selTitle: `${+mo}월 ${selDay}일 ${DOW[sdow]}요일`,
      selIn: won(selList.filter(x => x.k === 'in').reduce((a, x) => a + x.amount, 0)), selOut: won(selList.filter(x => x.k === 'out').reduce((a, x) => a + x.amount, 0)),
      selRows: selList.map(row), selEmpty: !selList.length && !selPendings.length,
      selPendings, hasSelPendings: selPendings.length > 0,
      goToday: () => { const tm = TODAY.slice(0, 7); if (this.state.store.months[tm]) this.setState({ month: tm, selDay: +TODAY.slice(8) }); else this.setState({ selDay: 1 }); },
      addOnDay: () => this.openWith('out', data.month + '-' + String(selDay).padStart(2, '0')),
      addInOnDay: () => this.openWith('in', data.month + '-' + String(selDay).padStart(2, '0')),
      addPendOnDay: () => this.openWith('pending', data.month + '-' + String(selDay).padStart(2, '0')),
      statPeriods: [['month', '월간'], ['quarter', '분기'], ['year', '연간']].map(([k, label]) => ({ label, bg: statPeriod === k ? '#0f9d6a' : 'transparent', fg: statPeriod === k ? '#fff' : '#6c6880', pick: () => this.setState({ statPeriod: k }) })),
      statRangeLabel: statPeriod === 'month' ? `${y}년 ${+mo}월` : statPeriod === 'quarter' ? `${statMonths[0]} ~ ${statMonths[2]}` : `${y}년 전체`,
      statTotalOut: won(statOutSum), statTotalIn: won(statInSum), statDailyAvg: won(Math.round(statOutSum / statDaysDenom)),
      statTopCatName: topCat ? topCat[0] : '내역 없음',
      statTopCatSub: topCat && statOutSum > 0 ? `${won(topCat[1])} (${Math.round(topCat[1] / statOutSum * 100)}%)` : '지출을 기록해 보세요',
      statTrendRows, statCatRows, statIsMonth: statPeriod === 'month',
      ...homeVals,
      activeGoalCount: activeGoals.length, doneGoalCount: doneGoals.length,
      goalTabA: { bg: goalTab === 'active' ? '#0f9d6a' : 'transparent', fg: goalTab === 'active' ? '#fff' : '#6c6880' },
      goalTabD: { bg: goalTab === 'done' ? '#0f9d6a' : 'transparent', fg: goalTab === 'done' ? '#fff' : '#6c6880' },
      setGoalTabActive: () => this.setState({ goalTab: 'active' }), setGoalTabDone: () => this.setState({ goalTab: 'done' }),
      goalRows: shownGoals, noGoals: !shownGoals.length,
      goalModalOpen, goalDraft,
      openGoalModal: () => this.setState({ goalModalOpen: true, goalDraft: { title: '', target: '200000', current: '0', deadline: data.month + '-28' } }),
      closeGoalModal: () => this.setState({ goalModalOpen: false }),
      stopProp: ev => ev.stopPropagation(),
      setGoalTitle: ev => this.setState(s => ({ goalDraft: { ...s.goalDraft, title: ev.target.value } })),
      setGoalTarget: ev => this.setState(s => ({ goalDraft: { ...s.goalDraft, target: ev.target.value } })),
      setGoalCurrent: ev => this.setState(s => ({ goalDraft: { ...s.goalDraft, current: ev.target.value } })),
      setGoalDeadline: ev => this.setState(s => ({ goalDraft: { ...s.goalDraft, deadline: ev.target.value } })),
      saveGoal: () => {
        const gd = this.state.goalDraft, title = (gd.title || '').trim() || '나의 목표';
        const target = Math.max(1000, Math.round(Number(gd.target) || 100000));
        const current = Math.max(0, Math.round(Number(gd.current) || 0));
        this.saveGoals([...goals, { id: 'g' + Date.now(), title, target, current, deadline: gd.deadline || TODAY }]);
        this.setState({ goalModalOpen: false }); this.say('새 목표를 추가했어요.');
      },
      goDash: this.go('dash'), goCal: this.go('cal'), goStat: this.go('stat'), goPlan: this.go('plan'), goGoal: this.go('goal'), goExp: this.go('exp'), goShare: this.go('share'),
      setAllowance: ev => { const v = Math.max(0, Math.round(Number(ev.target.value) || 0)); this.upd(d => { d.allowance = v; return d; }); },
      addCat: () => this.upd(d => { d.categories.push({ id: 'c' + Date.now(), name: '새 항목', amount: 0 }); return d; }),
      autoAllocateBudget: () => {
        if (readOnly) return;
        this.upd(d => {
          const base = d.allowance > 0 ? d.allowance : 400000;
          d.allowance = base;
          const weights = { '식비': 0.35, '교통': 0.15, '카페·간식': 0.15, '간식·카페': 0.15, '쇼핑': 0.20, '쇼핑·생활': 0.20, '문화·취미': 0.15, '기타': 0.15 };
          const n = d.categories.length || 1;
          let sumW = 0;
          const ws = d.categories.map(c => { const w = weights[c.name] || (1 / n); sumW += w; return w; });
          let allocated = 0;
          d.categories.forEach((c, idx) => {
            if (idx === n - 1) c.amount = Math.max(0, base - allocated);
            else {
              const v = Math.round((base * (ws[idx] / sumW)) / 5000) * 5000;
              c.amount = v;
              allocated += v;
            }
          });
          return d;
        });
        this.say('전체 예산에 맞춰 카테고리별 추천 비율로 자동 배분했어요!');
      },
      copyPrevMonthBudget: () => {
        if (readOnly) return;
        if (!prevM || (!prevM.allowance && !(prevM.categories || []).some(c => c.amount > 0))) {
          this.say('가져올 지난달 예산 기록이 없어요. 추천 비율 배분을 이용해 보세요.');
          return;
        }
        this.upd(d => {
          d.allowance = prevM.allowance || d.allowance;
          d.categories = (prevM.categories || []).map(c => ({ ...c }));
          return d;
        });
        this.say('지난달 예산 설정을 그대로 가져왔어요.');
      },
      fillRemainingBudget: () => {
        if (readOnly || gap <= 0 || !data.categories.length) return;
        this.upd(d => {
          const each = Math.floor(gap / d.categories.length / 1000) * 1000;
          let remGap = gap;
          d.categories.forEach((c, idx) => {
            const add = idx === d.categories.length - 1 ? remGap : each;
            c.amount = Math.max(0, (Number(c.amount) || 0) + add);
            remGap -= add;
          });
          return d;
        });
        this.say('남은 미배분 예산을 카테고리에 골고루 배분했어요.');
      },
      fixedPresets: [
        { title: '통신비·알뜰폰 요금', category: '기타', method: '계좌·페이', amount: 33000 },
        { title: '대중교통 정기권·패스', category: '교통', method: '카드', amount: 55000 },
        { title: 'OTT·음원 정기구독', category: '쇼핑', method: '카드', amount: 14000 },
        { title: '헬스장·운동 회비', category: '기타', method: '카드', amount: 60000 },
        { title: '동아리·모임 정기회비', category: '기타', method: '계좌·페이', amount: 20000 }
      ].map(fp => ({
        ...fp, amtFmt: won(fp.amount),
        add: () => {
          if (readOnly) return;
          const date = TODAY.startsWith(data.month) ? TODAY : data.month + '-01';
          this.upd(d => {
            d.expenses.push({ id: Date.now() + Math.floor(Math.random() * 100), title: fp.title, category: fp.category, method: fp.method, date, amount: fp.amount });
            return d;
          });
          this.say(`📌 고정지출 '${fp.title}' (${won(fp.amount)})을 가계부에 등록했어요.`);
        }
      })),
      setQ: ev => this.setState({ q: ev.target.value }), setFilter: ev => this.setState({ filter: ev.target.value, selectedKeys: [] }),
      openModal: () => this.openWith('out'), openIncome: () => this.openWith('in'),
      openBatchModal: () => this.openBatchModal('out'),
      closeModal: () => this.setState({ modalOpen: false }),
      backdropClick: ev => { if (ev.target === ev.currentTarget) this.setState({ modalOpen: false }); },
      isNewDraft: draft.editId == null,
      hasBatchDrafts: bDrafts.length > 0,
      modalWidth: bDrafts.length > 0 ? '740px' : '480px',
      batchDraftCount: bDrafts.length,
      modalReadyCount: Math.max(1, modalReadyCount),
      modalTotalSumFmt: won(modalTotalSum),
      batchDraftRows,
      addModalBatchRow: () => this.setState(s => {
        const d0 = s.draft;
        if (Math.round(Number(d0.amount)) > 0) {
          const moved = { ...d0, uid: 'br_' + Date.now() + '_' + Math.floor(Math.random() * 100000) };
          return {
            batchDrafts: [...(s.batchDrafts || []), moved],
            draft: { ...d0, title: '', amount: '' },
            draftError: ''
          };
        }
        return {
          batchDrafts: [...(s.batchDrafts || []), { ...this.makeBlankRow(data, d0.kind, d0.date), method: d0.method, category: d0.category }],
          draftError: ''
        };
      }),
      addModal3Rows: () => this.setState(s => {
        const d0 = s.draft;
        const rows = [1, 2, 3].map(() => ({ ...this.makeBlankRow(data, d0.kind, d0.date), method: d0.method, category: d0.category }));
        return { batchDrafts: [...(s.batchDrafts || []), ...rows], draftError: '' };
      }),
      clearModalBatch: () => this.setState({ batchDrafts: [], draftError: '' }),
      mSaveBtnLabel: draft.editId != null ? '수정 저장하기' : bDrafts.length > 0 ? `✅ 총 ${Math.max(1, modalReadyCount)}건 한꺼번에 저장하기` : '저장하기',
      mOut: seg(draft.kind === 'out'), mIn: seg(isInDraft), mPend: seg(isPendDraft),
      setKindOut: setKind('out'), setKindIn: setKind('in'), setKindPending: setKind('pending'),
      addAmt1k: bumpAmt(1000), addAmt5k: bumpAmt(5000), addAmt10k: bumpAmt(10000), addAmt50k: bumpAmt(50000),
      mTitleLabel: isInDraft ? '어디서 받았나요? (메모)' : isPendDraft ? '어떤 미정 지출인가요? (N빵/얻어먹기 등 메모)' : '어디에 사용했나요? (메모)',
      mTitlePh: isInDraft ? '예: 주말 아르바이트 (비워두면 분류명 저장)' : isPendDraft ? '예: 친구들과 밥 먹음 — N빵할지 사주는지 미정' : '예: 친구와 점심 식사 (비워두면 분류명 저장)',
      mSaveBg: isPendDraft ? '#d97706' : '#0f9d6a',
      setTitle: setD('title'), setAmount: setD('amount'), setMethod: setD('method'), setCategory: setD('category'), setDate: setD('date'),
      draftKey: ev => { if (ev.key === 'Enter') this.saveExpense(); },
      saveExpense: this.saveExpense, downloadCsv: this.downloadCsv,
      downloadTemplate: this.downloadTemplate,
      triggerExcelUpload: this.triggerExcelUpload,
      excelModalOpen, excelPaste, excelError, excelFileName,
      hasExcelFileName: !!excelFileName,
      openExcelModal: () => this.setState({ excelModalOpen: true, excelError: '' }),
      closeExcelModal: () => this.setState({ excelModalOpen: false, excelError: '' }),
      setExcelPaste: ev => {
        const text = ev.target.value;
        const rows = this.parseExcelText(text);
        this.setState({
          excelPaste: text,
          excelRows: rows,
          excelError: text.trim() && !rows.length ? '입력한 내용에서 날짜와 금액을 인식하지 못했어요. (예: 2026-10-05, 지출, 카드, 식비, 점심, 7000)' : ''
        });
      },
      clearExcelPreview: () => this.setState({ excelRows: [], excelPaste: '', excelFileName: '', excelError: '' }),
      hasExcelPreview: (excelRows || []).length > 0,
      excelPreviewCount: (excelRows || []).length,
      excelPreviewInFmt: won((excelRows || []).filter(r => r.kind === 'in').reduce((a, r) => a + r.amount, 0)),
      excelPreviewOutFmt: won((excelRows || []).filter(r => r.kind === 'out').reduce((a, r) => a + r.amount, 0)),
      excelPreviewPendFmt: won((excelRows || []).filter(r => r.kind === 'pending').reduce((a, r) => a + r.amount, 0)),
      fillExcelSamplePaste: () => {
        const sample = [
          `${data.month}-03\t지출\t카드\t식비\t학생식당 점심\t7000`,
          `${data.month}-04\t지출\t카드\t카페·간식\t아이스 아메리카노\t4500`,
          `${data.month}-06\t수입\t계좌·페이\t아르바이트\t주말 알바 대타 급여\t65000`,
          `${data.month}-07\t임시\t카드\t식비\t동기들과 치킨·맥주 (N빵 정산 전)\t42000`
        ].join('\n');
        const rows = this.parseExcelText(sample);
        this.setState({ excelPaste: sample, excelRows: rows, excelError: '' });
      },
      excelPreviewRows: (excelRows || []).map(r => {
        const isIn = r.kind === 'in', isPend = r.kind === 'pending', mb = methodBadge(r.method);
        return {
          ...r,
          kindLabel: isIn ? '수입' : isPend ? '임시·미정' : '지출',
          kindBg: isIn ? '#e8f8f0' : isPend ? '#fff6e5' : '#fff0f4',
          kindFg: isIn ? '#0f9d6a' : isPend ? '#d97706' : '#f0466e',
          methodBg: mb.bg, methodFg: mb.fg,
          amountFmt: (isIn ? '+' : isPend ? '⏳ ' : '-') + won(r.amount),
          amtColor: isIn ? '#0f9d6a' : isPend ? '#d97706' : '#17161d',
          removeRow: () => this.setState(s => ({ excelRows: (s.excelRows || []).filter(x => x.uid !== r.uid) }))
        };
      }),
      commitExcelUpload: this.commitExcelUpload,
      // 🧮 N빵 · 더치페이 & 미정 내역 정산 계산기 모달 바인딩
      settleModalOpen,
      settleDraft,
      settleTotalFmt: won(settleDraft.totalAmt),
      settleMyAmtKor: kor(settleDraft.myAmt),
      settleShareFmt: won(calcSplitAmt(settleDraft.totalAmt, settleDraft.people, settleDraft.roundMode)),
      settleRemainderFmt: sgn(settleDraft.totalAmt - calcSplitAmt(settleDraft.totalAmt, settleDraft.people, settleDraft.roundMode) * settleDraft.people),
      closeSettleModal: () => this.setState({ settleModalOpen: false }),
      settlePeopleBtns: [2, 3, 4, 5, 6, 8].map(n => ({
        label: `${n}명 (1/${n})`,
        bg: settleDraft.people === n ? '#d97706' : '#fff',
        fg: settleDraft.people === n ? '#fff' : '#34313f',
        bd: settleDraft.people === n ? '#d97706' : '#e5e7eb',
        pick: () => this.setState(s => {
          const sd = s.settleDraft;
          const myAmt = calcSplitAmt(sd.totalAmt, n, sd.roundMode);
          return { settleDraft: { ...sd, people: n, myAmt: String(myAmt), tag: `1/${n} N빵` } };
        })
      })),
      settleDecPeople: () => this.setState(s => {
        const sd = s.settleDraft, n = Math.max(1, (Number(sd.people) || 2) - 1);
        const myAmt = calcSplitAmt(sd.totalAmt, n, sd.roundMode);
        return { settleDraft: { ...sd, people: n, myAmt: String(myAmt), tag: n === 1 ? '전액 부담' : `1/${n} N빵` } };
      }),
      settleIncPeople: () => this.setState(s => {
        const sd = s.settleDraft, n = Math.min(50, (Number(sd.people) || 2) + 1);
        const myAmt = calcSplitAmt(sd.totalAmt, n, sd.roundMode);
        return { settleDraft: { ...sd, people: n, myAmt: String(myAmt), tag: `1/${n} N빵` } };
      }),
      settleRoundBtns: [
        ['none', '정확히 1/N (원 단위 반올림)'],
        ['up100', '100원 단위 올림'],
        ['down100', '100원 단위 버림'],
        ['down1000', '1,000원 단위 버림']
      ].map(([rm, label]) => ({
        label,
        bg: settleDraft.roundMode === rm ? '#fef3c7' : '#f8f9fc',
        fg: settleDraft.roundMode === rm ? '#b45309' : '#6c6880',
        bd: settleDraft.roundMode === rm ? '#f59e0b' : '#e5e7eb',
        pick: () => this.setState(s => {
          const sd = s.settleDraft;
          const myAmt = calcSplitAmt(sd.totalAmt, sd.people, rm);
          return { settleDraft: { ...sd, roundMode: rm, myAmt: String(myAmt) } };
        })
      })),
      setSettleMyAmt: ev => this.setState(s => ({ settleDraft: { ...s.settleDraft, myAmt: ev.target.value, tag: '직접 정산' } })),
      setSettleFull: () => this.setState(s => ({ settleDraft: { ...s.settleDraft, people: 1, myAmt: String(s.settleDraft.totalAmt), tag: '전액 부담' } })),
      setSettleZero: () => this.setState(s => ({ settleDraft: { ...s.settleDraft, myAmt: '0', tag: '얻어먹음(0원)' } })),
      copySettleMsg: async () => {
        const sd = this.state.settleDraft;
        const perPerson = calcSplitAmt(sd.totalAmt, sd.people, sd.roundMode);
        const msg = `[MOA 더치페이 정산 안내]\n• 내역: ${sd.title} (${sd.date.slice(5).replace('-', '.')})\n• 총 결제금액: ${won(sd.totalAmt)}\n• 정산 인원: ${sd.people}명 (1/${sd.people} N빵)\n• 1인당 보내실 금액: ${won(perPerson)}`;
        try {
          await navigator.clipboard.writeText(msg);
          this.say('📋 카카오톡/문자 더치페이 정산 안내 문구를 복사했어요!');
        } catch (e) {
          window.prompt('아래 정산 문구를 복사하세요:', msg);
        }
      },
      confirmSettle: () => {
        const sd = this.state.settleDraft;
        const p = pendings.find(x => x.id === sd.id);
        if (!p) { this.setState({ settleModalOpen: false }); return; }
        const finalAmt = Math.max(0, Math.round(Number(sd.myAmt) || 0));
        resolvePending(p, finalAmt, finalAmt > 0 ? sd.tag : '');
        this.setState({ settleModalOpen: false });
      },
      replaySplash: () => { clearTimeout(this._it); this.setState({ intro: 'splash' }); this._it = setTimeout(() => this.setState({ intro: '' }), 2200); },
      replayOnboarding: () => { clearTimeout(this._it); this.setState({ intro: 'ob', obStep: 0 }); },
      ...this.introVals(),
      _x: 0
    };
  }
}
