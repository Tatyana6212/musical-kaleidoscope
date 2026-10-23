export class TrackAnalysis {
 constructor(){this.queue=Promise.resolve();this.disposed=false;}
 prepare(track,context){
  if(track.analysis)return Promise.resolve(track.analysis);
  if(track.pending)return track.pending;
  // Bound decoded-PCM memory to one song, even for a large playlist.
  const task=this.queue.then(async()=>{
   if(this.disposed)throw Error('Analysis disposed');
   const decoded=await context.decodeAudioData(await track.file.arrayBuffer());
   const rate=11025,offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*rate),rate),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
   const rendered=await offline.startRendering(),pcm=rendered.getChannelData(0);
   const result=await new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./beat-worker.js',import.meta.url));this.worker=worker;
    const finish=()=>{worker.terminate();this.worker=null;this.cancel=null;};
    this.cancel=()=>{finish();reject(Error('Analysis disposed'));};
    worker.onmessage=({data})=>{finish();data.error?reject(Error(data.error)):resolve(data);};
    worker.onerror=e=>{finish();reject(Error(e.message));};
    worker.postMessage({pcm,sampleRate:rate},[pcm.buffer]);
   });
   track.analysis=result;return result;
  });
  this.queue=task.catch(()=>{});track.pending=task.catch(e=>{track.pending=null;throw e;});return track.pending;
 }
 dispose(){this.disposed=true;this.cancel?.();}
}

// Every effect reads the same media timestamp. No beat interval timers.
export class RhythmTimeline {
 constructor(){this.pulses=Array.from({length:4},()=>({age:2,strength:0}));this.value={beat:0,bpm:0,phase:0,pulses:this.pulses};this.deck=null;}
 sample(deck,playing){
  const out=this.value;out.beat=0;out.bpm=0;out.phase=0;for(const p of this.pulses){p.age=2;p.strength=0;}
  const map=deck?.track?.analysis;
  if(!playing||!map||deck.el.seeking||deck.el.paused||deck.el.ended)return out;
  const time=deck.el.currentTime;out.bpm=map.bpm;out.phase=map.bpm?((time-map.phase)*map.bpm/60%1+1)%1:0;
  const events=map.events;let lo=0,hi=events.length;
  while(lo<hi){const m=(lo+hi)>>>1;if(events[m].time<=time)lo=m+1;else hi=m;}
  // Recent overlapping beats occupy reusable slots. Seeking samples the map
  // directly, so there is no backlog to fire or accumulated clock error.
  for(let j=0,i=lo-1;i>=0&&j<this.pulses.length;i--,j++){
   const e=events[i],age=time-e.time;if(age>1.05)break;
   const pulse=this.pulses[i%this.pulses.length];pulse.age=age;pulse.strength=e.strength;
   const envelope=Math.min(1,age/.012)*Math.exp(-Math.max(0,age-.012)/.17);
   out.beat=Math.max(out.beat,envelope*e.strength);
  }
  return out;
 }
}
