import * as T from '../vendor/three.module.js';
import {Kaleidoscope} from './kaleidoscope.js';

const vertex=`
attribute vec3 target, surfaceNormal, targetNormal;
uniform float morph,time,bass,beat; varying vec3 vP,vView,vNormal;
void main(){vec3 p=mix(position,target,morph);vec3 n=normalize(p+vec3(.0001));
float wave=sin(p.y*5.+time*.8)*cos(p.x*4.-time*.55)+sin(p.z*6.+time*.6)*.4;
p+=n*wave*(.027+bass*.075+beat*.013);vP=p;
vec3 smoothNormal=normalize(mix(surfaceNormal,targetNormal,morph));
vNormal=normalMatrix*normalize(smoothNormal+n*wave*.025);
vec4 mv=modelViewMatrix*vec4(p,1.);vView=mv.xyz;gl_Position=projectionMatrix*mv;}`;
const fragment=`
uniform float time,mid,energy,volume,beat,hue,saturation,showAccent;varying vec3 vP,vView,vNormal;
vec3 palette(float t){
  vec3 violet=vec3(.24,.025,.55),pink=vec3(.95,.055,.34);
  vec3 amber=vec3(1.,.37,.045),cyan=vec3(.035,.57,.66);
  float f=fract(t)*4.;
  if(f<1.)return mix(violet,pink,smoothstep(0.,1.,f));
  if(f<2.)return mix(pink,amber,smoothstep(1.,2.,f));
  if(f<3.)return mix(amber,cyan,smoothstep(2.,3.,f));
  return mix(cyan,violet,smoothstep(3.,4.,f));
}
void main(){vec3 n=normalize(vNormal),view=normalize(-vView);
float facing=max(dot(n,view),0.),rim=pow(1.-facing,3.);
float flow=vP.y*.14+vP.x*.10+sin(vP.z*1.9+time*.24)*.13+time*.025+mid*.12+hue;
vec3 col=palette(flow+.65);
vec3 key=normalize(vec3(-.65,1.,1.4)),fill=normalize(vec3(1.,-.3,.8));
float diffuse=max(dot(n,key),0.);
float softSpec=pow(max(dot(n,normalize(key+view)),0.),24.);
float glint=pow(max(dot(n,normalize(fill+view)),0.),70.);
float silk=pow(.5+.5*sin(vP.y*3.+vP.x*2.+sin(vP.z*2.-time*.25)),5.);
vec3 color=col*(.16+diffuse*.65+silk*.15+energy*.17);
color+=palette(flow+.83)*rim*(.7+volume*.4+beat*.75);
color+=mix(col,vec3(1.,.78,.65),.65)*softSpec*.65;
color+=vec3(.4,.85,1.)*glint*.65;
color=mix(vec3(dot(color,vec3(.2126,.7152,.0722))),color,saturation);
gl_FragColor=vec4(color*(1.+volume*.35+beat*.85+showAccent*.75),1.);}`;

