'use strict';
// Keep the original Apps Script endpoint and flat Korean-key JSON transport.
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbyoY955vCmQSYgXuC2JgvWME4uSujfCapjPJFFwNZDsFtXEpRim_vQEdj_HYetex_-6Qw/exec';
// Fill with the operator's published privacy policy before accepting real applications.
const PRIVACY = {operator:'', retention:'', contact:''};
const demo = new URLSearchParams(location.search).get('demo') === '1';
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const answers = {연령대:'',유입경로:'',만족도:'',유용한점:'',추천의향:'',좋았던점:'',개선점:'',성별:''};
let step=0, persona='f', photos=[], busy=false, submitted=false, view='form', status='pending', editing=false;
let questionIndex=0;
let returnToReview=false;
let introSlide=0;
let profilePersona='f';
const HOSTS={f:{name:'다민',role:'촉 좋은 인싸 언니',job:'고려대 · IT기업',experience:'소개팅/미팅 주선 100회+',detail:'친구 연애상담 단골',quote:'일단 얘기해봐. 내가 감 좀 잡아볼게 👀'},m:{name:'정진',role:'발 넓은 마당발 형',job:'고려대 · 직장인',experience:'각종 모임 100회+',detail:'친구의 친구까지 넓은 인맥',quote:'어떤 사람 찾는데? 아는 사람 중에 생각해볼게.'}};
function startChat(id){persona=id;answers.주선자=id;view='form';step=3;questionIndex=0;history.length=0;render();topScreen();}
const history=[];
let lastPrompt="";
let receipt=null;
try{receipt=JSON.parse(sessionStorage.getItem('chinchinso-receipt'));if(receipt&&!demo){submitted=true;view='status';}}catch{}
const name=()=>persona==='f'?'다민':'정진';
const copy=(f,m)=>persona==='f'?f:m;
const stages=['시작','먼저 하나만!','누구랑 얘기할래요?','반가워 👋','너부터 좀 알자','평소엔 뭐 하고 지내?','그래서 어떤 사람이 좋아?','반대로 이건 진짜 안 돼?','은근 중요한 건?','내가 제대로 이해했나 봐봐','조금 현실적인 것도','사진도 몇 장 줘 📸','어떻게 알고 왔어?','마지막으로 이것만'];

const QUESTIONS={
4:[['이름','이름이 뭐야?','함다인'],['출생연도','몇 년생이야?','1997','number'],['키','키는 몇이야?','163','number'],['생활권','보통 어디서 지내? 집이나 회사처럼 평소 생활권 정도면 돼.','잠실 살고 회사는 판교야'],['직업','무슨 일 해? 회사랑 하는 일 정도만 편하게.','네이버에서 서비스 기획해'],['학교','학교는 어디 나왔어?','고려대 / 경영학과'],['MBTI','MBTI도 알아?','ENFP','text',true]],
5:[['취미','쉬는 날엔 보통 뭐 해? 요즘 자주 하는 거 아무거나!','요가 하고 맛있는 거 먹으러 다녀.','textarea'],['음주','술은?', ['거의 안 마셔','가끔','자주 마셔']],['흡연','담배는?',['안 피워','가끔','피워']],['종교','종교는?',['없어','기독교','천주교','불교','기타'],'text',true]],
10:[['연봉','연봉은?',['5천 미만','5–7천','7–9천','9천–1억','1억+','비밀'],'text',true],['자산','자산도 알려줄 수 있어?','불편하면 비워둬도 돼','text',true]],
12:[['유입경로','우리 어떻게 알게 됐어?',['친구 추천','기존 참여자 추천','인스타','블라인드','기타']],['추천인','추천해준 사람 있어?','이름이나 닉네임','text',true],['연락처','연락받을 번호도 알려줘.','01012345678','tel']]
};
function currentQuestion(){return QUESTIONS[step]?.[questionIndex];}
function questionUI(){const [key,label,placeholder,type='text',optional=false]=currentQuestion();const context=step===10&&questionIndex===0?bubble(copy('조금 현실적인 것도 물어볼게. 불편하면 넘어가도 돼. 상대에게 그대로 공개하지 않고, 조합을 생각할 때만 참고할게.','현실적인 조건도 참고하려고 해. 선택사항이니 말하기 싫으면 넘어가도 돼. 상대에게 그대로 공개하지 않아.')):'';return context+bubble(label)+(key==='연락처'?'<p class=hint>맞는 자리가 생기거나 추가 확인이 필요할 때만 연락할게.</p>':'')+(optional?'<p class="hint">말하기 불편하면 넘어가도 괜찮아.</p>':'')+(Array.isArray(placeholder)?choices(key,label,placeholder,optional):field(key,label,placeholder,type,optional));}
function remember(){const q=currentQuestion();const keys=q?[q[0]]:({6:['이상형'],7:['제외조건'],8:['중요조건'],9:['제외조건','중요조건','이상형']}[step]||[]);history.push({step,index:questionIndex,prompt:q?q[1]:lastPrompt||stages[step],keys,reply:step===3?'좋아, 얘기해볼게!':step===11?'사진 '+photos.length+'장 선택했어':step===9?'응, 이렇게 기억해줘.':''});}
function transcript(){return history.map(h=>'<div class="past-turn">'+bubble(h.prompt)+'<div class="outgoing">'+esc(h.reply||h.keys.map(k=>answers[k]||'이건 넘어갈게').join(' · '))+'</div></div>').join('');}
function previous(){if(busy)return;if(returnToReview){returnToReview=false;step=9;questionIndex=0;render();topScreen();return;}if(QUESTIONS[step]&&questionIndex>0)questionIndex--;else{step=step===2?0:Math.max(0,step-1);questionIndex=QUESTIONS[step]?QUESTIONS[step].length-1:0;}while(history.length&&(history.at(-1).step>step||(history.at(-1).step===step&&history.at(-1).index>=questionIndex)))history.pop();render();topScreen();}

