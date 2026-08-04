(() => {
'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const DPR = Math.min(2, window.devicePixelRatio || 1);
let vw=0,vh=0;
function resize(){vw=innerWidth;vh=innerHeight;canvas.width=Math.floor(vw*DPR);canvas.height=Math.floor(vh*DPR);canvas.style.width=vw+'px';canvas.style.height=vh+'px';ctx.setTransform(DPR,0,0,DPR,0,0)}
addEventListener('resize',resize);resize();

const sprite = new Image(); sprite.src='assets/sion_sprites.png';
const WORLD={w:1800,h:1250};
const player={x:850,y:720,r:22,speed:210,dir:'down',moving:false,walkT:0};
const input={x:0,y:0};
let started=false,paused=false,soundOn=true,last=0;
const keys={};
const starsEl=document.getElementById('stars'), missionText=document.getElementById('missionText'), progressRow=document.getElementById('progressRow');

const missions=[
 {id:'radio',icon:'📻',name:'Radio',done:false},
 {id:'tv',icon:'📺',name:'TV',done:false},
 {id:'phone',icon:'📱',name:'Teléfono',done:false},
 {id:'computer',icon:'💻',name:'Computadora',done:false},
 {id:'news',icon:'📰',name:'Periódico',done:false},
 {id:'letter',icon:'✉️',name:'Carta',done:false}
];
let current=0, stars=0;
const state={battery:false,remote:false,phoneAnswered:false,computerIcons:0,pages:0,letterTaken:false};

const obstacles=[
 {x:160,y:150,w:310,h:250}, // school
 {x:650,y:135,w:330,h:255}, // radio
 {x:1110,y:160,w:300,h:235}, // tv
 {x:1450,y:360,w:230,h:235}, // news
 {x:1170,y:810,w:330,h:255}, // computer
 {x:190,y:790,w:270,h:200}, // house
];
const landmarks={
 radio:{x:810,y:405,label:'Estación de Radio'},tv:{x:1260,y:415,label:'Casa de TV'},phone:{x:540,y:535,label:'Teléfono'},computer:{x:1325,y:795,label:'Computadora'},news:{x:1550,y:620,label:'Periódico'},mailbox:{x:540,y:860,label:'Buzón'},house:{x:340,y:760,label:'Casa de Lía'}
};
const pickups={
 battery:{x:930,y:600,emoji:'🔋',visible:true},remote:{x:1030,y:505,emoji:'🎛️',visible:false},
 chip1:{x:1040,y:950,emoji:'🌐',visible:false},chip2:{x:875,y:1000,emoji:'✉️',visible:false},chip3:{x:1510,y:940,emoji:'🎥',visible:false},
 page1:{x:1470,y:720,emoji:'📄',visible:false},page2:{x:1610,y:780,emoji:'📄',visible:false},page3:{x:1380,y:690,emoji:'📄',visible:false},
 letter:{x:535,y:900,emoji:'✉️',visible:false}
};
const npcs=[{x:760,y:470,name:'Don Pepe',emoji:'👴'},{x:1220,y:485,name:'Luna',emoji:'👧'},{x:500,y:600,name:'Mila',emoji:'👩'}];

function missionDesc(){
 const m=missions[current]; if(!m) return '¡Pueblo conectado!';
 if(m.id==='radio') return state.battery?'Lleva la batería a la radio':'Encuentra una batería para la radio';
 if(m.id==='tv') return state.remote?'Lleva el control a la televisión':'Busca el control remoto';
 if(m.id==='phone') return 'Ve al teléfono y descubre para qué sirve';
 if(m.id==='computer') return `Encuentra los 3 iconos de la computadora (${state.computerIcons}/3)`;
 if(m.id==='news') return `Recoge las 3 páginas del periódico (${state.pages}/3)`;
 if(m.id==='letter') return state.letterTaken?'Entrega la carta en la casa':'Recoge la carta del buzón';
}
function updateHUD(){missionText.textContent=missionDesc();starsEl.textContent=stars;progressRow.innerHTML=missions.map((m,i)=>`<span class="chip ${m.done?'done':''}">${m.icon} ${m.done?'✓':i===current?'●':'○'}</span>`).join('')}
updateHUD();

function speak(text){if(!soundOn||!('speechSynthesis'in window))return; speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text);u.lang='es-ES';u.rate=.92;u.pitch=1.08;speechSynthesis.speak(u)}
function tone(freq=660,dur=.12){if(!soundOn)return;try{const A=new (window.AudioContext||window.webkitAudioContext)();const o=A.createOscillator(),g=A.createGain();o.frequency.value=freq;o.connect(g);g.connect(A.destination);g.gain.setValueAtTime(.08,A.currentTime);g.gain.exponentialRampToValueAtTime(.001,A.currentTime+dur);o.start();o.stop(A.currentTime+dur)}catch(e){}}

const dialog=document.getElementById('dialog'), dialogText=document.getElementById('dialogText'), speakerEl=document.getElementById('speaker'), choices=document.getElementById('dialogChoices'), nextBtn=document.getElementById('dialogNext');
let nextAction=null;
function showDialog(speaker,text,opts={}){paused=true;dialog.classList.remove('hidden');speakerEl.textContent=speaker;dialogText.textContent=text;choices.innerHTML='';nextBtn.style.display=opts.choices?'none':'inline-block';nextAction=opts.next||null;speak(text);if(opts.choices){opts.choices.forEach(c=>{const b=document.createElement('button');b.className='choice';b.textContent=c.label;b.onclick=()=>{if(c.correct){tone(900);showDialog('Sion','¡Muy bien! '+c.ok,{next:c.next})}else{tone(220,.2);showDialog('Sion','Casi. Intenta otra vez.',{next:()=>showDialog(speaker,text,opts)})}};choices.appendChild(b)})}}
function closeDialog(){dialog.classList.add('hidden');paused=false;if(nextAction){const f=nextAction;nextAction=null;f()}}
nextBtn.onclick=closeDialog;

function completeMission(msg){const m=missions[current];m.done=true;stars+=1;tone(1040,.25);showDialog('Sion',msg+` ¡Ganaste una estrella! ⭐`,{next:()=>{current++;unlockForMission();updateHUD(); if(current>=missions.length){showDialog('Sion','¡Lo logramos! Todos los medios de comunicación funcionan otra vez. ¡Eres un gran comunicador! 🏅',{next:()=>{}})}}});updateHUD()}
function unlockForMission(){Object.values(pickups).forEach(p=>{if(p!==pickups.battery)p.visible=false}); const id=missions[current]?.id;
 if(id==='tv')pickups.remote.visible=true;
 if(id==='computer'){pickups.chip1.visible=pickups.chip2.visible=pickups.chip3.visible=true}
 if(id==='news'){pickups.page1.visible=pickups.page2.visible=pickups.page3.visible=true}
 if(id==='letter')pickups.letter.visible=true;
}

function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function canMove(nx,ny){if(nx<35||ny<35||nx>WORLD.w-35||ny>WORLD.h-35)return false;for(const o of obstacles){if(nx>o.x-24&&nx<o.x+o.w+24&&ny>o.y-24&&ny<o.y+o.h+24)return false}return true}

function useAction(){if(paused||!started)return;const m=missions[current];if(!m)return;
 // pickups
 for(const [k,p] of Object.entries(pickups)){if(p.visible&&dist(player,p)<72){
   if(k==='battery'){p.visible=false;state.battery=true;showDialog('Sion','¡Encontré una batería! Ahora llévala a la estación de radio.');updateHUD();return}
   if(k==='remote'){p.visible=false;state.remote=true;showDialog('Sion','¡Encontré el control remoto! Vamos a encender la televisión.');updateHUD();return}
   if(k.startsWith('chip')){p.visible=false;state.computerIcons++;tone(760);showDialog('Sion',`¡Icono encontrado! ${state.computerIcons} de 3.`);if(state.computerIcons>=3)setTimeout(()=>{},0);updateHUD();return}
   if(k.startsWith('page')){p.visible=false;state.pages++;tone(760);showDialog('Sion',`¡Página encontrada! ${state.pages} de 3.`);if(state.pages>=3)setTimeout(()=>{},0);updateHUD();return}
   if(k==='letter'){p.visible=false;state.letterTaken=true;showDialog('Sion','¡Tengo la carta! Ahora debo llevarla a la casa de Lía.');updateHUD();return}
 }}
 // landmarks
 if(m.id==='radio'&&state.battery&&dist(player,landmarks.radio)<120){completeMission('¡La radio volvió a funcionar! La radio sirve para escuchar noticias, música y mensajes.');return}
 if(m.id==='tv'&&state.remote&&dist(player,landmarks.tv)<130){showDialog('Sion','¿Con cuál medio podemos ver imágenes y escuchar sonidos?',{choices:[{label:'📻 Radio',correct:false},{label:'📺 Televisión',correct:true,ok:'La televisión nos permite ver imágenes y escuchar sonidos.',next:()=>completeMission('¡Encendimos la televisión!')} ]});return}
 if(m.id==='phone'&&dist(player,landmarks.phone)<100){showDialog('Sion','¿Qué usamos para hablar con una persona que está lejos?',{choices:[{label:'📱 Teléfono',correct:true,ok:'El teléfono sirve para comunicarnos con personas que están lejos.',next:()=>completeMission('¡Hicimos la llamada!')},{label:'📰 Periódico',correct:false}]});return}
 if(m.id==='computer'&&state.computerIcons>=3&&dist(player,landmarks.computer)<150){completeMission('¡La computadora está lista! Con ella podemos crear, aprender y comunicarnos.');return}
 if(m.id==='news'&&state.pages>=3&&dist(player,landmarks.news)<130){completeMission('¡Armamos el periódico! El periódico nos ayuda a conocer noticias.');return}
 if(m.id==='letter'&&state.letterTaken&&dist(player,landmarks.house)<140){completeMission('¡Carta entregada! Las cartas sirven para enviar mensajes.');return}
 showDialog('Sion','Aquí no hay nada que usar todavía. ¡Sigue explorando!');
}
function talkAction(){if(paused||!started)return;let near=null,best=999;for(const n of npcs){const d=dist(player,n);if(d<best){best=d;near=n}}if(best<105){let t='¡Hola, Sion! Explora el pueblo y aprende jugando.';if(near.name==='Don Pepe')t='Mi radio no funciona. Dicen que hay una batería cerca del camino.';if(near.name==='Luna')t='La televisión necesita su control remoto. ¡Mira cerca de los jardines!';if(near.name==='Mila')t='Los medios nos ayudan a compartir información con otras personas.';showDialog(near.name,t)}else showDialog('Sion','No hay nadie cerca. Acércate a un personaje para hablar.')}

document.getElementById('useBtn').addEventListener('pointerdown',e=>{e.preventDefault();useAction()});
document.getElementById('talkBtn').addEventListener('pointerdown',e=>{e.preventDefault();talkAction()});
document.getElementById('soundBtn').onclick=()=>{soundOn=!soundOn;document.getElementById('soundBtn').textContent=soundOn?'🔊':'🔇'; if(!soundOn&&speechSynthesis)speechSynthesis.cancel()};
addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key.toLowerCase()==='e')useAction();if(e.key.toLowerCase()==='q')talkAction()});addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);