// Identical UV triangle layout for all shapes, including the torus. Only the
// attributes change at selection; the transition itself is evaluated on GPU.
function shapes(){
  const arrays=Array.from({length:6},()=>[]),normals=Array.from({length:6},()=>[]);const U=80,V=40;
  const point=(u,v,k)=>{const a=u*Math.PI*2,b=v*Math.PI,x=Math.sin(b)*Math.cos(a),y=Math.cos(b),z=Math.sin(b)*Math.sin(a);let r;
    if(k===0){r=1.48*(1+.045*Math.cos(a*5)*Math.sin(b*3)**2);return[x*r,y*r,z*r];}
    if(k===1){r=1.13/Math.max(Math.abs(x),Math.abs(y),Math.abs(z));return[x*r,y*r,z*r];}
    if(k===2){r=Math.min(y<0?-1.05/y:1e4,1.05/Math.max(.00001,Math.abs(x)+y*.65),1.05/Math.max(.00001,Math.abs(z)+y*.65));return[x*r,y*r,z*r];}
    if(k===3){r=1/(Math.abs(y)/1.9+(Math.abs(x)+Math.abs(z))/1.65);return[x*r,y*r,z*r];}
    if(k===4){r=1.2+.63*Math.pow(.5+.5*Math.cos(a*5),3)*Math.sin(b)**2;return[x*r,y*1.35,z*r];}
    const c=v*Math.PI*2;return[(1.12+.47*Math.cos(c))*Math.cos(a),.47*Math.sin(c),(1.12+.47*Math.cos(c))*Math.sin(a)];
  };
  const tangentU=new T.Vector3(),tangentV=new T.Vector3(),normal=new T.Vector3();
  for(let j=0;j<V;j++)for(let i=0;i<U;i++){const corners=[[i/U,j/V],[(i+1)/U,j/V],[i/U,(j+1)/V],[(i+1)/U,j/V],[(i+1)/U,(j+1)/V],[i/U,(j+1)/V]];corners.forEach(([u,v])=>{for(let k=0;k<6;k++){
    arrays[k].push(...point(u,v,k));
    const safeV=k===5?v:Math.max(.0001,Math.min(.9999,v)),e=.00005;
    const ua=point(u+e,safeV,k),ub=point(u-e,safeV,k),va=point(u,safeV+e,k),vb=point(u,safeV-e,k);
    tangentU.set(ua[0]-ub[0],ua[1]-ub[1],ua[2]-ub[2]);tangentV.set(va[0]-vb[0],va[1]-vb[1],va[2]-vb[2]);normal.crossVectors(tangentU,tangentV).normalize();if(k===5)normal.negate();normals[k].push(normal.x,normal.y,normal.z);
  }});}
  return{arrays:arrays.map(a=>new Float32Array(a)),normals:normals.map(a=>new Float32Array(a))};
}