function field(key,label,placeholder='',type='text',optional=false){return `<label class="field"><span>${label} ${optional?'<small>선택</small>':''}</span>${type==='textarea'?`<textarea aria-label="${esc(label)}" data-key="${key}" placeholder="${placeholder}" maxlength="2000">${esc(answers[key])}</textarea>`:`<input aria-label="${esc(label)}" data-key="${key}" type="${type}" ${type==='number'?'inputmode="numeric"':''} value="${esc(answers[key])}" placeholder="${placeholder}" maxlength="200">`}</label>`;}
function choices(key,label,options,optional=false){return `<fieldset aria-label="${esc(label)}"><legend>${label} ${optional?'<small>선택</small>':''}</legend><div class="choices">${options.map(o=>`<button type="button" class="chip" data-key="${key}" data-value="${o}" aria-pressed="${answers[key]===o}">${o}</button>`).join('')}</div></fieldset>`;}
function bubble(text){lastPrompt=text;return `<div class="incoming"><span class="message-avatar" aria-hidden="true">${name().slice(0,1)}</span><div class="message-stack">${text.split(/\n\n/).map(part=>'<div class="bubble">'+esc(part)+'</div>').join('')}</div></div>`;}


const REVIEW_FIELDS=[['이름','이름',4,0],['성별','성별',1,0],['출생연도','출생연도',4,1],['키','키',4,2],['생활권','생활권',4,3],['직업','하는 일',4,4],['학교','학교 · 전공',4,5],['MBTI','MBTI',4,6],['취미','쉬는 날 하는 일',5,0],['음주','술',5,1],['흡연','담배',5,2],['종교','종교',5,3],['이상형','만나고 싶은 사람',6,0],['제외조건','절대 안 되는 조건',7,0],['중요조건','은근 중요한 조건',8,0]];
function fullReview(){return '<div class="incoming review-message"><span class="message-avatar" aria-hidden="true">'+name().slice(0,1)+'</span><div class="message-stack">'+REVIEW_FIELDS.map(([key,label],i)=>'<div class="bubble review-bubble"><div class="review-label">'+esc(label)+'<button type="button" class="review-edit" data-review="'+i+'" aria-label="'+esc(label)+' 수정">수정</button></div><div class="review-answer">'+esc(answers[key]?String(answers[key])+(key==='키'?'cm':key==='출생연도'?'년생':''):'건너뛰었어')+'</div></div>').join('')+'</div></div>';}

