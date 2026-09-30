/** Deploy alongside the existing Sheet. Set SPREADSHEET_ID in Script Properties.
 * Existing columns are preserved; new columns are appended by header name.
 * PHOTO_FOLDER_ID is created automatically as a private, unshared folder.
 * Update the existing web-app deployment to retain its URL.
 */
const LEGACY = ['연령대','유입경로','만족도','유용한점','추천의향','좋았던점','개선점','성별'];
const FIELDS = LEGACY.concat(['주선자','이름','출생연도','키','생활권','직업','같은회사제외','학교','MBTI','취미','음주','흡연','종교','이상형','제외조건','중요조건','연봉','자산','추천인','연락처','개인정보동의','개인정보동의일시']);
function json_(data) {return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function hash_(text){return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text));}
// Validation messages the applicant can act on are returned as-is; everything else stays generic.
function reject_(message){const error=Error(message);error.expose=true;return error;}
function safe_(value){const text=String(value==null?'':value);return /^[=+\-@]/.test(text)?"'"+text:text;}
function doPost(e){
 const lock=LockService.getScriptLock();
 try{
  const data=JSON.parse(e.postData.contents);
  if(data._action==='capabilities')return json_({ok:true,schemaVersion:2});
  if(data.website)throw Error('요청을 처리할 수 없습니다.');
  lock.waitLock(30000);
  const props=PropertiesService.getScriptProperties();
  const sheet=SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID')).getSheets()[0];
  let headers=sheet.getLastColumn()?sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0]:[];
  const required=FIELDS.concat(['신청ID','사진','심사상태','수정일시','접수토큰해시']);
  required.forEach(key=>{if(!headers.includes(key))headers.push(key);});
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  const id=String(data.신청ID||'');
  if(!/^[a-f0-9-]{36}$/.test(id))throw Error('유효한 신청번호가 필요합니다.');
  const idCol=headers.indexOf('신청ID')+1;
  const found=sheet.getLastRow()>1?sheet.getRange(2,idCol,sheet.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext():null;
  const row=found?found.getRow():null;
  const previous=row?sheet.getRange(row,1,1,headers.length).getValues()[0]:headers.map(()=> '');
  const read=k=>previous[headers.indexOf(k)];
  // Stable secret makes retries idempotent without storing raw receipt tokens.
  let secret=props.getProperty('RECEIPT_SECRET');
  if(!secret){secret=Utilities.getUuid()+Utilities.getUuid();props.setProperty('RECEIPT_SECRET',secret);}
  const token=Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(id,secret));
  if(data._action==='status'||data._action==='update'){
   if(!row||!data._token||hash_(String(data._token))!==read('접수토큰해시'))throw Error('신청 확인 정보가 올바르지 않습니다.');
  }
  if(data._action==='status'){
   const answers={};FIELDS.forEach(k=>answers[k]=read(k));
   answers.개인정보동의=read('개인정보동의')===true||read('개인정보동의')==='true';
   const photos=JSON.parse(read('사진')||'[]').map(item=>{const blob=DriveApp.getFileById(item.id).getBlob();return {name:item.name,type:blob.getContentType(),data:'data:'+blob.getContentType()+';base64,'+Utilities.base64Encode(blob.getBytes())};});
   return json_({ok:true,schemaVersion:2,status:read('심사상태'),answers,photos});
  }
  if(!['submit','update'].includes(data._action))throw Error('지원하지 않는 요청입니다.');
  if(row&&data._action==='submit')return json_({ok:true,schemaVersion:2,id,token});
  const mandatory=['성별','주선자','이름','출생연도','키','생활권','직업','학교','취미','음주','흡연','이상형','제외조건','중요조건','유입경로','연락처'];
  if(mandatory.some(k=>!String(data[k]||'').trim())||data.개인정보동의!==true)throw reject_('필수 입력 및 개인정보 동의를 확인해주세요.');
  if(!['여성','남성'].includes(data.성별)||!['f','m'].includes(data.주선자))throw reject_('선택값을 확인해주세요.');
  if(!/^01[016789]\d{7,8}$/.test(String(data.연락처).replace(/[-\s]/g,'')))throw reject_('연락처를 확인해주세요.');
  if(!Number.isInteger(Number(data.출생연도))||Number(data.출생연도)<1900||Number(data.출생연도)>new Date().getFullYear()-19||Number(data.키)<100||Number(data.키)>250)throw reject_('출생연도와 키를 확인해주세요.');
  FIELDS.forEach(k=>{if(String(data[k]||'').length>2000)throw reject_('입력 가능한 길이를 초과했습니다.');});
  if(!Array.isArray(data.사진)||data.사진.length<3||data.사진.length>5)throw reject_('사진은 3~5장 필요합니다.');
  const blobs=data.사진.map((photo,i)=>{
   const match=String(photo.data||'').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
   if(!match||match[2].length>7*1024*1024)throw reject_('사진 형식(JPG, PNG, WebP) 또는 크기를 확인해주세요.');
   const bytes=Utilities.base64Decode(match[2]);
   if(bytes.length>5*1024*1024)throw reject_('사진은 한 장당 5MB 이하만 가능합니다.');
   return Utilities.newBlob(bytes,match[1],id+'-'+(i+1));
  });
  let folderId=props.getProperty('PHOTO_FOLDER_ID');
  if(!folderId){const folder=DriveApp.createFolder('친친소 비공개 신청 사진');folder.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);folderId=folder.getId();props.setProperty('PHOTO_FOLDER_ID',folderId);}
  const folder=DriveApp.getFolderById(folderId);
  if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE)throw Error('사진 저장 폴더의 비공개 설정이 필요합니다.');
  const created=[];
  try{
   blobs.forEach((blob,i)=>{const file=folder.createFile(blob);created.push({id:file.getId(),name:String(data.사진[i].name||'사진').slice(0,200)});file.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);});
   const values=previous.slice();
   const put=(k,v)=>values[headers.indexOf(k)]=v;
   FIELDS.forEach(k=>put(k,safe_(data[k])));
   put('신청ID',id);put('사진',JSON.stringify(created));put('심사상태','pending');put('수정일시',new Date().toISOString());put('접수토큰해시',hash_(token));
   sheet.getRange(row||sheet.getLastRow()+1,1,1,headers.length).setValues([values]);
  }catch(err){created.forEach(p=>{try{DriveApp.getFileById(p.id).setTrashed(true);}catch{}});throw err;}
  // Clean up replaced images only after the new record is saved successfully.
  if(row)JSON.parse(read('사진')||'[]').forEach(p=>{try{DriveApp.getFileById(p.id).setTrashed(true);}catch{}});
  return json_({ok:true,schemaVersion:2,id,token});
 }catch(error){console.error(error);return json_({ok:false,schemaVersion:2,error:error.expose?error.message:'저장 또는 조회를 완료하지 못했습니다. 입력값을 확인하거나 운영자에게 문의해주세요.'});}
 finally{if(lock.hasLock())lock.releaseLock();}
}
