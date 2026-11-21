/* ピボット系スライドで共有するダミーの売上データと集計。DOM に依存しない（tests/pivot.test.mjs から使う） */
(function () {
  'use strict';
  const REGIONS = [
    ['北海道', ['札幌店', '旭川店', '函館店']], ['東北', ['仙台店', '盛岡店', '秋田店']], ['関東', ['新宿店', '横浜店', '大宮店']],
    ['中部', ['名古屋店', '静岡店', '金沢店']], ['関西', ['梅田店', '神戸店', '京都店']], ['九州', ['博多店', '熊本店', '鹿児島店']],
  ];
  const PRODUCTS = [['ノート PC', 120000], ['タブレット', 60000], ['モニター', 35000], ['周辺機器', 8000], ['保守サービス', 20000]];
  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

  /* 次元: 値の並び順と表示名 */
  const DIMS = {
    region: { label: '地域', values: REGIONS.map((r) => r[0]) },
    store: { label: '店舗', values: REGIONS.flatMap((r) => r[1]) },
    product: { label: '商品', values: PRODUCTS.map((p) => p[0]) },
    month: { label: '月', values: MONTHS, fmt: (m) => m + '月' },
  };

  /* 店舗 × 商品 × 月 = 1,080 行 */
  function makeRows() {
    const r = Lib.rng(2026), rows = [];
    for (const [region, stores] of REGIONS) {
      const rBias = region === '関東' ? 1.8 : region === '関西' ? 1.35 : region === '北海道' ? 0.7 : 1;
      for (const store of stores) {
        const sBias = 0.6 + r() * 0.9;
        PRODUCTS.forEach(([product, price], pi) => {
          const pBias = [1, 0.8, 1.1, 1.6, 0.9][pi];
          for (const month of MONTHS) {
            const season = 1 + 0.25 * Math.sin((month - 2) / 12 * Math.PI * 2) + (month === 3 || month === 12 ? 0.3 : 0);
            const qty = Math.max(1, Math.round(40 * rBias * sBias * pBias * season * (0.75 + r() * 0.5) * (30000 / price) ** 0.5));
            rows.push({ region, store, product, month, qty, sales: qty * price });
          }
        });
      }
    }
    return rows;
  }
  const rows = makeRows();

  /* rowKey × colKey で measure を集計する。fn: sum / avg / count / share（総計に対する %） */
  function aggregate(src, rowKey, colKey, measure, fn) {
    const rk = DIMS[rowKey].values.filter((v) => src.some((x) => x[rowKey] === v));
    const ck = colKey ? DIMS[colKey].values.filter((v) => src.some((x) => x[colKey] === v)) : ['合計'];
    const acc = new Map(), add = (a, b, v) => {
      const k = a + '\u0000' + b, o = acc.get(k) || { s: 0, n: 0 };
      o.s += v; o.n++; acc.set(k, o);
    };
    let grand = 0;
    for (const x of src) {
      add(x[rowKey], colKey ? x[colKey] : '合計', x[measure]);
      grand += x[measure];
    }
    const val = (o) => (!o ? 0 : fn === 'avg' ? o.s / o.n : fn === 'count' ? o.n : fn === 'share' ? (grand ? o.s / grand * 100 : 0) : o.s);
    const cells = rk.map((a) => ck.map((b) => val(acc.get(a + '\u0000' + b))));
    /* 行・列の合計。平均は「合計÷件数」で出し直す（セルの平均を平均しない） */
    const sumBy = (pick) => {
      const o = { s: 0, n: 0 };
      for (const x of src) if (pick(x)) { o.s += x[measure]; o.n++; }
      return val(o);
    };
    const rowTotals = rk.map((a) => sumBy((x) => x[rowKey] === a));
    const colTotals = ck.map((b) => sumBy((x) => !colKey || x[colKey] === b));
    const total = sumBy(() => true);
    return { rowKey, colKey, rowKeys: rk, colKeys: ck, cells, rowTotals, colTotals, total };
  }

  /* 店舗ごとの前年比（%、ダミー）。表と散布図で同じ値を使う */
  const YOY = (() => {
    const r = Lib.rng(8), out = {};
    for (const s of DIMS.store.values) out[s] = Math.round((r() * 40 - 12) * 10) / 10;
    return out;
  })();

  const label = (dim, v) => (DIMS[dim].fmt ? DIMS[dim].fmt(v) : String(v));
  const filter = (src, cond) => src.filter((x) => Object.keys(cond).every((k) => x[k] === cond[k]));

  window.SalesData = { rows, DIMS, aggregate, filter, label, REGIONS, PRODUCTS, YOY };
})();
