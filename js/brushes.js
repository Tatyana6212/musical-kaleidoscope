export const BRUSHES={
 fire:{name:'Огненная',color:'#ff9b59'},electric:{name:'Электрическая',color:'#80dfff'},
 star:{name:'Звёздная',color:'#ffe9a6'},smoke:{name:'Дымчатая',color:'#bd9aff'},crystal:{name:'Кристальная',color:'#8fffe7'}
};
const random=(i,seed)=>{const x=Math.sin(i*127.1+seed*311.7)*43758.5453;return x-Math.floor(x);};
const star=(c,x,y,r,angle=0)=>{c.beginPath();for(let i=0;i<10;i++){const a=angle+i*Math.PI/5-Math.PI/2,s=i%2?r*.3:r;c.lineTo(x+Math.cos(a)*s,y+Math.sin(a)*s);}c.closePath();c.fill();};
function path(c,points){c.beginPath();c.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];c.quadraticCurveTo(a.x,a.y,(a.x+b.x)*.5,(a.y+b.y)*.5);}const last=points[points.length-1];c.lineTo(last.x,last.y);}
function anchors(points,gap){
 const result=[{...points[0],angle:0}];let distance=0;
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(!len)continue;let d=gap-distance;for(;d<=len;d+=gap)result.push({x:a.x+dx*d/len,y:a.y+dy*d/len,angle:Math.atan2(dy,dx)});distance=(distance+len)%gap;}
 return result;
}

