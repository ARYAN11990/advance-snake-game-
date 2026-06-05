/* ================= CONFIGURATION ================= */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameRunning = false;
let animationId;
let currentMode = 'classic'; 

const state = {
    camera: { x: 0, y: 0 },
    width: 3000, 
    height: 3000,
    score: 0,
    coins: 0,
    kills: 0,
    time: 0, 
    timeLeft: 120,
    paused: false,
    playerName: "Player"
};

// Controls
const mouse = { x: 0, y: 0, down: false, active: false };
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, w: false, s: false, a: false, d: false, " ": false };

const randomColor = () => `hsl(${Math.random() * 360}, 70%, 50%)`;
const botNames = ["Slayer", "Viper", "Glider", "Noob", "Pro", "Venom", "Ghost", "Shadow", "King", "Queen"];

/* ================= AUDIO ================= */
const AudioSys = {
    ctx: new (window.AudioContext || window.webkitAudioContext)(),
    play: (freq, type, dur) => {
        if(AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume();
        const osc = AudioSys.ctx.createOscillator();
        const gain = AudioSys.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, AudioSys.ctx.currentTime);
        gain.gain.setValueAtTime(0.05, AudioSys.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, AudioSys.ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(AudioSys.ctx.destination);
        osc.start();
        osc.stop(AudioSys.ctx.currentTime + dur);
    },
    eat: () => AudioSys.play(600, 'sine', 0.1),
    kill: () => AudioSys.play(200, 'square', 0.2), 
    die: () => AudioSys.play(100, 'sawtooth', 0.6),
    powerup: () => AudioSys.play(1200, 'square', 0.3),
    bomb: () => AudioSys.play(100, 'square', 0.5)
};

/* ================= CLASSES ================= */
class Snake {
    constructor(isAi = false, name = "Player") {
        this.isAi = isAi;
        this.name = name;
        this.x = Math.random() * (state.width - 100) + 50;
        this.y = Math.random() * (state.height - 100) + 50;
        this.angle = Math.random() * Math.PI * 2;
        this.velocity = 3;
        this.baseSpeed = 3;
        this.turnSpeed = 0.10; 
        this.radius = 12;
        this.history = [];
        this.length = 20;
        this.color = isAi ? randomColor() : (Shop.getEquippedColor ? Shop.getEquippedColor() : '#4CAF50');
        this.dead = false;
        
        // AI Logic
        this.targetX = this.x;
        this.targetY = this.y;
        this.changeDirTimer = 0;

        // Powerups
        this.magnetTime = 0;
        this.speedTime = 0;
        this.killedByPlayer = false; 
    }

    update() {
        if (this.dead) return;

        let boosting = false;

        if (!this.isAi) {
            // CONTROLS
            let turnedByKey = false;
            
            if (keys.ArrowLeft || keys.a) {
                this.angle -= this.turnSpeed;
                turnedByKey = true;
                mouse.active = false; 
            }
            if (keys.ArrowRight || keys.d) {
                this.angle += this.turnSpeed;
                turnedByKey = true;
                mouse.active = false;
            }

            if (!turnedByKey && mouse.active) {
                const snakeScreenX = this.x - state.camera.x;
                const snakeScreenY = this.y - state.camera.y;
                const dx = mouse.x - snakeScreenX;
                const dy = mouse.y - snakeScreenY;
                
                if(Math.hypot(dx, dy) > 20) {
                    const targetAngle = Math.atan2(dy, dx);
                    let diff = targetAngle - this.angle;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    if(Math.abs(diff) < this.turnSpeed) this.angle = targetAngle;
                    else this.angle += Math.sign(diff) * this.turnSpeed;
                }
            }

            if (keys.ArrowUp || keys.w || keys[" "] || mouse.down || this.speedTime > 0) {
                boosting = true;
            }

        } else {
            this.aiThink();
            if (this.speedTime > 0) boosting = true;
        }

        // Apply Speed
        if (boosting) {
            this.velocity = 6;
            if (this.speedTime <= 0 && this.length > 10) {
                if (frameCount % 5 === 0) {
                    this.length -= 1.0; 
                    let dropX = this.history.length > 5 ? this.history[this.history.length - 4].x : this.x;
                    let dropY = this.history.length > 5 ? this.history[this.history.length - 4].y : this.y;
                    dropFood(dropX, dropY, 1, 'small'); 
                }
            }
        } else {
            this.velocity = this.baseSpeed;
        }

        this.x += Math.cos(this.angle) * this.velocity;
        this.y += Math.sin(this.angle) * this.velocity;

        // === FIXED BOUNDARIES ===
        // Stop snake 25px inside the map (where the wall visually is)
        const wallBuffer = 25 + this.radius; 
        if (this.x < wallBuffer) this.x = wallBuffer;
        if (this.x > state.width - wallBuffer) this.x = state.width - wallBuffer;
        if (this.y < wallBuffer) this.y = wallBuffer;
        if (this.y > state.height - wallBuffer) this.y = state.height - wallBuffer;

        this.history.push({ x: this.x, y: this.y });
        while (this.history.length > this.length * 4) {
            this.history.shift();
        }

        if(this.magnetTime > 0) this.magnetTime--;
        if(this.speedTime > 0) this.speedTime--;
        
        this.radius = Math.min(35, 12 + this.length / 100);
    }

    aiThink() {
        this.changeDirTimer--;
        let distToTarget = Math.hypot(this.targetX - this.x, this.targetY - this.y);

        if (this.changeDirTimer <= 0 || distToTarget < 50) {
            let closest = null;
            let minDist = 500;
            for(let f of foods) {
                let dx = f.x - this.x;
                let dy = f.y - this.y;
                let d = Math.sqrt(dx*dx + dy*dy);
                if(d < minDist) { minDist = d; closest = f; }
            }
            if(closest && minDist > 40) {
                this.targetX = closest.x;
                this.targetY = closest.y;
            } else {
                this.targetX = this.x + (Math.random() - 0.5) * 600;
                this.targetY = this.y + (Math.random() - 0.5) * 600;
            }
            this.changeDirTimer = 40 + Math.random() * 40;
        }
        let dx = this.targetX - this.x;
        let dy = this.targetY - this.y;
        let targetAngle = Math.atan2(dy, dx);
        let diff = targetAngle - this.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.angle += diff * 0.1;
    }

    draw() {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if(this.magnetTime > 0) { ctx.shadowBlur = 15; ctx.shadowColor = "#00d2d3"; }
        if(this.speedTime > 0) { ctx.shadowBlur = 15; ctx.shadowColor = "#ff9f43"; }

        for (let i = this.history.length - 1; i >= 0; i -= 4) {
            const point = this.history[i];
            let size = this.radius;
            if (i < 12) size = this.radius * (i / 12);
            size = Math.max(3, size);

            ctx.beginPath();
            ctx.arc(point.x - state.camera.x, point.y - state.camera.y, size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        ctx.shadowBlur = 0; 

        // Head
        const sx = this.x - state.camera.x;
        const sy = this.y - state.camera.y;

        ctx.beginPath();
        ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#fff"; 
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = this.color; 
        ctx.fill();

        // Eyes
        const eyeOff = this.radius * 0.5;
        ctx.fillStyle = "white";
        ctx.beginPath(); ctx.arc(sx + Math.cos(this.angle - 0.6)*eyeOff, sy + Math.sin(this.angle - 0.6)*eyeOff, this.radius*0.35, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + Math.cos(this.angle + 0.6)*eyeOff, sy + Math.sin(this.angle + 0.6)*eyeOff, this.radius*0.35, 0, Math.PI*2); ctx.fill();
        
        ctx.fillStyle = "black";
        ctx.beginPath(); ctx.arc(sx + Math.cos(this.angle - 0.6)*eyeOff, sy + Math.sin(this.angle - 0.6)*eyeOff, this.radius*0.15, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + Math.cos(this.angle + 0.6)*eyeOff, sy + Math.sin(this.angle + 0.6)*eyeOff, this.radius*0.15, 0, Math.PI*2); ctx.fill();

        // Name Tag
        ctx.fillStyle = "white";
        ctx.font = "bold 14px Arial"; 
        ctx.textAlign = "center";
        ctx.shadowColor="black"; ctx.shadowBlur=4;
        ctx.fillText(this.name, sx, sy - this.radius - 10);
        ctx.shadowBlur=0;
    }

    grow(amount) {
        this.length += amount;
    }
}

class Food {
    constructor(x, y, val, type = 'normal') {
        this.x = x || Math.random() * (state.width - 60) + 30;
        this.y = y || Math.random() * (state.height - 60) + 30;
        this.val = val || 1;
        this.type = type; 
        
        this.age = 0; 
        this.maxAge = 900; 
        
        this.color = '#ff4757';
        this.size = 5;
        
        if(type === 'coin') { this.color = '#FFD700'; this.size = 12; } 
        if(type === 'magnet') { this.color = '#00d2d3'; this.size = 25; } 
        if(type === 'speed') { this.color = '#ff9f43'; this.size = 25; } 
        if(type === 'bomb') { this.color = '#2f3542'; this.size = 25; } 
        if(type === 'small') { this.color = '#e1b12c'; this.size = 5; } 
        
        this.vx = 0; this.vy = 0; 
    }

    draw() {
        const sx = this.x - state.camera.x;
        const sy = this.y - state.camera.y;
        if (sx < -40 || sx > canvas.width + 40 || sy < -40 || sy > canvas.height + 40) return;

        this.x += this.vx; this.y += this.vy;
        this.vx *= 0.9; this.vy *= 0.9;

        if (this.type === 'small' && this.age > this.maxAge - 60) {
            if (Math.floor(this.age / 5) % 2 === 0) return;
        }

        ctx.beginPath();
        if(['magnet','speed','bomb'].includes(this.type)) {
            const boxSize = this.size * 1.5;
            ctx.fillStyle = this.color;
            ctx.fillRect(sx - boxSize/2, sy - boxSize/2, boxSize, boxSize); 
            ctx.fillStyle = "white";
            ctx.font = "bold 20px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            let icon = (this.type==='magnet')?'🧲':(this.type==='speed'?'⚡':'💣');
            ctx.fillText(icon, sx, sy);
        } else {
            ctx.arc(sx, sy, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
    }
}

/* ================= ENGINE ================= */
let player;
let bots = [];
let foods = [];
let frameCount = 0;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);

function initGame() {
    resize();
    let pName = document.getElementById('playerNameInput').value;
    if(!pName || pName.trim() === "") pName = "You"; 

    player = new Snake(false, pName);
    bots = [];
    foods = [];
    state.score = 0;
    state.coins = (Shop && Shop.data) ? Shop.data.coins : 0;
    state.kills = 0;
    state.time = 0;
    state.timeLeft = 120;
    frameCount = 0;

    for(let i=0; i<300; i++) spawnFood();
    let botCount = (currentMode === 'survival') ? 30 : 15;
    for(let i=0; i<botCount; i++) spawnBot();
}

function spawnFood(x, y, val, type) {
    if(!type) {
        const r = Math.random();
        if(r > 0.995) type = 'magnet';
        else if(r > 0.99) type = 'bomb';
        else if(r > 0.985) type = 'speed';
        else if(r > 0.95) type = 'coin';
        else type = 'normal';
    }
    foods.push(new Food(x, y, val, type));
}

function dropFood(x, y, val, type) {
    foods.push(new Food(x, y, val, type || 'normal'));
}

function spawnBot() {
    let name = botNames[Math.floor(Math.random() * botNames.length)];
    bots.push(new Snake(true, name));
}

function killSnake(snakeObj, index, isBot) {
    snakeObj.dead = true;

    for(let i = 0; i < snakeObj.history.length; i+=2) {
        let pt = snakeObj.history[i];
        dropFood(pt.x + (Math.random()*10), pt.y + (Math.random()*10), 2, 'small');
    }

    if(isBot) {
        bots.splice(index, 1);
        if(snakeObj.killedByPlayer) {
            state.kills++;
            AudioSys.kill(); 
        }
        
        if(currentMode === 'classic' || currentMode === 'time') spawnBot();
        if(currentMode === 'survival' && bots.length === 0) endGame(true);
    } else {
        AudioSys.die(); 
        endGame(false);
    }
}

function activateBomb(sourceSnake) {
    AudioSys.bomb();
    const blastRadius = 300;
    for(let i = bots.length - 1; i >= 0; i--) {
        let b = bots[i];
        let dx = sourceSnake.x - b.x;
        let dy = sourceSnake.y - b.y;
        if(Math.sqrt(dx*dx+dy*dy) < blastRadius) {
            b.killedByPlayer = !sourceSnake.isAi; 
            killSnake(b, i, true);
        }
    }
}

function update() {
    if (state.paused) return;
    frameCount++;

    if(frameCount % 60 === 0) {
        if(currentMode === 'time') {
            state.timeLeft--;
            if(state.timeLeft <= 0) endGame(true);
        } else {
            state.time++;
        }
    }

    foods = foods.filter(f => {
        if (f.type === 'small') {
            f.age++;
            return f.age < f.maxAge; 
        }
        return true; 
    });

    const allSnakes = [player, ...bots];

    allSnakes.forEach(s => {
        s.update();
        if(s.magnetTime > 0) {
            foods.forEach(f => {
                let dx = s.x - f.x;
                let dy = s.y - f.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                if(dist < 300) { f.vx = dx * 0.15; f.vy = dy * 0.15; }
            });
        }
    });

    state.camera.x = player.x - canvas.width / 2;
    state.camera.y = player.y - canvas.height / 2;
    state.camera.x = Math.max(0, Math.min(state.camera.x, state.width - canvas.width));
    state.camera.y = Math.max(0, Math.min(state.camera.y, state.height - canvas.height));

    allSnakes.forEach(s => {
        for (let i = foods.length - 1; i >= 0; i--) {
            const f = foods[i];
            const dx = s.x - f.x;
            const dy = s.y - f.y;
            if (Math.sqrt(dx*dx + dy*dy) < s.radius + f.size) {
                if(f.type === 'coin') {
                    if(!s.isAi) { state.coins++; AudioSys.eat(); }
                } else if(f.type === 'magnet') {
                     s.magnetTime = 600; 
                     if(!s.isAi) AudioSys.powerup();
                } else if(f.type === 'speed') {
                     s.speedTime = 300; 
                     if(!s.isAi) AudioSys.powerup();
                } else if(f.type === 'bomb') {
                     if(!s.isAi) activateBomb(s);
                } else {
                    s.grow(f.val);
                    if(!s.isAi) state.score += 10;
                }
                foods.splice(i, 1);
                if(foods.length < 200) spawnFood();
            }
        }
    });

    for(let i=0; i<allSnakes.length; i++) {
        let attacker = allSnakes[i];
        if(attacker.dead) continue;
        for(let j=0; j<allSnakes.length; j++) {
            let victim = allSnakes[j];
            if(attacker === victim) continue; 
            if(victim.dead) continue;

            let collision = false;
            for(let k=0; k<victim.history.length; k+=3) {
                let pt = victim.history[k];
                let dist = Math.hypot(attacker.x - pt.x, attacker.y - pt.y);
                if(dist < victim.radius + attacker.radius - 5) { 
                    collision = true;
                    break;
                }
            }

            if(collision) {
                if(i === 0) {
                    killSnake(player, 0, false); 
                } else {
                    if(j === 0) attacker.killedByPlayer = true; 
                    killSnake(attacker, i-1, true);
                }
            }
        }
    }

    // UI Updates
    document.getElementById('scoreDisplay').innerText = state.score;
    document.getElementById('killDisplay').innerText = state.kills;
    if(document.getElementById('coinDisplay')) {
        document.getElementById('coinDisplay').innerText = state.coins;
    }
    
    let t = (currentMode === 'time') ? state.timeLeft : state.time;
    let mins = Math.floor(t / 60);
    let secs = t % 60;
    document.getElementById('timeDisplay').innerText = `${mins}:${secs<10?'0':''}${secs}`;

    let sorted = [...allSnakes].sort((a,b) => b.length - a.length);
    let rank = sorted.indexOf(player) + 1;
    document.getElementById('rankDisplay').innerText = `${rank}/${allSnakes.length}`;

    document.getElementById('mag-hud').classList.toggle('hidden', player.magnetTime <= 0);
    document.getElementById('spd-hud').classList.toggle('hidden', player.speedTime <= 0);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = "#2c2c54";
    ctx.fillRect(0,0,canvas.width, canvas.height);

    const gridSize = 50;
    const offX = -state.camera.x % gridSize;
    const offY = -state.camera.y % gridSize;
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1; 
    ctx.beginPath();
    for(let x=offX; x<canvas.width; x+=gridSize) { ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); }
    for(let y=offY; y<canvas.height; y+=gridSize) { ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); }
    ctx.stroke();

    // === FIXED VISUAL BORDERS ===
    // Draw the red border 25px inset from the "real" map edge.
    // This provides a safety buffer so it's always visible.
    ctx.strokeStyle = "#ff4757";
    ctx.lineWidth = 20;
    ctx.strokeRect(
        -state.camera.x + 25, 
        -state.camera.y + 25, 
        state.width - 50, 
        state.height - 50
    );

    foods.forEach(f => f.draw());
    bots.forEach(b => b.draw());
    if(!player.dead) player.draw();
}

function loop() {
    if (!gameRunning) return;
    update();
    draw();
    animationId = requestAnimationFrame(loop);
}

/* ================= CONTROLS ================= */
// Mouse
window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true; 
});
window.addEventListener('mousedown', () => mouse.down = true);
window.addEventListener('mouseup', () => mouse.down = false);

