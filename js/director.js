// Continuous show controls share the existing musical state. Only actual beat
// envelopes can trigger a climax; scene choices last at least 22 seconds.
export class ShowDirector {
 constructor(onScene,onAuto){
  this.onScene=onScene;this.onAuto=onAuto;this.enabled=true;this.age=0;this.wait=0;this.scene=0;this.mood=0;this.average=.12;this.climax=0;this.climaxCooldown=0;this.currentShape=0;this.currentStyle=0;
  this.value={motion:.5,atmosphere:.8,palette:0,saturation:.9,accent:0,cameraYaw:0,cameraPitch:0,zoom:1,fov:38};
 }
 setAuto(enabled){this.enabled=enabled;this.age=0;this.wait=0;this.onAuto?.(enabled);}
 update(dt,time,music){
  const v=this.value,a=1-Math.exp(-dt*.75);
  this.mood+=(music.energy-this.mood)*a;this.average+=(music.energy-this.average)*(1-Math.exp(-dt/14));
  this.climaxCooldown=Math.max(0,this.climaxCooldown-dt);
  let strong=false;for(const p of music.pulses)if(p.age<.06&&p.strength>.72)strong=true;
  if(this.enabled&&strong&&this.mood>.24&&music.energy>this.average*1.28+.025&&this.climaxCooldown===0){this.climax=1;this.climaxCooldown=10;}
  this.climax*=Math.exp(-dt/3.5);
  if(this.enabled){
   this.age+=dt;
   if(this.age>22+this.scene%3*2){this.wait+=dt;if(strong||this.wait>2.5){
    const active=this.mood>.34,calm=this.mood<.16;
    const shapes=active?[4,3,1,2]:calm?[0,5,3]:[0,1,2,3,4,5];
    const styles=active?[4,1,0]:calm?[2,3,0]:[0,1,2,3,4];
    const choose=(items,current)=>{const choices=items.filter(index=>index!==current);return choices[Math.floor(Math.random()*choices.length)];};
    this.currentShape=choose(shapes,this.currentShape);this.currentStyle=choose(styles,this.currentStyle);this.scene++;
    this.onScene?.(this.currentShape,this.currentStyle);this.age=0;this.wait=0;
   }}
  }
  const targetMotion=this.enabled ? .32+this.mood*1.8 : .6,targetAtmosphere=this.enabled ? .62+this.mood*.9 : .85;
  v.motion+=(targetMotion-v.motion)*a;v.atmosphere+=(targetAtmosphere-v.atmosphere)*a;
  const palette=this.enabled?Math.sin(time*.023)*.16+this.mood*.18:0;
  v.palette+=(palette-v.palette)*(1-Math.exp(-dt*.5));v.saturation+=((this.enabled ? .72+this.mood*.65 : 1)-v.saturation)*a;
  v.accent=this.enabled?this.climax*music.beat:0;
  // Gentle arcs, restrained zoom, then a central composition every fourth scene.
  const phase=Math.min(1,this.age/24),ease=phase*phase*(3-2*phase),central=this.scene%4===3;
  const direction=this.scene%2?1:-1;
  const yaw=this.enabled&&!central?Math.sin(time*.055+this.scene*.7)*(.045+this.mood*.075)*direction:0;
  const pitch=this.enabled&&!central?Math.sin(time*.037)*.035:0;
  const zoom=this.enabled?(central?1.04:1.055-ease*(.075+this.mood*.05)):1;
  const cameraEase=1-Math.exp(-dt*.7);
  v.cameraYaw+=(yaw-v.cameraYaw)*cameraEase;v.cameraPitch+=(pitch-v.cameraPitch)*cameraEase;v.zoom+=(zoom-v.zoom)*cameraEase;
  v.fov+=((this.enabled?38+Math.sin(time*.035)*1.5:38)-v.fov)*cameraEase;
  return v;
 }
}