// joystick
const joy=document.getElementById('joystick'),knob=document.getElementById('joyKnob');let joyId=null;
function joyUpdate(e){const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy;const max=r.width*.32,len=Math.hypot(dx,dy)||1;if(len>max){dx=dx/len*max;dy=dy/len*max}knob.style.transform=`translate(${dx}px,${dy}px)`;input.x=dx/max;input.y=dy/max}
joystick.addEventListener('pointerdown',e=>{joyId=e.pointerId;joy.setPointerCapture(joyId);joyUpdate(e)});joystick.addEventListener('pointermove',e=>{if(e.pointerId===joyId)joyUpdate(e)});function joyEnd(e){if(e.pointerId!==joyId)return;joyId=null;input.x=input.y=0;knob.style.transform='translate(0,0)'}joystick.addEventListener('pointerup',joyEnd);joystick.addEventListener('pointercancel',joyEnd);

document.getElementById('startBtn').onclick=()=>{document.getElementById('startScreen').classList.add('hidden');started=true;showDialog('Sion','¡Hola! Soy Sion. Ayúdame a recuperar los medios de comunicación del pueblo. Primero, ¡busquemos una batería para la radio!');};

function circle(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
function rr(x,y,w,h,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function label(text,x,y,size=24){ctx.font=`700 ${size}px Arial`;ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,.28)';ctx.strokeText(text,x,y);ctx.fillStyle='white';ctx.fillText(text,x,y)}
function building(o,color,roof,title,icon){ctx.save();ctx.shadowColor='rgba(0,0,0,.2)';ctx.shadowBlur=16;rr(o.x,o.y,o.w,o.h,22,color);ctx.shadowBlur=0;ctx.fillStyle=roof;ctx.beginPath();ctx.moveTo(o.x-15,o.y+40);ctx.lineTo(o.x+o.w/2,o.y-45);ctx.lineTo(o.x+o.w+15,o.y+40);ctx.closePath();ctx.fill();rr(o.x+o.w*.41,o.y+o.h-74,o.w*.18,74,8,'#7b4b2a');for(let i=0;i<2;i++)rr(o.x+40+i*(o.w-110),o.y+75,70,60,9,'#8bd1ff');label(icon+' '+title,o.x+o.w/2,o.y+45,23);ctx.restore()}
function drawWorld(cam){ctx.save();ctx.translate(-cam.x,-cam.y);
 // grass
 ctx.fillStyle='#72c75d';ctx.fillRect(0,0,WORLD.w,WORLD.h);
 // subtle patches
 for(let x=50;x<WORLD.w;x+=90)for(let y=60;y<WORLD.h;y+=85){circle(x+(y%3)*12,y,3,'rgba(255,255,255,.25)');circle(x+18,y+8,3,'rgba(255,220,80,.35)')}
 // river
 ctx.fillStyle='#53b8df';ctx.beginPath();ctx.moveTo(0,1090);for(let x=0;x<=WORLD.w;x+=120)ctx.lineTo(x,1080+Math.sin(x*.01)*18);ctx.lineTo(WORLD.w,1250);ctx.lineTo(0,1250);ctx.closePath();ctx.fill();
 // paths
 ctx.strokeStyle='#dfbd76';ctx.lineWidth=120;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(850,1200);ctx.lineTo(850,650);ctx.lineTo(820,470);ctx.stroke();ctx.beginPath();ctx.moveTo(280,630);ctx.lineTo(1500,630);ctx.stroke();ctx.beginPath();ctx.moveTo(1250,630);ctx.lineTo(1320,900);ctx.stroke();
 // buildings
 building(obstacles[0],'#f4d78c','#d84b37','ESCUELA','🏫');
 building(obstacles[1],'#6b8dd6','#355a99','RADIO','📻');
 building(obstacles[2],'#77b7c9','#2b7394','TV','📺');
 building(obstacles[3],'#d7b67d','#61a83a','PERIÓDICO','📰');
 building(obstacles[4],'#c69f63','#2f5ca8','COMPUTADORA','💻');
 building(obstacles[5],'#f1c47e','#d5573a','CASA','🏠');
 // phone booth and mailbox
 rr(500,500,78,115,14,'#df3b3b');label('☎',539,570,45);rr(505,825,70,90,12,'#df3b3b');label('✉',540,880,38);
 // bridge
 rr(760,1065,180,95,8,'#9b6332');for(let x=775;x<930;x+=28){ctx.fillStyle='#d28b49';ctx.fillRect(x,1072,19,82)}
 // NPCs
 for(const n of npcs){circle(n.x,n.y,34,'rgba(255,255,255,.78)');ctx.font='42px Arial';ctx.textAlign='center';ctx.fillText(n.emoji,n.x,n.y+14);ctx.font='700 15px Arial';ctx.fillStyle='#234';ctx.fillText(n.name,n.x,n.y+55)}
 // pickups
 for(const p of Object.values(pickups)){if(!p.visible)continue;circle(p.x,p.y,34,'rgba(255,255,255,.78)');ctx.font='40px Arial';ctx.textAlign='center';ctx.fillText(p.emoji,p.x,p.y+13)}
 // interaction sparkle on relevant targets
 const target = missions[current]?.id==='radio'?(state.battery?landmarks.radio:pickups.battery):missions[current]?.id==='tv'?(state.remote?landmarks.tv:pickups.remote):missions[current]?.id==='phone'?landmarks.phone:missions[current]?.id==='computer'?(state.computerIcons>=3?landmarks.computer:null):missions[current]?.id==='news'?(state.pages>=3?landmarks.news:null):missions[current]?.id==='letter'?(state.letterTaken?landmarks.house:pickups.letter):null;
 if(target){const pulse=8+Math.sin(performance.now()/180)*4;ctx.strokeStyle='rgba(255,235,70,.95)';ctx.lineWidth=6;ctx.beginPath();ctx.arc(target.x,target.y,52+pulse,0,Math.PI*2);ctx.stroke()}
 // player
 drawPlayer(player.x,player.y);
 ctx.restore();}
function drawPlayer(x,y){if(!sprite.complete){circle(x,y,28,'white');return}const sw=sprite.naturalWidth/4,sh=sprite.naturalHeight/2;let col=0;if(player.dir==='down')col=0;else if(player.dir==='up')col=1;else if(player.dir==='left')col=2;else col=3;const row=player.moving?1:0;const dw=92,dh=122;ctx.save();ctx.shadowColor='rgba(0,0,0,.25)';ctx.shadowBlur=12;ctx.drawImage(sprite,col*sw,row*sh,sw,sh,x-dw/2,y-dh+28,dw,dh);ctx.restore()}

function loop(t){const dt=Math.min(.033,(t-last)/1000||0);last=t;if(started&&!paused){let dx=input.x,dy=input.y;if(keys['arrowleft']||keys['a'])dx-=1;if(keys['arrowright']||keys['d'])dx+=1;if(keys['arrowup']||keys['w'])dy-=1;if(keys['arrowdown']||keys['s'])dy+=1;let len=Math.hypot(dx,dy);player.moving=len>.1;if(len>.1){dx/=len;dy/=len;const nx=player.x+dx*player.speed*dt,ny=player.y+dy*player.speed*dt;if(canMove(nx,player.y))player.x=nx;if(canMove(player.x,ny))player.y=ny;if(Math.abs(dx)>Math.abs(dy))player.dir=dx<0?'left':'right';else player.dir=dy<0?'up':'down';player.walkT+=dt}}
 const cam={x:Math.max(0,Math.min(WORLD.w-vw,player.x-vw/2)),y:Math.max(0,Math.min(WORLD.h-vh,player.y-vh/2))};ctx.clearRect(0,0,vw,vh);drawWorld(cam);requestAnimationFrame(loop)}requestAnimationFrame(loop);
})();
