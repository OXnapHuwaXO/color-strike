const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
const scoreEl=document.getElementById('score');
const comboEl=document.getElementById('combo');
const colorIndEl=document.getElementById('color-indicator');
const colorLabelEl=document.getElementById('color-label');
const startScreen=document.getElementById('start-screen');
const startBtn=startScreen.querySelector('.tap-btn');
const gameOverEl=document.getElementById('game-over');
const finalScoreEl=document.getElementById('final-score');
const bestScoreEl=document.getElementById('best-score');
const restartBtn=document.getElementById('restart-btn');

let W,H;
function resize(){
W=canvas.width=window.innerWidth;
H=canvas.height=window.innerHeight;
}
resize();
window.addEventListener('resize',resize);

const COLORS=[
{name:'red',hex:'#e74c3c',alt:'#c0392b'},
{name:'green',hex:'#2ecc71',alt:'#27ae60'}
];
const EXTRA_COLORS=[
{name:'blue',hex:'#3498db',alt:'#2980b9'},
{name:'yellow',hex:'#f1c40f',alt:'#f39c12'},
{name:'purple',hex:'#9b59b6',alt:'#8e44ad'},
{name:'orange',hex:'#e67e22',alt:'#d35400'},
{name:'cyan',hex:'#00cec9',alt:'#00b894'},
{name:'pink',hex:'#fd79a8',alt:'#e84393'},
{name:'indigo',hex:'#6c5ce7',alt:'#5a4bd1'},
{name:'mint',hex:'#00b894',alt:'#00a381'}
];

const LANG={
en:{
sub:'Match background color to reveal obstacles<br>Swipe to dodge',
mech:'\u25cf Obstacles dangerous only when colors match<br>\u25cf Tap to change background color<br>\u25cf Swipe left/right to dodge',
tap:'Tap to play',
settingsTitle:'Settings',
langLabel:'Language',
goTitle:'Game Over',
restart:'Play Again',
mirror:'\u276E MIRROR \u276F',
colors:{red:'red',green:'green',blue:'blue',yellow:'yellow',purple:'purple',orange:'orange',cyan:'cyan',pink:'pink',indigo:'indigo',mint:'mint'},
comboX:'{n}x',
score:'Score: {n}',
best:'Best: {n}'
},
ru:{
sub:'Подбирайте цвет фона, чтобы увидеть препятствия<br>Свайпайте, чтобы уклоняться',
mech:'\u25cf Препятствия опасны только когда цвет совпадает<br>\u25cf Тапните, чтобы сменить цвет фона<br>\u25cf Свайп влево/вправо для уклонения',
tap:'Начать игру',
settingsTitle:'Настройки',
langLabel:'Язык',
goTitle:'Игра окончена',
restart:'Заново',
mirror:'\u276E ЗЕРКАЛО \u276F',
colors:{red:'красный',green:'зелёный',blue:'синий',yellow:'жёлтый',purple:'фиолетовый',orange:'оранжевый',cyan:'голубой',pink:'розовый',indigo:'индиго',mint:'мятный'},
comboX:'{n}x',
score:'Счёт: {n}',
best:'Рекорд: {n}'
}
};

let lang=localStorage.getItem('colorStrikeLang')||'ru';
function t(key,...args){
const txt=LANG[lang]||LANG.ru;
const parts=key.split('.');
let val=txt;
for(const p of parts)if(val)val=val[p];
if(typeof val==='string'&&args.length>0)val=val.replace('{n}',args[0]);
return val||key;
}

let allColors=[...COLORS];
let bgColorIdx=0,targetBgColorIdx=0,bgTransition=1;
let score=0,highScore=parseInt(localStorage.getItem('colorStrikeBest'))||0;
let gameRunning=false,gameOverFlag=false;
let speed=2.0,baseSpeed=2.0;
let frameCount=0;
let ballLane=1,targetLane=1,laneTransition=1;
const LANE_COUNT=3;
let combo=0,maxCombo=0;
let autoColorTimer=0,autoColorInterval=150;
let mirrorMode=false,reverseTrack=1;
let slowMo=false,slowMoTimer=0;
const SLOW_MO_DURATION=100;
let deathParticles=[];
let shakeAmount=0,shakeDecay=0.92;
let obstacles=[];
let trackOffset=0;
let metronomeTick=0;
let tapHandled=false;
let prevScoreMilestone=0,prevColorMilestone=0;
let colorPulse=0;

