function openArcade(){ document.getElementById('arcadeOverlay').style.display='flex'; startGame(); }
function closeArcade(){ document.getElementById('arcadeOverlay').style.display='none'; stopGame(); }
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeArcade(); });

// ── PALETTE ───────────────────────────────────────────────────────────────
const C={
  accent:'#4effc4', accent2:'#4eb8ff', accent3:'#ffcf4e',
  danger:'#ff6b6b', dim:'#3a4e56', muted:'#607880', bg:'#080c0e'
};

// ── STATE ─────────────────────────────────────────────────────────────────
let raf, gameRunning=false, paused=false;
const keys={};
let W,H,ctx,canvas;
let cat,bullets,bugs,bugBullets,particles;
let score,lives,wave,gameOver,frameCount;
let bugDir,bugDropping;
let diveBug=null;

const BULLET_SPEED   = 9;    // slightly faster player shot
const BUG_BULLET_SPD = 4.2;
const PAGE_SIZE_BUGS = { cols:9, rows:4 };
const DASH_COOLDOWN  = 300;  // frames @ 60fps ≈ 5s
const DASH_SPEED     = 18;
const DASH_FRAMES    = 14;
const MAX_YARN       = 3;
const YARN_ORBIT_R   = 28;
const YARN_ORBIT_SPD = 0.045;
const PICKUP_SPD     = 0.6;
let pickups=[], yarnBalls=[];

function stopGame(){ gameRunning=false; if(raf) cancelAnimationFrame(raf); }

function startGame(){
  canvas=document.getElementById('gameCanvas');
  W=Math.min(window.innerWidth-32,860);
  H=window.innerHeight-52-60;
  canvas.width=W; canvas.height=H;
  ctx=canvas.getContext('2d');

  cat={ x:W/2, y:H-48, speed:4, radius:14,
        dashCd:0, dashing:false, dashDir:0, dashFrames:0,
        invincible:0, shootCd:22 };
  bullets=[]; bugs=[]; bugBullets=[]; particles=[]; pickups=[]; yarnBalls=[];
  score=0; lives=3; wave=0; gameOver=false;
  bugDir=1; bugDropping=false; frameCount=0; diveBug=null;
  // clear any held keys from previous game
  Object.keys(keys).forEach(k=>delete keys[k]);
  spawnWave();
  gameRunning=true; loop();
}

// ── PIXEL ART SPRITES (grid, 1=fill, 0=empty) ────────────────────────────
// Cat — 13x10, drawn in theme accent color
const CAT_SPRITE=[
  [0,1,0,0,0,0,0,0,0,0,0,1,0],
  [1,1,0,0,0,0,0,0,0,0,0,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,1,1,1,1,1,1,1,1,1,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,0,1,1,1,1,0,1,1,1,0],
  [0,1,1,1,1,0,0,1,1,1,1,1,0],
  [0,0,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,1,1,0,0,1,1,1,0,0,0],
  [0,0,0,1,0,0,0,0,1,0,0,0,0],
];
const CAT_W=13, CAT_H=10, CAT_PX=2;

