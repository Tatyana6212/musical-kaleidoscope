import {MusicParameters,Player} from './audio.js';
import {Visual} from './visual.js';
import {ShowDirector} from './director.js';
import {Artist} from './artist.js';
import {ShowRecorder} from './recorder.js';

const $=id=>document.getElementById(id),bus=new MusicParameters(),player=new Player(bus),recorder=new ShowRecorder();
const experience=$('experience');
let messageTimer,revealTimer,currentShape=0,visual,artist,recordStarting=false;
function message(text){$('message').textContent=text;$('message').classList.add('show');clearTimeout(messageTimer);messageTimer=setTimeout(()=>$('message').classList.remove('show'),6000);}
try{visual=new Visual($('stage'),label=>$('quality').textContent=label);}catch(e){const error=document.createElement('p');error.className='error-screen';error.textContent='Для визуализации нужен WebGL 2. Включите аппаратное ускорение и откройте приложение в современном браузере.';$('stage').append(error);console.error(e);}

const director=new ShowDirector((shape,style)=>{selectShape(shape,false);visual?.kaleidoscope.select(style,false);},enabled=>{
 $('auto-show').classList.toggle('selected',enabled);$('auto-show').setAttribute('aria-pressed',String(enabled));
 if(visual)visual.kaleidoscope.auto=enabled;
});
function selectShape(index,manual=true){
 currentShape=index;director.currentShape=index;if(manual)director.setAuto(false);visual?.setShape(index);
 document.querySelectorAll('[data-shape]').forEach(b=>{const selected=Number(b.dataset.shape)===index;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
}
document.querySelectorAll('[data-shape]').forEach(b=>b.addEventListener('click',()=>selectShape(Number(b.dataset.shape))));
$('auto-show').onclick=()=>{director.setAuto(!director.enabled);message(director.enabled?'Авторежиссёр включён: музыка управляет сценами, цветами и камерой.':'Авторежиссёр выключен. Формы и стили выбираете вы.');};

for(const key of ['sensitivity','rotation','brightness','size','effects'])$(key).oninput=e=>{const value=Number(e.target.value)/100;$(key+'-value').value=e.target.value+'%';if(key==='sensitivity')bus.sensitivity=value;else if(visual)visual.controls[key]=value;};
$('graphics-quality').onchange=e=>visual?.setQuality(e.target.value);
document.querySelectorAll('[data-palette]').forEach(button=>button.onclick=()=>{if(visual)visual.controls.palette=Number(button.dataset.palette);document.querySelectorAll('[data-palette]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});});
const figureSettings=document.querySelector('.figure-settings');figureSettings.open=window.innerWidth>=960;figureSettings.addEventListener('toggle',()=>visual?.resize());

if(visual){
 const kaleido=visual.kaleidoscope;kaleido.managed=true;
 kaleido.onChange=index=>{director.currentStyle=index;document.querySelectorAll('[data-style]').forEach(b=>{const selected=Number(b.dataset.style)===index;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});};
 document.querySelectorAll('[data-style]').forEach(b=>b.addEventListener('click',()=>{director.setAuto(false);kaleido.select(Number(b.dataset.style));}));
 $('symmetry').oninput=e=>{kaleido.symmetry=Number(e.target.value);$('symmetry-value').value=e.target.value;};
 $('intensity').oninput=e=>{kaleido.intensity=Number(e.target.value)/100;$('intensity-value').value=e.target.value+'%';};
 artist=new Artist(visual.renderer.domElement,kaleido);visual.artist=artist;
}
$('artist-toggle').onclick=()=>{
 if(!artist)return;artist.setEnabled(!artist.enabled);visual.drag=false;visual.vx=visual.vy=0;
 $('artist-toggle').classList.toggle('selected',artist.enabled);$('artist-toggle').setAttribute('aria-pressed',String(artist.enabled));$('artist-tools').hidden=!artist.enabled;experience.classList.toggle('artist-open',artist.enabled);visual.resize();
 if(artist.enabled)message('Выберите волшебную кисть и оживление. Отпустите мышь или палец — рисунок начнёт жить.');
};
function brushColor(color){if(artist)artist.color=color;$('brush-color').value=color;document.querySelectorAll('[data-color]').forEach(b=>{const selected=b.dataset.color===color;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});}
document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>brushColor(b.dataset.color));$('brush-color').oninput=e=>brushColor(e.target.value);$('brush-width').oninput=e=>{if(artist)artist.width=Number(e.target.value);$('brush-width-value').value=e.target.value;};$('clear-art').onclick=()=>artist?.clear();
$('brush-type').onchange=e=>{if(artist){artist.setBrush(e.target.value);brushColor(artist.color);}};
$('stroke-life').onchange=e=>{if(artist)artist.life=e.target.value;};

function panelsHidden(){return experience.classList.contains('panels-hidden');}
function setPanelsHidden(hidden){experience.classList.toggle('panels-hidden',hidden);document.body.classList.toggle('meditation',hidden);experience.classList.remove('reveal-controls');clearTimeout(revealTimer);visual?.resize();}
$('hide-panels').onclick=()=>setPanelsHidden(true);$('show-panels').onclick=()=>setPanelsHidden(false);
function reveal(e){if(panelsHidden()&&e.clientY<65){experience.classList.add('reveal-controls');clearTimeout(revealTimer);revealTimer=setTimeout(()=>experience.classList.remove('reveal-controls'),2800);}}
window.addEventListener('pointermove',reveal);window.addEventListener('pointerdown',reveal);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&panelsHidden()){setPanelsHidden(false);return;}if((e.code==='KeyH'||e.key.toLowerCase()==='h')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();setPanelsHidden(!panelsHidden());}});
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await experience.requestFullscreen();}catch{message('Полноэкранный режим недоступен в этом окне. Откройте локальную страницу в отдельном браузере.');}};
document.addEventListener('fullscreenchange',()=>{$('fullscreen').querySelector('span').textContent=document.fullscreenElement?'Выйти из экрана':'На весь экран';$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Выйти из полного экрана':'На весь экран');if(!document.fullscreenElement&&panelsHidden())setPanelsHidden(false);visual?.resize();});

$('upload').onclick=()=>$('files').click();$('files').onchange=e=>{const count=player.add(e.target.files);message(count?`Добавлено треков: ${count}. Нажмите ▶, чтобы начать.`:'Выберите файлы в формате mp3.');e.target.value='';};
const safe=fn=>()=>Promise.resolve().then(fn).catch(e=>player.fail(e));
$('play').onclick=safe(()=>player.toggle());$('previous').onclick=safe(()=>player.step(-1));$('next').onclick=safe(()=>player.step(1));$('volume').oninput=e=>player.setVolume(Number(e.target.value));$('seek').oninput=e=>player.seek(Number(e.target.value)/100);
player.addEventListener('error',e=>message(e.detail));player.addEventListener('change',()=>{const has=player.tracks.length>0;for(const id of ['play','previous','next','seek'])$(id).disabled=!has||player.preparing;for(const id of ['previous','next'])$(id).disabled=!has||player.busy||player.preparing;$('play').textContent=player.playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',player.playing?'Пауза':'Воспроизвести');if(has){$('track-name').textContent=player.tracks[player.index].name;$('track-info').textContent=`${player.index+1} / ${player.tracks.length} треков · ${player.preparing?'Подготавливаем музыку':player.busy?'Плавный переход':player.playing?'Сейчас звучит':'Готово к воспроизведению'}`;}});
const time=s=>Number.isFinite(s)?`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`:'0:00';
$('record-start').onclick=async()=>{
 if(!visual||recordStarting)return;recordStarting=true;$('record-start').disabled=true;
 try{await recorder.start(visual.renderer.domElement,player,visual.averageFps);$('save-video').hidden=true;}
 catch(e){message(e.message);}finally{recordStarting=false;$('record-start').disabled=false;}
};
$('record-stop').onclick=()=>recorder.stop();$('close-save').onclick=()=>$('save-video').hidden=true;
recorder.addEventListener('error',e=>message(e.detail));
recorder.addEventListener('change',()=>{
 const active=recorder.state==='recording'||recorder.state==='stopping';$('record-start').hidden=active;$('record-stop').hidden=!active;$('record-stop').disabled=recorder.state==='stopping';$('record-stop').textContent=recorder.state==='stopping'?'Завершение…':'■ Стоп';$('record-status').hidden=!active;
 if(recorder.state==='ready'){
  const stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date()).replace(/[ :]/g,'-');
  $('download-video').href=recorder.url;$('download-video').download=`kaleidoscope-${stamp}.${recorder.extension}`;
  $('video-details').textContent=`${recorder.extension.toUpperCase()} · ${time(recorder.duration)} · ${(recorder.blob.size/1048576).toFixed(1)} МБ · до ${recorder.fps} кадров/с`;$('save-video').hidden=false;
 }
});
let last=performance.now(),elapsed=0,ui=0;
function frame(now){
 const raw=(now-last)/1000;last=now;const dt=Math.min(raw,.07);elapsed+=dt;const values=bus.update(dt,player.playing,player.rhythm()),show=director.update(dt,elapsed,values);
 artist?.update(elapsed,visual?.quality??1);visual?.update(raw>.2?dt:raw,elapsed,values,show);recorder.capture(now);
 ui+=dt;if(ui>.1){ui=0;player.tick();const audio=player.current;$('elapsed').textContent=time(audio?.currentTime||0);$('duration').textContent=time(audio?.duration||0);$('seek').value=audio&&Number.isFinite(audio.duration)&&audio.duration?audio.currentTime/audio.duration*100:0;if(recorder.state==='recording')$('record-time').textContent=time((now-recorder.started)/1000);}
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.addEventListener('pagehide',e=>{if(!e.persisted){clearTimeout(messageTimer);clearTimeout(revealTimer);recorder.dispose();player.dispose();artist?.dispose();visual?.dispose();}});
if(location.protocol==='file:')message('Запустите «Запустить.cmd», затем откройте http://localhost:8080');