const LANE_W_RATIO=0.13;
const BALL_R_RATIO=0.04;
const TRACK_FREQ=0.0025;
const TRACK_AMP_RATIO=0.25;

function getLaneW(){return W*LANE_W_RATIO}
function getBallR(){return Math.max(7,Math.min(22,W*BALL_R_RATIO))}
function getTrackAmp(){return Math.min(W*TRACK_AMP_RATIO,60)}
function getLaneX(lane){
const lw=getLaneW();
const cx=W/2+reverseTrack*Math.sin((trackOffset+200)*TRACK_FREQ)*getTrackAmp();
return cx+(lane-1)*lw;
}
function getBallX(){
if(ballLane===targetLane&&laneTransition>=1)return getLaneX(ballLane);
const from=getLaneX(ballLane),to=getLaneX(targetLane);
const t=Math.min(1,laneTransition);
const st=t*t*(3-2*t);
return from+(to-from)*st;
}
function circleRectCollision(cx,cy,cr,ox,oy,ow,oh){
const left=ox-ow/2,right=ox+ow/2,top=oy-oh/2,bottom=oy+oh/2;
const closestX=Math.max(left,Math.min(cx,right));
const closestY=Math.max(top,Math.min(cy,bottom));
const dx=cx-closestX,dy=cy-closestY;
return dx*dx+dy*dy<cr*cr;
}

let audioCtx=null;
function initAudio(){
if(audioCtx)return;
try{
const AC=window.AudioContext||window.webkitAudioContext;
if(!AC)return;
audioCtx=new AC();
}catch(e){}
}

function playTick(){
if(!audioCtx)return;
try{
const o=audioCtx.createOscillator(),g=audioCtx.createGain();
o.type='sine';o.frequency.value=880;
g.gain.setValueAtTime(0.025,audioCtx.currentTime);
g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.04);
o.connect(g);g.connect(audioCtx.destination);
o.start();o.stop(audioCtx.currentTime+0.04);
}catch(e){}
}

function playDing(){
if(!audioCtx)return;
try{
const o=audioCtx.createOscillator(),g=audioCtx.createGain();
o.type='sine';o.frequency.value=1318.5;
g.gain.setValueAtTime(0.05,audioCtx.currentTime);
g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.08);
o.connect(g);g.connect(audioCtx.destination);
o.start();o.stop(audioCtx.currentTime+0.08);
setTimeout(()=>{
try{
const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
o2.type='sine';o2.frequency.value=1760;
g2.gain.setValueAtTime(0.04,audioCtx.currentTime);
g2.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.1);
o2.connect(g2);g2.connect(audioCtx.destination);
o2.start();o2.stop(audioCtx.currentTime+0.1);
}catch(e){}
},50);
}catch(e){}
}

function playThud(){
if(!audioCtx)return;
try{
const o=audioCtx.createOscillator(),g=audioCtx.createGain();
o.type='sawtooth';o.frequency.setValueAtTime(80,audioCtx.currentTime);
o.frequency.exponentialRampToValueAtTime(25,audioCtx.currentTime+0.25);
g.gain.setValueAtTime(0.12,audioCtx.currentTime);
g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.25);
o.connect(g);g.connect(audioCtx.destination);
o.start();o.stop(audioCtx.currentTime+0.25);
const buf=audioCtx.createBuffer(1,audioCtx.sampleRate*0.15,audioCtx.sampleRate);
const d=buf.getChannelData(0);
for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(audioCtx.sampleRate*0.04));
const n=audioCtx.createBufferSource();n.buffer=buf;
const gn=audioCtx.createGain();gn.gain.setValueAtTime(0.1,audioCtx.currentTime);
gn.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.15);
n.connect(gn);gn.connect(audioCtx.destination);
n.start();
if(navigator.vibrate)navigator.vibrate([60,30,60]);
}catch(e){}
}

function playMatchFlash(){
if(!audioCtx)return;
try{
const o=audioCtx.createOscillator(),g=audioCtx.createGain();
o.type='sine';o.frequency.value=1108.7;
g.gain.setValueAtTime(0.03,audioCtx.currentTime);
g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.06);
o.connect(g);g.connect(audioCtx.destination);
o.start();o.stop(audioCtx.currentTime+0.06);
}catch(e){}
}

function spawnObstacle(){
const lane=Math.floor(Math.random()*LANE_COUNT);
let colorIdx=Math.floor(Math.random()*allColors.length);
if(allColors.length>4&&Math.random()<0.2)colorIdx=4+Math.floor(Math.random()*(allColors.length-4));
const y=trackOffset+H+100+Math.random()*60;
const h=45+Math.random()*35;
obstacles.push({lane,colorIdx,y,height:h,passed:false,active:false});
}