// Bug type A — mosquito/alien 12x10
const BUG_A=[
  [0,0,1,0,0,0,0,0,0,1,0,0],
  [0,0,0,1,0,0,0,0,1,0,0,0],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,1,1,0,1,1,0,1,1,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,0,1,1,1,1,1,1,0,1,0],
  [0,0,1,0,1,1,1,1,0,1,0,0],
  [0,0,1,1,0,0,0,0,1,1,0,0],
  [0,0,0,1,0,0,0,0,1,0,0,0],
  [0,0,0,0,1,0,0,1,0,0,0,0],
];
// Bug type B — beetle 12x10
const BUG_B=[
  [0,0,0,1,1,1,1,1,1,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [1,1,0,1,1,1,1,1,1,0,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,0,1,1,1,1,0,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,1,1,0,1,1,0,1,1,0,0],
  [0,0,0,1,1,0,0,1,1,0,0,0],
  [0,0,1,0,1,0,0,1,0,1,0,0],
  [0,0,1,0,0,0,0,0,0,1,0,0],
];
// Bug type C — boss moth 12x10
const BUG_C=[
  [1,1,0,0,0,0,0,0,0,0,1,1],
  [1,1,1,0,0,0,0,0,0,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,1,1,1,1,0,0],
  [1,1,1,0,1,1,1,1,0,1,1,1],
  [1,1,0,0,1,1,1,1,0,0,1,1],
  [1,0,0,1,1,1,1,1,1,0,0,1],
  [0,0,1,1,0,1,1,0,1,1,0,0],
  [0,1,1,0,0,0,0,0,0,1,1,0],
  [1,1,0,0,0,0,0,0,0,0,1,1],
];
const BUG_PX=2, BUG_SW=12, BUG_SH=10;

function drawSprite(sprite,px,x,y,color,flicker){
  if(flicker&&Math.floor(frameCount/4)%2===0) return;
  ctx.fillStyle=color;
  sprite.forEach((row,r)=>row.forEach((cell,c)=>{
    if(cell) ctx.fillRect(x+c*px, y+r*px, px, px);
  }));
}

// ── WAVE SPAWN ────────────────────────────────────────────────────────────
function spawnWave(){
  wave++;
  bugs=[];
  const {cols,rows}=PAGE_SIZE_BUGS;
  const spacingX=Math.min(52, (W-60)/cols);
  const startX=(W - cols*spacingX)/2;
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const type=r===0?'C':r===1?'A':'B';
      const color=r===0?C.danger:r===1?C.accent3:C.accent2;
      const sprite=r===0?BUG_C:r===1?BUG_A:BUG_B;
      bugs.push({
        x:startX+c*spacingX, y:70+r*46,
        baseX:startX+c*spacingX, baseY:70+r*46,
        type, color, sprite,
        health:r===0?2:1,
        radius:10,
        diving:false, diveVx:0, diveVy:0, diveAngle:0,
        flipFrame:0, flip:false,
        shootTimer:Math.floor(Math.random()*180)+90,
        waveOff:Math.random()*Math.PI*2
      });
    }
  }
  bugDir=1; bugDropping=false; diveBug=null;
}

// ── PARTICLES ─────────────────────────────────────────────────────────────
function emit(x,y,color,n=10){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, s=1+Math.random()*3.5;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,color,
      size:1+Math.random()*2});
  }
}

// ── LOOP ──────────────────────────────────────────────────────────────────
function loop(){
  if(!gameRunning) return;
  raf=requestAnimationFrame(loop);
  if(paused){ drawPause(); return; }
  frameCount++;
  update(); draw();
}

