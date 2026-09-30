const fs=require('fs'),vm=require('vm'),assert=require('assert');
const elements=new Map();const doc={body:{dataset:{}},getElementById(id){if(!elements.has(id))elements.set(id,{style:{},focus(){},scrollIntoView(){},innerHTML:'',textContent:''});return elements.get(id)},querySelectorAll(){return []}};
const ctx=vm.createContext({document:doc,location:{search:'?demo=1'},URLSearchParams,sessionStorage:{getItem:()=>null},crypto:require('crypto').webcrypto,window:{scrollTo(){}},setTimeout,clearTimeout,AbortController,console});
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../app.js'),'utf8'),ctx);const run=s=>vm.runInContext(s,ctx);
(async()=>{
for(const p of ['f','m']){run(`persona='${p}';`);for(let i=0;i<=13;i++){run(`step=${i};questionIndex=0;render()`);assert(elements.get('screen').innerHTML.includes('error'));assert(!elements.get('screen').innerHTML.includes('undefined'));}}
run('step=1');assert(run('validate()'));run("answers.성별='여성'");assert.equal(run('validate()'),'');run('step=2');assert(run('validate()'));run("answers.주선자='m';persona='m';step=4;Object.assign(answers,{이름:'테스트',출생연도:'1997',키:'163',생활권:'잠실',직업:'기획',학교:'고려대',MBTI:'ENFP'})");assert.equal(run('validate()'),'');run("questionIndex=2;answers.키='999'");assert(run('validate()'));run("questionIndex=6;answers.키='163';answers.MBTI='oops'");assert(run('validate()'));run("answers.MBTI='ENFP';step=5;questionIndex=0;Object.assign(answers,{취미:'요가',음주:'가끔',흡연:'안 피워'})");assert.equal(run('validate()'),'');run("Object.assign(answers,{이상형:'대화',제외조건:'흡연',중요조건:'연락'});step=9;render()");assert(elements.get('screen').innerHTML.includes('흡연'));run("answers.중요조건='연락과 소비';step=8;render();step=9;render()");assert(elements.get('screen').innerHTML.includes('연락과 소비'));run('step=11');assert(run('validate()'));run('photos=[{},{},{}]');assert.equal(run('validate()'),'');run("step=12;questionIndex=2;answers.유입경로='인스타';answers.연락처='123'");assert(run('validate()'));run("answers.연락처='01012345678'");assert.equal(run('validate()'),'');run('step=13');assert(run('validate()'));run('answers.개인정보동의=true');await run('submit()');assert.equal(run('view'),'complete');assert(elements.get('screen').innerHTML.includes('1~2일'));assert(elements.get('screen').innerHTML.includes('접수 완료'));assert.equal(run('answers.성별'),'여성');assert.equal(run('answers.주선자'),'m');
for(const s of ['pending','approved','rejected']){run(`view='status';status='${s}';render()`);assert(elements.get('screen').innerHTML.includes(s==='pending'?'확인을 기다리고':s==='approved'?'확인이 끝났어':'함께하기 어려워'));}
run("answers.이름='<img src=x onerror=alert(1)>';view='profile';render()");assert(!elements.get('screen').innerHTML.includes('<img src=x'));assert(elements.get('screen').innerHTML.includes('&lt;img'));
run("view='form';step=9;questionIndex=0;render()");
assert.equal((elements.get('screen').innerHTML.match(/data-review=/g)||[]).length,15);
for(const label of ['이름','학교 · 전공','쉬는 날 하는 일','만나고 싶은 사람'])assert(elements.get('screen').innerHTML.includes(label));
run("returnToReview=true;step=4;questionIndex=2;answers.키='999'");await run('next()');assert.equal(run('step'),4);
run("answers.키='170'");await run('next()');assert.equal(run('step'),9);assert.equal(run('returnToReview'),false);assert(elements.get('screen').innerHTML.includes('170cm'));
console.log('PASS: 15 complete review bubbles, invalid edit blocked, valid edit returns to review.');
for(const [st,ix,key,optional] of [[5,1,'음주',false],[5,2,'흡연',false],[5,3,'종교',true],[10,0,'연봉',true],[12,0,'유입경로',false]]){
 run(`view='form';step=${st};questionIndex=${ix};answers['${key}']='';returnToReview=false`);
 await run('next()');assert.equal(run('step'),st);assert.equal(run('questionIndex'),ix);
 if(optional){await run('next(true)');assert(run('step')!==st||run('questionIndex')!==ix);}
}
console.log('PASS: all five empty choice questions blocked; explicit optional skip allowed.');
for(const [st,ix] of [[4,0],[4,3],[4,4],[4,5],[5,0],[6,0],[7,0],[8,0],[12,2]]){run(`view='form';step=${st};questionIndex=${ix};render()`);const placeholders=[...elements.get('screen').innerHTML.matchAll(/placeholder="([^"]*)"/g)].map(m=>m[1]).join(' ');assert(placeholders,`no placeholder at step ${st}/${ix}`);for(const pii of ['함다인','네이버','경영학과','잠실','판교','01012345678'])assert(!placeholders.includes(pii),`placeholder leaks ${pii} at step ${st}/${ix}`);}
run("view='form';step=4;questionIndex=0;render()");assert(elements.get('screen').innerHTML.includes('placeholder="홍길동"'));
console.log('PASS: placeholders contain no person-like data; generic example name in use.');
assert.equal(run("sendsOnEnter({key:'Enter',shiftKey:false,isComposing:false,keyCode:13})"),true);assert.equal(run("sendsOnEnter({key:'Enter',shiftKey:true,isComposing:false,keyCode:13})"),false);assert.equal(run("sendsOnEnter({key:'Enter',shiftKey:false,isComposing:true,keyCode:229})"),false);assert.equal(run("sendsOnEnter({key:'Enter',shiftKey:false,isComposing:false,keyCode:229})"),false);assert.equal(run("sendsOnEnter({key:'a',shiftKey:false,isComposing:false,keyCode:65})"),false);
run("view='form';step=6;questionIndex=0;render()");assert(elements.get('screen').innerHTML.includes('<textarea') && elements.get('screen').innerHTML.includes('enterkeyhint="send"'));
console.log('PASS: Enter sends, Shift+Enter and IME composition do not; textarea carries enterkeyhint=send.');
ctx.fetch=async()=>({ok:true,json:async()=>({ok:true})});await assert.rejects(run("request({})"),/지원하지/);ctx.fetch=async()=>({ok:false});await assert.rejects(run('request({})'),/연결하지/);
console.log('PASS: 28 step/persona renders; validation; summary preservation; independent gender/persona; demo submit; 3 review states; HTML escaping; legacy response and network failure handling.');
new vm.Script(fs.readFileSync(require('path').join(__dirname,'../server/Code.gs'),'utf8'));console.log('PASS: Apps Script syntax');
})().catch(e=>{console.error(e);process.exit(1)});