function summary(keys){return keys.map(([key,label])=>`<div class="summary"><b>${label}</b><p>${esc(answers[key]||'아직 알려주지 않았어요')}</p></div>`).join('');}
function error(message){$('error').textContent=message;}
function render(){
 const oldScroll=$('screen').scrollTop;
 document.body.dataset.persona=persona;
 document.body.dataset.screen=view==='form'?(step<2?'intro':step===2?'list':'chat'):view==='host'?'host':'result';
 $('brand').innerHTML=step>=3&&view==='form'?'<button id=chatBack class=icon-button aria-label=대화목록으로>‹</button><span class=header-avatar>'+name().slice(0,1)+'</span><span>'+name()+'<small>편하게 얘기해줘</small></span>':'친친소<span class=spark>✳</span>'; 
 $('headerNote').textContent=step>2?`${name()}에게 맡기는 내 인연`:'친구의 친구, 그 너머의 인연';
 $('progress').style.width=(view==='form'?step/13*100:100)+'%';
 let html=demo?'<div class="demo">체험 모드 · 서버에 전송되지 않아요</div>':'';
 if(view==='form'){
 html+=step===2?'':step<3?`<div class="eyebrow">${step===2?'02 / CHOOSE YOUR PERSON':'01 / A LITTLE HELLO'}</div>`:'<div class="chat-date">자동 질문으로 얘기를 모으고, 선택한 운영자가 직접 확인해요.</div>'+transcript()+'<div id=activeTurn class=active-turn>';
 if(step<2){html=`<section class="onboarding" aria-label="친친소 서비스 소개"><div class="onboard-brand">친친소<span>친구의 친구, 우리 사이</span></div><div class="onboard-art" aria-hidden="true"><img src="assets/onboarding-tiger.png?v=2" alt="" width="3762" height="3762"></div><div id="introSlides" class="intro-slides" tabindex="0" aria-label="서비스 소개, 좌우로 넘겨보세요">`+[
 ['친구의 소개를,<br>더 넓고 잘 맞게.','친한 주선자에게 얘기하듯 알려주세요.<br>취향도, 피하고 싶은 조건도 편하게.'],
 ['내 이야기는 편하게,<br>내 정보는 조심스럽게.','등록만으로 사진이 공개되지 않아요.<br>누구에게 보여줄지 먼저 물어볼게요.'],
 ['잘 맞을 작은 자리,<br>초대받고 결정해요.','운영자가 6~8명의 조합을 생각해요.<br>맞는 자리가 생기면 먼저 연락할게요.']
 ].map(([title,body],i)=>'<article class="intro-slide" aria-label="'+(i+1)+' / 3"><h1>'+title+'</h1><p>'+body+'</p></article>').join('')+'</div><div class="slide-controls"><button id="slidePrev" class="slide-arrow" aria-label="이전 소개">‹</button><div class="slide-dots">'+[0,1,2].map(i=>'<button class="slide-dot" data-slide="'+i+'" aria-label="소개 '+(i+1)+' 보기" aria-current="'+(i===introSlide)+'"><span></span></button>').join('')+'</div><button id="slideNext" class="slide-arrow" aria-label="다음 소개">›</button></div></section>';}

 else {
 switch(step){
 case 1:html+=choices('성별','성별이 어떻게 돼요?',['여성','남성']);break;
 case 2:html+='<aside class="conversation-banner" aria-label="편하게 들려주세요"><div class="banner-copy"><strong>소개받고 싶은 사람,<br>편하게 얘기해봐요.</strong><p>취향도, 피하고 싶은 조건도요.</p></div><svg class="banner-art" viewBox="0 0 96 80" fill="none" aria-hidden="true"><path d="M5 29C5 14 17 6 33 6s28 8 28 23-12 23-28 23H21L9 61l2-20a23 23 0 0 1-6-12Z" fill="var(--incoming)"/><path d="M38 48c0-14 11-23 26-23s27 9 27 23-12 23-27 23H54l-11 7 1-16c-4-4-6-9-6-14Z" fill="var(--outgoing)"/><circle cx="24" cy="28" r="2" fill="var(--ink)"/><circle cx="40" cy="28" r="2" fill="var(--ink)"/><path d="M27 36q5 5 10 0" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/><circle cx="54" cy="48" r="2" fill="var(--ink)"/><circle cx="64" cy="48" r="2" fill="var(--ink)"/><circle cx="74" cy="48" r="2" fill="var(--ink)"/></svg></aside><div class="contacts">'+Object.entries(HOSTS).map(([id,h])=>`<div class="contact-row"><button class="contact-avatar ${id}" data-host="${id}" aria-label="${h.name} 프로필 보기">${h.name.slice(0,1)}</button><button class="contact-content" data-persona="${id}" aria-label="${h.name}과 대화하기"><span class="contact-copy"><strong>${h.name}</strong><span class="contact-status" title="${h.job} · ${h.experience}">${h.job} · ${h.experience}</span></span><svg class="contact-chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg></button></div>`).join('')+'</div>';break;
 case 3:html+=bubble(copy('오 반가워!\n당장 누구 소개해주겠다는 건 아니니까 부담 갖지 말고ㅋㅋ\n\n너 어떤 사람인지랑 어떤 사람 좋아하는지만 좀 알아둘게.\n잘 맞을 작은 자리가 생기면 먼저 초대할게 👀\n\n일단 쉬운 것부터!','오 반가워 👋\n당장 누구 만나라는 건 아니고 네 얘기 좀 들어두려고.\n\n네 취향이랑 피하고 싶은 조건까지 참고해서 작은 자리를 생각해볼게. 맞는 자리가 생기면 먼저 초대할게.\n\n일단 기본적인 것부터 가보자.'));break;
 case 4:html+=questionUI();break;
 case 5:html+=questionUI();break;
 case 6:html+=bubble(copy('자 이제 진짜 궁금한 거ㅋㅋ\n너는 어떤 사람 만나고 싶어?\n친구한테 얘기한다고 생각하고 편하게 말해줘. 조건이어도 좋고, 느낌이어도 좋아.','자 이제 중요한 거.\n그래서 어떤 사람 만나고 싶은데?\n조건, 성격, 느낌 다 좋아. 생각나는 대로 얘기해봐.'))+field('이상형','어떤 사람이 좋아?','키가 좀 컸으면 좋겠고 자기 일 열심히 하는 사람이 좋아.','textarea');break;
 case 7:html+=bubble(copy('근데 사실 이것도 엄청 중요해.\n“아무리 괜찮아도 이런 사람은 진짜 안 돼.”\n뭐 있어? 이유까지 설명 안 해도 돼. 솔직할수록 좋음ㅋㅋ','좋아하는 것만큼 아예 안 되는 걸 미리 아는 것도 중요하거든.\n이런 사람이면 안 만난다 하는 거 있어?'))+field('제외조건','이건 진짜 안 돼','흡연자는 안 되고, 연하는 싫어. 없다면 없다고 말해줘.','textarea');break;
 case 8:html+=bubble(copy('이상형까진 아닌데 막상 연애하면 은근 중요한 거 있잖아.\n연락, 돈 쓰는 방식, 표현, 주말 보내는 방식 같은 거. 너는 뭐 있어?','필수 조건까진 아닌데 안 맞으면 연애하기 힘들 것 같은 건?'))+field('중요조건','은근 중요한 건?','연락이 너무 뜸한 건 싫어. 돈 쓰는 방식도 비슷했으면 좋겠어.','textarea');break;
 case 9:html+=bubble(copy('잠깐ㅋㅋ 이름부터 지금까지 얘기한 거 쭉 모아봤어 👀\n틀린 게 있으면 고쳐줘!','이름부터 지금까지 얘기해준 내용이야.\n한번 쭉 보고, 다른 부분 있으면 고쳐줘.'))+fullReview();break;
 case 10:html+=questionUI();break;
 case 11:html+=bubble(copy('아 맞다 사진ㅋㅋ\n한 장 고르느라 고민하지 말고 3~5장 그냥 보내줘.\n얼굴 잘 보이는 거 하나랑 평소 느낌 보이는 사진이면 충분해!','사진도 최근 걸로 3~5장 정도 줘.\n한 장 엄선할 필요 없고 얼굴 잘 보이는 사진 하나 정도만 있으면 돼.'))+'<div class="privacy"><strong>🔒 사진은 일단 우리만 볼게.</strong>등록한 사진은 동의 없이 다른 사람에게 공개되지 않아요.<br>잘 맞을 것 같은 사람이 생겨도 먼저 너한테 물어보고, 네가 괜찮다고 했을 때만 보여줄게.</div><label class="field"><span>사진 올리기 · 3~5장</span><input id="photoInput" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><small>JPG · PNG · WebP, 한 장당 5MB 이하</small><div class="photos">'+photos.map((p,i)=>`<div class="photo"><img src="${p.data}" alt="선택한 사진 ${i+1}"><button data-remove="${i}" aria-label="사진 ${i+1} 삭제">×</button></div>`).join('')+'</div>';break;
 case 12:html+=questionUI();break;
 case 13:html+=bubble(copy('네가 여기서 말한 내용이 아무한테나 공개되진 않아.\n잘 맞을 것 같은 사람이 생기면 너한테 먼저 얘기할게.\n사진이나 회사, 학교 같은 걸 보여줄 때도 어디까지 보여줄지 먼저 확인하고!','등록했다고 네 프로필이 다른 사람들한테 돌아다니는 구조 아니야.\n괜찮은 사람이 있으면 너한테 먼저 물어볼게.\n네가 괜찮다고 한 정보만 보여줄 거고.'))+'<div class="privacy"><strong>내 정보 공개는, 내가 정해요.</strong>이 동의는 신청 검토와 매칭 연락을 위한 수집·이용 동의예요. 상대방에게 사진과 프로필을 공개하는 동의는 별도로 받을게요.</div><details><summary>수집·이용 내용 보기</summary><p>목적: 신청 검토, 소개 가능 여부 확인 및 매칭 연락\n항목: 이름, 성별, 출생연도, 키, 생활권, 직업, 학교, 취미, 생활습관, 선호조건, 사진, 연락처, 유입경로 및 선택 입력 항목\n선택 항목은 입력하지 않아도 신청할 수 있어요. 동의를 거부할 수 있으며, 필수정보 수집에 동의하지 않으면 신청할 수 없어요.</p><p>'+(PRIVACY.operator&&PRIVACY.retention&&PRIVACY.contact?esc('처리자: '+PRIVACY.operator+' / 보유기간: '+PRIVACY.retention+' / 삭제 요청: '+PRIVACY.contact):'개인정보 처리방침을 준비하고 있어요. 현재는 체험 모드만 이용할 수 있어요.')+'</p></details><label class="consent"><input id="consent" type="checkbox" '+(answers.개인정보동의?'checked':'')+'>개인정보 수집·이용에 동의해요</label>';break;
 }}
 }else if(view==='host'){
 const h=HOSTS[profilePersona];
 html+='<section class="host-profile" aria-label="'+h.name+' 소개"><div class="host-avatar '+profilePersona+'" aria-hidden="true">'+h.name.slice(0,1)+'</div><h1>'+h.name+'</h1><p class="host-role">'+h.role+'</p><div class="host-quote">'+h.quote+'</div><div class="host-facts"><p>'+h.job+'</p><p>'+h.experience+'</p><p>'+h.detail+'</p></div><p class="host-note">자동 질문으로 편하게 이야기해주세요.<br>남겨준 이야기는 '+h.name+'이 직접 확인해요.</p></section>';
 }else if(view==='profile'){
 html+='<h2>내가 얘기한 내용</h2>'+summary(Object.entries(answers).filter(([k,v])=>v&&!['주선자','개인정보동의'].includes(k)).map(([k])=>[k,k]));
 }else{
 const done=view==='complete';
 const title=done?'네 이야기, 잘 맡겨뒀어.':status==='pending'?'운영자 확인을 기다리고 있어':status==='approved'?'이야기 확인이 끝났어':'이번에는 함께하기 어려워';
 html+='<div class="status-icon">'+(done?'✓':status==='approved'?'♡':status==='rejected'?'…':'◷')+'</div><div class="eyebrow">'+(done?'등록 완료':status==='pending'?'확인 중':status==='approved'?'확인 완료':'현재 진행 어려움')+'</div><h1>'+title+'</h1>';
 html+=bubble(done?copy('편하게 얘기해줘서 고마워. 네 취향과 피하고 싶은 조건까지 잘 참고해둘게.\n\n잘 맞을 것 같은 6~8명의 작은 자리가 생기면 먼저 연락할게. 그때 보고 참석할지 정하면 돼.\n등록만으로 사진이 공개되거나 만남이 확정되지는 않아.','얘기해준 내용 잘 받았어. 어떤 사람과 편할지, 어떤 조건은 피해야 할지 참고해둘게.\n\n맞는 사람들이 모이면 작은 자리로 먼저 초대할게. 참석할지는 그때 정하면 돼.'):status==='pending'?copy('남겨준 이야기는 다민이 확인할 예정이야. 더 궁금한 게 있으면 알려준 연락처로 물어볼게.\n확인이 끝나도 바로 만남이 정해지는 건 아니야. 잘 맞을 자리가 생기면 먼저 연락할게.','정진이 남겨준 내용을 확인할 예정이야. 추가로 확인할 게 있으면 연락할게.\n맞는 자리가 생긴 뒤에 초대하고, 참석 여부는 네가 정하면 돼.'):status==='approved'?copy('어떤 사람을 만나고 싶은지 확인했어. 이제 네 이야기 참고해서 잘 맞을 자리를 생각해볼게.\n\n초대가 바로 확정된 건 아니야. 맞는 조합이 생기면 먼저 연락할게.','얘기해준 내용 확인했어. 취향과 피하고 싶은 조건을 참고해서 작은 자리를 준비할게.\n맞는 조합이 생기면 먼저 연락할 테니, 그때 참석할지 정해줘.'):copy('이야기를 읽어봤는데, 지금은 소개를 맡아주기 어려울 것 같아. 기다리게 하기보다 먼저 알려주는 게 맞다고 생각했어.\n시간 내서 얘기해줘서 고마워. 남겨준 내용은 내 정보에서 다시 확인할 수 있어.','얘기해준 내용은 잘 봤어. 지금은 소개를 맡기 어려워서 먼저 알려줘.\n시간 내줘서 고마워. 남겨준 내용은 내 정보에서 확인할 수 있어.'));
 if(demo&&!done)html+=choices('_demoStatus','확인 상태 미리보기',['pending','approved','rejected']);
 }
 if(view==='form'&&step>=3)html+='</div>';
 html+='<p id="error" class="error" role="alert"></p>';
 $('screen').innerHTML=html;
 $('nav').innerHTML=view==='form'?`${step?'<button class="secondary" id="back">이전</button>':''}<button class="primary" id="next">${busy?'처리 중…':step===0?'얘기해볼게요 ↗':step===9?'응 딱 맞아':step===13?(editing?'수정 내용 저장':'내 얘기 맡겨두기'):step===10?'다음 · 넘어가도 괜찮아':'다음 →'}</button>`:view==='profile'?'<button class="secondary" id="return">돌아가기</button><button class="primary" id="edit">수정하기</button>':`<button class="secondary" id="profile">내 정보 보기</button><button class="primary" id="status">${view==='complete'?'확인 상태 보기':'상태 새로고침'}</button>`;
 if(view==='form'&&step===2){$('brand').innerHTML='<button class="icon-button" id="back" aria-label="소개로 돌아가기">‹</button><span>대화 <small class="contact-count">2</small></span>';$('headerNote').textContent='';$('nav').innerHTML='';}
 if(view==='form'&&step>=3&&step<=12){$('next').textContent=step===3?'좋아, 시작하자 →':step===9?'응 딱 맞아 →':currentQuestion()?.[4]?'보내기 / 건너뛰기 ↑':'보내기 ↑';}
 if(view==='form'&&step<2)$('nav').innerHTML='<div class="start-panel"><p>이제, 얘기 시작할래요?</p><div class="start-genders"><button data-start="여성" class="start-gender female">여자</button><button data-start="남성" class="start-gender male">남자</button></div><small>성별을 선택하면 대화 상대를 고를 수 있어요.</small></div>';
 if(view==='host'){$('brand').innerHTML='<button id="hostBack" class="icon-button" aria-label="친구 목록으로">‹</button><span>프로필</span>';$('headerNote').textContent='';$('nav').innerHTML='<button class="primary" data-persona="'+profilePersona+'">'+HOSTS[profilePersona].name+'과 대화하기</button>';}
 mountComposer();
 bind();
 $('screen').scrollTop=oldScroll;
}