function resetGame(){
allColors=[...COLORS];
bgColorIdx=0;targetBgColorIdx=0;bgTransition=1;
score=0;speed=baseSpeed;frameCount=0;
ballLane=1;targetLane=1;laneTransition=1;
combo=0;maxCombo=0;
autoColorTimer=0;autoColorInterval=150;
mirrorMode=false;reverseTrack=1;
slowMo=false;slowMoTimer=0;colorPulse=0;
deathParticles=[];shakeAmount=0;
obstacles=[];trackOffset=0;
metronomeTick=0;
gameOverFlag=false;gameRunning=true;
prevScoreMilestone=0;prevColorMilestone=0;
gameOverEl.style.display='none';
updateColorUI();
updateScoreUI();
}

function createDeathParticles(x,y){
const clrs=['#fff','#e74c3c','#3498db','#2ecc71','#f1c40f','#ff6b6b','#9b59b6'];
for(let i=0;i<60;i++){
const a=Math.random()*Math.PI*2,sp=2+Math.random()*8;
deathParticles.push({
x,y,dx:Math.cos(a)*sp,dy:Math.sin(a)*sp,
life:1,decay:0.004+Math.random()*0.01,
size:2+Math.random()*6,color:clrs[Math.floor(Math.random()*clrs.length)],
gravity:0.035
});
}
}

function doGameOver(x,y){
gameRunning=false;gameOverFlag=true;
slowMo=true;slowMoTimer=SLOW_MO_DURATION;
createDeathParticles(x,y);
playThud();shakeAmount=14;
if(score>highScore){highScore=score;localStorage.setItem('colorStrikeBest',highScore)}
}

function startGame(){
    initAudio();resetGame();started=true;
    startScreen.style.display='none';
}

function updateColorUI(){
colorIndEl.innerHTML='';
const cur=targetBgColorIdx;
allColors.forEach((c,i)=>{
const dot=document.createElement('div');
dot.className='dot'+(i===cur?' active':'');
dot.style.background=c.hex;dot.style.color=c.hex;
colorIndEl.appendChild(dot);
});
const c=allColors[cur];
if(c)colorLabelEl.innerHTML='\u25cf '+(t('colors.'+c.name)||c.name);
}

function updateScoreUI(){
scoreEl.textContent=Math.floor(score);
comboEl.textContent=combo>1?t('comboX',combo):'';
}

function applyLang(){
document.querySelectorAll('[data-key]').forEach(el=>{
const key=el.dataset.key;
const txt=t(key);
if(txt!==key){
if(el.tagName==='BUTTON'||el.tagName==='DIV')el.innerHTML=txt;
else el.textContent=txt;
}
});
document.querySelectorAll('.lang-opt input').forEach(r=>{
r.checked=r.value===lang;
});
updateColorUI();
}

