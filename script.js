(() => {
'use strict';

let display, livePreview, calcNote, savedModal, editModal, downloadModal, settingsModal, savedList, suggestionsBox;
let savedRecords = [];
let editingRecordId = null;
let expressionState = '';
let soundEnabled = localStorage.getItem('wm_calc_sound') !== 'false';
let currentTheme = localStorage.getItem('wm_calc_theme') || 'theme-dark';

const STORAGE_KEY = 'wm_calculator_records_v3';
const VOLUME_KEY = 'wm_calc_volume';
let audioCtx = null, masterGain = null, isAudioPlaying = false, audioLoopTimer = null;
let currentSongIndex = 0, currentPatternIndex = 0;

const songPlaylist = [
    {title:'2026 Sinhala Hit 01 - මාගෙ ආදරේ',speed:380,pattern:[261.63,329.63,392,523.25,392,329.63]},
    {title:'2026 Sinhala Hit 02 - හිතට දැනෙනා',speed:320,pattern:[293.66,349.23,440,587.33,440,349.23]},
    {title:'2026 Sinhala Hit 03 - සුළඟක් වී',speed:420,pattern:[329.63,392,493.88,659.25,493.88,392]}
];

document.addEventListener('DOMContentLoaded', initApp);

function initApp(){
    display=q('display'); livePreview=q('live-preview'); calcNote=q('calc-note');
    savedModal=q('saved-modal'); editModal=q('edit-modal'); downloadModal=q('download-modal');
    settingsModal=q('settings-modal'); savedList=q('saved-list'); suggestionsBox=q('custom-suggestions');

    try{
        const raw=JSON.parse(localStorage.getItem(STORAGE_KEY));
        savedRecords=Array.isArray(raw)?raw.map(normalizeRecord).filter(Boolean):[];
    }catch{savedRecords=[]}

    applyTheme(currentTheme,false);
    q('theme-select').value=currentTheme;
    q('sound-toggle').checked=soundEnabled;
    q('player-volume').value=localStorage.getItem(VOLUME_KEY) ?? '0.5';

    updateClock(); setInterval(updateClock,1000);
    bindCalculator();
    bindActions();
    bindSettings();
    bindModalBehavior();
    setupSearchableSuggestions();
    updatePlayerUI();
    updateExpressionStatus();
}

function q(id){return document.getElementById(id)}

function normalizeRecord(r){
    if(!r || typeof r!=='object') return null;
    const value=Number(String(r.expression??'').replace(/,/g,''));
    if(!Number.isFinite(value)) return null;
    return {
        id:Number(r.id)||Date.now()+Math.floor(Math.random()*1000),
        date:String(r.date||''),
        time:String(r.time||''),
        note:String(r.note||'General Calculation').trim()||'General Calculation',
        expression:String(value)
    };
}

function showToast(message,type='success',duration=3000){
    const container=q('toast-container');
    const toast=document.createElement('div');
    const icons={success:'✨',error:'❌',warning:'⚠️',info:'ℹ️'};
    toast.className=`animated-toast toast-${type}`;
    toast.style.setProperty('--duration',`${duration}ms`);
    const icon=document.createElement('div'); icon.className='toast-icon'; icon.textContent=icons[type]||'✨';
    const msg=document.createElement('div'); msg.className='toast-message'; msg.textContent=message;
    const progress=document.createElement('div'); progress.className='toast-progress';
    toast.append(icon,msg,progress); container.appendChild(toast);
    setTimeout(()=>{toast.style.opacity='0';toast.style.transform='translateY(-10px)';setTimeout(()=>toast.remove(),250)},duration);
}

function showConfirmDialog(title,message,onConfirm){
    const overlay=document.createElement('div'); overlay.className='custom-alert-overlay';
    const box=document.createElement('div'); box.className='custom-alert-box';
    box.innerHTML=`<div class="custom-alert-icon">⚠️</div><div class="custom-alert-title"></div><div class="custom-alert-msg"></div>
    <div class="custom-alert-actions"><button class="custom-alert-btn btn-alert-cancel">අවලංගු කරන්න</button><button class="custom-alert-btn btn-alert-confirm">ඔව්, කරන්න</button></div>`;
    box.querySelector('.custom-alert-title').textContent=title;
    box.querySelector('.custom-alert-msg').textContent=message;
    overlay.appendChild(box); document.body.appendChild(overlay);
    box.querySelector('.btn-alert-cancel').onclick=()=>overlay.remove();
    box.querySelector('.btn-alert-confirm').onclick=()=>{overlay.remove();onConfirm()};
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});
}

