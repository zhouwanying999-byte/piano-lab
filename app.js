
'use strict';
const $ = id => document.getElementById(id);
const rh = [
  {midi:56, name:'G♯3', finger:1, hand:'right'},
  {midi:61, name:'C♯4', finger:3, hand:'right'},
  {midi:64, name:'E4', finger:5, hand:'right'}
];
const bass = [
  [{midi:37,name:'C♯2',finger:5,hand:'left'},{midi:49,name:'C♯3',finger:1,hand:'left'}],
  [{midi:35,name:'B1',finger:5,hand:'left'},{midi:47,name:'B2',finger:1,hand:'left'}]
];
const scoreXs = [
  [402,434,460,488,519,545,574,605,631,659,691,717],
  [792,822,850,877,908,935,964,993,1021,1049,1080,1106]
];
const bars = bass.map((left, i) => ({
  number:i+1, left, right:Array.from({length:12},(_,step)=>rh[step%3]),
  chord: i === 0
    ? {label:'i · C♯m',tones:'C♯–E–G♯',root:'C♯',bass:'C♯2',inversion:'小三和弦原位',function:'升 C 小调主功能，确立中心。',motion:'进入下一小节时，右手三音不变，低音下行全音。'}
    : {label:'i 延续 · C♯m/B',tones:'B–C♯–E–G♯',root:'C♯（上方主和弦）',bass:'B1',inversion:'B 不属于主三和弦。若读成 C♯m7/B，则是小七和弦第三转位。',function:'主和声延续，B 是下行低音。',motion:'听连贯的低音线，避免把 B 当作新和弦的根。'}
}));
let selected=0, activeChord=0, showChord=false, run=null, audio=null, serial=0;
const live = new Set(), keys = new Map(), measureButtons=[], chordButtons=[];
const names = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const nameFor = midi => names[midi%12] + (Math.floor(midi/12)-1);
const noteFor = midi => [...rh,...bass.flat()].find(n=>n.midi===midi)?.name ?? nameFor(midi);