function update(dt){
if(slowMo){
slowMoTimer--;
for(const p of deathParticles){
if(p.life<=0)continue;
p.x+=p.dx*0.2;p.y+=p.dy*0.2;
p.dy+=p.gravity*0.2;p.life-=p.decay*0.2;
}
if(shakeAmount>0)shakeAmount*=shakeDecay;
if(slowMoTimer<=0){
slowMo=false;
gameOverEl.style.display='flex';
finalScoreEl.textContent=t('score',Math.floor(score));
bestScoreEl.textContent=t('best',Math.floor(highScore));
}
return;
}

if(!gameRunning)return;

const dtScale=Math.min(dt,32)/16;
const spd=speed*dtScale;

trackOffset+=spd;

autoColorTimer+=dtScale;
if(autoColorTimer>=autoColorInterval){
autoColorTimer=0;
targetBgColorIdx=(targetBgColorIdx+1)%allColors.length;
bgTransition=0;
colorPulse=1;
updateColorUI();
}

if(bgTransition<1){
bgTransition+=0.06*dtScale;
if(bgTransition>=1){bgTransition=1;bgColorIdx=targetBgColorIdx}
}

if(laneTransition<1){
laneTransition+=0.12*dtScale;
if(laneTransition>=1){laneTransition=1;ballLane=targetLane}
}

if(colorPulse>0)colorPulse-=0.03*dtScale;

metronomeTick+=spd*0.03;
if(metronomeTick>=1){
metronomeTick=0;
if(score>2)playTick();
}

frameCount+=dtScale;
const spawnInterval=Math.max(22,85-Math.floor(score/50)*2);
if(frameCount>=spawnInterval){
frameCount=0;spawnObstacle();
}

const matchedColor=targetBgColorIdx;

for(let i=obstacles.length-1;i>=0;i--){
const o=obstacles[i];
const sy=o.y-trackOffset;
if(sy<-120){obstacles.splice(i,1);continue;}

const isMatching=o.colorIdx===matchedColor;
if(isMatching&&!o.active){
o.active=true;
playMatchFlash();
}else if(!isMatching){
o.active=false;
}

if(!o.passed&&sy<H*0.25){
o.passed=true;
combo++;
if(o.active){
score+=2+Math.floor(Math.min(combo,25)*0.3);
}else{
score+=1;
}
if(combo>maxCombo)maxCombo=combo;
playDing();
updateScoreUI();
}

if(!o.active)continue;

if(sy>H*0.1&&sy<H*0.9){
const bx=getBallX(),by=H*0.72;
const ox=getLaneX(o.lane),oy=sy;
const br=getBallR();
const ow=getLaneW()*0.62,oh=o.height;
if(circleRectCollision(bx,by,br+3,ox,oy,ow,oh)){
doGameOver(bx,by);return;
}
}
}

if(shakeAmount>0)shakeAmount*=shakeDecay;

const ms=Math.floor(score/50);
const pms=Math.floor(prevScoreMilestone/50);
for(let m=pms+1;m<=ms;m++){
speed=baseSpeed+m*0.4;
autoColorInterval=Math.max(35,150-m*8);
}
prevScoreMilestone=ms*50;

const mc=Math.floor(score/100);
const pmc=Math.floor(prevColorMilestone/100);
for(let m=pmc+1;m<=mc;m++){
const extraIdx=m-1;
if(extraIdx>=0&&extraIdx<EXTRA_COLORS.length){
allColors=[...COLORS,...EXTRA_COLORS.slice(0,extraIdx+1)];
updateColorUI();
}
}
prevColorMilestone=mc*100;

if(score>=500&&!mirrorMode){
mirrorMode=true;reverseTrack=-1;
}
}