// Rasterize a stroke only when its input changes. Animation later reuses this
// cropped bitmap and a bounded set of precomputed branches/particles.
export function cacheStroke(s,size){
 const w=s.width*.75,pad=w*9+20;let left=size,top=size,right=0,bottom=0;
 for(const p of s.points){left=Math.min(left,p.x);top=Math.min(top,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
 s.x=Math.max(0,Math.floor(left-pad));s.y=Math.max(0,Math.floor(top-pad));const width=Math.max(1,Math.min(size,Math.ceil(right+pad))-s.x),height=Math.max(1,Math.min(size,Math.ceil(bottom+pad))-s.y);
 s.cache??=document.createElement('canvas');s.cache.width=width;s.cache.height=height;const c=s.cache.getContext('2d');c.translate(-s.x,-s.y);c.lineCap=c.lineJoin='round';c.globalCompositeOperation='source-over';
 c.strokeStyle=c.fillStyle=s.color;c.shadowColor=s.color;c.shadowBlur=w*2;c.lineWidth=Math.max(.7,w*.65);
 const dots=anchors(s.points,Math.max(4,w*2.5));s.anchors=dots;
 if(s.type==='smoke'){
  c.shadowBlur=0;for(let i=0;i<dots.length;i++){const p=dots[i],r=w*(2.2+random(i,s.seed)*2),x=p.x+(random(i+300,s.seed)-.5)*w*3,y=p.y+(random(i+600,s.seed)-.5)*w*3;
   const gradient=c.createRadialGradient(x,y,0,x,y,r);gradient.addColorStop(0,s.color+'55');gradient.addColorStop(.4,s.color+'22');gradient.addColorStop(1,s.color+'00');c.fillStyle=gradient;c.fillRect(x-r,y-r,r*2,r*2);
  }
 }else if(s.type==='electric'){
  const jagged=[];for(let i=0;i<dots.length;i++){const p=dots[i],d=(random(i,s.seed)-.5)*w*4;jagged.push({x:p.x-Math.sin(p.angle)*d,y:p.y+Math.cos(p.angle)*d});}
  c.lineWidth=Math.max(.8,w*.45);c.beginPath();jagged.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();
  for(let i=2;i<jagged.length;i+=3){const p=jagged[i];c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x+w*2,p.y-w*2);c.lineTo(p.x+w,p.y-w*3.6);c.stroke();}
  c.shadowBlur=w;c.strokeStyle='#eaffff';c.lineWidth=Math.max(.4,w*.14);c.beginPath();jagged.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();
 }else{
  path(c,s.points);c.globalAlpha=s.type==='star' ? .35 : .5;c.stroke();c.globalAlpha=1;
  for(let i=0;i<dots.length;i++){
   const p=dots[i];c.save();c.translate(p.x,p.y);c.rotate(p.angle);
   if(s.type==='fire'){
    const length=w*(3+random(i,s.seed)*3),side=i%2?1:-1;c.fillStyle=s.color;c.globalAlpha=.6;
    c.beginPath();c.moveTo(-w,0);c.bezierCurveTo(-w*2,-side*length*.3,w*1.6,-side*length*.6,w*.4,-side*length);c.bezierCurveTo(w*3,-side*length*.4,w*1.8,-side*w,w,0);c.closePath();c.fill();
    c.globalAlpha=.85;c.fillStyle='#fff3c5';c.beginPath();c.ellipse(0,0,w*.55,w*1.1,0,0,Math.PI*2);c.fill();
   }else if(s.type==='star'){
    c.fillStyle=s.color;star(c,0,0,w*(1.1+random(i,s.seed)),random(i+40,s.seed)*Math.PI);c.fillStyle='#ffffff';star(c,0,0,w*.42);
   }else if(s.type==='crystal'){
    const r=w*(2+random(i,s.seed)*1.8);c.fillStyle=s.color;c.globalAlpha=.38;c.beginPath();c.moveTo(0,-r);c.lineTo(w,0);c.lineTo(0,r*.8);c.lineTo(-w,0);c.closePath();c.fill();
    c.globalAlpha=.9;c.strokeStyle=s.color;c.lineWidth=.65;c.stroke();c.fillStyle='#e8ffff';c.globalAlpha=.5;c.beginPath();c.moveTo(0,-r);c.lineTo(w,0);c.lineTo(0,r*.8);c.closePath();c.fill();
   }
   c.restore();
  }
 }
 if(s.points.length===1&&s.type!=='smoke'){c.fillStyle=s.color;c.beginPath();c.arc(s.points[0].x,s.points[0].y,Math.max(1,w*.6),0,Math.PI*2);c.fill();}
 s.cacheDirty=false;
}

export function awakenStroke(s){
 const points=s.points,n=points.length;s.branches=[];s.particles=[];
 for(let i=0;i<10;i++){
  const index=Math.min(n-1,Math.floor(i/10*n)),p=points[index],next=points[Math.min(n-1,index+1)],angle=Math.atan2(next.y-p.y,next.x-p.x)+(i%2?1:-1)*Math.PI*.5;
  s.branches.push({x:p.x,y:p.y,angle,length:18+random(i,s.seed)*35+s.width*2,delay:i*.17,phase:random(i+70,s.seed)*6.28});
 }
 for(let i=0;i<48;i++){
  const p=points[Math.floor(random(i+100,s.seed)*n)],a=random(i+200,s.seed)*Math.PI*2,speed=5+random(i+300,s.seed)*16;
  s.particles.push({x:p.x,y:p.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-4,delay:random(i+400,s.seed)*1.8,life:5+random(i+500,s.seed)*8,size:.6+random(i+600,s.seed)*1.9,phase:random(i+700,s.seed)*6.28});
 }
 // A small reusable glow stamp avoids a shadow blur for every animated mote.
 s.spark=document.createElement('canvas');s.spark.width=s.spark.height=32;const c=s.spark.getContext('2d'),g=c.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'#ffffff');g.addColorStop(.17,s.color);g.addColorStop(.55,s.color+'66');g.addColorStop(1,s.color+'00');c.fillStyle=g;c.fillRect(0,0,32,32);
}

