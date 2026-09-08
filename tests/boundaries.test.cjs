const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Expose the existing calculation code without starting the browser UI.
const source = fs.readFileSync(path.join(__dirname, '../bundle.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.replace('ve = new ue();',
  've = { R, N, he, ye, fe, j, ge, G, simulateDetailedKill, analyzeWeaponSimulationPatterns };')
  .replace('window.app = ve;', 'globalThis.api = ve;'), context);
const api = context.api;
const parts = ['head', 'chest', 'stomach', 'arms', 'legs', 'miss'];
const params = () => ({ healthValue: 100, armorValue: 0, helmetValue: 0,
  armorLevel: 1, helmetLevel: 1, bulletLevel: 3, distance: 0, hitRate: 1,
  hitProb: { head: 0, chest: 1, stomach: 0, arms: 0, legs: 0 } });
const matrix = () => Object.fromEntries(parts.map(p => [p,
  { head: 0, chest: 1, stomach: 0, arms: 0, legs: 0, miss: 0 }]));
const weapon = () => ({ name: 'test', flesh: 25, armor: 20, velocity: 500,
  rof: 600, ranges: [10, 20, 30, 40], decays: [1, 1, 1, 1, 1],
  mult: { head: 2, chest: 1, stomach: 1, limbs: 1 } });
function run(code) { return vm.runInContext(code, context, { timeout: 2000 }); }

test('reject invalid numeric parameters and per-weapon hit rates', () => {
  for (const field of ['healthValue', 'distance', 'armorValue', 'helmetValue', 'hitRate'])
    for (const value of [NaN, Infinity, -Infinity])
      assert.throws(() => api.ye({ ...params(), [field]: value }));
  for (const value of [0, -1]) {
    assert.throws(() => api.ye({ ...params(), healthValue: value }));
    assert.throws(() => api.ye({ ...params(), hitRate: value }));
  }
  for (const value of [0, -1, NaN, Infinity, 1.1])
    assert.throws(() => api.fe([{ hitRate: value }], [weapon()]));
  assert.equal(api.ye(params()), true);
  assert.equal(api.fe([{ hitRate: null }, { hitRate: 1 }], [weapon(), weapon()]), true);
});

test('validate all matrix entries before normalization; invalidate cached probabilities', () => {
  for (const value of [-1, NaN, Infinity, undefined]) {
    const p = { ...params(), markovModelEnable: true, markovMatrix: matrix() };
    p.markovMatrix.head.chest = 2;
    p.markovMatrix.miss.head = value;
    assert.throws(() => api.he(p));
    assert.equal(p.markovMatrix.head.chest, 2);
  }
  const p = { ...params(), markovModelEnable: true, markovMatrix: matrix(), preNormalizedMarkovMatrix: {} };
  p.markovMatrix.head.chest = 1e-8;
  assert.equal(api.he(p), true);
  assert.equal(p.markovMatrix.head.chest, 1);
  assert.equal(p.preNormalizedMarkovMatrix, undefined);
  p.markovMatrix.miss = { head: 0, chest: 0, stomach: 0, arms: 0, legs: 0, miss: 1 };
  assert.throws(() => api.he(p), /打空/);
  p.markovMatrix.miss.miss = 0;
  assert.throws(() => api.he(p));
  delete p.markovMatrix;
  assert.throws(() => api.he(p));
});

test('normal simulation remains deterministic and agrees with detailed damage', () => {
  context.p = params(); context.w = weapon();
  const result = run('api.j(); api.R.simulateOneTTK(w, p, api.N.getStrategy(3, w))');
  assert.equal(result.shots, 4);
  assert.ok(Math.abs(result.time - 0.3) < 1e-12);
  assert.equal(run('api.j(); api.simulateDetailedKill(w, p, 3)').shots, 4);
});

test('both simulation loops terminate for zero hit rate, absorbing misses and zero damage', () => {
  for (const mode of ['zero-hit', 'absorbing', 'zero-damage']) {
    context.p = params(); context.w = weapon();
    if (mode === 'zero-hit') context.p.hitRate = 0;
    if (mode === 'zero-damage') context.w.flesh = 0;
    if (mode === 'absorbing') {
      context.p.markovModelEnable = true;
      context.p.markovMatrix = matrix();
      for (const row of Object.values(context.p.markovMatrix)) { row.chest = 0; row.miss = 1; }
    }
    for (const code of ['api.R.simulateOneTTK(w, p, api.N.getStrategy(3, w))', 'api.simulateDetailedKill(w, p, 3)'])
      assert.throws(() => run('api.j(); ' + code), /10000/);
  }
});

test('invalid damage fails instead of producing a successful result', () => {
  context.p = params(); context.w = weapon(); context.w.flesh = NaN;
  assert.throws(() => run('api.R.simulateOneTTK(w, p, api.N.getStrategy(3, w))'), /伤害/);
  assert.throws(() => run('api.simulateDetailedKill(w, p, 3)'), /伤害/);
});

test('batch limits stop excessive work without returning partial averages', () => {
  context.p = params(); context.w = weapon();
  const limit = api.G.MAX_SHOTS_PER_BATCH;
  try {
    api.G.MAX_SHOTS_PER_BATCH = 7;
    assert.throws(() => run('api.R.calculateAvgStats(w, p, 2, api.N.getStrategy(3, w))'), /安全上限/);
    assert.throws(() => run('api.analyzeWeaponSimulationPatterns(w, p, 3, 2)'), /安全上限/);
  } finally { api.G.MAX_SHOTS_PER_BATCH = limit; }
});
