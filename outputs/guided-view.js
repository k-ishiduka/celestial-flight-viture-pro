import * as T from './three.module.js';
import {equatorialVector} from './rich-guide.js';
export class GuidedView{
 constructor(experience){this.e=experience;this.active=false;this.remaining=0;this.orientation=new T.Quaternion();this.target=new T.Quaternion();this.savedFov=null;this.headDelta=new T.Quaternion();this.trackingAge=0;this.frameShift=0;}
 framing(){
  const ui=document.getElementById('ui');
  if(!ui?.getBoundingClientRect||ui.classList?.contains('hidden'))return {scale:1,shift:0};
  const h=ui.getBoundingClientRect().height;if(!h)return {scale:1,shift:0};
  const dock=document.querySelector('.bottom-dock')?.getBoundingClientRect();
  const header=document.querySelector('.topbar')?.getBoundingClientRect();
  const top=Math.min(h*.3,header?.bottom||0);let bottom=dock?dock.top-16:h;
  if(this.e.narrator?.speaking||this.e.narrator?.preparing){const panel=document.getElementById('narrationPanel');bottom=Math.min(bottom,panel&&!panel.hidden?panel.getBoundingClientRect().top-16:bottom-132);}
  bottom=Math.max(top+h*.25,Math.min(h,bottom));
  return {scale:(bottom-top)/h,shift:1-(top+bottom)/h};
 }
 lock(id,d,refresh=false){
  const e=this.e,camera=e.camera;this.lockedID=id;this.lockedData=d;this.lastAspect=camera.aspect;this.frame=this.framing();
  const local=(e.members?.[id]||[]).map(s=>equatorialVector(s.ra,s.dec));if(!local.length)local.push(equatorialVector(d[0],d[1]));
  const vectors=local.map(v=>e.observer?e.observer.vector(v):v);const center=vectors.reduce((sum,v)=>sum.add(v),new T.Vector3()).normalize();if(center.lengthSq()<.1)center.copy(vectors[0]);
  const up=Math.abs(center.y)>.98?new T.Vector3(0,0,1):new T.Vector3(0,1,0),right=new T.Vector3().crossVectors(center,up).normalize(),vertical=new T.Vector3().crossVectors(right,center).normalize();
  let height=0,width=0;for(const v of vectors){const forward=v.dot(center);height=Math.max(height,Math.atan2(Math.abs(v.dot(vertical)),forward));width=Math.max(width,Math.atan2(Math.abs(v.dot(right)),forward));}
  const extent=Math.max(Math.tan(height)/this.frame.scale,Math.tan(width)/camera.aspect);this.fov=T.MathUtils.clamp(2*Math.atan(extent/.8)*180/Math.PI,18,170);
  const temporary=new T.PerspectiveCamera();temporary.up.copy(up);temporary.lookAt(center);this.target.copy(temporary.quaternion);
  if(!this.active){this.orientation.copy(camera.quaternion);this.savedFov??=camera.fov;}if(!refresh)this.referenceHead=null;this.active=true;this.remaining=0;
 }
 release(){if(!this.active)return;this.orientation.copy(this.e.camera.quaternion);this.active=false;this.remaining=3;}
 update(camera,dt,head=new T.Quaternion()){
  if(!this.active&&!this.remaining)return;this.trackingAge+=dt;
  const key=+(this.e.observer?.date||0)+':'+(this.e.observer?.active||false);
  if(this.active&&(camera.aspect!==this.lastAspect||this.trackingAge>.2)){
   const frame=this.framing();
   if(camera.aspect!==this.lastAspect||Math.abs(frame.scale-this.frame.scale)>.002||Math.abs(frame.shift-this.frame.shift)>.002||(this.e.observer?.active&&key!==this.lastSkyKey))this.lock(this.lockedID,this.lockedData,true);
   this.trackingAge=0;this.lastSkyKey=key;
  }
  const smooth=1-Math.exp(-dt*2);this.orientation.slerp(this.active?this.target:camera.quaternion,smooth);camera.quaternion.copy(this.orientation);
  if(this.active){this.referenceHead??=head.clone();camera.quaternion.multiply(this.headDelta.copy(this.referenceHead).invert().multiply(head));}
  camera.fov=T.MathUtils.lerp(camera.fov,this.active?this.fov:this.savedFov??camera.fov,smooth);
  this.frameShift=T.MathUtils.lerp(this.frameShift,this.active?this.frame.shift:0,smooth);
  if(!this.active){this.remaining=Math.max(0,this.remaining-dt);if(!this.remaining){this.savedFov=null;this.frameShift=0;}}
  camera.updateProjectionMatrix();camera.projectionMatrix.elements[9]=-this.frameShift;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();document.getElementById('fov').value=camera.fov;
 }
}