// ── UPDATE ────────────────────────────────────────────────────────────────
function update(){
  if(gameOver) return;

  // cat movement
  if(cat.dashing){
    cat.x+=cat.dashDir*DASH_SPEED;
    cat.dashFrames--;
    if(cat.dashFrames<=0){ cat.dashing=false; }
  } else {
    if(keys['ArrowLeft']||keys['a']||keys['A']) cat.x-=cat.speed;
    if(keys['ArrowRight']||keys['d']||keys['D']) cat.x+=cat.speed;
  }
  cat.x=Math.max(CAT_W*CAT_PX/2, Math.min(W-CAT_W*CAT_PX/2, cat.x));
  if(cat.dashCd>0) cat.dashCd--;
  if(cat.invincible>0) cat.invincible--;
  if(cat.shootCd>0) cat.shootCd--;

  // cat bullets — hard cull at all bounds
  bullets=bullets.filter(b=>b.y>0&&b.y<H&&b.x>0&&b.x<W);
  bullets.forEach(b=>{ b.y-=BULLET_SPEED; });

  // bug bullets — hard cull at all bounds
  bugBullets=bugBullets.filter(b=>b.y>0&&b.y<H&&b.x>0&&b.x<W);
  bugBullets.forEach(b=>{ b.x+=b.vx; b.y+=b.vy; });

  // formation drift
  const formed=bugs.filter(b=>!b.diving);
  if(formed.length){
    const spd=0.7+wave*0.12;
    let wall=false;
    formed.forEach(b=>{ b.baseX+=bugDir*spd; if(b.baseX<24||b.baseX>W-24) wall=true; });
    if(wall){ bugDir*=-1; formed.forEach(b=>b.baseY+=14); }
  }

  // dive trigger — one at a time
  if(!diveBug && frameCount%100===0 && bugs.length>0){
    const cands=bugs.filter(b=>!b.diving);
    if(cands.length){
      diveBug=cands[Math.floor(Math.random()*cands.length)];
      diveBug.diving=true;
      const ang=Math.atan2(cat.y-diveBug.y, cat.x-diveBug.x);
      diveBug.diveVx=Math.cos(ang)*3.5;
      diveBug.diveVy=Math.sin(ang)*3.5;
    }
  }

  // update bugs
  bugs.forEach(b=>{
    b.waveOff+=0.04;
    b.flipFrame++;
    if(b.flipFrame%30===0) b.flip=!b.flip;

    if(b.diving){
      b.diveVy+=0.06;
      b.x+=b.diveVx; b.y+=b.diveVy;
      if(b.y>H+50||b.x<-50||b.x>W+50){
        b.diving=false; b.x=b.baseX; b.y=-50;
        b.diveVx=0; b.diveVy=0;
        if(diveBug===b) diveBug=null;
      }
    } else {
      b.x+=(b.baseX-b.x)*0.1;
      b.y+=(b.baseY-b.y)*0.1 + Math.sin(b.waveOff)*0.4;
    }

    // bug shoots
    b.shootTimer--;
    if(b.shootTimer<=0){
      b.shootTimer=Math.floor(Math.random()*160)+80;
      const ang=Math.atan2(cat.y-b.y, cat.x-b.x);
      bugBullets.push({
        x:b.x, y:b.y+BUG_SH*BUG_PX/2,
        vx:Math.cos(ang)*BUG_BULLET_SPD,
        vy:Math.sin(ang)*BUG_BULLET_SPD
      });
    }
  });

  // player bullet vs bugs
  bullets.forEach(b=>{
    bugs.forEach(bug=>{
      const bx=bug.x-BUG_SW*BUG_PX/2, by=bug.y;
      if(b.x>bx && b.x<bx+BUG_SW*BUG_PX && b.y>by && b.y<by+BUG_SH*BUG_PX){
        b.y=-999; bug.health--;
        emit(b.x,b.y+BUG_SH*BUG_PX/2,bug.color,8);
        if(bug.health<=0){
          emit(bug.x,bug.y+BUG_SH*BUG_PX/2,bug.color,18);
          score+=bug.type==='C'?200:bug.type==='A'?100:50;
          if(diveBug===bug) diveBug=null;
        }
      }
    });
  });
  bugs=bugs.filter(b=>b.health>0);

  // bug bullet vs cat
  if(cat.invincible<=0){
    bugBullets.forEach(b=>{
      const cx=cat.x-CAT_W*CAT_PX/2, cy=cat.y;
      if(b.x>cx&&b.x<cx+CAT_W*CAT_PX&&b.y>cy&&b.y<cy+CAT_H*CAT_PX){
        b.y=H+99; lives--; cat.invincible=180;
        emit(cat.x,cat.y+CAT_H*CAT_PX/2,C.accent,20);
        if(lives<=0) gameOver=true;
      }
    });
    // diving bug touches cat
    bugs.filter(b=>b.diving).forEach(b=>{
      if(Math.hypot(b.x-cat.x, b.y-cat.y)<20){
        lives--; cat.invincible=180; b.health=0;
        emit(cat.x,cat.y,C.accent,20);
        if(lives<=0) gameOver=true;
        if(diveBug===b) diveBug=null;
      }
    });
  }

  // particles
  particles.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.vx*=0.9; p.vy*=0.9; p.life-=0.025; });
  particles=particles.filter(p=>p.life>0);

  // spawn yarn pickup — random chance, respects max
  if(frameCount%380===0 && pickups.length<2 && yarnBalls.length<MAX_YARN){
    pickups.push({
      x: 40+Math.random()*(W-80),
      y: -12,
      spin: 0
    });
  }

  // move pickups down, collect if cat touches
  pickups.forEach(p=>{ p.y+=PICKUP_SPD; p.spin+=0.08; });
  pickups=pickups.filter(p=>{
    if(p.y>H+20) return false; // fell off screen
    const dist=Math.hypot(p.x-cat.x, p.y-(cat.y+CAT_H*CAT_PX/2));
    if(dist<18 && yarnBalls.length<MAX_YARN){
      // collected — add a new orbiting yarn ball
      yarnBalls.push({
        angle: (yarnBalls.length*(Math.PI*2/MAX_YARN)),
        r: YARN_ORBIT_R + yarnBalls.length*8
      });
      emit(p.x,p.y,C.accent3,14);
      score+=300;
      return false;
    }
    return true;
  });

  // yarn balls orbit cat, intercept bug bullets
  const catCX=cat.x, catCY=cat.y+CAT_H*CAT_PX/2;
  yarnBalls.forEach(y=>{ y.angle+=YARN_ORBIT_SPD; });

  // yarn intercepts bug bullets
  yarnBalls.forEach(y=>{
    const yx=catCX+Math.cos(y.angle)*y.r;
    const yy=catCY+Math.sin(y.angle)*y.r;
    bugBullets.forEach(b=>{
      if(Math.hypot(b.x-yx,b.y-yy)<10){
        emit(b.x,b.y,C.accent3,6);
        b.x=-999; // mark for removal
      }
    });
  });
  bugBullets=bugBullets.filter(b=>b.x>-900);

  // next wave
  if(bugs.length===0) spawnWave();

  // update dash cooldown bar label
  const pct=Math.max(0,1-(cat.dashCd/DASH_COOLDOWN));
  const bar=document.getElementById('dashBar');
  if(bar){
    const ready=cat.dashCd===0;
    bar.innerHTML=`← → MOVE &nbsp;·&nbsp; SPACE fire &nbsp;·&nbsp;
      <span style="color:${ready?C.accent3:C.muted}">
        SHIFT lunge${ready?' ✦ READY':'  '+Math.ceil(cat.dashCd/60)+'s'}
      </span>
      &nbsp;·&nbsp; P pause`;
  }
}

