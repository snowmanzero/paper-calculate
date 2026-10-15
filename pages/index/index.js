const DADA_W = 889, DADA_H = 1194;
const ZHENG_W = 787, ZHENG_H = 1092;
const DADA_COEF = 1884;
const STORAGE_GSM_KEY = 'paper_gsm_list_v1';
const STORAGE_SPEC_KEY = 'paper_spec_selected_v1';
const DEFAULT_GSM = [80, 190, 210, 230, 250, 300, 350, 400, 120, 150, 180];
const QUICK_QTY = [20, 30, 50, 70];

// 全部规格定义（默认选中 A3/A4/A5 + 4K/8K）
const ALL_GROUPS = [
  {
    gi: 'A', label: 'A 系列 · 大度', paper: 'dada',
    specs: [
      { name: 'A2', w: 420, h: 594, selected: false },
      { name: 'A3', w: 297, h: 420, selected: true },
      { name: 'A4', w: 210, h: 297, selected: true },
      { name: 'A5', w: 148, h: 210, selected: true },
      { name: 'A6', w: 105, h: 148, selected: false },
      { name: 'A7', w: 74,  h: 105, selected: false },
      { name: 'A8', w: 52,  h: 74,  selected: false }
    ]
  },
  {
    gi: 'B', label: 'B 系列 · 正度', paper: 'zheng',
    specs: [
      { name: 'B2', w: 500, h: 707, selected: false },
      { name: 'B3', w: 353, h: 500, selected: false },
      { name: 'B4', w: 250, h: 353, selected: false },
      { name: 'B5', w: 176, h: 250, selected: false },
      { name: 'B6', w: 125, h: 176, selected: false },
      { name: 'B7', w: 88,  h: 125, selected: false },
      { name: 'B8', w: 62,  h: 88,  selected: false }
    ]
  },
  {
    gi: 'K', label: 'K 系列 · 正度', paper: 'zheng',
    specs: [
      { name: '2K',  w: 546, h: 787, selected: false },
      { name: '4K',  w: 393, h: 546, selected: true },
      { name: '8K',  w: 273, h: 393, selected: true },
      { name: '16K', w: 185, h: 260, selected: false },
      { name: '32K', w: 130, h: 184, selected: false },
      { name: '64K', w: 92,  h: 126, selected: false }
    ]
  }
];

function fitCount(sw, sh, iw, ih) {
  const a = Math.floor(sw / iw) * Math.floor(sh / ih);
  const b = Math.floor(sw / ih) * Math.floor(sh / iw);
  return Math.max(a, b);
}
function fmt(n, minDec, maxDec) {
  if (!isFinite(n)) return '—';
  let s = n.toFixed(maxDec).replace(/0+$/, '').replace(/\.$/, '');
  const dec = s.indexOf('.') > -1 ? s.split('.')[1].length : 0;
  if (dec < minDec) s = n.toFixed(minDec);
  return s;
}

