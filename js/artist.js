import * as T from '../vendor/three.module.js';
import {BRUSHES,cacheStroke,awakenStroke,animateStroke} from './brushes.js';

export class Artist {
 constructor(canvas,kaleidoscope){
  this.canvas=canvas;this.kaleidoscope=kaleidoscope;this.enabled=false;this.drawing=false;this.type='fire';this.life='plants';this.color=BRUSHES.fire.color;this.width=5;
  this.size=768;this.strokes=[];this.current=null;this.lastRender=-Infinity;
  this.ink=document.createElement('canvas');this.ink.width=this.ink.height=this.size;this.ctx=this.ink.getContext('2d');this.texture=new T.CanvasTexture(this.ink);this.texture.minFilter=T.LinearFilter;this.texture.generateMipmaps=false;this.dirty=true;
  kaleidoscope.uniforms.ink.value=this.texture;
  this.down=e=>{
   if(!this.enabled||e.button>0||this.drawing)return;e.preventDefault();this.drawing=true;this.pointer=e.pointerId;canvas.setPointerCapture(e.pointerId);
   if(this.strokes.length>=32)this.release(this.strokes.shift());
   this.current={type:this.type,life:this.life,color:this.color,width:this.width,seed:Math.random()*1000,points:[this.point(e)],cacheDirty:true,finished:false,born:this.time()};this.strokes.push(this.current);this.dirty=true;
  };
  this.move=e=>{if(!this.drawing||e.pointerId!==this.pointer)return;e.preventDefault();const samples=e.getCoalescedEvents?.();for(const sample of samples?.length?samples:[e])this.addPoint(this.point(sample));};
  this.up=e=>{if(e.pointerId!==this.pointer)return;if(this.drawing&&e.type!=='pointercancel')this.addPoint(this.point(e));this.finish();};
  canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointermove',this.move);canvas.addEventListener('pointerup',this.up);canvas.addEventListener('pointercancel',this.up);
 }
 time(){return this.kaleidoscope.uniforms.time.value;}
 setEnabled(enabled){this.finish();this.enabled=enabled;this.canvas.classList.toggle('artist-cursor',enabled);}
 setBrush(type){if(!BRUSHES[type])return;this.type=type;this.color=BRUSHES[type].color;}
 point(e){
  const rect=this.canvas.getBoundingClientRect(),u=this.kaleidoscope.uniforms,c=u.center.value;
  const x=((e.clientX-rect.left)/rect.width-c.x)*rect.width/rect.height*2,y=(1-(e.clientY-rect.top)/rect.height-c.y)*2;
  const r=Math.hypot(x,y)/(1+u.beat.value*.04),w=Math.PI*2/u.sectors.value;
  let angle=((Math.atan2(y,x)+u.time.value*.025)%(2*w)+2*w)%(2*w);angle=w-Math.abs(angle-w)-w*.5;
  return{x:(r*Math.cos(angle)/4+.5)*this.size,y:(.5-r*Math.sin(angle)/4)*this.size};
 }
 addPoint(p){
  const s=this.current;if(!s)return;const last=s.points[s.points.length-1];if(Math.hypot(p.x-last.x,p.y-last.y)<1.6)return;
  s.points.push(p);if(s.points.length>128){s.points=s.points.filter((_,i)=>i%2===0||i===s.points.length-1);}s.cacheDirty=true;this.dirty=true;
 }
 finish(){if(!this.current)return;const s=this.current;s.finished=true;s.born=this.time();if(s.cacheDirty)cacheStroke(s,this.size);awakenStroke(s);this.current=null;this.drawing=false;this.dirty=true;}
 release(s){if(s.cache)s.cache.width=s.cache.height=1;if(s.spark)s.spark.width=s.spark.height=1;}
 clear(){
  if(this.canvas.hasPointerCapture(this.pointer))this.canvas.releasePointerCapture(this.pointer);
  this.strokes.forEach(s=>this.release(s));this.strokes.length=0;this.current=null;this.drawing=false;this.ctx.clearRect(0,0,this.size,this.size);this.dirty=true;
 }
 update(time=this.time(),quality=1){
  const fps=quality<.7?12:20;
  if(!this.dirty&&!this.strokes.length)return;
  if(time-this.lastRender<1/fps)return;this.lastRender=time;
  const c=this.ctx;c.clearRect(0,0,this.size,this.size);
  for(let i=this.strokes.length-1;i>=0;i--){const s=this.strokes[i];if(s.finished&&s.life==='particles'&&time-s.born>18){this.release(s);this.strokes.splice(i,1);}}
  for(const s of this.strokes){if(s.cacheDirty)cacheStroke(s,this.size);animateStroke(c,s,time,quality);}
  this.texture.needsUpdate=true;this.dirty=false;
 }
 dispose(){this.canvas.removeEventListener('pointerdown',this.down);this.canvas.removeEventListener('pointermove',this.move);this.canvas.removeEventListener('pointerup',this.up);this.canvas.removeEventListener('pointercancel',this.up);this.strokes.forEach(s=>this.release(s));this.strokes.length=0;this.texture.dispose();}
}