// ── DRAW ──────────────────────────────────────────────────────────────────
function draw(){
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);

  // grid
  ctx.strokeStyle='rgba(78,255,196,0.022)'; ctx.lineWidth=1;
  for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

  // particles
  particles.forEach(p=>{
    ctx.globalAlpha=p.life;
    ctx.fillStyle=p.color;
    ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
  });
  ctx.globalAlpha=1;

  // bugs
  bugs.forEach(b=>{
    const sprite=b.flip&&b.type==='C'?BUG_B:b.sprite; // boss moths flutter
    drawSprite(sprite, BUG_PX,
      Math.round(b.x-BUG_SW*BUG_PX/2),
      Math.round(b.y),
      b.color, false);
    if(b.health===2){
      // health pip
      ctx.fillStyle=b.color;
      ctx.fillRect(Math.round(b.x-4), Math.round(b.y-5), 8, 2);
    }
  });

  // bullets
  bullets.forEach(b=>{
    ctx.shadowBlur=8; ctx.shadowColor=C.accent;
    ctx.fillStyle=C.accent;
    ctx.fillRect(b.x-1.5, b.y, 3, 9);
    ctx.shadowBlur=0;
  });

  // bug bullets — little pixel bolts
  bugBullets.forEach(b=>{
    ctx.shadowBlur=6; ctx.shadowColor=C.danger;
    ctx.fillStyle=C.danger;
    ctx.fillRect(b.x-1.5,b.y-1.5,3,3);
    ctx.shadowBlur=0;
  });

  // yarn ball pickups (falling)
  pickups.forEach(p=>{
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.spin);
    // yarn ball — concentric pixel rings in accent3
    ctx.fillStyle=C.accent3;
    const s=2;
    [[-2,-4],[0,-5],[2,-4],[4,-2],[5,0],[4,2],[2,4],[0,5],[-2,4],[-4,2],[-5,0],[-4,-2],
     [-1,-2],[1,-2],[2,-1],[2,1],[1,2],[-1,2],[-2,1],[-2,-1],[0,0]
    ].forEach(([dx,dy])=>ctx.fillRect(dx*s,dy*s,s,s));
    // glow
    ctx.shadowBlur=8; ctx.shadowColor=C.accent3;
    ctx.fillRect(-s,0,s,s);
    ctx.shadowBlur=0;
    ctx.restore();
  });

  // yarn balls orbiting cat
  const catCX=cat.x, catCY=cat.y+CAT_H*CAT_PX/2;
  yarnBalls.forEach(y=>{
    const yx=catCX+Math.cos(y.angle)*y.r;
    const yy=catCY+Math.sin(y.angle)*y.r;
    // orbit trail
    for(let t=1;t<=4;t++){
      const ta=y.angle-t*0.18;
      const tx=catCX+Math.cos(ta)*y.r, ty=catCY+Math.sin(ta)*y.r;
      ctx.globalAlpha=0.15*t;
      ctx.fillStyle=C.accent3;
      ctx.fillRect(tx-2,ty-2,4,4);
    }
    ctx.globalAlpha=1;
    // yarn pixel ball
    ctx.save(); ctx.translate(yx,yy); ctx.rotate(y.angle*2);
    ctx.fillStyle=C.accent3;
    ctx.shadowBlur=10; ctx.shadowColor=C.accent3;
    const s=2;
    [[0,-3],[2,-2],[3,0],[2,2],[0,3],[-2,2],[-3,0],[-2,-2],
     [0,-1],[1,0],[0,1],[-1,0]
    ].forEach(([dx,dy])=>ctx.fillRect(dx*s,dy*s,s,s));
    ctx.shadowBlur=0;
    ctx.restore();
  });

  // cat (blink when invincible)
  const blinkOk=cat.invincible<=0||Math.floor(cat.invincible/8)%2===0;
  if(blinkOk){
    const cx=Math.round(cat.x-CAT_W*CAT_PX/2);
    const cy=Math.round(cat.y);
    // dash streak
    if(cat.dashing){
      ctx.globalAlpha=0.25;
      drawSprite(CAT_SPRITE,CAT_PX,cx+cat.dashDir*-10,cy,C.accent,false);
      drawSprite(CAT_SPRITE,CAT_PX,cx+cat.dashDir*-20,cy,C.accent,false);
      ctx.globalAlpha=1;
    }
    drawSprite(CAT_SPRITE,CAT_PX,cx,cy,C.accent,false);
    // paws wiggle
    if(keys['ArrowLeft']||keys['ArrowRight']){
      ctx.fillStyle=C.accent;
      const wobble=Math.sin(frameCount*0.3)*2;
      ctx.fillRect(cx+2, cy+CAT_H*CAT_PX+wobble, 3, 3);
      ctx.fillRect(cx+CAT_W*CAT_PX-5, cy+CAT_H*CAT_PX-wobble, 3, 3);
    }
  }

  // dash cooldown arc
  const dashPct=1-(cat.dashCd/DASH_COOLDOWN);
  ctx.strokeStyle=cat.dashCd===0?C.accent3:C.dim;
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.arc(cat.x+CAT_W*CAT_PX/2+8, cat.y+CAT_H*CAT_PX/2,
    7, -Math.PI/2, -Math.PI/2+Math.PI*2*dashPct);
  ctx.stroke();

  // HUD
  ctx.fillStyle=C.accent; ctx.font='500 12px IBM Plex Mono';
  ctx.fillText('SCORE  '+String(score).padStart(6,'0'), 16, 26);
  ctx.fillText('WAVE   '+wave, 16, 44);
  // yarn ball count
  ctx.fillStyle=C.accent3;
  ctx.fillText('YARN   '+yarnBalls.length+'/'+MAX_YARN, 16, 62);
  // lives as cat icons (tiny)
  for(let i=0;i<lives;i++){
    drawSprite(CAT_SPRITE,1, W-20-(i*18), 12, C.accent, false);
  }

  if(gameOver){
    ctx.fillStyle='rgba(8,12,14,0.8)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    ctx.fillStyle=C.accent; ctx.font='400 28px Libre Baskerville';
    ctx.fillText('GAME OVER',W/2,H/2-24);
    ctx.fillStyle=C.muted; ctx.font='500 12px IBM Plex Mono';
    ctx.fillText('FINAL SCORE  '+score,W/2,H/2+10);
    ctx.fillText('PRESS SPACE TO RESTART',W/2,H/2+34);
    ctx.textAlign='left';
  }
}