export class Visual {
 constructor(host,onQuality){
  this.host=host;this.onQuality=onQuality;this.renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance'});host.append(this.renderer.domElement);this.renderer.setClearColor(0x07080b);this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(38,1,.1,60);this.camera.position.set(0,0,7.5);
  this.uniforms={time:{value:0},morph:{value:1},bass:{value:0},mid:{value:0},energy:{value:0},volume:{value:0},beat:{value:0},hue:{value:0},saturation:{value:1},showAccent:{value:0}};
  const data=shapes();this.arrays=data.arrays;this.normals=data.normals;this.geometry=new T.BufferGeometry();this.geometry.setAttribute('position',new T.BufferAttribute(data.arrays[0].slice(),3));this.geometry.setAttribute('target',new T.BufferAttribute(data.arrays[0].slice(),3));this.geometry.setAttribute('surfaceNormal',new T.BufferAttribute(data.normals[0].slice(),3));this.geometry.setAttribute('targetNormal',new T.BufferAttribute(data.normals[0].slice(),3));this.geometry.boundingSphere=new T.Sphere(new T.Vector3(),3);
  // Smooth pearlescent skin: no wire overlay or duplicate inner silhouette.
  this.material=new T.ShaderMaterial({uniforms:this.uniforms,vertexShader:vertex,fragmentShader:fragment,side:T.DoubleSide});this.group=new T.Group();this.mesh=new T.Mesh(this.geometry,this.material);this.group.add(this.mesh);this.scene.add(this.group);this.group.rotation.set(.15,.2,-.13);
  this.kaleidoscope=new Kaleidoscope();this.scene.background=this.kaleidoscope.targetTexture.texture;
  this.makeAtmosphere();this.makeBeatEffects();this.makePost();this.quality=1;this.slow=0;this.frames=0;this.totalTime=0;this.drag=false;this.vx=0;this.vy=0;this.auto=1;
  this.interactionHold=0;this.userCamera={yaw:0,pitch:0,zoom:1};this.cameraMotion={yaw:0,pitch:0,zoom:1};this.frameCenter=new T.Vector2(.58,.5);this.averageFps=60;this.bind();this.resize();
 }
 makeAtmosphere(){
  const count=1800,p=new Float32Array(count*3),seed=new Float32Array(count);for(let i=0;i<count;i++){p[i*3]=(Math.random()-.5)*17;p[i*3+1]=(Math.random()-.5)*11;p[i*3+2]=(Math.random()-.5)*13;seed[i]=Math.random();}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(p,3));g.setAttribute('seed',new T.BufferAttribute(seed,1));this.particleGeometry=g;
  this.particleUniforms={time:this.uniforms.time,high:{value:0},energy:this.uniforms.energy,pixel:{value:1},tint:{value:this.kaleidoscope.tint},tintSecondary:{value:this.kaleidoscope.tintSecondary}};
  this.particles=new T.Points(g,new T.ShaderMaterial({uniforms:this.particleUniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexShader:`attribute float seed;uniform float time,high,pixel;varying float s;void main(){s=seed;vec3 p=position;p.x+=sin(time*.07+seed*12.)*.7;p.y+=sin(time*.1+seed*20.)*.5;p.z+=sin(time*.08+seed*30.)*1.2;vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=min(28.,(1.5+pow(seed,12.)*30.+high*4.)*pixel*6./max(1.,-mv.z));gl_Position=projectionMatrix*mv;}`,fragmentShader:`uniform float time,high;uniform vec3 tint,tintSecondary;varying float s;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float a=pow(1.-d,3.)*(.3+high*.65)*(.7+.3*sin(time*(1.+high*4.)+s*40.));vec3 c=mix(tint,tintSecondary,s);gl_FragColor=vec4(c,a);}`}));this.scene.add(this.particles);
  this.orbits=new T.Group();this.scene.add(this.orbits);for(let k=0;k<5;k++){const verts=[],colors=[];const color=new T.Color();for(let i=0;i<=256;i++){let a=i/256*Math.PI*2;verts.push(Math.cos(a)*(2.05+k*.12),Math.sin(a)*(2.05+k*.12),0);color.setHSL(.47+i/256*.35,.7,.5);colors.push(color.r,color.g,color.b);}let geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));const line=new T.Line(geo,new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.08+k*.012,blending:T.AdditiveBlending,depthWrite:false}));line.rotation.set(.95+k*.2,.2+k*.5,k*.6);this.orbits.add(line);}
  // One generated glow texture, shared by all atmospheric sprites.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),grad=ctx.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,'#ffffff');grad.addColorStop(.15,'#ffffff80');grad.addColorStop(.5,'#ffffff19');grad.addColorStop(1,'#ffffff00');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);const texture=new T.CanvasTexture(canvas);this.glows=[];
  [[0,0,-2,6,0x127c78,.15],[1,-.5,-4,6,0x8d2259,.13],[-2,1,-5,8,0x153c50,.11],[-2.9,.8,1.3,3,0x65cbb3,.04],[2.8,-.8,2,2.4,0xa66ec4,.04],[-3,-2,3,1.2,0x94c5d9,.035],[3,2,-1,1.8,0xcc87b0,.05]].forEach(([x,y,z,size,color,opacity])=>{const sp=new T.Sprite(new T.SpriteMaterial({map:texture,color,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false}));sp.position.set(x,y,z);sp.scale.set(size,size,1);sp.userData.opacity=opacity;this.scene.add(sp);this.glows.push(sp);});
  const rayGeometry=new T.PlaneGeometry(1,1);this.rays=new T.Group();
  const rayMaterial=new T.ShaderMaterial({uniforms:{time:this.uniforms.time,energy:this.uniforms.energy,beat:this.uniforms.beat,tint:{value:this.kaleidoscope.tint}},transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform float time,energy,beat;uniform vec3 tint;void main(){float width=.09+.12*vUv.y;float shaft=exp(-pow((vUv.x-.5)/width,2.));float fade=pow(sin(vUv.y*3.14159),2.);float haze=.7+.3*sin(vUv.y*9.+time*.14);gl_FragColor=vec4(tint,shaft*fade*haze*(.025+energy*.035+beat*.025));}`});
  for(let i=0;i<7;i++){const ray=new T.Mesh(rayGeometry,rayMaterial);ray.position.set((i-3)*1.45,.5,-3+(i%3)*2.3);ray.scale.set(.65+i%2*.6,9+i%3,1);ray.rotation.z=(i-3)*-.17;this.rays.add(ray);}this.scene.add(this.rays);
 }
 makeBeatEffects(){
  // Four fixed slots allow overlapping beats without allocating per hit.
  this.beatWaves=[];const geometry=new T.RingGeometry(1,1.026,128);
  this.burstUniforms={pulses:{value:Array.from({length:4},()=>new T.Vector4(2,0,0,0))},pixel:{value:1},tint:{value:this.kaleidoscope.tint},tintSecondary:{value:this.kaleidoscope.tintSecondary}};
  for(let i=0;i<4;i++){
   const material=new T.MeshBasicMaterial({color:i%2?0xf778ba:0x8effec,transparent:true,opacity:0,blending:T.AdditiveBlending,side:T.DoubleSide,depthWrite:false});
   const wave=new T.Mesh(geometry,material);wave.visible=false;this.scene.add(wave);this.beatWaves.push(wave);
  }
  const count=768,positions=new Float32Array(count*3),seeds=new Float32Array(count),slots=new Float32Array(count);
  for(let i=0;i<count;i++){const a=i*2.3999632297,y=1-2*((i%192)+.5)/192,r=Math.sqrt(1-y*y);positions.set([r*Math.cos(a),y,r*Math.sin(a)],i*3);seeds[i]=Math.random();slots[i]=Math.floor(i/192);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setAttribute('seed',new T.BufferAttribute(seeds,1));g.setAttribute('slot',new T.BufferAttribute(slots,1));g.boundingSphere=new T.Sphere(new T.Vector3(),7);
  this.burst=new T.Points(g,new T.ShaderMaterial({uniforms:this.burstUniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
   vertexShader:`attribute float seed,slot;uniform vec4 pulses[4];uniform float pixel;uniform vec3 tint,tintSecondary;varying float alpha;varying vec3 vTint;
    void main(){vec4 pulse=pulses[int(slot)];float age=pulse.x,strength=pulse.y;float alive=step(0.,age)*(1.-step(1.05,age));
    float radius=1.5+age*(2.5+seed*1.5);vec3 p=position*radius;p.y-=age*age*.3;
    alpha=alive*strength*pow(max(0.,1.-age/1.05),2.)*min(1.,age/.012);
    vTint=mix(tint,tintSecondary,seed);vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=(2.+seed*3.)*pixel*5./max(1.,-mv.z);gl_Position=projectionMatrix*mv;}`,
   fragmentShader:`varying float alpha;varying vec3 vTint;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(vTint,alpha*pow(1.-r,1.6));}`}));this.scene.add(this.burst);
 }
 makePost(){
  this.base=new T.WebGLRenderTarget(1,1);this.bloom=new T.WebGLRenderTarget(1,1,{depthBuffer:false});this.postScene=new T.Scene();this.postCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);this.postUniforms={image:{value:this.base.texture},glow:{value:this.bloom.texture},texel:{value:new T.Vector2()},pass:{value:0},energy:this.uniforms.energy};
  this.post=new T.ShaderMaterial({uniforms:this.postUniforms,depthTest:false,depthWrite:false,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`varying vec2 vUv;uniform sampler2D image,glow;uniform vec2 texel;uniform float pass,energy;void main(){vec3 base=texture2D(image,vUv).rgb;if(pass<.5){vec3 b=vec3(0.);for(int x=-3;x<=3;x++)for(int y=-3;y<=3;y++){vec3 c=texture2D(image,vUv+vec2(float(x),float(y))*texel*3.).rgb;float w=exp(-float(x*x+y*y)*.19);b+=max(c-.13,0.)*w;}gl_FragColor=vec4(b/15.,1.);}else{vec3 bloom=texture2D(glow,vUv).rgb;vec3 c=base+bloom*(.9+energy*.6);c=1.-exp(-c*1.5);c=pow(c,vec3(.85));gl_FragColor=vec4(c,1.);}}`});this.postScene.add(new T.Mesh(new T.PlaneGeometry(2,2),this.post));
 }
 setShape(index){const m=this.uniforms.morph.value;for(const [source,target,values] of [['position','target',this.arrays],['surfaceNormal','targetNormal',this.normals]]){const from=this.geometry.attributes[source],to=this.geometry.attributes[target];for(let i=0;i<from.array.length;i++)from.array[i]+=(to.array[i]-from.array[i])*m;to.array.set(values[index]);from.needsUpdate=to.needsUpdate=true;}this.uniforms.morph.value=0;this.morphTime=0;}
 bind(){const c=this.renderer.domElement;
  c.addEventListener('pointerdown',e=>{if(this.artist?.enabled||e.button>0)return;this.drag=true;this.interactionHold=5;this.x=e.clientX;this.y=e.clientY;c.setPointerCapture(e.pointerId);});
  c.addEventListener('pointermove',e=>{if(!this.drag||this.artist?.enabled)return;const dx=e.clientX-this.x,dy=e.clientY-this.y;this.vy=dx*.005;this.vx=dy*.005;this.userCamera.yaw=T.MathUtils.clamp(this.userCamera.yaw-dx*.0008,-.18,.18);this.userCamera.pitch=T.MathUtils.clamp(this.userCamera.pitch+dy*.0007,-.12,.12);this.interactionHold=5;this.x=e.clientX;this.y=e.clientY;});
  const stop=()=>this.drag=false;c.addEventListener('pointerup',stop);c.addEventListener('pointercancel',stop);
  c.addEventListener('wheel',e=>{if(this.artist?.enabled)return;e.preventDefault();this.userCamera.zoom=T.MathUtils.clamp(this.userCamera.zoom*Math.exp(e.deltaY*.0005),.9,1.2);this.interactionHold=5;},{passive:false});
  window.addEventListener('resize',()=>this.resize());c.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.onQuality('ГРАФИКА ПРИОСТАНОВЛЕНА');});c.addEventListener('webglcontextrestored',()=>{this.lost=false;this.resize();});}
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;this.width=w;this.height=h;
  const panel=document.querySelector('.console'),hostTop=this.host.getBoundingClientRect().top;
  const hidden=document.getElementById('experience').classList.contains('panels-hidden');
  const bounds=panel.getBoundingClientRect(),sidebar=!hidden&&w>=960;
  const freeWidth=sidebar?Math.max(300,bounds.left-28):w;
  const top=hidden?h*.07:w<760?116:96,bottom=hidden?h*.93:sidebar?h-28:bounds.top-hostTop-20;
  const available=Math.max(145,bottom-top),centerY=top+available*.5,centerX=sidebar?freeWidth*.5/w:.5;
  this.diameter=Math.min(freeWidth*.8,available*.9);this.layoutX=centerX;this.layoutY=centerY/h;
  const dpr=Math.min(devicePixelRatio,1.65)*this.quality;
  this.renderer.setPixelRatio(dpr);this.renderer.setSize(w,h);this.camera.aspect=w/h;
  this.camera.setViewOffset(w,h,w*(.5-this.frameCenter.x),h*(.5-this.frameCenter.y),w,h);this.camera.updateProjectionMatrix();
  this.kaleidoscope.resize(w,h,dpr,this.frameCenter.x,1-this.frameCenter.y);
  this.base.setSize(Math.round(w*dpr),Math.round(h*dpr));this.bloom.setSize(Math.max(1,Math.round(w*dpr*.35)),Math.max(1,Math.round(h*dpr*.35)));this.postUniforms.texel.value.set(1/(w*dpr),1/(h*dpr));this.particleUniforms.pixel.value=dpr;this.burstUniforms.pixel.value=dpr;}
 updateCamera(dt,show){
  this.interactionHold=Math.max(0,this.interactionHold-dt);const manual=this.drag||this.interactionHold>0||this.artist?.drawing;
  const ease=1-Math.exp(-dt*2.4),returnEase=1-Math.exp(-dt*.7),u=this.userCamera,m=this.cameraMotion;
  if(!manual){u.yaw*=1-returnEase;u.pitch*=1-returnEase;u.zoom+=(1-u.zoom)*returnEase;}
  m.yaw+=((manual?u.yaw:show.cameraYaw+u.yaw)-m.yaw)*ease;m.pitch+=((manual?u.pitch:show.cameraPitch+u.pitch)-m.pitch)*ease;m.zoom+=((manual?u.zoom:show.zoom*u.zoom)-m.zoom)*ease;
  this.frameCenter.x+=(this.layoutX-this.frameCenter.x)*ease;this.frameCenter.y+=(this.layoutY-this.frameCenter.y)*ease;
  const fov=this.camera.fov+(show.fov-this.camera.fov)*returnEase,tan=Math.tan(fov*Math.PI/360);
  const wanted=4.65*this.height/(2*tan*this.diameter)*m.zoom,safe=4.35*this.height/(2*tan*this.diameter);
  m.distance??=wanted;m.distance+=(wanted-m.distance)*ease;const distance=Math.max(m.distance,safe);
  this.camera.position.set(Math.sin(m.yaw)*distance,Math.sin(m.pitch)*distance,Math.cos(m.yaw)*distance);this.camera.lookAt(0,0,0);
  this.camera.fov=fov;this.camera.setViewOffset(this.width,this.height,this.width*(.5-this.frameCenter.x),this.height*(.5-this.frameCenter.y),this.width,this.height);this.camera.updateProjectionMatrix();
  this.kaleidoscope.uniforms.center.value.set(this.frameCenter.x,1-this.frameCenter.y);
 }
 update(dt,t,music,show){if(this.lost)return;const u=this.uniforms;u.time.value=t;for(const k of ['bass','mid','energy','volume','beat'])u[k].value=music[k];this.particleUniforms.high.value=music.high;
  this.averageFps+=(Math.min(120,1/Math.max(.001,dt))-this.averageFps)*(1-Math.exp(-dt));
  u.hue.value=show.palette;u.saturation.value=show.saturation;u.showAccent.value=show.accent;
  this.updateCamera(dt,show);this.kaleidoscope.update(dt,t,music,show);
  if(u.morph.value<1){this.morphTime+=dt/2.1;const x=Math.min(1,this.morphTime);u.morph.value=x*x*(3-2*x);}
  this.group.scale.setScalar(1+.15*music.beat);
  for(let i=0;i<4;i++){const pulse=music.pulses[i],age=pulse?.age??2,strength=pulse?.strength??0,wave=this.beatWaves[i];this.burstUniforms.pulses.value[i].set(age,strength,0,0);wave.material.color.copy(i%2?this.kaleidoscope.tintSecondary:this.kaleidoscope.tint);wave.visible=age<1.05&&strength>0;if(wave.visible){wave.scale.setScalar(1.55+age*3.1);wave.material.opacity=strength*Math.min(1,age/.012)*Math.exp(-age*4.4)*.75;}}
  this.auto+=((this.drag||this.artist?.drawing?0:1)-this.auto)*(1-Math.exp(-dt*2));this.group.rotation.y+=dt*(.13+music.energy*.045)*show.motion*this.auto+this.vy;this.group.rotation.x+=dt*.032*show.motion*this.auto+this.vx;const damping=Math.exp(-dt*12);this.vx*=damping;this.vy*=damping;
  this.orbits.rotation.y=t*.025;this.orbits.rotation.z=Math.sin(t*.05)*.15;this.particles.rotation.y=t*.008;this.rays.rotation.z=Math.sin(t*.07)*.06;
  this.orbits.children.forEach(line=>{line.material.color.copy(this.kaleidoscope.tint);line.material.opacity=.045+music.energy*.04;});
  this.glows.forEach((g,i)=>{g.material.color.copy(this.kaleidoscope.tint).lerp(this.kaleidoscope.tintSecondary,(i%3)*.5);g.material.opacity=(g.userData.opacity+music.volume*.05+music.beat*.025)*(1+Math.sin(t*.3+i)*.15)*show.atmosphere;});
  const r=this.renderer;this.kaleidoscope.render(r);r.setRenderTarget(this.base);r.render(this.scene,this.camera);this.postUniforms.pass.value=0;this.postUniforms.glow.value=null;r.setRenderTarget(this.bloom);r.render(this.postScene,this.postCamera);this.postUniforms.pass.value=1;this.postUniforms.glow.value=this.bloom.texture;r.setRenderTarget(null);r.render(this.postScene,this.postCamera);
  if(dt<.2){this.frames++;this.totalTime+=dt;if(this.frames>=150){const fps=this.frames/this.totalTime;if(fps<43)this.slow++;else this.slow=0;if(this.slow>=2&&this.quality>.55){this.quality=Math.max(.55,this.quality-.2);this.particleGeometry.setDrawRange(0,Math.floor(1800*this.quality));this.resize();this.onQuality('ЭКОНОМНЫЙ РЕЖИМ');this.slow=0;}this.frames=0;this.totalTime=0;}}
 }
 dispose(){
  this.kaleidoscope.dispose();this.base.dispose();this.bloom.dispose();
  const geometries=new Set(),materials=new Set(),textures=new Set();
  for(const scene of [this.scene,this.postScene])scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
  materials.forEach(m=>{if(m.map)textures.add(m.map);m.dispose();});geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());this.renderer.dispose();
 }
}