function playClickSound(){
    if(!soundEnabled)return;
    if(navigator.vibrate)navigator.vibrate(10);
    try{
        const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
        const ctx=new C(),osc=ctx.createOscillator(),gain=ctx.createGain();
        osc.frequency.value=720;gain.gain.value=.035;gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.045);
        osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.045);
    }catch{}
}

function bindCalculator(){
    q('app-shell').querySelector('.buttons').addEventListener('click',e=>{
        const btn=e.target.closest('button');if(!btn)return;
        playClickSound();
        const val=btn.dataset.val, action=btn.dataset.action;
        if(val!==undefined)appendCharacter(val);
        else if(action==='clear')clearCalculator();
        else if(action==='delete')deleteLastChar();
        else if(action==='calculate')calculateResult();
    });

    document.addEventListener('keydown',e=>{
        if(isModalOpen())return;
        const key=e.key;
        if(/^[0-9.]$/.test(key)){e.preventDefault();appendCharacter(key)}
        else if(['+','-','*','/'].includes(key)){e.preventDefault();appendCharacter(key)}
        else if(key==='Enter'||key==='='){e.preventDefault();calculateResult()}
        else if(key==='Backspace'){e.preventDefault();deleteLastChar()}
        else if(key==='Escape'){e.preventDefault();clearCalculator()}
    });
    q('copy-result-btn').addEventListener('click',copyResult);
}

function clearCalculator(){
    expressionState='';display.value='';livePreview.textContent='';updateExpressionStatus();
}