function drawPause(){
  ctx.fillStyle='rgba(8,12,14,0.6)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle=C.accent3; ctx.font='500 13px IBM Plex Mono';
  ctx.textAlign='center'; ctx.fillText('PAUSED — P to resume',W/2,H/2); ctx.textAlign='left';
}

// ── INPUT ─────────────────────────────────────────────────────────────────
// listeners registered ONCE — no accumulation on restart
document.addEventListener('keydown',e=>{
  if(e.repeat) return; // block key-repeat entirely
  keys[e.key]=true;
  if(e.key===' '){
    e.preventDefault();
    if(gameOver){ startGame(); return; }
    if(gameRunning&&!paused&&cat.shootCd<=0){
      bullets.push({ x:cat.x, y:cat.y-2 });
      cat.shootCd=22; // ~2.7 shots/sec — snappy but not spammy
    }
  }
  if(e.key==='Shift'||e.key==='ShiftLeft'||e.key==='ShiftRight'){
    if(gameRunning&&!paused&&!cat.dashing&&cat.dashCd===0){
      const dir=(keys['ArrowLeft']||keys['a']||keys['A'])?-1:1;
      cat.dashing=true; cat.dashDir=dir;
      cat.dashFrames=DASH_FRAMES; cat.dashCd=DASH_COOLDOWN;
    }
  }
  if(e.key==='p'||e.key==='P') paused=!paused;
});
document.addEventListener('keyup',e=>{ keys[e.key]=false; });
