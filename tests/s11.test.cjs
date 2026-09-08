const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const context = vm.createContext({document:{querySelector:()=>null}});
const source = fs.readFileSync(path.join(__dirname,'../bundle.js'),'utf8');
vm.runInContext(source.replace('ve = new ue();','ve = {ge,ie,R,N,Y,q,j,simulateDetailedKill};')
  .replace('window.app = ve;','globalThis.api = ve;'),context);
const {ge,ie,R,N,Y,q,j,simulateDetailedKill}=context.api;
const get = name => ge.find(w=>w.name===name);
const params = () => ({healthValue:100,armorValue:0,helmetValue:0,armorLevel:4,helmetLevel:4,
  bulletLevel:4,distance:0,hitRate:1,hitProb:{head:0,chest:1,stomach:0,arms:0,legs:0}});
function equip(name, changes={}, clone=false) {
  const manager = new Y();
  const config = {barrelIndex:0,muzzleIndex:0,fireControlIndex:0,hitRate:null,...changes};
  if (clone) {
    manager.weapons=[];
    manager.clonedWeapons=[{...get(name),isClone:true,attachmentConfig:config}];
    return manager.applyAttachments([],params())[0];
  }
  manager.weapons=[get(name)];
  return manager.applyAttachments([config],params())[0];
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('S11 new weapon baseline and ranged damage are available',()=>{
  const mdr=get('MDR'),tommy=get('汤姆逊');
  assert.equal(mdr.flesh,41);assert.equal(mdr.armor,43);near(60/mdr.rof,.0923);
  assert.deepEqual(Array.from(mdr.ranges.slice(0,2)),[35,50]);
  assert.equal(tommy.flesh,34);assert.equal(tommy.armor,36);near(60/tommy.rof,.06666);
  near(tommy.mult.stomach,1);near(tommy.mult.limbs,.35);
  near(equip('MDR',{barrelIndex:2}).velocity,819);
  near(equip('汤姆逊',{barrelIndex:1}).ranges[0],23.4);
});
test('K437 S11 barrel uses +50% range/velocity and 35 armor damage',()=>{
  const index=get('K437').barrels.findIndex(b=>b.name==='长矛手长枪管组合')+1;
  for(const clone of [false,true]) {
    const w=equip('K437',{barrelIndex:index},clone);
    near(w.ranges[0],52.5);near(w.velocity,862.5);assert.equal(w.armor,35);
  }
});
test('receiver kits apply to normal and cloned weapons without mutating base data',()=>{
  for (const clone of [false,true]) {
    const t=equip('汤姆逊',{fireControlIndex:1,barrelIndex:1},clone);
    assert.equal(t.flesh,37);assert.equal(t.armor,37);near(t.ranges[0],23.4);
    const semi=equip('M700',{fireControlIndex:1},clone);
    near(60/semi.rof,.45);
    const auto=equip('M700',{fireControlIndex:2},clone);
    near(60/auto.rof,.14285);near(auto.mult.stomach,.5);near(auto.mult.limbs,.25);
    assert.equal(auto.fireMode,'auto');
    const r=equip('93R',{fireControlIndex:1},clone);
    assert.equal(r.fireMode,'auto');assert.equal(r.burstCount,undefined);
    near(r.ranges[0],31.9);near(60/r.rof,.16*.559);
  }
  assert.equal(get('汤姆逊').flesh,34);near(get('M700').mult.stomach,.9);
});
test('93R burst timing includes the 220 ms inter-burst gap',()=>{
  const w=equip('93R');const p={...params(),healthValue:110};
  j();const r=R.simulateOneTTK(w,p,N.getStrategy(4,w));
  assert.equal(r.shots,4);near(r.time,.067*2+.22);
});
test('M700 GRateOfFire modifies shot interval, not RPM, including receiver kits',()=>{
  // DFTTK FireControl: 60 / (FireInterval * GRateOfFire).
  for (const clone of [false,true]) {
    for (const [fc,baseInterval] of [[0,1.25],[1,.45],[2,.45-.30715]]) {
      near(60/equip('M700',{fireControlIndex:fc,barrelIndex:1},clone).rof,baseInterval*.85);
      near(60/equip('M700',{fireControlIndex:fc,barrelIndex:2},clone).rof,baseInterval*1.15);
    }
  }
});
test('93R receiver replaces barrel and muzzle even in saved or cloned configurations',()=>{
  for (const clone of [false,true]) {
    const kit=equip('93R',{fireControlIndex:1,barrelIndex:4,muzzleIndex:1},clone);
    near(kit.ranges[0],22*1.45);near(kit.velocity,400*1.45);
    assert.equal(kit.activeBarrelName,null);
  }
  const manager=new Y();
  const info=manager.calculateCloneDisplayData({...get('93R'),attachmentConfig:{fireControlIndex:1,barrelIndex:4,muzzleIndex:1}});
  assert.equal(info.ranges[0],32);assert.equal(info.velocity,580);
});
test('ST ammo scales actual weapon part multipliers and preserves penetration tier',()=>{
  const w=get('MP7');
  for(const key of ['4.6×30mm FMJ ST','4.6×30mm AP ST']){
    assert.ok(w.allowedBullets.includes(key));
    near(q.calculate(w,ie[key],'chest',1),w.flesh*w.mult.chest*1.25);
    near(q.calculate(w,ie[key],'stomach',1),w.flesh*w.mult.stomach*.9);
    near(q.calculate(w,ie[key],'legs',1),w.flesh*w.mult.limbs*.9);
  }
  assert.equal(ie['4.6×30mm FMJ ST'].armor[5].pen,0);
  assert.equal(ie['4.6×30mm AP ST'].armor[5].pen,.5);
  assert.equal(ie['ACP SUPER'].armor[6].armorMult,1.1);
});
test('CT preserves requested hit parts and reduces rate exactly once',()=>{
  const key='4.6×30mm CT';const p={...params(),bulletLevel:key};
  const base=get('MP7');const armed=equip('MP7',{bulletType:key});
  near(armed.rof,base.rof*.85);
  near(q.calculate(base,ie[key],'legs',1),base.flesh*base.mult.limbs*1.85);
  j();const raw=R.simulateOneTTK(base,p,N.getStrategy(key,base),true);
  j();const applied=R.simulateOneTTK(armed,p,N.getStrategy(key,armed),true);
  near(raw.time,applied.time);near(raw.time,(raw.shots-1)*60/(base.rof*.85));
  assert.ok(raw.hitParts.every(p=>p==='chest'));
  j();assert.ok(simulateDetailedKill(armed,p,key).steps.every(s=>s.hitPart==='chest'));
  near(equip('MP7',{bulletType:key},true).rof,armed.rof);
});
test('all new configurations yield finite rankings across armor levels and distances',()=>{
  for(const name of ['MDR','汤姆逊','M700','93R'])
    for(let fc=0;fc<=(get(name).fireControls?.length||0);fc++)
      for(const distance of [0,35,100])
        for(const level of [1,4,6]) {
          const w=equip(name,{fireControlIndex:fc,barrelIndex:1});
          const p={...params(),distance,armorLevel:level,helmetLevel:level,armorValue:100,helmetValue:50};
          j();const result=R.calculateAvgStats(w,p,100,N.getStrategy(4,w));
          assert.ok(Number.isFinite(result.avgTime)&&result.avgTime>=0);
        }
});
