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
const PALETTE = [['#e0705b', '#fdece7'], ['#3f7fc4', '#eaf3fc'], ['#c08a1e', '#fdf3dc'], ['#d2618a', '#fdedf3'], ['#4e9a5b', '#ebf5ec'], ['#7d867b', '#f1f3ef']];
const GREEN = ['#159d7b', '#e9faf5'];
// chart gradients (light -> deep), same order as PALETTE
const GRAD = [['#FFC9BB', '#F79A84'], ['#BFDDFF', '#86B8F0'], ['#FFE7A8', '#F6C969'], ['#FFC8DC', '#F09BBC'], ['#CDEBC0', '#93CF8A'], ['#E3E7E0', '#BCC4B9']];
const IN_CATS = ['아르바이트', '선물·세뱃돈', '기타 수입'];
const DOW = '일월화수목금토';
const DEFAULT = () => ({
  month: TODAY.slice(0, 7), allowance: 0,
  categories: [{ id: 'c1', name: '식비', amount: 0 }, { id: 'c2', name: '교통', amount: 0 }, { id: 'c3', name: '카페·간식', amount: 0 }, { id: 'c4', name: '쇼핑', amount: 0 }, { id: 'c5', name: '기타', amount: 0 }],
  incomes: [],
  expenses: []
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
      q: '', filter: '', kind: 'all', statPeriod: 'month', goalTab: 'active',
      modalOpen: false, draft: this.blank(init.store.months[init.month], 'out'), draftError: '',
      goalModalOpen: false, goalDraft: { title: '', target: '200000', current: '0', deadline: TODAY },
      toast: '', shareUrls: { plan: '', ledger: '' },
      driveConnected: !!(window.moaDrive && window.moaDrive.isConnected && window.moaDrive.isConnected()),
      driveStatus: (window.moaDrive && window.moaDrive.getStatus && window.moaDrive.getStatus()) || '연결하면 앱 전용 공간에 안전하게 백업해요.'
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
    const { intro, obStep: step } = this.state, last = 2, ig = '#3E8C64';
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
      obDots: [0, 1, 2].map(i => ({ w: i === step ? '22px' : '6px', bg: i === step ? ig : '#D9D4C9' })),
      obLedgerRows: [
        { sign: '+', title: '이번 달 수입 기록', cat: '수입 · 용돈/급여', amt: '+ 0원', color: '#159d7b', soft: '#e9faf5', amtColor: '#159d7b', d: '.35s' },
        { sign: '−', title: '식비 지출 기록', cat: '지출 · 식비', amt: '− 0원', color: '#e0705b', soft: '#fdece7', amtColor: '#464d44', d: '.5s' },
        { sign: '−', title: '교통비 지출 기록', cat: '지출 · 교통', amt: '− 0원', color: '#3f7fc4', soft: '#eaf3fc', amtColor: '#464d44', d: '.65s' }
      ],
      obSpend: [
        { name: '식비', amount: '예산 한도 설정', w: '64%', color: '#E0705B', soft: '#FDE7E1', icon: OB_ICON.food, d1: '.35s', d2: '.45s' },
        { name: '교통', amount: '실시간 비중 확인', w: '46%', color: '#3F7FC4', soft: '#E3EEFA', icon: OB_ICON.bus, d1: '.48s', d2: '.58s' },
        { name: '카페·간식', amount: '소비 흐름 분석', w: '34%', color: '#C8902A', soft: '#FCF0D7', icon: OB_ICON.cup, d1: '.6s', d2: '.7s' }
      ]
    };
    for (let i = 0; i <= last; i++) v['ob' + i] = step === i;
    return v;
  }
  defDay(month) { return TODAY.startsWith(month) ? +TODAY.slice(8) : 1; }
  cur() { return this.state.store.months[this.state.month]; }
  blank(d, kind, date) {
    let lastCat = '';
    try { lastCat = JSON.parse(localStorage.getItem(LAST_PREF_KEY) || '{}')[kind] || ''; } catch (e) {}
    const defCat = kind === 'in'
      ? (IN_CATS.includes(lastCat) ? lastCat : IN_CATS[0])
      : ((d.categories.find(c => c.name === lastCat) || d.categories[0] || {}).name || '기타');
    return { kind, title: '', amount: '', category: defCat, date: date || (TODAY.startsWith(d.month) ? TODAY : d.month + '-01') };
  }
  upd(fn) {
    if (this.state.readOnly) return;
    this.setState(s => {
      const store = clone(s.store);
      const md = store.months[s.month];
      md.incomes = md.incomes || [];
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
      if (k) this.setState({ month: k, selDay: this.defDay(k), q: '', filter: '' });
      return;
    }
    const [y, mm] = month.split('-').map(Number);
    const dt = new Date(y, mm - 1 + delta, 1);
    const key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
    const st = clone(store);
    if (!st.months[key]) {
      const src = st.months[month];
      st.months[key] = { month: key, allowance: src.allowance, categories: src.categories.map(c => ({ ...c })), incomes: [], expenses: [] };
    }
    st.current = key;
    persist(st);
    this.setState({ store: st, month: key, selDay: this.defDay(key), q: '', filter: '', shareUrls: { plan: '', ledger: '' } });
  };
  openWith = (kind, date) => this.setState({ modalOpen: true, draft: this.blank(this.cur(), kind, date), draftError: '' });
  openEdit = x => this.setState({ modalOpen: true, draft: { kind: x.k, title: x.title, amount: String(x.amount), category: x.category, date: x.date, editId: x.id, editKind: x.k }, draftError: '' });
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
    const { draft } = this.state, data = this.cur();
    const amount = Math.round(Number(draft.amount));
    if (!Number.isFinite(amount) || amount <= 0) return this.setState({ draftError: '올바른 금액을 입력하세요.' });
    if (!draft.date || !draft.date.startsWith(data.month)) return this.setState({ draftError: '이번 달 날짜만 등록할 수 있어요.' });
    const category = (draft.category || '').trim() || (draft.kind === 'in' ? IN_CATS[0] : '기타');
    const title = (draft.title || '').trim() || category;
    const editing = draft.editId != null;
    const item = { id: editing ? draft.editId : Date.now(), title, category, date: draft.date, amount };
    try {
      const lp = JSON.parse(localStorage.getItem(LAST_PREF_KEY) || '{}');
      lp[draft.kind] = category;
      localStorage.setItem(LAST_PREF_KEY, JSON.stringify(lp));
    } catch (e) {}
    this.upd(d => {
      if (editing) {
        const k = draft.editKind === 'in' ? 'incomes' : 'expenses';
        d[k] = d[k].filter(e => e.id !== draft.editId);
      }
      (draft.kind === 'in' ? d.incomes : d.expenses).push(item);
      return d;
    });
    this.setState({ modalOpen: false, draftError: '', selDay: +draft.date.slice(8) || 1 });
    this.say(editing ? '기록을 수정했어요.' : draft.kind === 'in' ? '수입을 저장했어요.' : '지출을 저장했어요.');
  };
  downloadCsv = () => {
    const d = this.cur();
    const rows = [
      ['날짜', '구분', '내용', '분류', '금액(원)'],
      ...(d.allowance > 0 ? [[d.month + '-01', '수입', '이번 달 예산', '용돈', d.allowance]] : []),
      ...[...(d.incomes || []).map(x => ({ ...x, k: '수입' })), ...d.expenses.map(x => ({ ...x, k: '지출' }))]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(x => [x.date, x.k, x.title, x.category, x.k === '지출' ? -x.amount : x.amount])
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = d.month + '_가계부.csv';
    a.click();
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
    const { store, goals, month, selDay, readOnly, sharedAt, scope, page, q, filter, kind, statPeriod, goalTab, modalOpen, draft, draftError, goalModalOpen, goalDraft, toast, shareUrls, driveConnected, driveStatus } = this.state;
    const shareObj = k => ({ url: shareUrls[k], has: !!shareUrls[k], make: this.makeShare(k), copy: this.copyShare(k), preview: () => shareUrls[k] && window.open(shareUrls[k], '_blank', 'noopener') });
    const data = store.months[month] || DEFAULT(), incomes = data.incomes || [];
    const mkeys = Object.keys(store.months).sort(), mi = mkeys.indexOf(month);
    const allowance = Math.max(0, Number(data.allowance) || 0);
    const spent = data.expenses.reduce((a, x) => a + (Number(x.amount) || 0), 0);
    const income = incomes.reduce((a, x) => a + (Number(x.amount) || 0), 0);
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
      const v = num ? Math.max(0, Math.round(Number(ev.target.value) || 0)) : (ev.target.value || '').trim() || '항목';
      this.upd(d => {
        const c = d.categories.find(x => x.id === id);
        if (!c) return d;
        if (k === 'name') d.expenses.forEach(x => { if (x.category === c.name) x.category = v; });
        c[k] = v;
        return d;
      });
    };
    const catRows = data.categories.map((c, i) => {
      const s = by[c.name] || 0, a = Math.max(0, Number(c.amount) || 0);
      const over = a > 0 && s > a, warn = !over && a > 0 && (s / a) >= 0.8, col = PALETTE[i % 5][0];
      return {
        ...c, color: col, amountFmt: won(a), spentFmt: won(s), spentColor: over ? '#e26c73' : '#737c71',
        hasAlert: over || warn, alertText: over ? '초과' : '주의', alertBg: over ? '#fff0f1' : '#fdf3dc', alertFg: over ? '#e26c73' : '#c08a1e',
        barW: Math.min(100, a > 0 ? s / a * 100 : (s > 0 ? 100 : 0)) + '%',
        barColor: over ? 'linear-gradient(90deg,#FFC2C2,#F2868E)' : `linear-gradient(90deg,${GRAD[i % 5][0]},${GRAD[i % 5][1]})`,
        share: allowance > 0 ? Math.round(a / allowance * 100) + '%' : '',
        setName: editField(c.id, 'name'), setAmount: editField(c.id, 'amount', true), amountKor: kor(c.amount),
        usePct: a > 0 ? Math.round(s / a * 100) + '%' : '-', soft: PALETTE[i % 5][1], initial: String(c.name || '?').slice(0, 1),
        remove: () => this.upd(d => { d.categories = d.categories.filter(x => x.id !== c.id); return d; })
      };
    });
    const ledger = [
      ...(allowance > 0 ? [{ id: 'allow', k: 'in', fixed: true, title: '이번 달 예산', category: '용돈', date: data.month + '-01', amount: allowance }] : []),
      ...incomes.map(x => ({ ...x, k: 'in' })),
      ...data.expenses.map(x => ({ ...x, k: 'out' }))
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.fixed ? -1 : b.fixed ? 1 : 0) || (Number(a.id) - Number(b.id)));
    let bal = 0; const balOf = {};
    ledger.forEach(x => { bal += x.k === 'in' ? x.amount : -x.amount; balOf[x.k + x.id] = bal; });
    const row = x => {
      const isIn = x.k === 'in', c = isIn ? GREEN : (colorOf[x.category] || PALETTE[5]);
      return {
        ...x, color: c[0], soft: c[1], sign: isIn ? '+' : '−', dateShort: x.date.slice(5).replace('-', '.'),
        amountFmt: (isIn ? '+' : '-') + won(x.amount), amtColor: isIn ? '#159d7b' : '#464d44',
        inCol: isIn ? '+' + won(x.amount) : '', outCol: isIn ? '' : '-' + won(x.amount), balanceFmt: sgn(balOf[x.k + x.id]),
        canRemove: !x.fixed, cursor: !readOnly && !x.fixed ? 'pointer' : 'default',
        rowClick: () => { if (!readOnly && !x.fixed) this.openEdit(x); },
        edit: () => this.openEdit(x),
        remove: () => {
          if (confirm('이 기록을 삭제할까요?')) {
            this.upd(d => {
              if (isIn) d.incomes = d.incomes.filter(e => e.id !== x.id);
              else d.expenses = d.expenses.filter(e => e.id !== x.id);
              return d;
            });
            this.say('기록을 삭제했어요.');
          }
        }
      };
    };
    const desc = [...ledger].reverse();
    const ql = q.trim().toLowerCase(), qn = ql.replace(/[,₩원\s]/g, '');
    const hit = x => x.title.toLowerCase().includes(ql) || x.category.toLowerCase().includes(ql) || (/^\d+$/.test(qn) && String(x.amount).includes(qn)) || x.date.slice(5).replace('-', '.').includes(ql) || x.date.includes(ql);
    const found = ledger.filter(x => (kind === 'all' || x.k === kind) && (!filter || x.category === filter) && (!ql || hit(x)));
    const P = PAGES[page] || PAGES.dash;
    const firstDow = new Date(+y, +mo - 1, 1).getDay();
    const outT = {}, inT = {};
    data.expenses.forEach(x => { const d = +x.date.slice(8); outT[d] = (outT[d] || 0) + x.amount; });
    ledger.filter(x => x.k === 'in').forEach(x => { const d = +x.date.slice(8); inT[d] = (inT[d] || 0) + x.amount; });
    const maxT = Math.max(1, ...Object.values(outT));
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push({ isDay: false });
    for (let d = 1; d <= days; d++) {
      const t = outT[d] || 0, ti = inT[d] || 0, dow = (firstDow + d - 1) % 7, sel = d === selDay, isToday = thisMonth && d === todayD;
      cells.push({
        isDay: true, day: d, amt: t ? '-' + t.toLocaleString('ko-KR') : '', inAmt: ti ? '+' + ti.toLocaleString('ko-KR') : '',
        bg: sel ? '#36795a' : t ? `rgba(47,107,79,${(0.05 + 0.2 * t / maxT).toFixed(3)})` : '#fff',
        border: sel ? '1px solid #36795a' : isToday ? '1.5px solid #3d8865' : '1px solid #f2f4f2',
        numColor: sel ? '#fff' : dow === 0 ? '#e36c70' : dow === 6 ? '#5b8fd6' : '#4b5349',
        amtColor: sel ? '#fff' : '#2c6249', inColor: sel ? '#d9fff1' : '#159d7b', todayMark: isToday ? '오늘' : '',
        pick: () => this.setState({ selDay: d })
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
      bg: r.amt && r.amt === maxTrend ? 'linear-gradient(180deg,#5CC08C,#2B9B68)' : '#CFEBD9', amtShort: r.amt ? kor(r.amt).replace('원', '') : '0' }));
    let catAcc = 0;
    const sortedStatCats = Object.entries(statCatMap).filter(([, amt]) => amt > 0).sort((a, b) => b[1] - a[1]);
    const statCatRows = sortedStatCats.map(([name, amt], i) => {
      const len = statOutSum > 0 ? Math.round(503 * amt / statOutSum) : 0, off = -catAcc; catAcc += len;
      const gi = gradOf[name] ?? i % 5, g = GRAD[gi];
      return { name, grad: 'url(#sg-' + gi + ')', dot: `linear-gradient(135deg,${g[0]},${g[1]})`, len, off, pct: statOutSum > 0 ? Math.round(amt / statOutSum * 100) + '%' : '0%', amtFmt: won(amt) };
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
        badgeBg: isDone ? '#e9faf5' : '#f6fbf8', badgeFg: isDone ? '#159d7b' : '#43956f',
        addSavings: () => { this.saveGoals(goals.map(it => it.id === g.id ? { ...it, current: (Number(it.current) || 0) + 10000 } : it)); this.say('10,000원을 모았어요.'); },
        remove: () => { if (confirm('이 목표를 삭제할까요?')) { this.saveGoals(goals.filter(it => it.id !== g.id)); this.say('목표를 삭제했어요.'); } }
      };
    });
    const activeGoals = enrichedGoals.filter(g => !g.isDone), doneGoals = enrichedGoals.filter(g => g.isDone);
    const shownGoals = goalTab === 'done' ? doneGoals : activeGoals;

    // --- home dashboard extras ---
    const hr = new Date().getHours();
    const greet = hr < 11 ? '좋은 아침이에요!' : hr < 18 ? '좋은 하루예요!' : '좋은 저녁이에요!';
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
      trendBadge: chg === null ? '' : (chg <= 0 ? '↓ ' : '↑ ') + Math.abs(chg) + '%', trendBadgeColor: chg !== null && chg > 0 ? '#F2665E' : '#2B9B68',
      monthStartLabel: `${+mo}월 1일`, monthNowLabel: `${+mo}월 ${lastDay}일`,
      weekBars: '월화수목금토일'.split('').map((l, i) => ({ l, h: (weekMax ? Math.max(6, Math.round(weekAmts[i] / weekMax * 100)) : 6) + '%', bg: weekMax && i === weekTop ? '#2B9B68' : '#CFEBD9' })),
      weekMsg: weekMax ? `이번 주는 ${'월화수목금토일'[weekTop]}요일에 가장 많이 썼어요.` : '이번 주는 아직 지출이 없어요.',
      weekSub: `이번 주 지출 ${won(weekSum)}`,
      hasGoal: !!topGoal, noGoal: !topGoal,
      goalTitle: topGoal ? topGoal.title : '', goalCur: topGoal ? topGoal.currentFmt : '', goalTgt: topGoal ? topGoal.targetFmt : '',
      goalPct: topGoal ? topGoal.pct + '%' : '0%', goalW: topGoal ? topGoal.barW : '0%', goalDday: topGoal ? topGoal.ddayLabel : ''
    };

    const navItem = k => ({ bg: k === page ? '#E9F6EF' : 'transparent', color: k === page ? '#1F7A52' : '#6B7684' });
    const seg = on => ({ bg: on ? '#fff' : 'transparent', color: on ? '#2a3228' : '#98a096', shadow: on ? '0 2px 6px rgba(28,48,38,.08)' : 'none' });
    const setD = k => ev => { const v = ev.target.value; this.setState(s => ({ draft: { ...s.draft, [k]: v }, draftError: '' })); };
    const setKind = k => () => this.setState(s => ({ draft: { ...s.draft, kind: k, category: k === 'in' ? IN_CATS[0] : ((data.categories[0] || {}).name || '기타') } }));
    const bumpAmt = delta => () => this.setState(s => ({ draft: { ...s.draft, amount: String(Math.max(0, Math.round(Number(s.draft.amount) || 0) + delta)) }, draftError: '' }));
    const isInDraft = draft.kind === 'in';
    return {
      readOnly, editable: !readOnly, sharedAt, toast, modalOpen, draft, draftError, q, filter,
      draftKor: kor(draft.amount), allowanceKor: kor(data.allowance), goalTargetKor: kor(goalDraft.target), goalCurrentKor: kor(goalDraft.current),
      driveConnected, driveStatus,
      driveLabel: driveConnected ? 'Drive 연결됨' : 'Google Drive 연결',
      driveBtnText: driveConnected ? '계정 다시 연결' : 'Google 계정 연결',
      drivePillBg: driveConnected ? '#e9faf5' : '#fff',
      drivePillFg: driveConnected ? '#159d7b' : '#43956f',
      drivePillBd: driveConnected ? '#c8efe3' : '#edf0ec',
      driveDotColor: driveConnected ? '#159d7b' : '#b5bab4',
      connectDrive: this.triggerDriveConnect,
      saveDriveNow: () => { if (window.moaDrive && window.moaDrive.saveNow) window.moaDrive.saveNow(); this.say('Google Drive에 백업을 요청했어요.'); },
      sp: shareObj('plan'), sl: shareObj('ledger'),
      showDash: !scope, showCal: scope !== 'plan', showStat: scope !== 'plan', showPlan: scope !== 'ledger', showGoal: !scope, showExp: scope !== 'plan',
      bannerText: scope === 'plan' ? `${y}년 ${+mo}월 지출 계획서` : scope === 'ledger' ? `${y}년 ${+mo}월 가계부` : '공유 화면',
      nav: { dash: navItem('dash'), cal: navItem('cal'), stat: navItem('stat'), plan: navItem('plan'), goal: navItem('goal'), exp: navItem('exp'), share: navItem('share') },
      crumb: P[0], modeLabel: readOnly ? '읽기 전용으로 보는 중' : '내 기록 편집 중', dotColor: readOnly ? '#3e8966' : '#4acdad',
      isDash: page === 'dash', isCal: page === 'cal', isStat: page === 'stat', isPlan: page === 'plan', isGoal: page === 'goal', isExp: page === 'exp', isShare: page === 'share',
      eyebrow: `${y}년 ${+mo}월의 기록`, monthShort: `${+mo}월`, monthLabel: `${y}년 ${+mo}월`, title: page === 'dash' ? homeVals.greet : P[1], titleChars: [...(page === 'dash' ? homeVals.greet : P[1])].map((ch, i) => ({ ch, st: `animation-name:tp-letter-${(this._tn || 0) % 2};animation-delay:${i * 35}ms;--dx:${i % 2 ? -22 : 24}px` })), desc: P[2], showShareCta: !readOnly && page !== 'share',
      prevMonth: this.shiftMonth(-1), nextMonth: this.shiftMonth(1),
      prevOp: readOnly && mi <= 0 ? 0.3 : 1, nextOp: readOnly && mi >= mkeys.length - 1 ? 0.3 : 1,
      planLink: readOnly ? '자세히 보기 →' : '계획 수정 →',
      allowance, allowanceFmt: won(this.cu('allow', allowance)), incomeFmt: won(this.cu('income', income)), incomeCount: incomes.length, availFmt: won(avail), inTotalFmt: won(avail),
      spentFmt: won(this.cu('spent', spent)), plannedFmt: won(planned), leftFmt: sgn(this.cu('left', left)), count: data.expenses.length,
      leftColor: left < 0 ? '#e26572' : '#16a885',
      leftHint: left < 0 ? '예산을 초과했어요' : day >= days ? '이번 달 마감' : `남은 ${rem}일, 하루 ${won(Math.floor(left / rem))}`,
      remDays: day >= days ? 0 : rem, dailyFmt: won(left > 0 && day < days ? Math.floor(left / rem) : 0),
      pctLabel: this.cu('pct', pct) + '%', pctW: pc + '%', ring: `conic-gradient(#5DB585 0 ${pc}%, #ffffffb3 ${pc}% 100%)`, planRing: `conic-gradient(#2B9B68 0 ${pc}%, #EEF1EF ${pc}% 100%)`,
      dayLabel: day ? `${days}일 중 ${day}일째` : '아직 시작 전',
      heroMsg: left < 0 ? '예산 초과! 내역을 확인해요' : avail === 0 && spent === 0 ? '이번 달 지출 계획을 세워 보세요' : pct > (day / days * 100) + 10 ? '조금 빠른 속도예요' : '계획적인 소비 중!',
      gapFmt: sgn(gap), gapColor: gap < 0 ? '#e26c73' : '#347355',
      gapText: gap === 0 ? '지출 예산을 모두 배분했어요.' : gap > 0 ? `배분되지 않은 예산 ${won(gap)}` : `전체 예산보다 ${won(gap)} 많이 배분했어요.`,
      dashSegs: (() => {
        let acc = 0;
        return Object.entries(by).filter(([, amt]) => amt > 0).sort((a, b) => b[1] - a[1]).map(([name, amt], i) => {
          const len = spent > 0 ? Math.round(503 * amt / spent) : 0, off = -acc; acc += len;
          const gi = gradOf[name] ?? i % 5, g = GRAD[gi];
          return { name, color: g[1], grad: 'url(#mg-' + gi + ')', dot: `linear-gradient(135deg,${g[0]},${g[1]})`, len, off, pct: spent > 0 ? Math.round(amt / spent * 100) + '%' : '0%', amt: won(amt), d: (i * 0.12) + 's' };
        });
      })(),
      noSpend0: !spent,
      catRows,
      allCatNames: [...new Set(['용돈', ...IN_CATS, ...data.categories.map(c => c.name), ...incomes.map(i => i.category), ...data.expenses.map(e => e.category)].filter(Boolean))],
      draftCats: [...new Set([...(isInDraft ? IN_CATS : data.categories.map(c => c.name)), draft.category].filter(Boolean))],
      mHeading: draft.editId != null ? '기록 수정하기' : '가계부 기록하기',
      recentRows: desc.slice(0, 6).map(row), noLedger: !desc.length,
      kinds: [['all', '전체'], ['in', '수입'], ['out', '지출']].map(([k, label]) => ({ label, ...seg(kind === k), pick: () => this.setState({ kind: k }) })),
      allRows: found.map(row), noFound: !found.length, foundCount: found.length,
      // newest day first; each day shows its net total ("10월 12일 (일)  -₩42,500")
      ledgerGroups: (() => {
        const g = {};
        [...found].reverse().forEach(x => { (g[x.date] = g[x.date] || []).push(x); });
        return Object.keys(g).sort().reverse().map(d => {
          const xs = g[d], net = xs.reduce((a, x) => a + (x.k === 'in' ? x.amount : -x.amount), 0);
          const dt = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8));
          return { label: `${+d.slice(5, 7)}월 ${+d.slice(8)}일 (${DOW[dt.getDay()]})`, total: (net < 0 ? '-' : '+') + won(net), totalColor: net < 0 ? '#191F28' : '#2B9B68', rows: xs.map(row) };
        });
      })(),
      foundIn: won(found.filter(x => x.k === 'in').reduce((a, x) => a + x.amount, 0)), foundOut: won(found.filter(x => x.k === 'out').reduce((a, x) => a + x.amount, 0)),
      weekdays: [...DOW].map((l, i) => ({ l, color: i === 0 ? '#e36c70' : i === 6 ? '#5b8fd6' : '#b0b6af' })),
      cells, spendDays, noSpend, selTitle: `${+mo}월 ${selDay}일 ${DOW[sdow]}요일`,
      selIn: won(selList.filter(x => x.k === 'in').reduce((a, x) => a + x.amount, 0)), selOut: won(selList.filter(x => x.k === 'out').reduce((a, x) => a + x.amount, 0)),
      selRows: selList.map(row), selEmpty: !selList.length,
      goToday: () => { const tm = TODAY.slice(0, 7); if (this.state.store.months[tm]) this.setState({ month: tm, selDay: +TODAY.slice(8) }); else this.setState({ selDay: 1 }); },
      addOnDay: () => this.openWith('out', data.month + '-' + String(selDay).padStart(2, '0')),
      addInOnDay: () => this.openWith('in', data.month + '-' + String(selDay).padStart(2, '0')),
      statPeriods: [['month', '월간'], ['quarter', '분기'], ['year', '연간']].map(([k, label]) => ({ label, bg: statPeriod === k ? '#2B9B68' : 'transparent', fg: statPeriod === k ? '#fff' : '#6B7684', pick: () => this.setState({ statPeriod: k }) })),
      statRangeLabel: statPeriod === 'month' ? `${y}년 ${+mo}월` : statPeriod === 'quarter' ? `${statMonths[0]} ~ ${statMonths[2]}` : `${y}년 전체`,
      statTotalOut: won(statOutSum), statTotalIn: won(statInSum), statDailyAvg: won(Math.round(statOutSum / statDaysDenom)),
      statTopCatName: topCat ? topCat[0] : '내역 없음',
      statTopCatSub: topCat && statOutSum > 0 ? `${won(topCat[1])} (${Math.round(topCat[1] / statOutSum * 100)}%)` : '지출을 기록해 보세요',
      statTrendRows, statCatRows, statIsMonth: statPeriod === 'month',
      ...homeVals,
      activeGoalCount: activeGoals.length, doneGoalCount: doneGoals.length,
      goalTabA: { bg: goalTab === 'active' ? '#2B9B68' : 'transparent', fg: goalTab === 'active' ? '#fff' : '#6B7684' },
      goalTabD: { bg: goalTab === 'done' ? '#2B9B68' : 'transparent', fg: goalTab === 'done' ? '#fff' : '#6B7684' },
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
      setQ: ev => this.setState({ q: ev.target.value }), setFilter: ev => this.setState({ filter: ev.target.value }),
      openModal: () => this.openWith('out'), openIncome: () => this.openWith('in'),
      closeModal: () => this.setState({ modalOpen: false }),
      backdropClick: ev => { if (ev.target === ev.currentTarget) this.setState({ modalOpen: false }); },
      mOut: seg(!isInDraft), mIn: seg(isInDraft), setKindOut: setKind('out'), setKindIn: setKind('in'),
      addAmt1k: bumpAmt(1000), addAmt5k: bumpAmt(5000), addAmt10k: bumpAmt(10000), addAmt50k: bumpAmt(50000),
      mTitleLabel: isInDraft ? '어디서 받았나요? (메모)' : '어디에 사용했나요? (메모)', mTitlePh: isInDraft ? '예: 주말 아르바이트 (비워두면 분류명 저장)' : '예: 친구와 점심 식사 (비워두면 분류명 저장)',
      mSaveBg: isInDraft ? '#159d7b' : '#36795a',
      setTitle: setD('title'), setAmount: setD('amount'), setCategory: setD('category'), setDate: setD('date'),
      draftKey: ev => { if (ev.key === 'Enter') this.saveExpense(); },
      saveExpense: this.saveExpense, downloadCsv: this.downloadCsv,
      replaySplash: () => { clearTimeout(this._it); this.setState({ intro: 'splash' }); this._it = setTimeout(() => this.setState({ intro: '' }), 2200); },
      replayOnboarding: () => { clearTimeout(this._it); this.setState({ intro: 'ob', obStep: 0 }); },
      ...this.introVals(),
      _x: 0
    };
  }
}
