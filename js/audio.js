import {TrackAnalysis,RhythmTimeline} from './rhythm.js';
// Meyda supplies atmosphere only. Precomputed events supply every beat effect.
export class MusicParameters {
  constructor(){this.target={volume:0,bass:0,mid:0,high:0,energy:0};this.smooth={...this.target};this.sensitivity=1;this.spectrumTarget=new Float32Array(64);this.spectrumSmooth=new Float32Array(64);this.value={...this.target,beat:0,bpm:0,phase:0,pulses:Array.from({length:4},()=>({age:2,strength:0})),spectrum:new Float32Array(64)};}
  ingest(f,sampleRate){
    const s=f.amplitudeSpectrum, bin=sampleRate/(s.length*2);
    const band=(lo,hi)=>{let total=0,n=0;for(let i=Math.max(1,Math.floor(lo/bin));i<Math.min(s.length,hi/bin);i++){total+=s[i]*s[i];n++;}return Math.min(1,Math.sqrt(total)/s.length*5);};
    const bass=band(35,250),mid=band(250,3500),high=band(3500,14000),volume=Math.min(1,f.rms*4);
    Object.assign(this.target,{volume,bass,mid,high,energy:volume*.6+bass*.25+high*.15});
    for(let band=0;band<64;band++){
      const lo=40*Math.pow(400,band/64),hi=40*Math.pow(400,(band+1)/64),start=Math.max(1,Math.floor(lo/bin)),end=Math.min(s.length,Math.max(start+1,Math.ceil(hi/bin)));let peak=0,power=0;
      for(let i=start;i<end;i++){peak=Math.max(peak,s[i]);power+=s[i]*s[i];}
      const amplitude=(peak*.65+Math.sqrt(power/Math.max(1,end-start))*.35)/s.length*4;
      this.spectrumTarget[band]=Math.min(1,Math.log1p(amplitude*30)/Math.log(31));
    }
  }
  update(dt,playing,rhythm){
    if(!playing){for(const k in this.target)this.target[k]=0;this.spectrumTarget.fill(0);}
    const a=1-Math.exp(-dt*5),gain=this.sensitivity;
    for(const k in this.target){this.smooth[k]+=(this.target[k]-this.smooth[k])*a;this.value[k]=Math.min(1,this.smooth[k]*gain);}
    for(let i=0;i<64;i++){const target=this.spectrumTarget[i],speed=target>this.spectrumSmooth[i]?15:4;this.spectrumSmooth[i]+=(target-this.spectrumSmooth[i])*(1-Math.exp(-dt*speed));this.value.spectrum[i]=Math.min(1,this.spectrumSmooth[i]*gain);}
    this.value.beat=Math.min(1,rhythm.beat*gain);this.value.bpm=rhythm.bpm;this.value.phase=rhythm.phase;
    for(let i=0;i<4;i++){const p=rhythm.pulses[i],out=this.value.pulses[i];out.age=p?.age??2;out.strength=Math.min(1,(p?.strength??0)*gain);}
    return this.value;
  }
}

