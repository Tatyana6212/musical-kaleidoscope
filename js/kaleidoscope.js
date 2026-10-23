import * as T from '../vendor/three.module.js';

const fragment=`
precision highp float;
varying vec2 vUv;
uniform vec2 resolution,center;
uniform float time,sectors,intensity,beat,bass,mid,high,energy;
uniform float hue,saturation,showGain;
uniform sampler2D ink;
uniform float weights[5];
const float PI=3.14159265359;
mat2 turn(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float cloud(vec2 p){return noise(p)*.57+noise(p*2.03)*.28+noise(p*4.07)*.15;}
float glow(float d,float width){return width/(abs(d)+width);}
float stroke(float d,float width){return 1.-smoothstep(width,width+fwidth(d)*1.5,abs(d));}
// Alternate sectors reflect a single wedge; all geometry is evaluated inside it.
vec2 mirror(vec2 p,float rotation){float w=2.*PI/sectors,a=mod(atan(p.y,p.x)+rotation,2.*w);a=w-abs(a-w);return length(p)*vec2(cos(a-w*.5),sin(a-w*.5));}
vec3 mandala(vec2 p){
 vec3 c=vec3(0.);float t=time*.12;
 for(int layer=0;layer<4;layer++){
  float l=float(layer),depth=1.+l*.33;vec2 q=mirror(p*depth/(1.+beat*.085),t*(mod(l,2.)<.5?1.:-.73)+l*.4);
  float r=length(q),a=atan(q.y,q.x),fold=cos(a*sectors);
  float petal=.67+.105*sin(t*1.7+l)+.20*cos(a*sectors*2.+sin(r*8.-t)*.7);
  float d=r-(petal+.08*sin(r*13.-t+l));
  float lace=stroke(d,.0025)+.2*glow(d,.009);
  float rings=pow(.5+.5*cos(r*32.-t*(1.+l*.2)+fold*1.7),24.);
  float veins=pow(.5+.5*cos(a*sectors*4.+r*15.+sin(r*7.-t)),22.);
  float mask=smoothstep(.2,.5,r)*(1.-smoothstep(1.5,2.3,r));
  vec3 tint=mix(vec3(.13,.75,.67),vec3(.79,.28,.65),.5+.5*sin(r*5.+l+t*.2));
  c+=tint*(lace*.72+rings*.16+veins*.12)*mask/(1.+l*.6);
 }
 return c;
}
vec3 crystals(vec2 p){
 vec3 c=vec3(0.);float t=time*.09;
 for(int layer=0;layer<4;layer++){
  float l=float(layer);vec2 q=mirror(p*(1.+l*.45)/(1.+beat*.065),t*(l<2.?1.:-.6)+l*.8);
  q=turn(.15*sin(t+l))*q;q.x+=t*.12*(mod(l,2.)<.5?1.:-1.);
  vec2 cell=floor(q*4.5),f=fract(q*4.5)-.5;float id=hash(cell+l);
  float facet=max(abs(f.x)*.86+f.y*.5,-f.y)-(.22+.08*sin(t*2.+id*6.));
  float edge=stroke(facet,.009)+glow(facet,.014)*.22;
  float face=(1.-smoothstep(-.03,.01,facet))*(.08+.08*noise(cell+f*3.+t));
  float split=stroke(abs(f.x)*.86-f.y*.5,.008)*(1.-smoothstep(.29,.4,length(f)));
  float glint=pow(max(0.,cos(id*25.+t*1.4)),28.)*glow(length(f-vec2(.1,.2)),.015);
  vec3 tint=mix(vec3(.12,.49,.95),vec3(.77,.51,1.),id);
  c+=tint*(edge*.28+face+split*.13+glint*.6)/(1.+l*.8);
 }
 return c*smoothstep(.12,.65,length(p));
}
vec3 cosmos(vec2 p){
 vec3 c=vec3(0.);float t=time*.055;
 for(int layer=0;layer<3;layer++){
  float l=float(layer);vec2 q=mirror(p*(1.+l*.7),t*(l==1.?-.6:1.)+l*.3);
  float r=length(q),a=atan(q.y,q.x),swirl=a*3.+log(r+.18)*5.-t*(1.+l*.4);
  float nebula=cloud(q*3.2+vec2(t,-t*.7)+l*8.);
  float spiral=pow(.5+.5*sin(swirl+nebula*3.),4.)*nebula;
  vec3 tint=mix(vec3(.08,.22,.66),vec3(.52,.12,.64),nebula);
  c+=tint*spiral*.34/(1.+l*.7);
  vec2 grid=q*(28.+l*17.),id=floor(grid),f=fract(grid)-.5;float star=hash(id+l*7.);
  float twinkle=.6+.4*sin(time*(.5+star*1.7)+star*82.);
  float dotStar=exp(-dot(f,f)*(200.+star*400.))*step(.94,star);
  c+=mix(vec3(.37,.75,1.),vec3(1.,.68,.89),star)*dotStar*twinkle*(.6+high*.9)/(1.+l*.35);
 }
 return c;
}
vec3 flowers(vec2 p){
 vec3 c=vec3(0.);float t=time*.09;
 for(int layer=0;layer<4;layer++){
  float l=float(layer);vec2 q=mirror(p*(1.+l*.34)/(1.+beat*.09),t*(mod(l,2.)<.5?1.:-.8)+l*.5);
  float r=length(q),a=atan(q.y,q.x),petals=cos(a*sectors*1.5+sin(r*3.-t)*.7);
  float edge=.53+.24*petals+.07*sin(t*1.6+l),d=r-edge;
  float skin=exp(-abs(d)*8.)*(.3+.7*pow(.5+.5*sin(a*sectors*3.+r*9.-t),3.));
  float line=stroke(d,.003)+glow(d,.012)*.2;
  float vein=pow(.5+.5*cos(r*45.+petals*5.-t),18.)*skin;
  float pollen=pow(noise(q*65.+l),25.)*skin*5.;
  vec3 tint=mix(vec3(.91,.16,.39),vec3(1.,.62,.30),.5+.5*sin(r*4.+t+l));
  tint=mix(tint,vec3(.58,.2,.86),l*.17);
  c+=tint*(skin*.22+line*.38+vein*.1+pollen*.25)/(1.+l*.6);
 }
 return c;
}
vec3 lasers(vec2 p){
 vec3 c=vec3(0.);float t=time*.16;
 for(int layer=0;layer<3;layer++){
  float l=float(layer);vec2 q=mirror(p,t*(mod(l,2.)<.5?1.:-.7)+l*.3);
  float r=length(q),a=atan(q.y,q.x);
  float fan=abs(sin(a*sectors*2.+sin(t*1.4+l)*r*2.));
  float ray=pow(glow(fan,.012),2.)+glow(fan,.04)*.1;
  float tunnel=abs(fract(log(r+.12)*2.4-t*(1.+l*.2)-beat*.12)-.5);
  float rings=stroke(tunnel,.009)+glow(tunnel,.018)*.12;
  float diamond=abs(q.x)+abs(q.y)*(.8+.3*sin(t+l));
  float frame=abs(fract(diamond*3.-t*.4)-.5);
  float trace=glow(abs(sin(a*sectors*2.+sin((t-.045)*1.4+l)*r*2.)),.025)*.07;
  vec3 tint=mix(vec3(.02,.9,.69),vec3(1.,.04,.37),.5+.5*sin(l*2.+r*2.+t*.3));
  c+=tint*(ray*.3+rings*.14+stroke(frame,.008)*.09+trace)/(1.+l*.6);
 }
 return c*smoothstep(.08,.45,length(p));
}
void main(){
 vec2 raw=(vUv-center)*vec2(resolution.x/resolution.y,1.)*2.;vec2 p=raw;float r=length(p);
 p*=1.+mid*.025+bass*.025;
 // Fold the entire composition first, so all layers share exact mirror axes.
 p=mirror(p,time*.025);
 vec3 c=vec3(0.);
 if(weights[0]>.001)c+=mandala(p)*weights[0];
 if(weights[1]>.001)c+=crystals(p)*weights[1];
 if(weights[2]>.001)c+=cosmos(p)*weights[2];
 if(weights[3]>.001)c+=flowers(p)*weights[3];
 if(weights[4]>.001)c+=lasers(p)*weights[4];
 // Keep a dark pocket around the sculpture, with depth fading at the edges.
 float focus=mix(.18,1.,smoothstep(.26,.68,r));
 float depth=exp(-r*.23)*(1.-smoothstep(2.3,3.4,r));
 vec2 inkPoint=mirror(raw/(1.+beat*.04),time*.025);
 vec4 drawing=texture2D(ink,inkPoint/4.+.5);
 c+=drawing.rgb*drawing.a*(.8+beat*.6);
 vec3 axis=vec3(.57735027);float angle=hue*3.14159;
 c=max(vec3(0.),c*cos(angle)+cross(axis,c)*sin(angle)+axis*dot(axis,c)*(1.-cos(angle)));
 c=mix(vec3(dot(c,vec3(.2126,.7152,.0722))),c,saturation);
 c*=focus*depth*intensity*(.53+energy*.24+beat*.46)*showGain;
 gl_FragColor=vec4(vec3(.012,.015,.023)+c,1.);
}`;