export function animateStroke(c,s,time,quality){
 const age=s.finished?Math.max(0,time-s.born):0,lifeAge=Math.max(0,age-.6),alive=s.finished;
 const dissolve=s.life==='particles'?Math.exp(-Math.max(0,age-1.3)/3.5):1;
 const sway=alive?Math.sin(age*.6+s.seed)*Math.min(1,age)*1.7:0;
 c.save();c.globalCompositeOperation='source-over';c.globalAlpha=dissolve;
 const cx=s.x+s.cache.width*.5,cy=s.y+s.cache.height*.5;c.translate(cx+sway,cy);c.rotate(alive?Math.sin(age*.24+s.seed)*.009*Math.min(1,age):0);
 if(s.type==='fire')c.globalAlpha*=.82+.18*Math.sin(time*7+s.seed);
 if(s.type==='electric'){c.translate(Math.sin(time*13+s.seed)*.65,Math.cos(time*9+s.seed)*.5);c.globalAlpha*=.74+.26*Math.sin(time*11+s.seed)**2;}
 if(s.type==='smoke'){const grow=1+Math.min(age,8)*.015;c.scale(grow,grow);c.translate(Math.sin(time*.4+s.seed)*2,-Math.min(age,12)*.5);c.globalAlpha*=.72;}
 c.drawImage(s.cache,-s.cache.width*.5,-s.cache.height*.5);c.restore();
 if(!alive)return;
 c.save();c.globalCompositeOperation='source-over';c.strokeStyle=c.fillStyle=s.color;c.lineCap='round';
 if(s.life==='plants'){
  c.shadowColor=s.color;c.shadowBlur=3;
  for(let i=0;i<s.branches.length;i++){
   if(quality<.7&&i%2)continue;const b=s.branches[i],growth=Math.max(0,Math.min(1,(lifeAge-b.delay)/4));if(!growth)continue;
   const length=b.length*growth,a=b.angle+Math.sin(age*.65+b.phase)*.09*growth,dx=Math.cos(a)*length,dy=Math.sin(a)*length;
   c.globalAlpha=.62;c.lineWidth=Math.max(.6,s.width*.14)*(1-growth*.3);c.beginPath();c.moveTo(b.x,b.y);c.quadraticCurveTo(b.x+dx*.35-dy*.12,b.y+dy*.35+dx*.12,b.x+dx,b.y+dy);c.stroke();
   for(let leaf=0;leaf<3;leaf++){const open=Math.max(0,(growth-.2-leaf*.15)/.65),f=.45+leaf*.23;if(!open)continue;c.save();c.translate(b.x+dx*f,b.y+dy*f);c.rotate(a+(leaf%2?1:-1)*.7);c.globalAlpha=.32*open;c.beginPath();c.ellipse(0,0,(5+s.width*.4)*open,2.1*open,0,0,Math.PI*2);c.fill();c.restore();}
   if(growth>.7){c.globalAlpha=(growth-.7)*1.5;c.drawImage(s.spark,b.x+dx-4,b.y+dy-4,8,8);}
  }
 }else if(s.life==='particles'){
  for(let i=0;i<s.particles.length;i+=quality<.7?2:1){const p=s.particles[i],a=lifeAge-p.delay;if(a<0||a>p.life)continue;
   const fade=Math.min(1,a/.4)*(1-a/p.life),x=p.x+p.vx*a+Math.sin(a+p.phase)*3,y=p.y+p.vy*a-a*a*.3,r=p.size*(s.type==='smoke'?6:3);
   c.globalAlpha=fade*.85;c.drawImage(s.spark,x-r,y-r,r*2,r*2);
  }
 }
 // Brush-specific life remains visible even in the gentle-flow mode.
 if(s.type==='star'||s.type==='crystal'||s.type==='fire'){
  const count=Math.min(12,s.anchors.length);for(let i=0;i<count;i++){const p=s.anchors[Math.floor(i/count*s.anchors.length)],twinkle=.5+.5*Math.sin(time*(s.type==='fire'?2:.8)+i*2+s.seed),r=(s.type==='star'?4:2.5)*twinkle;
   c.globalAlpha=twinkle*.6*dissolve;c.drawImage(s.spark,p.x-r,p.y-r,r*2,r*2);
  }
 }
 c.restore();
}