// Keyboard
window.addEventListener('keydown', e => {
    if(keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
    }
});

window.addEventListener('keyup', e => {
    if(keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
    }
});

// Touch
window.addEventListener('touchmove', e => {
    e.preventDefault();
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
    mouse.active = true;
}, {passive: false});
window.addEventListener('touchstart', () => mouse.down = true);
window.addEventListener('touchend', () => mouse.down = false);

function startGame() {
    document.getElementById('ui-layer').querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('hud').classList.remove('hidden');
    initGame();
    gameRunning = true;
    loop();
}

function endGame(victory) {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    if(Shop && Shop.save) {
        Shop.data.coins = state.coins;
        Shop.save();
    }
    Leaderboard.saveScore(state.score);

    document.getElementById('hud').classList.add('hidden');
    document.getElementById('goTitle').innerText = victory ? "YOU WIN!" : "GAME OVER";
    document.getElementById('goTitle').style.color = victory ? "#2ecc71" : "#e74c3c";
    
    document.getElementById('finalScore').innerText = state.score;
    document.getElementById('finalKills').innerText = state.kills;
    document.getElementById('finalCoins').innerText = state.coins;
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

function restartGame() {
    document.getElementById('gameOverScreen').classList.add('hidden');
    startGame();
}

function selectMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
    if(window.event) window.event.currentTarget.classList.add('selected');
}

function togglePause() {
    state.paused = !state.paused;
    document.getElementById('pauseScreen').classList.toggle('hidden', !state.paused);
}

function goToMenu() {
    gameRunning = false;
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
}

document.getElementById('pauseBtn').addEventListener('click', togglePause);