function mountComposer(){
 const chatting=view==='form'&&step>=3;
 if(!chatting)return;
 $('brand').innerHTML='<button id="chatBack" class="icon-button" aria-label="대화 목록으로">‹</button><div class="chat-person"><span class="header-avatar">'+name().slice(0,1)+'</span><strong>'+name()+'</strong><small>자동 질문 · 운영자가 나중에 확인</small></div>';
 $('headerNote').innerHTML='<button id="chatInfo" class="info-button" aria-label="대화 안내">ⓘ</button>';
 const active=$('activeTurn');
 if(!active?.querySelectorAll)return;
 const fields=active.querySelectorAll('.field');
 const plain=fields.length===1&&fields[0].querySelector('input:not([type=file]),textarea');
 const options=active.querySelector('fieldset');
 const nextButton=$('next'),backButton=$('back');
 const err=$('error');
 $('nav').innerHTML='<div id="actionPanel" class="action-panel"></div><div id="replyTools" class="reply-tools"></div><div id="composer" class="composer"></div><div id="composerMeta" class="composer-meta"></div><div class="home-indicator" aria-hidden="true"></div>';
 $('nav').appendChild(err);
 if(options)$('replyTools').appendChild(options);
 if(plain){
  const entry=fields[0].querySelector('input,textarea');
  entry.classList.add('chat-entry');
  if(entry.tagName==='TEXTAREA'){entry.rows=1;entry.placeholder='메시지를 입력하세요';}
  else entry.placeholder=currentQuestion()?.[2]||'메시지를 입력하세요';
  $('composer').appendChild(entry);fields[0].remove();
  nextButton.textContent='➤';nextButton.className='send-message';nextButton.setAttribute('aria-label','메시지 보내기');
 }else if(options){
  const entry=document.createElement('input');entry.className='chat-entry';entry.id='choiceEntry';entry.type='text';entry.readOnly=true;entry.value=answers[currentQuestion()[0]]||'';entry.placeholder='답변을 골라주세요';entry.setAttribute('aria-label','선택한 답변');
  $('composer').appendChild(entry);nextButton.textContent='➤';nextButton.className='send-message';nextButton.setAttribute('aria-label','메시지 보내기');
 }else{
  const caption=document.createElement('span');caption.className='composer-caption';caption.textContent=options?'위에서 답변을 골라주세요':step===11?'사진을 보내주세요':step===13?'동의하고 내 얘기 맡기기':step===9?'내 얘기를 확인해주세요':'편하게 시작해볼까요?';
  $('composer').appendChild(caption);
  nextButton.textContent=step===3?'시작하기':step===13?'등록':step===9?'확인':'↑';nextButton.className='send-message'+([3,9,13].includes(step)?' send-label':'');nextButton.setAttribute('aria-label','답변 보내기');
 }
 if(step===11){
  const fileLabel=active.querySelector('.field');if(fileLabel)fileLabel.hidden=true;
  // Lucide Image icon (ISC); see THIRD_PARTY_NOTICES.txt.
  const add=document.createElement('button');add.className='attach-button';add.type='button';add.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.586-4.586a2 2 0 0 0-2.828 0L3 21"/></svg>';add.setAttribute('aria-label','앨범에서 사진 선택');add.title='앨범에서 사진 선택';add.onclick=()=>{if(!busy)$('photoInput').click();};$('composer').appendChild(add);
  nextButton.textContent='➤';nextButton.className='send-message';nextButton.setAttribute('aria-label','선택한 사진 보내기');
  $('composer').appendChild(nextButton);
 }else if(plain||options){$('composer').appendChild(nextButton);}
 else{
  $('composer').hidden=true;
  nextButton.textContent=step===3?'대화 시작하기':step===9?'전부 확인했어':step===13?(editing?'수정 내용 저장하기':'동의하고 등록하기'):'선택 확인하기';nextButton.className='action-confirm';nextButton.setAttribute('aria-label',nextButton.textContent);$('actionPanel').appendChild(nextButton);
 }
 backButton.textContent='이전 답변 수정';backButton.className='previous-answer';$('composerMeta').appendChild(backButton);
 if(currentQuestion()?.[4]){const skip=document.createElement('button');skip.id='skipReply';skip.className='skip-reply';skip.textContent='건너뛰기';skip.onclick=()=>{answers[currentQuestion()[0]]='';next(true);};$('composerMeta').appendChild(skip);}
 const entry=$('composer').querySelector('input,textarea');
 if(entry){const resize=()=>{if(entry.tagName==='TEXTAREA'){entry.style.height='auto';entry.style.height=Math.min(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--entry-max')),entry.scrollHeight)+'px';}nextButton.disabled=busy||!entry.value.trim();};entry.addEventListener('input',resize);resize();}
}

function showIntroSlide(index){introSlide=Math.max(0,Math.min(2,index));const track=$('introSlides');if(track?.scrollTo)track.scrollTo({left:track.clientWidth*introSlide,behavior:'smooth'});updateIntroDots();}
function updateIntroDots(){document.querySelectorAll('[data-slide]').forEach(el=>el.setAttribute('aria-current',String(Number(el.dataset.slide)===introSlide)));}
function bind(){
 document.querySelectorAll('[data-start]').forEach(el=>el.onclick=()=>{answers.성별=el.dataset.start;if(returnToReview){returnToReview=false;step=9;}else step=2;questionIndex=0;render();topScreen();});
 document.querySelectorAll('[data-slide]').forEach(el=>el.onclick=()=>showIntroSlide(Number(el.dataset.slide)));
 const track=$('introSlides');if(track?.addEventListener){track.scrollLeft=track.clientWidth*introSlide;track.addEventListener('scroll',()=>{if(track.clientWidth){introSlide=Math.round(track.scrollLeft/track.clientWidth);updateIntroDots();}});track.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();showIntroSlide(introSlide+(e.key==='ArrowRight'?1:-1));}};}
 if($('slidePrev'))$('slidePrev').onclick=()=>showIntroSlide(introSlide-1);
 if($('slideNext'))$('slideNext').onclick=()=>showIntroSlide(introSlide+1);

 if($('chatInfo'))$('chatInfo').onclick=()=>{const notice=$('chatNotice');if(notice){notice.remove();return;}const el=document.createElement('div');el.id='chatNotice';el.className='chat-notice';el.textContent='지금은 자동 질문으로 이야기를 모으는 중이에요. 등록 후 선택한 운영자가 직접 확인해요. 사진과 프로필은 공개 범위를 먼저 확인한 뒤에만 다른 참여자에게 보여줘요.';$('screen').prepend(el);$('screen').scrollTop=0;};
 if($('chatBack'))$('chatBack').onclick=()=>{if(busy)return;step=2;questionIndex=0;render();topScreen();};
 document.querySelectorAll('input[data-key],textarea[data-key]').forEach(el=>{el.oninput=()=>{answers[el.dataset.key]=el.value;};el.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing&&(el.tagName==='INPUT'||e.ctrlKey||e.metaKey)){e.preventDefault();next();}};});
 document.querySelectorAll('button[data-value]').forEach(el=>el.onclick=()=>{if(busy)return;const k=el.dataset.key;answers[k]=el.dataset.value;if(k==='_demoStatus'){status=el.dataset.value;render();return;}el.closest('fieldset').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b===el));if($('choiceEntry')){$('choiceEntry').value=el.dataset.value;next();}});
 document.querySelectorAll('[data-persona]').forEach(el=>{if(el.tagName==='BUTTON')el.onclick=()=>startChat(el.dataset.persona);});
 document.querySelectorAll('[data-host]').forEach(el=>el.onclick=()=>{profilePersona=el.dataset.host;view='host';render();topScreen();});
 if($('hostBack'))$('hostBack').onclick=()=>{view='form';step=2;render();topScreen();};
 document.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{photos.splice(Number(el.dataset.remove),1);render();});
 if($('next')){const entry=$('composer')?.querySelector?.('.chat-entry');$('next').disabled=busy||!!(entry&&!entry.value.trim());$('next').onclick=next;}
 if($('back')){$('back').disabled=busy;$('back').onclick=previous;}
 document.querySelectorAll('[data-review]').forEach(el=>el.onclick=()=>{const item=REVIEW_FIELDS[Number(el.dataset.review)];returnToReview=true;step=item[2];questionIndex=item[3];render();topScreen();});
 if($('secret'))$('secret').onclick=()=>{answers.자산='비밀';render();};
 if($('consent'))$('consent').onchange=e=>answers.개인정보동의=e.target.checked;
 if($('photoInput'))$('photoInput').onchange=selectPhotos;
 if($('profile'))$('profile').onclick=()=>{view='profile';render();topScreen();};
 if($('return'))$('return').onclick=()=>{view='status';render();topScreen();};
 if($('edit'))$('edit').onclick=()=>{editing=true;view='form';step=0;questionIndex=0;history.length=0;render();topScreen();};
 if($('status'))$('status').onclick=async()=>{view='status';render();topScreen();await refreshStatus();};
}
function topScreen(){if(view==='form'&&step>=3){if(step===9)$('activeTurn')?.scrollIntoView({block:'start',behavior:'instant'});else $('screen').scrollTop=$('screen').scrollHeight;}else{$('screen').scrollTop=0;window.scrollTo({top:0,behavior:'instant'});}}
function legacyValidate(){const required={1:['성별'],2:['주선자'],4:['이름','출생연도','키','생활권','직업','학교'],5:['취미','음주','흡연'],6:['이상형'],7:['제외조건'],8:['중요조건'],9:['이상형','제외조건','중요조건'],12:['유입경로','연락처']};if((required[step]||[]).some(k=>!String(answers[k]||'').trim()))return '아직 답하지 않은 항목을 채워줘.';
 if(step===4){const year=Number(answers.출생연도),height=Number(answers.키);if(!Number.isInteger(year)||year<1900||year>new Date().getFullYear()-19)return '출생연도 4자리를 확인해줘. 출생연도 기준 19세 이상만 신청할 수 있어.';if(height<100||height>250)return '키는 cm 단위로 확인해줘 (100~250).';if(answers.MBTI&&!/^[IE][NS][FT][JP]$/i.test(answers.MBTI.trim()))return 'MBTI 네 글자를 확인하거나 비워줘.';}
 if(step===11&&(photos.length<3||photos.length>5))return '사진을 3~5장 선택해줘.';
 if(step===12&&!/^01[016789]\d{7,8}$/.test(answers.연락처.replace(/[-\s]/g,'')))return '연락받을 휴대폰 번호를 확인해줘.';
 if(step===13&&!answers.개인정보동의)return '개인정보 수집·이용에 동의해야 신청할 수 있어.';return '';}