export const STYLE_NAMES=['Мандала','Кристаллы','Космос','Цветы','Лазеры'];
const COLORS=[0x55d5ba,0x9aa8ff,0x9474ed,0xf0a1b0,0x32e7ca];

export class Kaleidoscope {
 constructor(onChange){
  this.onChange=onChange;this.selected=0;this.auto=true;this.age=0;this.wait=0;this.bag=[];
  this.weights=new Float32Array([1,0,0,0,0]);this.from=this.weights.slice();this.target=0;this.fade=1;
  this.tint=new T.Color(COLORS[0]);this.tintSecondary=new T.Color();this.palette=COLORS.map(c=>new T.Color(c));
  this.uniforms={resolution:{value:new T.Vector2(1,1)},center:{value:new T.Vector2(.58,.5)},time:{value:0},sectors:{value:12},intensity:{value:.72},weights:{value:this.weights},beat:{value:0},bass:{value:0},mid:{value:0},high:{value:0},energy:{value:0},ink:{value:null},hue:{value:0},saturation:{value:1},showGain:{value:1}};
  this.symmetry=12;this.intensity=.72;
  this.scene=new T.Scene();this.camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
  this.geometry=new T.PlaneGeometry(2,2);this.material=new T.ShaderMaterial({uniforms:this.uniforms,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:fragment,depthWrite:false,depthTest:false});
  this.scene.add(new T.Mesh(this.geometry,this.material));this.targetTexture=new T.WebGLRenderTarget(1,1,{depthBuffer:false});
 }
 select(index,manual=true){
  if(manual)this.auto=false;
  if(index!==this.selected){this.from.set(this.weights);this.target=index;this.selected=index;this.fade=0;}
  this.age=0;this.wait=0;this.onChange?.(this.selected,this.auto);
 }
 setAuto(enabled){this.auto=enabled;this.age=0;this.wait=0;this.onChange?.(this.selected,this.auto);}
 next(){
  if(!this.bag.length){this.bag=[0,1,2,3,4];for(let i=4;i>0;i--){const j=Math.floor(Math.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}}
  let next=this.bag.pop();if(next===this.selected){const i=this.bag.findIndex(x=>x!==this.selected);if(i>=0){const other=this.bag[i];this.bag[i]=next;next=other;}else next=(next+1)%5;}
  this.select(next,false);
 }
 update(dt,time,music,show){
  if(this.auto&&!this.managed){this.age+=dt;if(this.age>=24){this.wait+=dt;let nearBeat=false;for(const pulse of music.pulses)if(pulse.strength>.55&&pulse.age>=0&&pulse.age<.07)nearBeat=true;if(nearBeat||this.wait>2.5)this.next();}}
  if(this.fade<1){this.fade=Math.min(1,this.fade+dt/2.6);const x=this.fade*this.fade*(3-2*this.fade);for(let i=0;i<5;i++)this.weights[i]=this.from[i]*(1-x)+(i===this.target?x:0);}
  const u=this.uniforms;u.time.value=time;for(const k of ['beat','bass','mid','high','energy'])u[k].value=music[k];
  u.intensity.value+=(this.intensity-u.intensity.value)*(1-Math.exp(-dt*4));
  u.sectors.value=this.symmetry;
  if(show){u.hue.value=show.palette;u.saturation.value=show.saturation;u.showGain.value=show.atmosphere+show.accent*.4;}
  this.tint.setRGB(0,0,0);this.tintSecondary.setRGB(0,0,0);
  for(let i=0;i<5;i++){const a=this.palette[i],b=this.palette[(i+2)%5],w=this.weights[i];this.tint.r+=a.r*w;this.tint.g+=a.g*w;this.tint.b+=a.b*w;this.tintSecondary.r+=b.r*w;this.tintSecondary.g+=b.g*w;this.tintSecondary.b+=b.b*w;}
  if(show){this.tint.offsetHSL(show.palette*.3,0,0);this.tintSecondary.offsetHSL(show.palette*.3,0,0);}
 }
 resize(w,h,dpr,centerX,centerY){this.uniforms.resolution.value.set(w,h);this.uniforms.center.value.set(centerX,centerY);this.targetTexture.setSize(Math.max(1,Math.round(w*dpr*.5)),Math.max(1,Math.round(h*dpr*.5)));}
 render(renderer){renderer.setRenderTarget(this.targetTexture);renderer.render(this.scene,this.camera);}
 dispose(){this.targetTexture.dispose();this.geometry.dispose();this.material.dispose();}
}