export class Player extends EventTarget {
  constructor(bus){super();this.bus=bus;this.tracks=[];this.index=0;this.active=0;this.playing=false;this.busy=false;this.preparing=false;this.volume=.75;this.fadeDuration=2.5;this.analysis=new TrackAnalysis();this.timeline=new RhythmTimeline();this.transition=null;}
  emit(){this.dispatchEvent(new Event('change'));}
  async init(){
    if(this.context){await this.context.resume();return;}
    this.context=new AudioContext();this.mix=this.context.createGain();this.master=this.context.createGain();this.master.gain.value=this.volume;this.mix.connect(this.master);this.master.connect(this.context.destination);
    this.decks=[0,1].map(()=>{const el=new Audio();el.preload='auto';const source=this.context.createMediaElementSource(el),gain=this.context.createGain();gain.gain.value=0;source.connect(gain);gain.connect(this.mix);return{el,gain,track:null};});
    this.analyzer=Meyda.createMeydaAnalyzer({audioContext:this.context,source:this.mix,bufferSize:1024,featureExtractors:['rms','amplitudeSpectrum'],callback:f=>{if(this.playing)this.bus.ingest(f,this.context.sampleRate);}});this.analyzer.start();await this.context.resume();
  }
  get current(){return this.decks?.[this.active].el;}
  add(files){const accepted=[...files].filter(f=>/\.mp3$/i.test(f.name)||f.type==='audio/mpeg');for(const f of accepted)this.tracks.push({name:f.name.replace(/\.mp3$/i,''),file:f,url:URL.createObjectURL(f)});this.emit();if(this.context)this.preload();return accepted.length;}
  prepare(track){return this.analysis.prepare(track,this.context);}
  preload(){if(!this.tracks.length)return;this.prepare(this.tracks[(this.index+1)%this.tracks.length]).catch(()=>{});}
  async toggle(){
    if(!this.tracks.length||this.preparing)return;await this.init();
    if(this.playing){this.finishFade();this.playing=false;this.decks.forEach(d=>d.el.pause());this.emit();return;}
    this.preparing=true;this.emit();
    try{const track=this.tracks[this.index];await this.prepare(track);const deck=this.decks[this.active];if(deck.track!==track||!deck.el.src){deck.el.src=track.url;deck.track=track;}deck.gain.gain.setValueAtTime(1,this.context.currentTime);await deck.el.play();this.playing=true;this.preload();}
    finally{this.preparing=false;this.emit();}
  }
  async step(direction){
    if(!this.tracks.length||this.busy||this.preparing)return;await this.init();const next=(this.index+direction+this.tracks.length)%this.tracks.length;
    this.busy=true;this.emit();const old=this.decks[this.active],fresh=this.decks[1-this.active],track=this.tracks[next];
    try{await this.prepare(track);}catch(e){this.busy=false;this.emit();throw e;}
    if(!this.playing){this.index=next;this.current.src=track.url;old.track=track;this.current.currentTime=0;this.busy=false;this.emit();this.preload();return;}
    fresh.el.src=track.url;fresh.track=track;fresh.gain.gain.cancelScheduledValues(this.context.currentTime);fresh.gain.gain.setValueAtTime(0,this.context.currentTime);
    try{await fresh.el.play();}catch(e){this.busy=false;this.emit();throw e;}
    const now=this.context.currentTime,d=Math.min(this.fadeDuration,Number.isFinite(old.el.duration)?Math.max(.05,old.el.duration-old.el.currentTime):this.fadeDuration);
    old.gain.gain.cancelScheduledValues(now);old.gain.gain.setValueAtTime(old.gain.gain.value,now);old.gain.gain.linearRampToValueAtTime(0,now+d);fresh.gain.gain.linearRampToValueAtTime(1,now+d);
    this.transition={old,fresh,start:now,duration:d,switched:false};this.active=1-this.active;this.index=next;this.emit();this.preload();
  }
  finishFade(){if(!this.transition)return;const {old,fresh}=this.transition,now=this.context.currentTime;old.gain.gain.cancelScheduledValues(now);old.gain.gain.setValueAtTime(0,now);old.el.pause();old.el.removeAttribute('src');old.el.load();fresh.gain.gain.cancelScheduledValues(now);fresh.gain.gain.setValueAtTime(1,now);this.transition=null;this.busy=false;}
  rhythm(){
    let dominant=this.decks?.[this.active];const fade=this.transition;
    if(fade){const progress=Math.min(1,Math.max(0,(this.context.currentTime-fade.start)/fade.duration));
      const level=deck=>{const map=deck.track.analysis;return map.loudness[Math.min(map.loudness.length-1,Math.floor(deck.el.currentTime/map.step))]||0;};
      // Hysteresis latches the new song once it becomes perceptually dominant.
      if(!fade.switched&&(progress>=1||fade.old.el.ended||progress*level(fade.fresh)>(1-progress)*level(fade.old)*1.12))fade.switched=true;
      dominant=fade.switched?fade.fresh:fade.old;
    }
    return this.timeline.sample(dominant,this.playing);
  }
  tick(){if(this.transition&&this.context.currentTime-this.transition.start>=this.transition.duration){this.finishFade();this.emit();}if(this.playing&&!this.busy&&this.current&&Number.isFinite(this.current.duration)&&this.current.duration-this.current.currentTime<=this.fadeDuration)this.step(1).catch(e=>this.fail(e));}
  seek(fraction){if(this.current&&Number.isFinite(this.current.duration)){this.finishFade();this.current.currentTime=this.current.duration*fraction;}}
  setVolume(v){this.volume=v;if(this.master)this.master.gain.gain.setTargetAtTime(v,this.context.currentTime,.06);}
  fail(e){this.playing=false;this.decks?.forEach(d=>d.el.pause());this.emit();this.dispatchEvent(new CustomEvent('error',{detail:'Не удалось воспроизвести файл. Выберите другой mp3. '+e.message}));}
  dispose(){this.analysis.dispose();this.decks?.forEach(d=>d.el.pause());this.analyzer?.stop();this.context?.close();this.tracks.forEach(t=>URL.revokeObjectURL(t.url));}
}