function validate(){if(step<2)return answers.성별?'':'성별을 선택해주세요.';const q=currentQuestion();if(!q)return legacyValidate();const [key,,,type,optional]=q;const value=String(answers[key]||'').trim();if(!optional&&!value)return '답변을 입력하거나 골라줘.';if(key==='출생연도'&&(!/^\d{4}$/.test(value)||+value<1900||+value>new Date().getFullYear()-19))return '출생연도 4자리를 확인해줘. 출생연도 기준 19세 이상만 신청할 수 있어.';if(key==='키'&&(+value<100||+value>250))return '키는 100~250cm 사이로 입력해줘.';if(key==='MBTI'&&value&&!/^[IE][NS][FT][JP]$/i.test(value))return 'MBTI 네 글자를 확인해줘.';if(key==='연락처'&&!/^01[016789]\d{7,8}$/.test(value.replace(/[-\s]/g,'')))return '휴대폰 번호를 확인해줘.';return '';}
async function next(allowSkip=false){if(busy)return;const choice=currentQuestion();if(Array.isArray(choice?.[2])&&!answers[choice[0]]&&!(allowSkip===true&&choice[4])){error('답변을 골라줘.');return;}const msg=validate();if(msg){error(msg);return;}if(returnToReview){returnToReview=false;step=9;questionIndex=0;render();topScreen();return;}if(step<2){step=2;questionIndex=0;}else if(step===13){await submit();return;}else{if(step>=3)remember();if(QUESTIONS[step]&&questionIndex<QUESTIONS[step].length-1)questionIndex++;else{step++;questionIndex=0;}}render();topScreen();}
async function selectPhotos(e){const files=[...e.target.files];if(files.length+photos.length>5){error('사진은 최대 5장까지 올릴 수 있어.');e.target.value='';return;}busy=true;$('next').disabled=true;$('back').disabled=true;try{const incoming=[];for(const file of files){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('JPG, PNG, WebP 형식의 5MB 이하 사진을 선택해줘.');const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('사진을 읽지 못했어. 다시 골라줘.'));r.readAsDataURL(file);});await new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=()=>reject(Error('열 수 없는 사진이야. 다른 파일을 골라줘.'));img.src=data;});incoming.push({name:file.name,type:file.type,data});}photos.push(...incoming);}catch(err){error(err.message);busy=false;$('next').disabled=false;$('back').disabled=false;return;}busy=false;render();}
async function request(payload){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),60000);try{const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),signal:controller.signal});if(!response.ok)throw Error('서버에 연결하지 못했어. 잠시 후 다시 눌러줘.');let result;try{result=await response.json();}catch{throw Error('서버의 저장 확인을 받지 못했어. 운영자의 새 신청 양식 연동이 필요해.');}if(result.schemaVersion!==2||!result.ok)throw Error(result.error||'서버가 새 신청 양식을 지원하지 않아. 운영자에게 확인해줘.');return result;}finally{clearTimeout(timeout);}}
let submissionId=crypto.randomUUID();
async function submit(){if(!demo&&(!PRIVACY.operator||!PRIVACY.retention||!PRIVACY.contact)){error('개인정보 처리방침을 준비하고 있어요. 정식 접수는 준비가 끝나면 열릴 예정이에요.');return;}busy=true;render();try{
 answers.연령대=Math.floor((new Date().getFullYear()-Number(answers.출생연도))/10)*10+'대';
 if(!demo){await request({_action:'capabilities'});const result=await request({...answers,신청ID:receipt?.id||submissionId,사진:photos,개인정보동의일시:new Date().toISOString(),_action:editing?'update':'submit',_token:receipt?.token});if(!result.id||!result.token)throw Error('접수번호를 확인하지 못했어. 다시 시도해줘.');receipt={id:result.id,token:result.token};try{sessionStorage.setItem('chinchinso-receipt',JSON.stringify(receipt));}catch{}}
 submitted=true;editing=false;status='pending';view='complete';
 }catch(err){error(err.name==='AbortError'?'저장 확인이 지연되고 있어. 잠시 후 다시 눌러줘.':err.message);busy=false;$('next').disabled=false;$('next').textContent='다시 보내기';$('back').disabled=false;return;}busy=false;render();topScreen();}
async function refreshStatus(){if(demo||busy)return;busy=true;$('status').disabled=true;try{const result=await request({_action:'status',신청ID:receipt.id,_token:receipt.token});if(!['pending','approved','rejected'].includes(result.status))throw Error('심사 상태를 확인하지 못했어.');status=result.status;if(result.answers){Object.assign(answers,result.answers);persona=answers.주선자||'f';}if(result.photos)photos=result.photos;render();}catch(err){error(err.message);}finally{busy=false;if($('status'))$('status').disabled=false;}}
function fitKeyboard(){const screen=$('screen');const nearBottom=screen.scrollHeight-screen.scrollTop-screen.clientHeight<=screen.clientHeight/4;document.documentElement.style.setProperty('--viewport-height',(window.visualViewport?.height||window.innerHeight)+'px');if(view==='form'&&step>=3&&nearBottom)screen.scrollTop=screen.scrollHeight;}
window.visualViewport?.addEventListener('resize',fitKeyboard);
window.visualViewport?.addEventListener('scroll',fitKeyboard);
render();if(window.visualViewport)fitKeyboard();if(receipt&&!demo)refreshStatus();