function buildKeyboard(){
  const keyboard=$('keyboard');
  const pitches=Array.from({length:31},(_,i)=>i+35);
  const isBlack=midi=>[1,3,6,8,10].includes(midi%12);
  const whiteCount=pitches.filter(p=>!isBlack(p)).length;
  let whites=0;
  for(const midi of pitches){
    const black=isBlack(midi), key=document.createElement('button');
    const name=document.createElement('span'), finger=document.createElement('b');
    key.type='button'; key.className='key '+(black?'black':'white');
    key.dataset.midi=midi;
    if(black){key.style.left=(whites/whiteCount*100)+'%';key.style.width=(.61/whiteCount*100)+'%';}
    else whites++;
    name.textContent=noteFor(midi); key.append(name,finger);
    key.addEventListener('click',async()=>{
      try{const ac=await unlock(); tone(ac,midi,ac.currentTime,.4,.12); }
      catch{ status('浏览器未开启音频，请再次点按试听。'); }
    });
    keyboard.append(key); keys.set(midi,{key,name,finger});
  }
}
function displayNotes(notes=[]){
  for(const [midi,{key,name,finger}] of keys){
    const pressed=notes.filter(n=>n.midi===midi);
    for(const hand of ['left','right'])key.classList.toggle('on-'+hand,pressed.some(n=>n.hand===hand));
    key.setAttribute('aria-label',$('names').checked?noteFor(midi):'键盘键 '+(midi-34));
    name.hidden=!$('names').checked;
    finger.textContent=$('fingers').checked?pressed.map(n=>n.finger).join('/'):'';
  }
  const desc = ['left','right'].flatMap(hand=>{
    const handNotes=notes.filter(n=>n.hand===hand);
    if(!handNotes.length || (!$('names').checked && !$('fingers').checked))return [];
    const content=handNotes.map(n=>[$('names').checked?n.name:'',$('fingers').checked?'指法 '+n.finger:''].filter(Boolean).join(' · '));
    return [(hand==='left'?'左手 ':'右手 ')+content.join(' / ')];
  });
  $('current-notes').textContent=desc.join('　');
}
function allowed(hand){return $('hand').value==='both'||$('hand').value===hand;}
function playNotes(bar,step){return [...(allowed('left')?bar.left:[]),...(allowed('right')?[bar.right[step]]:[])];}
function paint(i,step){
  bars.forEach((_,j)=>$('measure-'+(j+1)).classList.toggle('active',i===j));
  measureButtons.forEach((b,j)=>b.setAttribute('aria-pressed',String(selected===j)));
  $('counter').textContent=step==null?'就绪':'第 '+(i+1)+' 小节 · 第 '+(Math.floor(step/3)+1)+' 组 · '+(step%3+1)+'/3';
  const cursor=$('cursor'); cursor.hidden=step==null;
  if(step!=null)cursor.style.left=((scoreXs[i][step]-192)/933*100)+'%';
  displayNotes(step==null?[]:playNotes(bars[i],step));
}
function status(text){$('status').textContent=text;}
async function unlock(){
  if(!audio){
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)throw Error('Web Audio unsupported');
    audio=new Context();
  }
  if(audio.state!=='running')await audio.resume();
  return audio;
}
function tone(ac,midi,at,duration,volume,group=null){
  const gain=ac.createGain();
  gain.connect(ac.destination);
  const end=at+duration, stopAt=end+.09;
  gain.gain.setValueAtTime(.0001,at);
  gain.gain.linearRampToValueAtTime(volume,at+.012);
  gain.gain.exponentialRampToValueAtTime(volume*.22,at+Math.max(.022,duration*.88));
  gain.gain.exponentialRampToValueAtTime(.0001,stopAt);
  const wave=ac.createOscillator();
  wave.type='triangle';wave.frequency.value=440*2**((midi-69)/12);wave.connect(gain);
  const entry={wave,gain,group}; live.add(entry);
  wave.onended=()=>{live.delete(entry);wave.disconnect();gain.disconnect();};
  wave.start(at);wave.stop(stopAt);
}
function cancelTones(group=null){
  for(const entry of live){
    if(group!==null && entry.group!==group)continue;
    entry.gain.disconnect();
    try{entry.wave.stop();}catch{}
    live.delete(entry);
  }
}
function reset(message='已停止。'){
  serial++;
  if(run)cancelAnimationFrame(run.frame);
  run=null;
  cancelTones();
  $('play').textContent='播放';
  paint(selected,null);status(message);
}
function pause(){
  if(!run)return;
  const r=run;
  const step=Math.max(0,Math.floor((audio.currentTime-r.at)/r.stepSeconds)+r.origin);
  cancelAnimationFrame(r.frame);cancelTones(r.group);
  run=null;serial++;
  paused={sequence:r.sequence,step: r.loop?step%12:Math.min(step,r.sequence.length*12-1), loop:r.loop};
  const i=r.sequence[Math.floor(paused.step/12)];
  paint(i,paused.step%12);displayNotes();
  $('play').textContent='继续';status('已暂停。继续时从当前三连音位置开始。');
}
let paused=null;
function stop(message){paused=null;reset(message);}
async function start(){
  if(run){pause();return;}
  const ticket=++serial;
  try{
    const ac=await unlock();
    if(ticket!==serial)return;
    const loop=$('loop').checked, sequence=paused?.sequence??(loop?[selected]:bars.map((_,i)=>i).slice(selected));
    const origin=paused?.step??0;
    paused=null;
    const r={at:ac.currentTime+.065,stepSeconds:60/(48*Number($('speed').value))/3,origin,next:origin,last:-1,frame:0,loop,sequence,group:ticket};
    run=r;$('play').textContent='暂停';status('正在播放。');
    const limit=loop?Infinity:sequence.length*12;
    function tick(){
      if(run!==r)return;
      const now=ac.currentTime;
      while(r.next<limit && r.at+(r.next-origin)*r.stepSeconds<now+.1){
        const index=r.next++, step=index%12, bar=bars[sequence[Math.floor(index/12)%sequence.length]];
        const begin=Math.max(now,r.at+(index-origin)*r.stepSeconds);
        if((step===0||index===origin)&&allowed('left')){
          for(const note of bar.left)tone(ac,note.midi,begin,(12-step)*r.stepSeconds-.02,.095,r.group);
        }
        if(allowed('right'))tone(ac,bar.right[step].midi,begin,r.stepSeconds*.74,.15,r.group);
      }
      const index=origin+Math.floor((now-r.at)/r.stepSeconds);
      if(index>=limit){stop('播放完成。');return;}
      if(index>=origin&&index!==r.last){
        r.last=index;paint(sequence[Math.floor(index/12)%sequence.length],index%12);
      }
      r.frame=requestAnimationFrame(tick);
    }
    tick();
  }catch{if(ticket===serial)stop('音频未能启动。请在浏览器中点按「播放」。');}
}
function updateHarmony(){
  const visible=$('harmony').checked;
  $('chord-panel').hidden=!visible;
  $('chord-detail').replaceChildren();
  if(!visible||!showChord)return;
  const chord=bars[activeChord].chord,dl=document.createElement('dl');
  for(const [term,value] of [
    ['构成音',chord.tones],['根音',chord.root],['最低音',chord.bass],['转位',chord.inversion],
    ['功能',chord.function],['连接',chord.motion]]){
    const dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=term;dd.textContent=value;dl.append(dt,dd);
  }
  $('chord-detail').append(dl);
}
bars.forEach((bar,i)=>{
  const button=document.createElement('button');
  button.type='button';button.textContent='第 '+bar.number+' 小节';
  button.addEventListener('click',()=>{selected=i;stop('已选择第 '+bar.number+' 小节。');});
  $('measure-buttons').append(button);measureButtons.push(button);
  const chord=document.createElement('button');
  chord.type='button';chord.textContent=bar.number+' 小节 · '+bar.chord.label;
  chord.addEventListener('click',()=>{
    showChord=!showChord||activeChord!==i;activeChord=i;
    chordButtons.forEach((b,j)=>b.setAttribute('aria-expanded',String(showChord&&i===j)));
    updateHarmony();
  });
  chord.setAttribute('aria-expanded','false');
  chord.setAttribute('aria-controls','chord-detail');
  $('chord-buttons').append(chord);chordButtons.push(chord);
});
const counter=document.createElement('span');counter.id='counter';counter.className='counter';$('measure-buttons').append(counter);
$('play').addEventListener('click',start);
$('stop').addEventListener('click',()=>stop());
for(const id of ['loop','speed','hand'])$(id).addEventListener('change',()=>stop('已更新播放设置。'));
for(const id of ['names','fingers'])$(id).addEventListener('change',()=>{
  if(run && run.last>=0)paint(run.sequence[Math.floor(run.last/12)%run.sequence.length],run.last%12);
  else displayNotes();
});
$('harmony').addEventListener('change',updateHarmony);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&run)pause();});
const questions = [
  {type:'识谱',prompt:'第 1 小节右手第一个音是什么？',answer:bars[0].right[0].name,choices:['G♯4',bars[0].right[0].name,'A3','C♯4'],why:'首音在中央 C 下方。调号把 G 升为 G♯。'},
  {type:'识谱',prompt:'第 2 小节开始时左手的两个实际音是什么？',answer:bass[1].map(n=>n.name).join('＋'),choices:['B2＋B3','C♯2＋C♯3','B1＋B2','A1＋A2'],why:'第二小节左手从 C♯ 八度下移到 B 八度。'},
  {type:'调号',prompt:'原谱的四个升号按什么顺序出现？',answer:'F♯ C♯ G♯ D♯',choices:['F♯ C♯ G♯ D♯','F♯ G♯ C♯ D♯','F♯ C♯ D♯ A♯','B♭ E♭ A♭ D♭'],why:'这里使用四个升号的调号。它也用于关系大调 E 大调。'},
  {type:'音程',prompt:'第 1 小节左手同时按下的两个 C♯ 相隔什么音程？',answer:'纯八度',choices:['纯五度','小三度','大七度','纯八度'],why:'同一音名相隔 12 个半音；这里是 C♯2 到 C♯3。'},
  {type:'音程',prompt:'右手 C♯4 到 E4 相隔什么音程？',answer:'小三度',choices:['大二度','小三度','大三度','纯四度'],why:'C 到 E 按字母数是三度，C♯ 到 E 有三个半音。'},
  {type:'和弦',prompt:'第 1 小节的主三和弦是什么？',answer:'C♯ 小三和弦',choices:['E 大三和弦','B 大三和弦','C♯ 小三和弦','C♯ 大三和弦'],why:'根音 C♯，上方有小三度 E 和纯五度 G♯。'},
  {type:'和弦',prompt:'第 2 小节低音变成 B 后，右手三连音怎样变化？',answer:'保持 G♯–C♯–E',choices:['保持 G♯–C♯–E','变成 B–D♯–F♯','变成 A–C♯–E','右手停止'],why:'这里右手仍呈示主三和弦音，变化发生在低音声部。'}
];
let questionIndex=0;
function quiz(){
  const q=questions[questionIndex];
  $('quiz-progress').textContent=(questionIndex+1)+' / '+questions.length;
  $('question').textContent=q.type+' · '+q.prompt;
  $('choices').replaceChildren();$('feedback').textContent='';
  for(const choice of q.choices){
    const b=document.createElement('button');b.type='button';b.textContent=choice;
    b.addEventListener('click',()=>{
      const correct=choice===q.answer;
      b.classList.add(correct?'correct':'wrong');
      $('feedback').textContent=(correct?'正确。':'再试一次。')+(correct?q.why:'');
      if(correct)for(const button of $('choices').children)button.disabled=true;
    });
    $('choices').append(b);
  }
  $('next').textContent=questionIndex===questions.length-1?'回到第一题':'下一题';
}
$('next').addEventListener('click',()=>{questionIndex=(questionIndex+1)%questions.length;quiz();});
buildKeyboard();paint(0,null);updateHarmony();quiz();