function lerpColor(a,b,t){
const ha=a.replace('#',''),hb=b.replace('#','');
const r1=parseInt(ha.substr(0,2),16),g1=parseInt(ha.substr(2,2),16),b1=parseInt(ha.substr(4,2),16);
const r2=parseInt(hb.substr(0,2),16),g2=parseInt(hb.substr(2,2),16),b2=parseInt(hb.substr(4,2),16);
return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`;
}

function draw(){
const sx=(Math.random()-0.5)*shakeAmount*2;
const sy=(Math.random()-0.5)*shakeAmount*2;
ctx.save();
ctx.translate(sx,sy);

const bgFrom=allColors[bgColorIdx]||COLORS[0];
const bgTo=allColors[targetBgColorIdx]||COLORS[0];
const bgc=lerpColor(bgFrom.hex,bgTo.hex,bgTransition);
ctx.fillStyle=bgc;
ctx.fillRect(0,0,W,H);

if(colorPulse>0){
ctx.fillStyle='rgba(255,255,255,'+(colorPulse*0.06)+')';
ctx.fillRect(0,0,W,H);
}

const lw=getLaneW();

ctx.save();
ctx.globalAlpha=0.05;
for(let y=-20;y<H+30;y+=14){
const cx=W/2+reverseTrack*Math.sin((trackOffset+y)*TRACK_FREQ)*getTrackAmp();
ctx.fillStyle='rgba(255,255,255,0.03)';
ctx.fillRect(cx-lw*1.8,y,lw*3.6,5);
}
ctx.restore();

ctx.save();
ctx.globalAlpha=0.08;
ctx.strokeStyle='rgba(255,255,255,0.08)';
ctx.lineWidth=1;
for(let i=0;i<LANE_COUNT;i++){
const lx=getLaneX(i);
ctx.beginPath();
ctx.setLineDash([5,12]);
ctx.moveTo(lx,0);
ctx.lineTo(lx,H);
ctx.stroke();
ctx.setLineDash([]);
}
ctx.restore();

for(const o of obstacles){
const sy=o.y-trackOffset;
if(sy<-60||sy>H+60)continue;
const ox=getLaneX(o.lane);
const color=allColors[o.colorIdx]||COLORS[0];
const w=lw*0.62,h=o.height;

if(o.active){
const grad=ctx.createRadialGradient(ox,sy,0,ox,sy,30);
grad.addColorStop(0,color.hex);
grad.addColorStop(1,color.alt);
ctx.fillStyle=grad;
ctx.shadowColor=color.hex+'bb';
ctx.shadowBlur=16;
ctx.globalAlpha=1;
ctx.beginPath();
ctx.roundRect(ox-w/2,sy-h/2,w,h,4);
ctx.fill();
ctx.shadowBlur=0;
ctx.globalAlpha=0.5;
ctx.strokeStyle='#fff';
ctx.lineWidth=2.5;
ctx.beginPath();
ctx.roundRect(ox-w/2,sy-h/2,w,h,4);
ctx.stroke();
ctx.globalAlpha=0.15;
ctx.fillStyle='#fff';
ctx.beginPath();
ctx.roundRect(ox-w/2-1,sy-h/2-1,w+2,h+2,5);
ctx.fill();
ctx.globalAlpha=1;
}else{
ctx.globalAlpha=0.25;
ctx.fillStyle=color.hex;
ctx.beginPath();
ctx.roundRect(ox-w/2,sy-h/2,w,h,3);
ctx.fill();
ctx.globalAlpha=0.3;
ctx.strokeStyle='rgba(255,255,255,0.3)';
ctx.lineWidth=1.5;
ctx.beginPath();
ctx.roundRect(ox-w/2,sy-h/2,w,h,3);
ctx.stroke();
ctx.globalAlpha=1;
}
}

ctx.shadowBlur=0;
ctx.globalAlpha=1;

const ballR=getBallR();
const bx=getBallX();
const by=H*0.72;

if(slowMo){
const progress=slowMoTimer/SLOW_MO_DURATION;
const sq=1+(1-progress)*0.7;
const st=1-(1-progress)*0.4;
ctx.save();
ctx.translate(bx,by);
ctx.scale(sq,st);
ctx.beginPath();
ctx.arc(0,0,ballR,0,Math.PI*2);
ctx.fillStyle='#fff';
ctx.shadowColor='rgba(255,255,255,0.6)';
ctx.shadowBlur=30;
ctx.fill();
ctx.shadowBlur=0;
ctx.restore();
}else{
ctx.beginPath();
ctx.arc(bx,by,ballR,0,Math.PI*2);
ctx.fillStyle='#fff';
ctx.shadowColor='rgba(255,255,255,0.5)';
ctx.shadowBlur=12;
ctx.fill();
ctx.shadowBlur=0;
ctx.beginPath();
ctx.arc(bx-ballR*0.15,by-ballR*0.2,ballR*0.15,0,Math.PI*2);
ctx.fillStyle='rgba(0,0,0,0.1)';
ctx.fill();
}

for(const p of deathParticles){
if(p.life<=0)continue;
ctx.globalAlpha=Math.max(0,p.life);
ctx.fillStyle=p.color;
ctx.beginPath();
ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
ctx.fill();
}
ctx.globalAlpha=1;

if(mirrorMode){
ctx.save();
ctx.globalAlpha=0.1;
ctx.fillStyle='#fff';
ctx.font='bold 12px system-ui,sans-serif';
ctx.textAlign='center';
ctx.textBaseline='top';
ctx.fillText(t('mirror'),W/2,6);
ctx.restore();
}

if(combo>10&&!slowMo){
const flash=Math.sin(performance.now()*0.006)*0.15+0.5;
ctx.globalAlpha=flash*0.3;
ctx.fillStyle='#fff';
ctx.font='bold 52px system-ui,sans-serif';
ctx.textAlign='center';
ctx.textBaseline='middle';
ctx.fillText(combo+'x',W/2,H/2-30);
ctx.globalAlpha=1;
}

ctx.restore();
}

if(!ctx.roundRect){
ctx.roundRect=function(x,y,w,h,r){
if(typeof r==='number')r=[r,r,r,r];
this.moveTo(x+r[0],y);
this.lineTo(x+w-r[1],y);
this.quadraticCurveTo(x+w,y,x+w,y+r[1]);
this.lineTo(x+w,y+h-r[2]);
this.quadraticCurveTo(x+w,y+h,x+w-r[2],y+h);
this.lineTo(x+r[3],y+h);
this.quadraticCurveTo(x,y+h,x,y+h-r[3]);
this.lineTo(x,y+r[0]);
this.quadraticCurveTo(x,y,x+r[0],y);
this.closePath();
return this;
};
}

let lastTime=0;
function gameLoop(timestamp){
const now=performance.now();
const dt=lastTime?Math.min(32,now-lastTime):16;
lastTime=now;
update(dt);
draw();
requestAnimationFrame(gameLoop);
}

let touchStartX=0,touchStartY=0;
let touchMoved=false;

function handleTap(){
if(slowMo)return;
if(!gameRunning||gameOverFlag)return;
initAudio();
targetBgColorIdx=(targetBgColorIdx+1)%allColors.length;
bgTransition=0;
colorPulse=1;
updateColorUI();
}

function onPointerDown(x,y){
touchStartX=x;touchStartY=y;
touchMoved=false;tapHandled=false;
}

function onPointerMove(x,y){
const dx=x-touchStartX,dy=y-touchStartY;
if(Math.abs(dx)>8||Math.abs(dy)>8)touchMoved=true;
if(Math.abs(dx)>22&&gameRunning&&!gameOverFlag&&!slowMo){
if(dx>0&&targetLane<2){targetLane++;laneTransition=0;touchStartX=x}
else if(dx<0&&targetLane>0){targetLane--;laneTransition=0;touchStartX=x}
tapHandled=true;
}
}

function onPointerUp(){
if(!started){startGame();return}
if(gameOverFlag&&!slowMo){resetGame();return}
if(!touchMoved&&!tapHandled){tapHandled=true;handleTap()}
}

let started=false;

canvas.addEventListener('touchstart',e=>{
e.preventDefault();
const t=e.touches[0];
onPointerDown(t.clientX,t.clientY);
},{passive:false});

canvas.addEventListener('touchmove',e=>{
e.preventDefault();
const t=e.touches[0];
onPointerMove(t.clientX,t.clientY);
},{passive:false});

canvas.addEventListener('touchend',e=>{
e.preventDefault();
onPointerUp();
},{passive:false});

canvas.addEventListener('click',e=>{
if(!started){startGame();return}
if(gameOverFlag&&!slowMo){resetGame();return}
if(!tapHandled){tapHandled=true;handleTap()}
});

let mouseDown=false;
canvas.addEventListener('mousedown',e=>{onPointerDown(e.clientX,e.clientY);mouseDown=true});
canvas.addEventListener('mousemove',e=>{if(mouseDown)onPointerMove(e.clientX,e.clientY)});
canvas.addEventListener('mouseup',e=>{mouseDown=false;onPointerUp()});

document.addEventListener('keydown',e=>{
if(!started&&(e.key===' '||e.key==='Enter')){e.preventDefault();startGame();return}
if(gameOverFlag&&!slowMo&&(e.key===' '||e.key==='Enter')){e.preventDefault();resetGame();return}
if(!gameRunning||gameOverFlag||slowMo)return;
if(e.key===' '||e.key==='ArrowUp'){e.preventDefault();handleTap()}
if(e.key==='ArrowRight'&&targetLane<2){targetLane++;laneTransition=0}
if(e.key==='ArrowLeft'&&targetLane>0){targetLane--;laneTransition=0}
});

startBtn.addEventListener('click',e=>{e.stopPropagation();if(!started)startGame()});
startBtn.addEventListener('touchend',e=>{e.preventDefault();e.stopPropagation();startGame()});

restartBtn.addEventListener('click',e=>{e.stopPropagation();resetGame()});
restartBtn.addEventListener('touchend',e=>{e.stopPropagation();tapHandled=true;resetGame()});
gameOverEl.addEventListener('click',e=>{if(!slowMo)resetGame()});
gameOverEl.addEventListener('touchend',e=>{if(!slowMo){e.preventDefault();resetGame()}});

const settingsBtn=document.getElementById('settings-btn');
const settingsOverlay=document.getElementById('settings-overlay');
const settingsClose=document.getElementById('settings-close');

function openSettings(){settingsOverlay.classList.add('show')}
function closeSettings(){settingsOverlay.classList.remove('show')}

settingsBtn.addEventListener('click',e=>{e.stopPropagation();openSettings()});
settingsClose.addEventListener('click',e=>{e.stopPropagation();closeSettings()});
settingsOverlay.addEventListener('click',e=>{if(e.target===settingsOverlay)closeSettings()});

document.querySelectorAll('.lang-opt input').forEach(r=>{
r.addEventListener('change',function(){
if(this.checked){
lang=this.value;
localStorage.setItem('colorStrikeLang',lang);
applyLang();
}
});
});

applyLang();
updateColorUI();

if('serviceWorker'in navigator){
navigator.serviceWorker.register('sw.js');
}

gameLoop(0);
