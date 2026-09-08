const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const context = vm.createContext({document:{querySelector:()=>null}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../bundle.js'),'utf8')
  .replace('ve = new ue();','ve = {ge,Y};').replace('window.app = ve;','globalThis.api = ve;'),context);
const {ge,Y} = context.api;
const audit = require('../data/range-audit-s11.json');
function equipped(w,barrelIndex,muzzleIndex,clone) {
  const manager = new Y();
  const config = {barrelIndex,muzzleIndex,fireControlIndex:0,hitRate:null};
  manager.weapons=clone?[]:[w];
  manager.clonedWeapons=clone?[{...w,isClone:true,attachmentConfig:config}]:[];
  return manager.applyAttachments(clone?[]:[config],{hitRate:1})[0];
}
function nearArray(actual,expected,label) {
  assert.equal(actual.length,expected.length,label);
  expected.forEach((v,i)=>assert.ok(Math.abs(actual[i]-v)<.001,`${label}: ${actual[i]} != ${v}`));
}
test('all 60 configurations and 124 barrels match the audited curves, retaining only pending exceptions',()=>{
  assert.equal(audit.records.length,184);
  for (const row of audit.records) {
    const w=ge.find(w=>w.name===row.weapon);
    assert.ok(w,row.weapon);
    const index=row.barrel?w.barrels.findIndex(b=>b.name===row.barrel)+1:0;
    if(row.barrel) assert.ok(index>0,row.barrel);
    const expected=row.status==='pending'?row.before:row.source;
    for(const clone of [false,true]) {
      const actual=equipped(w,index,0,clone);
      nearArray(Array.from(actual.ranges).filter(Number.isFinite),expected.ranges,`${row.weapon}/${row.barrel}`);
      nearArray(Array.from(actual.decays).slice(0,expected.decays.length),expected.decays,row.weapon);
    }
  }
});
test('barrel replacements and percentage bonuses stack muzzle range on the resolved bullet curve',()=>{
  const muzzles=new Y().muzzles;
  for(const row of audit.records.filter(r=>r.barrel&&r.status!=='pending')) {
    const w=ge.find(w=>w.name===row.weapon);
    const index=w.barrels.findIndex(b=>b.name===row.barrel)+1;
    for(const muzzleIndex of [1,2,3]) for(const clone of [false,true]) {
      const expected=row.sourceBaseCurve.ranges.map(r=>r*(row.sourceMultiplier+muzzles[muzzleIndex].mult));
      nearArray(Array.from(equipped(w,index,muzzleIndex,clone).ranges).filter(Number.isFinite),expected,`${w.name}/${row.barrel}/muzzle${muzzleIndex}`);
    }
  }
});
test('stable configurations do not increase range, including equipped and cloned configurations',()=>{
  for(const name of ['QCQ171','QJB201','腾龙']) {
    const base=ge.find(w=>w.name===name),stable=ge.find(w=>w.name===name+'稳固');
    for(let barrel=0;barrel<=stable.barrels.length;barrel++) for(const clone of [false,true]) {
      assert.deepEqual(Array.from(equipped(stable,barrel,0,clone).ranges),Array.from(equipped(base,barrel,0,clone).ranges));
    }
  }
});
