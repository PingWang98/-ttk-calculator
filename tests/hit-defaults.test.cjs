const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context=vm.createContext({document:{querySelector:()=>null}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../bundle.js'),'utf8').replace('ve = new ue();','ve = {te};').replace('window.app = ve;','globalThis.api = ve;'),context);
const config=new context.api.te().getDefaultConfig();
test('Markov preset preserves the independent body distribution without introducing misses at default accuracy',()=>{
  assert.equal(config.hitRate,1);
  const parts=Object.keys(config.hitProb);
  for(const row of Object.values(config.markovMatrix)) {
    assert.ok(Math.abs(Object.values(row).reduce((s,v)=>s+v,0)-1)<1e-12);
    assert.equal(row.miss,0);
  }
  for(const col of parts) {
    const next=parts.reduce((sum,row)=>sum+config.hitProb[row]*config.markovMatrix[row][col],0);
    assert.ok(Math.abs(next-config.hitProb[col])<1e-12,col);
    assert.ok(config.markovMatrix[col][col]>=config.hitProb[col]);
    assert.ok(config.markovMatrix[col].chest<=.35);
  }
});
test('HTML and engine use identical initial probabilities and matrix values',()=>{
  for(const file of ['index.html','index_optimized.html']) {
    const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
    const value=id=>Number(html.match(new RegExp('id="'+id+'" value="([^"]+)"'))[1]);
    assert.equal(value('hitRate'),1);
    for(const [p,v] of Object.entries(config.hitProb)) assert.equal(value('p'+p[0].toUpperCase()+p.slice(1)),v);
    for(const [r,row] of Object.entries(config.markovMatrix)) for(const [c,v] of Object.entries(row)) assert.equal(value('m_'+r+'_'+c),v);
    for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) if(match[1].trim()) new vm.Script(match[1]);
  }
});
