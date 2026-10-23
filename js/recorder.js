export class ShowRecorder extends EventTarget {
 constructor(){super();this.state='idle';this.url=null;this.chunks=[];}
 emit(){this.dispatchEvent(new Event('change'));}
 async start(source,player,fps=30){
  if(this.state==='recording'||this.state==='stopping')return;
  if(!globalThis.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)throw Error('Этот браузер не поддерживает запись видео. Откройте приложение в современном Chrome, Edge или Firefox.');
  if(!player.playing)throw Error('Сначала загрузите музыку и нажмите ▶, затем начните запись.');
  const types=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4;codecs=avc1,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].filter(t=>MediaRecorder.isTypeSupported(t));
  if(!types.length)throw Error('В этом браузере нет поддерживаемого формата записи видео со звуком.');
  await player.init();
  if(this.url){URL.revokeObjectURL(this.url);this.url=null;}
  this.source=source;this.player=player;this.chunks=[];this.blob=null;this.finished=false;this.fps=fps>=54?60:30;
  // Fixed capture dimensions protect MP4 encoders during fullscreen/resizing.
  // The only copy occurs immediately after WebGL rendering, inside the same RAF.
  this.canvas=document.createElement('canvas');const scale=Math.min(1,1920/source.width,1080/source.height);
  this.canvas.width=Math.max(2,Math.floor(source.width*scale/2)*2);this.canvas.height=Math.max(2,Math.floor(source.height*scale/2)*2);this.ctx=this.canvas.getContext('2d',{alpha:false,desynchronized:true});
  try{
   this.video=this.canvas.captureStream(this.fps);if(!this.video.getVideoTracks().length)throw Error('Браузер не предоставил видеодорожку для записи.');this.tap=player.context.createMediaStreamDestination();player.master.connect(this.tap);
   const audio=this.tap.stream.getAudioTracks();if(!audio.length)throw Error('Браузер не предоставил звуковую дорожку для записи.');
   this.stream=new MediaStream([...this.video.getVideoTracks(),...audio]);
   let lastError;
   for(const type of types){try{this.recorder=new MediaRecorder(this.stream,{mimeType:type,videoBitsPerSecond:this.fps===60?10000000:6500000,audioBitsPerSecond:192000});this.recorder.start(1000);break;}catch(e){lastError=e;this.recorder=null;}}
   if(!this.recorder)throw lastError||Error('Не удалось запустить запись со звуком.');
   this.recorder.ondataavailable=e=>{if(e.data.size)this.chunks.push(e.data);};
   this.recorder.onerror=e=>{this.dispatchEvent(new CustomEvent('error',{detail:'Запись остановлена браузером: '+(e.error?.message||'формат или ресурсы устройства недоступны.')}));this.stop();};
   this.recorder.onstop=()=>this.finish();this.started=performance.now();this.lastFrame=-Infinity;this.state='recording';this.emit();
  }catch(e){this.cleanup();this.state='idle';this.emit();throw /[а-яё]/i.test(e.message)?e:Error('Не удалось начать запись видео со звуком в этом браузере. Попробуйте другой браузер. '+e.message);}
 }
 capture(now){
  if(this.state!=='recording'||now-this.lastFrame<1000/this.fps-1)return;this.lastFrame=now;
  const c=this.canvas,s=this.source,scale=Math.min(c.width/s.width,c.height/s.height),w=s.width*scale,h=s.height*scale;
  this.ctx.fillStyle='#07080b';this.ctx.fillRect(0,0,c.width,c.height);this.ctx.drawImage(s,(c.width-w)/2,(c.height-h)/2,w,h);
 }
 stop(){if(this.state!=='recording')return;this.state='stopping';this.emit();if(this.recorder.state!=='inactive')this.recorder.stop();else this.finish();}
 finish(){
  if(this.finished)return;this.finished=true;
  const type=this.chunks[0]?.type||this.recorder?.mimeType||'video/webm';this.blob=new Blob(this.chunks,{type});this.chunks=[];this.cleanup();
  if(!this.blob.size){this.state='idle';this.dispatchEvent(new CustomEvent('error',{detail:'Браузер не записал кадры. Повторите запись в активной вкладке.'}));this.emit();return;}
  this.extension=type.includes('mp4')?'mp4':'webm';this.url=URL.createObjectURL(this.blob);this.duration=(performance.now()-this.started)/1000;this.state='ready';this.emit();
 }
 cleanup(){if(this.tap&&this.player?.master){try{this.player.master.disconnect(this.tap);}catch{}}this.stream?.getTracks().forEach(t=>t.stop());this.video?.getTracks().forEach(t=>t.stop());this.tap=null;this.stream=null;this.video=null;this.canvas=null;this.ctx=null;}
 dispose(){if(this.recorder&&this.recorder.state!=='inactive'){this.recorder.onstop=null;this.recorder.stop();}this.cleanup();if(this.url)URL.revokeObjectURL(this.url);}
}