function engraveExcerpt(){
  const canvas=$('notation'), ctx=canvas.getContext('2d');
  ctx.scale(2,2);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,933,390);
  ctx.fillStyle='#202c30';ctx.strokeStyle='#202c30';ctx.lineWidth=1;
  function line(x,y,x2,y2){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
  function text(value,x,y,font){ctx.font=font;ctx.fillText(value,x,y);}
  function note(x,y,hollow=false){
    ctx.beginPath();ctx.ellipse(x,y,hollow?8:7,hollow?5:4.6,-.18,0,Math.PI*2);
    if(hollow){ctx.lineWidth=2;ctx.stroke();ctx.lineWidth=1;}else ctx.fill();
  }
  text('Adagio sostenuto',28,35,'italic 24px Georgia, serif');
  for(const top of [86,290])for(let i=0;i<5;i++)line(28,top+13*i,918,top+13*i);
  for(const x of [28,569,918])line(x,86,x,342);
  text('𝄞',31,146,'64px "Apple Symbols", "Noto Music", serif');
  text('𝄢',34,332,'43px "Apple Symbols", "Noto Music", serif');
  const keyXs=[83,99,115,131], treble=[86,106,80,99], low=[304,323,297,316];
  keyXs.forEach((x,i)=>{text('♯',x,treble[i]+7,'22px serif');text('♯',x,low[i]+7,'22px serif');});
  for(const y of [122,325]){
    text('C',152,y,'32px Georgia, serif');
    line(163,y-29,163,y+5);
  }
  for(let bar=0;bar<bars.length;bar++){
    const starts=scoreXs[bar].map(x=>x-192);
    const trebleY={56:170.5,61:151,64:138};
    bars[bar].right.forEach(({midi},step)=>{
      const x=starts[step],y=trebleY[midi],head=step-step%3,first=starts[head],last=starts[head+2];
      if(midi!==64)line(x-12,151,x+12,151);
      if(midi===56)line(x-12,164,x+12,164);
      note(x,y);line(x+6,y,x+6,107-(x-first)/(last-first)*11);
      if(step%3===0){
        ctx.lineWidth=5;line(first+6,107,last+6,96);ctx.lineWidth=1;
        text('3',(first+last)/2,82,'italic 17px Georgia, serif');
      }
    });
    const x=starts[0],y=bar===0?368:374.5;
    line(x-12,355,x+12,355);
    line(x-12,368,x+12,368);
    note(x,y,true);note(x,bar===0?322.5:329,true);
  }
  text('pp',204,220,'italic bold 27px Georgia, serif');
}

engraveExcerpt();
const offlineStatus=$('offline-status');
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
  navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{
    offlineStatus.textContent='离线教材已就绪。可通过浏览器菜单安装或添加到主屏幕。';
  }).catch(()=>{offlineStatus.textContent='离线缓存未启用，仍可在线练习。';});
}else{
  offlineStatus.textContent='当前为文件预览。通过 HTTPS 或本机预览地址打开可启用离线安装。';
}
