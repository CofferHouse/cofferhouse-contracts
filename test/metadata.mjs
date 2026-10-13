import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'coffer-metadata-')),src=path.join(tmp,'src');fs.mkdirSync(src);
for(let id=1;id<=4444;id++)fs.writeFileSync(path.join(src,id+'.json'),JSON.stringify({name:'Original '+id,image:'ipfs://original/'+id+'.png',attributes:[{trait_type:'Original',value:id}]}));
try{
 const seed='ab'.repeat(32);for(const name of ['a','b'])execFileSync(process.execPath,[root+'/scripts/metadata.mjs',src,path.join(tmp,name),seed]);
 const raw=fs.readFileSync(path.join(tmp,'a/PRIVATE-mapping.json'),'utf8'),map=JSON.parse(raw);
 assert.equal(raw,fs.readFileSync(path.join(tmp,'b/PRIVATE-mapping.json'),'utf8'));assert.equal(new Set(map.map(x=>x.artworkId)).size,4444);
 assert.equal(map.filter(x=>x.reserved).length,100);assert.equal(map.slice(0,100).filter(x=>x.artworkId>=4421).length,13);assert.equal(map.slice(100).filter(x=>x.artworkId>=4421).length,11);
 const commitment=JSON.parse(fs.readFileSync(path.join(tmp,'a/PUBLIC-commitment.json')));assert.equal(commitment.sha256,createHash('sha256').update(raw).digest('hex'));
 for(const x of map)assert.equal(fs.readFileSync(path.join(tmp,'a/reveal',String(x.tokenId)),'utf8'),fs.readFileSync(path.join(src,x.artworkId+'.json'),'utf8'));
 assert.throws(()=>execFileSync(process.execPath,[root+'/scripts/metadata.mjs',src,path.join(tmp,'a'),seed],{stdio:'pipe'}));
 console.log('PASS metadata: 4444 unique artworks, exact traits preserved, reproducible shuffle, 100/4344 allocations, 13/11 specials, commitment, overwrite guard.');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