Page({
  data: {
    gsm: '', price: '', reamPrice: '', cw: '', ch: '',
    gsmList: [],
    addingGsm: false,
    newGsmValue: '',

    resultDada:  { ream: '—', sheet: '—' },
    resultZheng: { ream: '—', sheet: '—' },
    resultCustom:{ ream: '—', sheet: '—', dim: '—' },
    showResultCustom: false,

    cutGroups: [],
    hasAnyResult: false,

    manualCards: [],
    manualSelectedQtyList: [],
    manualShowQtyInput: false,
    manualQtyInput: '',
    manualQuickQtyBtns: [],
    manualCustomQtyBtns: [],

    showAddDialog: false,
    dialogW: '', dialogH: '', dialogFold: '', dialogPaper: '',

    manualCardSeq: 2000
  },

  onLoad() {
    // 恢复克重
    let gsmList = DEFAULT_GSM.slice();
    try {
      const stored = wx.getStorageSync(STORAGE_GSM_KEY);
      if (Array.isArray(stored) && stored.length) {
        const clean = stored.map(Number).filter(n => isFinite(n) && n > 0);
        if (clean.length) gsmList = clean;
      }
    } catch (e) {}

    // 恢复规格选中状态
    let selectedMap = {};
    try {
      const stored = wx.getStorageSync(STORAGE_SPEC_KEY);
      if (stored && typeof stored === 'object') selectedMap = stored;
    } catch (e) {}

    const cutGroups = ALL_GROUPS.map(g => ({
      gi: g.gi,
      label: g.label,
      paper: g.paper,
      specs: g.specs.map(s => {
        const key = g.gi + ':' + s.name;
        const sel = (key in selectedMap) ? !!selectedMap[key] : !!s.selected;
        return { name: s.name, w: s.w, h: s.h, selected: sel, key: key };
      }),
      selectedQtyList: [],
      showQtyInput: false,
      qtyInput: '',
      quickQtyBtns: [],
      customQtyBtns: [],
      items: []
    }));

    this.setData({ gsmList, cutGroups });
    this.recompute();
  },

  /* ============ 输入事件 ============ */
  onGsmInput(e) { this.setData({ gsm: e.detail.value }, () => this.recompute()); },
  onPriceInput(e) { this.setData({ price: e.detail.value, reamPrice: '' }, () => this.recompute()); },
  onReamInput(e) { this.setData({ reamPrice: e.detail.value, price: '' }, () => this.recompute()); },
  onCwInput(e) { this.setData({ cw: e.detail.value }, () => this.recompute()); },
  onChInput(e) { this.setData({ ch: e.detail.value }, () => this.recompute()); },

  /* ============ 克重 ============ */
  onChipTap(e) {
    const g = e.currentTarget.dataset.g;
    this.setData({ gsm: String(g) }, () => this.recompute());
  },
  onChipLongPress(e) {
    const g = e.currentTarget.dataset.g;
    wx.showModal({
      title: '删除克重',
      content: '确定删除 ' + g + 'g 吗？',
      success: (res) => {
        if (!res.confirm) return;
        const gsmList = this.data.gsmList.filter(x => x !== g);
        this.setData({ gsmList });
        try { wx.setStorageSync(STORAGE_GSM_KEY, gsmList); } catch (err) {}
        this.recompute();
      }
    });
  },
  onAddGsmTap() { this.setData({ addingGsm: true, newGsmValue: '' }); },
  onNewGsmInput(e) { this.setData({ newGsmValue: e.detail.value }); },
  onNewGsmBlur() { this.commitNewGsm(); },
  onNewGsmConfirm() { this.commitNewGsm(); },
  commitNewGsm() {
    if (!this.data.addingGsm) return;
    const val = parseFloat(this.data.newGsmValue);
    let gsmList = this.data.gsmList.slice();
    let newGsm = this.data.gsm;
    if (isFinite(val) && val > 0 && val <= 2000) {
      const g = Math.round(val * 100) / 100;
      if (gsmList.indexOf(g) === -1) {
        gsmList.push(g);
        try { wx.setStorageSync(STORAGE_GSM_KEY, gsmList); } catch (e) {}
      }
      newGsm = String(g);
    }
    this.setData({ gsmList, gsm: newGsm, addingGsm: false, newGsmValue: '' }, () => this.recompute());
  },

  /* ============ 规格选中切换 ============ */
  onSpecToggle(e) {
    const gi = e.currentTarget.dataset.gi;
    const name = e.currentTarget.dataset.name;
    const cutGroups = this.data.cutGroups.map(g => {
      if (g.gi !== gi) return g;
      return Object.assign({}, g, {
        specs: g.specs.map(s =>
          s.name === name ? Object.assign({}, s, { selected: !s.selected }) : s
        )
      });
    });
    this.setData({ cutGroups }, () => {
      this.saveSelectedMap(cutGroups);
      this.recompute();
    });
  },

  saveSelectedMap(cutGroups) {
    const map = {};
    cutGroups.forEach(g => {
      g.specs.forEach(s => { map[s.key] = !!s.selected; });
    });
    try { wx.setStorageSync(STORAGE_SPEC_KEY, map); } catch (e) {}
  },

  /* ============ 组张数 ============ */
  onQtyBtnTap(e) {
    const gi = e.currentTarget.dataset.gi;
    const qty = Number(e.currentTarget.dataset.qty);
    const groups = this.data.cutGroups.slice();
    const g = groups.find(x => x.gi === gi);
    if (!g) return;
    const list = g.selectedQtyList.slice();
    const idx = list.indexOf(qty);
    if (idx > -1) list.splice(idx, 1);
    else { list.push(qty); list.sort((a, b) => a - b); }
    g.selectedQtyList = list;
    this.setData({ cutGroups: groups }, () => this.recompute());
  },
  onQtyAddTap(e) {
    const gi = e.currentTarget.dataset.gi;
    const groups = this.data.cutGroups.slice();
    const g = groups.find(x => x.gi === gi);
    if (!g) return;
    g.showQtyInput = true;
    g.qtyInput = '';
    this.setData({ cutGroups: groups });
  },
  onQtyInput(e) {
    const gi = e.currentTarget.dataset.gi;
    const groups = this.data.cutGroups.slice();
    const g = groups.find(x => x.gi === gi);
    if (!g) return;
    g.qtyInput = e.detail.value;
    this.setData({ cutGroups: groups });
  },
  onQtyInputBlur(e) { this.commitQtyInput(e.currentTarget.dataset.gi); },
  onQtyInputConfirm(e) { this.commitQtyInput(e.currentTarget.dataset.gi); },
  commitQtyInput(gi) {
    const groups = this.data.cutGroups.slice();
    const g = groups.find(x => x.gi === gi);
    if (!g || !g.showQtyInput) return;
    const val = parseFloat(g.qtyInput);
    if (isFinite(val) && val > 0) {
      const q = Math.round(val);
      if (g.selectedQtyList.indexOf(q) === -1) {
        g.selectedQtyList = g.selectedQtyList.slice().concat(q).sort((a, b) => a - b);
      }
    }
    g.showQtyInput = false;
    g.qtyInput = '';
    this.setData({ cutGroups: groups }, () => this.recompute());
  },

  /* ============ 手动卡片张数 ============ */
  onManualQtyBtnTap(e) {
    const qty = Number(e.currentTarget.dataset.qty);
    const list = this.data.manualSelectedQtyList.slice();
    const idx = list.indexOf(qty);
    if (idx > -1) list.splice(idx, 1);
    else { list.push(qty); list.sort((a, b) => a - b); }
    this.setData({ manualSelectedQtyList: list }, () => this.recompute());
  },
  onManualQtyAddTap() {
    this.setData({ manualShowQtyInput: true, manualQtyInput: '' });
  },
  onManualQtyInput(e) { this.setData({ manualQtyInput: e.detail.value }); },
  onManualQtyInputBlur() { this.commitManualQty(); },
  onManualQtyInputConfirm() { this.commitManualQty(); },
  commitManualQty() {
    if (!this.data.manualShowQtyInput) return;
    const val = parseFloat(this.data.manualQtyInput);
    let list = this.data.manualSelectedQtyList.slice();
    if (isFinite(val) && val > 0) {
      const q = Math.round(val);
      if (list.indexOf(q) === -1) list = list.concat(q).sort((a, b) => a - b);
    }
    this.setData({
      manualSelectedQtyList: list,
      manualShowQtyInput: false,
      manualQtyInput: ''
    }, () => this.recompute());
  },

  /* ============ 弹窗 ============ */
  onOpenAddDialog() {
    this.setData({
      showAddDialog: true,
      dialogW: '', dialogH: '', dialogFold: '', dialogPaper: ''
    });
  },
  onCloseAddDialog() { this.setData({ showAddDialog: false }); },
  onDialogStop() {},

  onDialogWInput(e) { this.setData({ dialogW: e.detail.value }); },
  onDialogHInput(e) { this.setData({ dialogH: e.detail.value }); },
  onDialogFoldInput(e) { this.setData({ dialogFold: e.detail.value }); },
  onDialogPaperTap(e) { this.setData({ dialogPaper: e.currentTarget.dataset.paper }); },

  onDialogAddManual() {
    const cw = parseFloat(this.data.dialogW);
    const ch = parseFloat(this.data.dialogH);
    const foldIn = parseFloat(this.data.dialogFold);
    const paper = this.data.dialogPaper;

    if (!isFinite(cw) || cw <= 0 || !isFinite(ch) || ch <= 0) {
      wx.showToast({ title: '请输入长宽', icon: 'none' });
      return;
    }
    if (paper !== 'dada' && paper !== 'zheng') {
      wx.showToast({ title: '请选择大度或正度', icon: 'none' });
      return;
    }

    const sw = paper === 'dada' ? DADA_W : ZHENG_W;
    const sh = paper === 'dada' ? DADA_H : ZHENG_H;
    const manualFold = isFinite(foldIn) && foldIn > 0;
    const count = manualFold ? Math.round(foldIn) : fitCount(sw, sh, cw, ch);
    const id = this.data.manualCardSeq;

    const newCard = {
      id: id,
      name: cw + ' × ' + ch,
      w: cw, h: ch,
      paper: paper,
      count: count,
      fold: '1/' + count,
      manualFold: manualFold
    };

    this.setData({
      manualCards: this.data.manualCards.concat(newCard),
      manualCardSeq: id + 1,
      dialogW: '', dialogH: '', dialogFold: ''
    }, () => this.recompute());
  },

  onRemoveManualCard(e) {
    const id = Number(e.currentTarget.dataset.id);
    this.setData({
      manualCards: this.data.manualCards.filter(c => c.id !== id)
    }, () => this.recompute());
  },

  /* ============ 核心计算 ============ */
  recompute() {
    const d = this.data;
    const priceIn = parseFloat(d.price);
    const reamIn = parseFloat(d.reamPrice);
    const gsm = parseFloat(d.gsm);

    const hasGsm = isFinite(gsm) && gsm > 0;
    const hasPrice = isFinite(priceIn) && priceIn > 0;
    const hasReam = isFinite(reamIn) && reamIn > 0;

    let price = null;
    if (hasPrice) price = priceIn;
    else if (hasReam && hasGsm) price = reamIn * DADA_COEF / gsm;

    const ok = price !== null && hasGsm;

    function calcResult(coef) {
      if (!ok || !coef) return { ream: '—', sheet: '—' };
      const rp = price * gsm / coef;
      return { ream: fmt(rp, 2, 2), sheet: fmt(rp / 500, 4, 4) };
    }

    const resultDada = calcResult(1884);
    const resultZheng = calcResult(2327);

    const cw = parseFloat(d.cw);
    const ch = parseFloat(d.ch);
    const showResultCustom = isFinite(cw) && cw > 0 && isFinite(ch) && ch > 0;
    let resultCustom = { ream: '—', sheet: '—', dim: '—' };
    if (showResultCustom) {
      const coef = 2000000000 / (cw * ch);
      const r = calcResult(coef);
      resultCustom = { ream: r.ream, sheet: r.sheet, dim: cw + ' × ' + ch };
    }

    let dadaUnit = null, zhengUnit = null;
    if (ok) {
      dadaUnit = (price * gsm / 1884) / 500;
      zhengUnit = (price * gsm / 2327) / 500;
    }

    // A/B/K 系列
    let totalItems = 0;
    const cutGroups = d.cutGroups.map(g => {
      const base = g.paper === 'dada' ? dadaUnit : zhengUnit;
      const qtyList = g.selectedQtyList;
      const sw = g.paper === 'dada' ? DADA_W : ZHENG_W;
      const sh = g.paper === 'dada' ? DADA_H : ZHENG_H;

      // 只渲染被选中的规格
      const items = g.specs.filter(s => s.selected).map(s => {
        const count = fitCount(sw, sh, s.w, s.h);
        const out = {
          _id: g.gi + ':' + s.name,
          name: s.name,
          w: s.w, h: s.h,
          count: count,
          fold: '1/' + count,
          dim: s.w + ' × ' + s.h + ' mm',
          unit: '—', ten: '—', qtyRows: []
        };
        if (ok) {
          const unit = base / count;
          const wps = (s.w / 1000) * (s.h / 1000) * gsm;
          out.unit = fmt(unit, 4, 4) + ' 元/' + fmt(wps, 2, 2) + ' g';
          out.ten = fmt(unit * 10, 4, 4) + ' 元/' + fmt(wps * 10, 2, 2) + ' g';
          out.qtyRows = qtyList.map(q => ({
            qty: q,
            cost: fmt(unit * q, 4, 4) + ' 元/' + fmt(wps * q, 2, 2) + ' g'
          }));
        }
        return out;
      });
      totalItems += items.length;

      const quickQtyBtns = QUICK_QTY.map(q => ({
        qty: q, on: qtyList.indexOf(q) > -1
      }));
      const customQtyBtns = qtyList
        .filter(q => QUICK_QTY.indexOf(q) === -1)
        .map(q => ({ qty: q }));

      return Object.assign({}, g, { items, quickQtyBtns, customQtyBtns });
    });

    // 手动卡片
    const manualQtyList = d.manualSelectedQtyList;
    const manualCards = d.manualCards.map(cc => {
      const base = cc.paper === 'dada' ? dadaUnit : zhengUnit;
      const out = Object.assign({}, cc);
      out.paperName = cc.paper === 'dada' ? '大度' : '正度';
      if (!ok) { out.unit = '—'; out.ten = '—'; out.qtyRows = []; return out; }
      const unit = base / cc.count;
      const wps = (cc.w / 1000) * (cc.h / 1000) * gsm;
      out.unit = fmt(unit, 4, 4) + ' 元/' + fmt(wps, 2, 2) + ' g';
      out.ten = fmt(unit * 10, 4, 4) + ' 元/' + fmt(wps * 10, 2, 2) + ' g';
      out.qtyRows = manualQtyList.map(q => ({
        qty: q,
        cost: fmt(unit * q, 4, 4) + ' 元/' + fmt(wps * q, 2, 2) + ' g'
      }));
      return out;
    });
    totalItems += manualCards.length;

    const manualQuickQtyBtns = QUICK_QTY.map(q => ({
      qty: q, on: manualQtyList.indexOf(q) > -1
    }));
    const manualCustomQtyBtns = manualQtyList
      .filter(q => QUICK_QTY.indexOf(q) === -1)
      .map(q => ({ qty: q }));

    this.setData({
      resultDada, resultZheng, resultCustom, showResultCustom,
      cutGroups,
      hasAnyResult: totalItems > 0,
      manualCards,
      manualQuickQtyBtns, manualCustomQtyBtns
    });
  }
});