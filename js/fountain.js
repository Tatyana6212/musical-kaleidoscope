import * as T from '../vendor/three.module.js';

// 320 ribbons share one instanced geometry. Heights come only from smoothed
// logarithmic spectrum bands; moving highlights simulate the flow of water.
export class SpectralFountain {
 constructor(tint,secondary){
  this.group=new T.Group();const source=new T.PlaneGeometry(2,1,1,12);source.translate(0,.5,0);
  const geometry=new T.InstancedBufferGeometry();geometry.index=source.index.clone();geometry.setAttribute('position',source.attributes.position.clone());geometry.setAttribute('uv',source.attributes.uv.clone());source.dispose();
  const count=320,angles=new Float32Array(count),bands=new Float32Array(count),seeds=new Float32Array(count);
  for(let i=0;i<count;i++){angles[i]=i/count*Math.PI*2;bands[i]=i%64;seeds[i]=(i*.61803398875)%1;}
  geometry.setAttribute('aAngle',new T.InstancedBufferAttribute(angles,1));geometry.setAttribute('aBand',new T.InstancedBufferAttribute(bands,1));geometry.setAttribute('aSeed',new T.InstancedBufferAttribute(seeds,1));geometry.instanceCount=count;geometry.boundingSphere=new T.Sphere(new T.Vector3(),6);
  this.uniforms={spectrum:{value:new Float32Array(64)},time:{value:0},radius:{value:2.35},effects:{value:1},beat:{value:0},tint:{value:tint},secondary:{value:secondary}};
  this.material=new T.ShaderMaterial({uniforms:this.uniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
   vertexShader:`attribute float aAngle,aBand,aSeed;uniform float spectrum[64],time,radius;varying vec2 vUv;varying float level,seed;void main(){vUv=uv;seed=aSeed;level=spectrum[int(aBand)];float t=position.y;float h=.035+pow(level,.75)*3.15;float r=radius+t*t*(.1+level*.28);vec3 p=vec3(cos(aAngle)*r,-1.68+t*h,sin(aAngle)*r);p.x+=sin(t*7.-time*1.2+aSeed*6.28)*.012*t*level;vec4 mv=modelViewMatrix*vec4(p,1.);mv.x+=position.x*(.009+.007*level)*(1.+smoothstep(.93,1.,t));gl_Position=projectionMatrix*mv;}`,
   fragmentShader:`uniform float time,effects,beat;uniform vec3 tint,secondary;varying vec2 vUv;varying float level,seed;void main(){float x=(vUv.x-.5)*2.;float core=exp(-x*x*8.);float tip=pow(vUv.y,20.);float droplets=pow(.5+.5*sin(vUv.y*90.-time*(8.+seed*5.)+seed*40.),18.);float fade=1.-smoothstep(.97,1.,vUv.y);vec3 color=mix(tint,secondary,.5+.5*sin(seed*6.28+vUv.y*2.));color=mix(color,vec3(.8,1.,.96),core*.3+tip*.2);float a=core*(.13+level*.75)*( .6+droplets*.4+tip*.35)*effects*(1.+beat*.35);gl_FragColor=vec4(color,a*fade);}`});
  this.mesh=new T.Mesh(geometry,this.material);this.group.add(this.mesh);
  this.ring=new T.Mesh(new T.TorusGeometry(2.35,.012,4,256),new T.MeshBasicMaterial({color:0x79e7c9,transparent:true,opacity:.22,blending:T.AdditiveBlending,depthWrite:false}));this.ring.rotation.x=Math.PI*.5;this.ring.position.y=-1.68;this.group.add(this.ring);
 }
 update(time,music,size,effects){this.uniforms.time.value=time;this.uniforms.spectrum.value=music.spectrum;this.uniforms.beat.value=music.beat;this.uniforms.effects.value=effects;const radius=2.35+Math.max(0,size-1)*1.3;this.uniforms.radius.value=radius;this.ring.scale.setScalar(radius/2.35);this.ring.material.color.copy(this.uniforms.tint.value);this.ring.material.opacity=.22*effects;this.group.visible=effects>.001;}
}
