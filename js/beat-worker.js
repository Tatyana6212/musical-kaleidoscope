// Runs once per file, outside the rendering/audio callback threads.
self.onmessage=({data:{pcm,sampleRate}})=>{
 try{self.postMessage(analyze(pcm,sampleRate));}catch(e){self.postMessage({error:e.message});}
};
function analyze(pcm,sr){
 const hop=64,win=256,step=hop/sr,n=Math.ceil(pcm.length/hop);
 // Cascaded RBJ high/low-pass filters isolate 40–200 Hz.
 const filter=(type,hz)=>{const w=2*Math.PI*hz/sr,c=Math.cos(w),a=Math.sin(w)/Math.SQRT2,a0=1+a;
   const b0=(type==='high'?(1+c):(1-c))/2/a0,b1=(type==='high'?-(1+c):(1-c))/a0;
   return{b0,b1,b2:b0,a1:-2*c/a0,a2:(1-a)/a0,x1:0,x2:0,y1:0,y2:0};};
 const hp=filter('high',40),lp=filter('low',200);
 const run=(f,x)=>{const y=f.b0*x+f.b1*f.x1+f.b2*f.x2-f.a1*f.y1-f.a2*f.y2;f.x2=f.x1;f.x1=x;f.y2=f.y1;f.y1=y;return y;};
 const energy=new Float32Array(n),loudness=new Float32Array(n),ring=new Float64Array(win),full=new Float64Array(win);
 let sum=0,wide=0,peak=0;
 for(let i=0;i<pcm.length;i++){const x=pcm[i],y=run(lp,run(hp,x)),k=i%win;sum+=y*y-ring[k];wide+=x*x-full[k];ring[k]=y*y;full[k]=x*x;if(i%hop===0){const j=Math.floor(i/hop);energy[j]=Math.sqrt(Math.max(0,sum)/win);loudness[j]=Math.sqrt(Math.max(0,wide)/win);peak=Math.max(peak,energy[j]);}}
 if(peak<.0003)return{bpm:0,phase:0,confidence:0,events:[],grid:[],loudness,step};
 const novelty=new Float32Array(n);let maxFlux=0;
 for(let i=3;i<n;i++){const prior=(energy[i-2]+energy[i-3]+energy[Math.max(0,i-5)])/3;const flux=Math.max(0,energy[i]-prior);novelty[i]=flux;maxFlux=Math.max(maxFlux,flux);}
 const prefix=new Float64Array(n+1),squares=new Float64Array(n+1),energyPrefix=new Float64Array(n+1);for(let i=0;i<n;i++){prefix[i+1]=prefix[i]+novelty[i];squares[i+1]=squares[i]+novelty[i]*novelty[i];energyPrefix[i+1]=energyPrefix[i]+energy[i];}
 const events=[];let last=-100;const radius=Math.round(.3/step),refractory=.18;
 for(let i=2;i<n-2;i++){
   if(novelty[i]<novelty[i-1]||novelty[i]<=novelty[i+1])continue;
   const a=Math.max(0,i-radius),b=Math.min(n,i+radius),mean=(prefix[b]-prefix[a])/(b-a),sd=Math.sqrt(Math.max(0,(squares[b]-squares[a])/(b-a)-mean*mean));
   const threshold=Math.max(maxFlux*.025,mean+sd*.65);
   const before=Math.max(0,i-Math.round(.12/step)),baseline=(energyPrefix[i]-energyPrefix[before])/Math.max(1,i-before);
   // Reject periodic RMS ripple inside one sustained bass note.
   if(novelty[i]<threshold||energy[i]<Math.max(.00045,peak*.025)||energy[i]<baseline*1.16+peak*.001)continue;
   // Backtrack the rising edge; account for the causal filter's small delay.
   let onset=i;while(onset>i-5&&onset>0&&novelty[onset-1]>novelty[i]*.16)onset--;
   const time=Math.max(0,onset*step-.012),strength=Math.min(1,.25+.75*Math.sqrt(novelty[i]/maxFlux));
   if(time-last<refractory){const previous=events[events.length-1];if(previous&&strength>previous.strength){previous.time=time;previous.strength=strength;last=time;}continue;}
   events.push({time,strength});last=time;
 }
 // Analyze the most active 90-second span, rather than a potentially silent intro.
 const length=Math.min(n,Math.round(90/step));let start=0,best=-1;
 for(let i=0;i+length<=n;i+=Math.max(1,Math.round(2/step))){const activity=squares[i+length]-squares[i];if(activity>best){best=activity;start=i;}}
 const lo=Math.floor(60/200/step),hi=Math.ceil(60/55/step),ac=new Float32Array(hi*2+2);
 const end=start+length;for(let lag=lo;lag<=hi*2;lag++){let xy=0,xx=0,yy=0;for(let i=start+lag;i<end;i++){const x=novelty[i],y=novelty[i-lag];xy+=x*y;xx+=x*x;yy+=y*y;}ac[lag]=xy/Math.sqrt(xx*yy+1e-20);}
 let lagBest=0,scoreBest=0;
 for(let lag=lo;lag<=hi;lag++){if(ac[lag]<ac[lag-1]||ac[lag]<ac[lag+1])continue;
   const bpm=60/(lag*step),half=ac[Math.round(lag/2)]||0,double=ac[lag*2]||0;
   // Support harmonic alternatives; use only a mild preference for 80–160 BPM.
   const score=(ac[lag]+double*.22+half*.08)*(bpm>=80&&bpm<=160?1.06:1);
   if(score>scoreBest){scoreBest=score;lagBest=lag;}
 }
 if(!lagBest||events.length<4)return{bpm:0,phase:0,confidence:0,events,grid:[],loudness,step};
 const left=ac[lagBest-1],center=ac[lagBest],right=ac[lagBest+1],den=left-2*center+right;
 const offset=Math.abs(den)>1e-8?Math.max(-.5,Math.min(.5,.5*(left-right)/den)):0;
 let period=(lagBest+offset)*step;
 // Refine period from real onset intervals to avoid long-track grid drift.
 const periods=[];for(let i=1;i<events.length;i++){const d=events[i].time-events[i-1].time,m=Math.round(d/period);if(m>=1&&m<=4&&Math.abs(d/m-period)<period*.09)periods.push(d/m);}
 if(periods.length>5){periods.sort((a,b)=>a-b);period=periods[Math.floor(periods.length/2)];}
 const bins=128,hist=new Float64Array(bins);for(const e of events){const b=Math.round((e.time%period)/period*bins)%bins;hist[b]+=e.strength;}
 let phaseBin=0,phaseScore=-1;for(let b=0;b<bins;b++){const s=hist[b]+.6*(hist[(b+1)%bins]+hist[(b+bins-1)%bins]);if(s>phaseScore){phaseScore=s;phaseBin=b;}}
 const phase=phaseBin/bins*period,tolerance=Math.min(.065,period*.14);let matched=0,total=0;
 for(const e of events){total+=e.strength;const d=Math.abs(((e.time-phase+period*.5)%period+period)%period-period*.5);if(d<tolerance)matched+=e.strength;}
 const confidence=matched/Math.max(1e-9,total)*Math.min(1,center*2);
 const grid=[];let cursor=0;
 // A grid is retained only where a real onset supports it: never fill silence.
 if(confidence>.55)for(let t=phase;t<pcm.length/sr;t+=period){while(cursor<events.length&&events[cursor].time<t-tolerance)cursor++;const e=events[cursor];if(e&&Math.abs(e.time-t)<tolerance)grid.push({time:e.time,strength:e.strength,expected:t});}
 return{bpm:60/period,phase,confidence,events,grid,loudness,step};
}
