import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,createHash,createHmac} from 'node:crypto';
// Usage: node scripts/metadata.mjs <source-json-dir> <NEW-private-output-dir> [seed hex]
const [source,output,seedArg]=process.argv.slice(2);
if(!source||!output)throw Error('Provide source metadata directory and NEW private output directory');
if(fs.existsSync(output))throw Error('Refusing to overwrite an existing reveal');
const seed=seedArg||randomBytes(32).toString('hex');if(!/^[a-fA-F0-9]{64}$/.test(seed))throw Error('Seed must be 32 bytes hex');
const specials=[4422,4423,4424,4425,4426,4427,4428,4432,4440,4441,4442,4443,4444];
const team=[...Array.from({length:87},(_,i)=>i+1),...specials];
const publicIds=Array.from({length:4444},(_,i)=>i+1).filter(x=>!team.includes(x));
// HMAC stream + rejection sampling avoids modulo bias. Reproducible with disclosed seed.
let counter=0;
function below(n){const limit=Math.floor(4294967296/n)*n;for(;;){const x=createHmac('sha256',Buffer.from(seed,'hex')).update(String(counter++)).digest().readUInt32BE();if(x<limit)return x%n;}}
for(let i=publicIds.length-1;i>0;i--){const j=below(i+1);[publicIds[i],publicIds[j]]=[publicIds[j],publicIds[i]];}
const order=[...team,...publicIds], docs=order.map(id=>{
 const d=JSON.parse(fs.readFileSync(path.join(source,id+'.json'),'utf8'));
 if(typeof d.image!=='string'||!d.image.length)throw Error('Missing image for artwork '+id);
 return d; // Art, traits and original names preserved. Token IDs mapped independently.
});
fs.mkdirSync(output,{recursive:true});fs.mkdirSync(path.join(output,'reveal'));
const manifest=order.map((artworkId,i)=>({tokenId:i+1,artworkId,reserved:i<100}));
const raw=JSON.stringify(manifest),commitment=createHash('sha256').update(raw).digest('hex');
fs.writeFileSync(path.join(output,'PRIVATE-seed.txt'),seed+'\n');
fs.writeFileSync(path.join(output,'PRIVATE-mapping.json'),raw);
fs.writeFileSync(path.join(output,'PUBLIC-commitment.json'),JSON.stringify({algorithm:'HMAC-SHA256 Fisher-Yates rejection sampling',sha256:commitment,total:4444,team:100,public:4344},null,2));
for(let i=0;i<docs.length;i++)fs.writeFileSync(path.join(output,'reveal',String(i+1)),JSON.stringify(docs[i]));
fs.writeFileSync(path.join(output,'placeholder.json'),JSON.stringify({name:'CofferHouse — Unrevealed Membership',description:'The House is preparing your key. Artwork will be revealed after the mint.',image:'REPLACE_WITH_PUBLIC_PLACEHOLDER_IMAGE_URI'}));
console.log('4444 metadata files prepared; 100 reserved / 4344 public. Keep seed, mapping AND reveal folder private until reveal. Commitment:',commitment);