function appendCharacter(char){
    if(display.value==='Error'||display.value==='Cannot calculate')clearCalculator();
    const current=expressionState;
    const operators=['+','-','*','/'];
    if(operators.includes(char)){
        if(!current)return;
        if(operators.includes(current.slice(-1)))expressionState=current.slice(0,-1)+char;
        else expressionState=current+char;
    }else if(char==='.'){
        const parts=expressionState.split(/[+\-*/]/);
        const last=parts[parts.length-1];
        if(last.includes('.'))return;
        expressionState=current?current+'.': '0.';
    }else{
        if(current==='0')expressionState=char;else expressionState=current+char;
    }
    display.value=expressionState.replace(/\*/g,'×').replace(/\//g,'÷');
    updateLivePreview();updateExpressionStatus();
}

function deleteLastChar(){
    if(display.value==='Error'){clearCalculator();return}
    expressionState=expressionState.slice(0,-1);
    display.value=expressionState.replace(/\*/g,'×').replace(/\//g,'÷');
    updateLivePreview();updateExpressionStatus();
}

function tokenize(expr){
    const s=expr.replace(/,/g,'').replace(/×/g,'*').replace(/÷/g,'/').replace(/\s+/g,'');
    if(!s)return [];
    if(!/^[0-9+\-*/.]+$/.test(s))throw new Error('Invalid characters');
    const tokens=[];let i=0;
    while(i<s.length){
        const ch=s[i];
        if(/[0-9.]/.test(ch)){
            let num='',dots=0;
            while(i<s.length&&/[0-9.]/.test(s[i])){if(s[i]==='.')dots++;num+=s[i++];}
            if(dots>1||num==='.')throw new Error('Invalid number');
            tokens.push({type:'number',value:Number(num)});
        }else if('+-*/'.includes(ch)){tokens.push({type:'op',value:ch});i++}
        else throw new Error('Invalid expression');
    }
    return tokens;
}

function evaluateExpression(expr){
    const t=tokenize(expr);if(!t.length)throw new Error('Empty');
    let pos=0;
    function parsePrimary(){
        if(pos>=t.length)throw new Error('Missing number');
        if(t[pos].type==='op'&&t[pos].value==='-'){pos++;return -parsePrimary()}
        if(t[pos].type!=='number')throw new Error('Expected number');
        return t[pos++].value;
    }
    function parseMul(){
        let v=parsePrimary();
        while(pos<t.length&&t[pos].type==='op'&&['*','/'].includes(t[pos].value)){
            const op=t[pos++].value,b=parsePrimary();
            if(op==='/'&&b===0)throw new Error('Division by zero');
            v=op==='*'?v*b:v/b;
        }return v;
    }
    function parseAdd(){
        let v=parseMul();
        while(pos<t.length&&t[pos].type==='op'&&['+','-'].includes(t[pos].value)){
            const op=t[pos++].value,b=parseMul();v=op==='+'?v+b:v-b;
        }return v;
    }
    const result=parseAdd();if(pos!==t.length)throw new Error('Invalid expression');
    if(!Number.isFinite(result))throw new Error('Invalid result');
    return result;
}

function formatNumber(n){
    if(!Number.isFinite(n))return 'Error';
    const rounded=Math.round((n+Number.EPSILON)*1e10)/1e10;
    return rounded.toLocaleString('en-US',{maximumFractionDigits:10});
}

function updateLivePreview(){
    if(!expressionState){livePreview.textContent='';return}
    try{livePreview.textContent='= '+formatNumber(evaluateExpression(expressionState))}catch{livePreview.textContent=''}
}

function calculateResult(){
    if(!expressionState)return;
    try{
        const result=evaluateExpression(expressionState);
        display.value=formatNumber(result);
        expressionState=String(Math.round((result+Number.EPSILON)*1e10)/1e10);
        livePreview.textContent='';
        q('expression-status').textContent='Calculated';
        playClickSound();
    }catch(e){
        display.value=e.message==='Division by zero'?'Cannot calculate':'Error';
        livePreview.textContent='';
        q('expression-status').textContent='Error';
        showToast(e.message==='Division by zero'?'Zero වලින් බෙදන්න බැහැ.':'කරුණාකර නිවැරදි calculation එකක් ඇතුළත් කරන්න.','error');
    }
}

function updateExpressionStatus(){
    q('expression-status').textContent=expressionState?'Typing':'Ready';
}

function copyResult(){
    const text=display.value.trim();if(!text)return showToast('Copy කිරීමට value එකක් නැහැ.','warning');
    navigator.clipboard?.writeText(text).then(()=>showToast('Result copied!','success')).catch(()=>showToast('Copy කිරීමට නොහැකි විය.','error'));
}

function bindActions(){
    q('save-btn').addEventListener('click',saveCurrentRecord);
    q('view-btn').addEventListener('click',openHistory);
    q('download-btn').addEventListener('click',openExport);
    q('nav-calc').addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
    q('nav-history').addEventListener('click',openHistory);
    q('nav-export').addEventListener('click',openExport);
    q('nav-settings').addEventListener('click',()=>openModal(settingsModal));
    q('clear-all-btn').addEventListener('click',clearAllRecords);
    q('history-search').addEventListener('input',renderHistory);
    q('close-modal-btn').addEventListener('click',()=>closeModal(savedModal));
    q('close-edit-btn').addEventListener('click',()=>closeModal(editModal));
    q('cancel-edit-btn').addEventListener('click',()=>closeModal(editModal));
    q('save-edit-btn').addEventListener('click',saveEditedRecord);
    q('close-download-btn').addEventListener('click',()=>closeModal(downloadModal));
    q('cancel-download-btn').addEventListener('click',()=>closeModal(downloadModal));
    q('confirm-download-btn').addEventListener('click',()=>processExport(false));
    q('confirm-share-btn').addEventListener('click',()=>processExport(true));
}

function saveCurrentRecord(){
    const raw=expressionState||display.value.trim().replace(/,/g,'');
    if(!raw||raw==='Error'||raw==='Cannot calculate')return showToast('කරුණාකර නිවැරදි calculation එකක් ඇතුළත් කරන්න!','warning');
    let newValue;
    try{newValue=evaluateExpression(raw)}catch{newValue=Number(raw)}
    if(!Number.isFinite(newValue))return showToast('Value එක නිවැරදි නැහැ.','error');
    const note=calcNote.value.trim()||'General Calculation';
    const now=new Date(),date=now.toISOString().slice(0,10),time=now.toLocaleTimeString();
    const idx=savedRecords.findIndex(r=>r.note.toLowerCase()===note.toLowerCase());
    if(idx>=0){
        const updated=Number(savedRecords[idx].expression)+newValue;
        savedRecords[idx]={...savedRecords[idx],expression:String(updated),date,time};
        showToast(`'${note}' සඳහා අගය එකතු විය. Total: ${formatNumber(updated)}`,'info');
    }else{
        savedRecords.push({id:Date.now()+Math.floor(Math.random()*1000),date,time,note,expression:String(newValue)});
        showToast('Data Saved Successfully!','success');
    }
    saveToStorage();clearCalculator();calcNote.value='';suggestionsBox.classList.add('hidden');
}

function openHistory(){renderHistory();openModal(savedModal);setNav('nav-history')}
function openExport(){
    if(!savedRecords.length)return showToast('Export කිරීමට දත්ත නොමැත!','warning');
    q('export-filename').value=`WM_Report_${Date.now()}`;
    openModal(downloadModal);setNav('nav-export');
}
function openModal(modal){modal.classList.remove('hidden');document.body.style.overflow='hidden'}
function closeModal(modal){modal.classList.add('hidden');if(![savedModal,editModal,downloadModal,settingsModal].some(m=>!m.classList.contains('hidden')))document.body.style.overflow=''}
function isModalOpen(){return [savedModal,editModal,downloadModal,settingsModal].some(m=>m&&!m.classList.contains('hidden'))}

function bindModalBehavior(){
    [savedModal,editModal,downloadModal,settingsModal].forEach(modal=>{
        modal.addEventListener('click',e=>{if(e.target===modal)closeModal(modal)});
    });
    q('settings-btn').addEventListener('click',()=>{openModal(settingsModal);setNav('nav-settings')});
    document.addEventListener('keydown',e=>{if(e.key==='Escape') [savedModal,editModal,downloadModal,settingsModal].forEach(m=>m.classList.contains('hidden')||closeModal(m))});
}

function renderHistory(){
    savedList.innerHTML='';
    const search=q('history-search').value.trim().toLowerCase();
    const filtered=savedRecords.filter(r=>r.note.toLowerCase().includes(search)||r.expression.includes(search));
    let total=0;
    filtered.slice().reverse().forEach(item=>{
        const value=Number(item.expression);total+=value;
        const wrapper=document.createElement('div');wrapper.className='saved-item-wrapper';
        const left=document.createElement('div');left.className='swipe-background swipe-bg-left';left.textContent='✏️ Edit';
        const right=document.createElement('div');right.className='swipe-background swipe-bg-right';right.textContent='🗑️ Delete';
        const card=document.createElement('div');card.className='saved-item';
        card.innerHTML='<div class="saved-item-header"><span class="saved-item-title"></span><span class="saved-item-date"></span></div><div class="saved-item-body"><span class="saved-item-label">අගය</span><span class="saved-item-result"></span></div>';
        card.querySelector('.saved-item-title').textContent=item.note;
        card.querySelector('.saved-item-date').textContent=`${item.date} • ${item.time}`;
        card.querySelector('.saved-item-result').textContent=formatNumber(value);
        wrapper.append(left,right,card);setupSwipeGesture(card,item);savedList.appendChild(wrapper);
    });
    if(!filtered.length){const empty=document.createElement('div');empty.className='empty-state';empty.textContent=search?'සෙවීමට අදාල දත්ත හමු නොවුණි.':'තවම Saved History එකක් නැහැ.';savedList.appendChild(empty)}
    q('history-total-val').textContent=formatNumber(total);
    q('history-count-val').textContent=filtered.length;
}

function setupSwipeGesture(element,item){
    let startX=0,currentX=0,moved=false,pointerId=null;
    const start=e=>{if(e.pointerType==='mouse'&&e.button!==0)return;startX=e.clientX;currentX=0;moved=false;pointerId=e.pointerId;element.style.transition='none';element.setPointerCapture?.(pointerId)};
    const move=e=>{if(pointerId!==e.pointerId)return;currentX=e.clientX-startX;if(Math.abs(currentX)>6)moved=true;currentX=Math.max(-100,Math.min(100,currentX));element.style.transform=`translateX(${currentX}px)`};
    const end=()=>{
        element.style.transition='transform .18s';
        if(currentX>60){element.style.transform='translateX(0)';openEdit(item)}
        else if(currentX<-60){element.style.transform='translateX(0)';confirmDelete(item)}
        else element.style.transform='translateX(0)';
        currentX=0;pointerId=null;
    };
    element.addEventListener('pointerdown',start);element.addEventListener('pointermove',move);element.addEventListener('pointerup',end);element.addEventListener('pointercancel',end);
    element.addEventListener('click',()=>{if(!moved)openEdit(item)});
}

function openEdit(item){
    editingRecordId=item.id;q('edit-note').value=item.note;q('edit-expression').value=item.expression;openModal(editModal);
}

function confirmDelete(item){
    showConfirmDialog('මකා දැමීම',`'${item.note}' දත්තය මකා දැමීමට නිසැකද?`,()=>{
        savedRecords=savedRecords.filter(r=>r.id!==item.id);saveToStorage();renderHistory();showToast('දත්තය මකා දමන ලදී!','info');
    });
}

function saveEditedRecord(){
    if(editingRecordId===null)return;
    const note=q('edit-note').value.trim()||'General Calculation';
    const value=Number(q('edit-expression').value.replace(/,/g,''));
    if(!Number.isFinite(value))return showToast('Value එක නිවැරදි නැහැ.','error');
    const duplicate=savedRecords.find(r=>r.id!==editingRecordId&&r.note.toLowerCase()===note.toLowerCase());
    if(duplicate){
        return showConfirmDialog('Duplicate Note',`'${note}' දැනටමත් තිබෙනවා. Values දෙක එකතු කරලා එක record එකක් කරන්නද?`,()=>{
            duplicate.expression=String(Number(duplicate.expression)+value);
            savedRecords=savedRecords.filter(r=>r.id!==editingRecordId);
            saveToStorage();closeModal(editModal);renderHistory();showToast('Records merged successfully.','success');
        });
    }
    savedRecords=savedRecords.map(r=>r.id===editingRecordId?{...r,note,expression:String(value)}:r);
    saveToStorage();closeModal(editModal);renderHistory();showToast('සංස්කරණය සාර්ථකයි!','success');editingRecordId=null;
}

function clearAllRecords(){
    if(!savedRecords.length)return showToast('මකා දැමීමට data නැහැ.','info');
    showConfirmDialog('සියල්ල මකා දැමීම','Saved History එකේ සියලුම data මකා දැමීමට ඔබට විශ්වාසද?',()=>{
        savedRecords=[];saveToStorage();renderHistory();showToast('History සාර්ථකව මකා දැමීය!','info');
    });
}

function saveToStorage(){localStorage.setItem(STORAGE_KEY,JSON.stringify(savedRecords))}

function generateExportHTML(title){
    let total=0;
    const rows=savedRecords.map((r,i)=>{
        const v=Number(r.expression);total+=v;
        return `<tr><td>${escapeHTML(r.date)}<br><small>${escapeHTML(r.time)}</small></td><td>${escapeHTML(r.note)}</td><td>${formatNumber(v)}</td></tr>`;
    }).join('');
    return `<div style="font-family:Arial,sans-serif;padding:28px;color:#172033;background:#fff;max-width:780px;margin:auto">
    <div style="display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #ff9800;padding-bottom:16px;margin-bottom:20px">
      <div><h1 style="margin:0;font-size:25px">WM CALCULATOR PRO</h1><p style="color:#667085;margin:5px 0 0">Calculation Statement & History Report</p></div>
      <div style="text-align:right;color:#667085;font-size:12px"><div>Date: ${escapeHTML(new Date().toLocaleDateString())}</div><div>Total Records: ${savedRecords.length}</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse"><thead><tr style="background:#172033;color:#fff"><th style="padding:11px;text-align:left">Date & Time</th><th style="padding:11px;text-align:left">Description</th><th style="padding:11px;text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div style="margin-top:20px;text-align:right"><strong style="display:block;color:#c2410c">GRAND TOTAL</strong><span style="font-size:25px;font-weight:800">${formatNumber(total)}</span></div>
    <div style="border-top:1px solid #ddd;margin-top:30px;padding-top:12px;text-align:center;color:#777;font-size:11px">WM Calculator Pro</div>
    </div>`;
}

async function processExport(isShare=false){
    const fname=(q('export-filename').value.trim()||'WM_Report').replace(/[\\/:*?"<>|]+/g,'_');
    const format=q('export-format').value;
    try{
        let blob=null,mime='text/plain',extension=format;
        if(format==='pdf'){
            if(!window.html2pdf)throw new Error('PDF library unavailable');
            const temp=document.createElement('div');temp.innerHTML=generateExportHTML(fname);
            const opt={margin:8,filename:`${fname}.pdf`,image:{type:'jpeg',quality:.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}};
            if(isShare)blob=await html2pdf().set(opt).from(temp).output('blob');
            else{await html2pdf().set(opt).from(temp).save();closeModal(downloadModal);showToast('PDF Download සාර්ථකයි!','success');return}
            mime='application/pdf';
        }else if(format==='html'){
            mime='text/html';blob=new Blob([`<!doctype html><html><head><meta charset="UTF-8"><title>${escapeHTML(fname)}</title></head><body>${generateExportHTML(fname)}</body></html>`],{type:mime});
        }else if(format==='xml'){
            mime='text/xml';extension='xml';
            const xml=savedRecords.map(r=>`<record><date>${escapeXML(r.date)}</date><time>${escapeXML(r.time)}</time><note>${escapeXML(r.note)}</note><value>${escapeXML(r.expression)}</value></record>`).join('');
            blob=new Blob([`<?xml version="1.0" encoding="UTF-8"?><records>${xml}</records>`],{type:mime});
        }else{
            mime='application/msword';extension='doc';
            const text=`WM CALCULATOR PRO\\n\\n${savedRecords.map(r=>`[${r.date} ${r.time}] ${r.note}: ${r.expression}`).join('\\n')}\\n\\nGRAND TOTAL: ${formatNumber(savedRecords.reduce((a,r)=>a+Number(r.expression),0))}`;
            blob=new Blob([text],{type:mime});
        }
        if(isShare&&blob){
            const file=new File([blob],`${fname}.${extension}`,{type:mime});
            if(navigator.share&&navigator.canShare?.({files:[file]})){
                try{await navigator.share({files:[file],title:fname,text:'WM Calculator History Report'});showToast('Share කිරීම සාර්ථකයි!','success')}
                catch(e){if(e.name!=='AbortError')downloadBlob(blob,`${fname}.${extension}`)}
            }else downloadBlob(blob,`${fname}.${extension}`);
        }else if(blob)downloadBlob(blob,`${fname}.${extension}`);
        closeModal(downloadModal);
    }catch(e){showToast(`Export failed: ${e.message}`,'error')}
}

function downloadBlob(blob,filename){
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);showToast('Download Completed!','success');
}

function exportBackupJSON(){
    const payload={version:3,exportedAt:new Date().toISOString(),records:savedRecords};
    downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`wm_calc_backup_${Date.now()}.json`);
}

function importBackupJSON(e){
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
        try{
            const parsed=JSON.parse(ev.target.result);
            const data=Array.isArray(parsed)?parsed:parsed.records;
            if(!Array.isArray(data))throw new Error('Invalid backup');
            const imported=data.map(normalizeRecord).filter(Boolean);
            if(!imported.length&&data.length)throw new Error('No valid records');
            showConfirmDialog('Restore Backup',`${imported.length} records restore කරන්නද?`,()=>{
                const map=new Map(savedRecords.map(r=>[r.id,r]));
                imported.forEach(r=>map.set(r.id,r));savedRecords=[...map.values()];saveToStorage();renderHistory();showToast('Backup restored successfully!','success');
            });
        }catch{showToast('Invalid Backup File!','error')}
        e.target.value='';
    };
    reader.readAsText(file);
}

function setupSearchableSuggestions(){
    const show=text=>{
        const term=text.toLowerCase();
        const unique=[...new Set(savedRecords.map(r=>r.note))].filter(n=>n.toLowerCase().includes(term)).slice(0,8);
        suggestionsBox.innerHTML='';
        if(!unique.length){suggestionsBox.classList.add('hidden');return}
        unique.forEach(n=>{const d=document.createElement('div');d.className='suggestion-item';d.textContent=n;d.onclick=()=>{calcNote.value=n;suggestionsBox.classList.add('hidden')};suggestionsBox.appendChild(d)});
        suggestionsBox.classList.remove('hidden');
    };
    calcNote.addEventListener('focus',()=>show(calcNote.value));calcNote.addEventListener('input',()=>show(calcNote.value));
    document.addEventListener('click',e=>{if(!calcNote.contains(e.target)&&!suggestionsBox.contains(e.target))suggestionsBox.classList.add('hidden')});
}

function bindSettings(){
    q('theme-select').addEventListener('change',e=>applyTheme(e.target.value,true));
    q('sound-toggle').addEventListener('change',e=>{soundEnabled=e.target.checked;localStorage.setItem('wm_calc_sound',String(soundEnabled))});
    q('player-volume').addEventListener('input',e=>{localStorage.setItem(VOLUME_KEY,e.target.value);initAudioContext();if(masterGain)masterGain.gain.setValueAtTime(Number(e.target.value),audioCtx.currentTime)});
    q('player-play-btn').addEventListener('click',()=>isAudioPlaying?stopMusic():startMusic());
    q('player-next-btn').addEventListener('click',()=>changeSong(1));
    q('player-prev-btn').addEventListener('click',()=>changeSong(-1));
    q('export-json-btn').addEventListener('click',exportBackupJSON);
    q('import-json-btn').addEventListener('click',()=>q('import-file-input').click());
    q('import-file-input').addEventListener('change',importBackupJSON);
    q('close-settings-btn').addEventListener('click',()=>closeModal(settingsModal));
    q('close-settings-x').addEventListener('click',()=>closeModal(settingsModal));
}

function applyTheme(theme,notify=true){
    const allowed=['theme-dark','theme-light','theme-neon','theme-emerald'];
    if(!allowed.includes(theme))theme='theme-dark';
    currentTheme=theme;document.body.className=theme;localStorage.setItem('wm_calc_theme',theme);
    if(q('theme-select'))q('theme-select').value=theme;
    if(notify)showToast('Theme updated!','success',1600);
}

function initAudioContext(){
    if(!audioCtx){
        const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
        audioCtx=new C();masterGain=audioCtx.createGain();masterGain.gain.value=Number(q('player-volume').value)||.5;masterGain.connect(audioCtx.destination);
    }
    if(audioCtx.state==='suspended')audioCtx.resume();
}

function startMusic(){initAudioContext();if(!audioCtx)return;if(!isAudioPlaying){isAudioPlaying=true;updatePlayerUI();playNextMelodyStep()}}
function stopMusic(){isAudioPlaying=false;if(audioLoopTimer)clearTimeout(audioLoopTimer);audioLoopTimer=null;triggerVisualizer();updatePlayerUI()}
function changeSong(step){currentSongIndex=(currentSongIndex+step+songPlaylist.length)%songPlaylist.length;currentPatternIndex=0;updatePlayerUI()}
function updatePlayerUI(){q('player-song-title').textContent=songPlaylist[currentSongIndex].title;q('player-play-btn').textContent=isAudioPlaying?'⏸':'▶'}
function triggerVisualizer(){document.querySelectorAll('.v-bar').forEach(b=>b.style.height=isAudioPlaying?`${5+Math.floor(Math.random()*20)}px`:'4px')}
function playNextMelodyStep(){
    if(!isAudioPlaying)return;initAudioContext();if(!audioCtx)return;
    const song=songPlaylist[currentSongIndex],freq=song.pattern[currentPatternIndex++%song.pattern.length];
    try{
        const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='triangle';osc.frequency.value=freq;
        gain.gain.setValueAtTime(.0001,audioCtx.currentTime);gain.gain.linearRampToValueAtTime(.08,audioCtx.currentTime+.04);gain.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+.45);
        osc.connect(gain);gain.connect(masterGain);osc.start();osc.stop(audioCtx.currentTime+.45);triggerVisualizer();
    }catch{}
    audioLoopTimer=setTimeout(playNextMelodyStep,song.speed);
}

function updateClock(){
    const now=new Date();q('current-date').textContent=now.toLocaleDateString('en-CA');q('current-time').textContent=now.toLocaleTimeString();
}
function setNav(id){document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.id===id))}
function escapeHTML(s){const d=document.createElement('div');d.textContent=String(s);return d.innerHTML}
function escapeXML(s){return String(s).replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]))}
})();