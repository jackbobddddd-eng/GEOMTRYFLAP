const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score-main');
const modeText = document.getElementById('mode-text');
const modeAlert = document.getElementById('mode-alert');
const hardFlash = document.getElementById('hard-mode-flash');
const overlay = document.getElementById('overlay');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- STATE ---
let active = false, score = 0, frames = 0;
let isWaveMode = false, isHolding = false, isHardMode = false;
let obstacles = [], stars = [];
let ship;

// --- SPEED & SPACING ---
const INITIAL_SPEED = 6;
const MAX_SPEED = 22; // Prevents game from breaking at infinite speeds
let currentScrollSpeed = INITIAL_SPEED;
const speedIncrement = 0.0016; // Increased for "faster faster" ramp-up

const DISTANCE_BETWEEN_OBSTACLES = 450; 
let pixelsSinceLastSpawn = 0;

// --- OG PHYSICS ---
const gravity = 0.5, flapPower = -9, waveSpeed = 7;

// --- CONSISTENT GAP CONFIG ---
const FIXED_GAP_SIZE = 165; 

const insults = [
    "GEOMETRY IS HARD, ISN'T IT?",
    "FLAP ERROR: 404 SKILL NOT FOUND.",
    "THE STARS ARE LAUGHING AT YOU.",
    "VOID CONSUMES THE WEAK.",
    "WAS THAT YOUR BEST? TRAGIC."
];

class Star {
    constructor(isDistant) {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = isDistant ? Math.random() * 1.5 : Math.random() * 3;
        this.speed = isDistant ? 0.4 : 1.2;
        this.color = isDistant ? '#444' : '#888';
    }
    update() {
        this.x -= this.speed * (currentScrollSpeed / INITIAL_SPEED);
        if (this.x < 0) {
            this.x = canvas.width;
            this.y = Math.random() * canvas.height;
        }
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

class Ship {
    constructor() {
        this.x = 200; this.y = canvas.height / 2;
        this.v = 0; this.w = 45; this.h = 25; this.angle = 0;
    }
    update() {
        if (isWaveMode) {
            this.v = isHolding ? -waveSpeed : waveSpeed;
            this.angle = isHolding ? -Math.PI / 5 : Math.PI / 5;
        } else {
            this.v += gravity;
            this.angle = Math.min(Math.PI / 6, Math.max(-Math.PI / 6, this.v * 0.05));
        }
        this.y += this.v;
        if (this.y < 0 || this.y > canvas.height) die();
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.shadowBlur = 15;
        ctx.shadowColor = isWaveMode ? '#ffcc00' : '#0ff';
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(20, 0); ctx.lineTo(-20, -12); ctx.lineTo(-10, 0); ctx.lineTo(-20, 12);
        ctx.closePath(); ctx.fill();
        ctx.restore();
    }
}

class Obstacle {
    constructor(isLong = false) {
        this.x = canvas.width;
        this.isLong = isLong;
        this.w = isLong ? 450 : 70;
        this.gap = FIXED_GAP_SIZE;
        
        const minTop = 50;
        const maxTop = canvas.height - this.gap - 50;
        this.topH = Math.random() * (maxTop - minTop) + minTop;

        this.passed = false;
        this.color = isLong ? '#ff0000' : '#f0f';
    }
    update() { this.x -= currentScrollSpeed; }
    draw() {
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, 0, this.w, this.topH);
        ctx.fillRect(this.x, this.topH + this.gap, this.w, canvas.height);
    }
}

function die() {
    active = false;
    overlay.classList.remove('hidden');
    hardFlash.classList.remove('flash-anim');
    const randomInsult = insults[Math.floor(Math.random() * insults.length)];
    document.getElementById('death-title').innerText = "SYSTEM CRASH";
    document.getElementById('death-msg').innerHTML = 
        `<span style="color:#ff0044">${randomInsult}</span><br>SCORE: ${score}`;
    const best = localStorage.getItem('best_gf') || 0;
    if (score > best) localStorage.setItem('best_gf', score);
    document.getElementById('high-score').innerText = localStorage.getItem('best_gf');
}

function animate() {
    if (!active) return;
    ctx.fillStyle = '#020205';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    stars.forEach(s => { s.update(); s.draw(); });

    frames++;
    
    // RAMP UP SPEED
    if (currentScrollSpeed < MAX_SPEED) {
        currentScrollSpeed += speedIncrement;
    }

    if (score >= 20 && !isHardMode) {
        isHardMode = true;
        hardFlash.classList.add('flash-anim');
    }

    let modeCheck = Math.floor(score / 10) % 2 !== 0;
    if (modeCheck !== isWaveMode) {
        isWaveMode = modeCheck;
        modeText.innerText = isWaveMode ? "WAVE" : "FLAP";
        modeText.style.color = isWaveMode ? "#ffcc00" : "#0ff";
        modeAlert.innerText = isWaveMode ? "WAVE MODE: HOLD" : "FLAP MODE: TAP";
        modeAlert.style.opacity = 1;
        setTimeout(() => modeAlert.style.opacity = 0, 1500);
    }

    ship.update();
    ship.draw();

    pixelsSinceLastSpawn += currentScrollSpeed;
    if (pixelsSinceLastSpawn >= DISTANCE_BETWEEN_OBSTACLES) {
        const longExists = obstacles.some(o => o.isLong);
        let spawnLong = (isHardMode && isWaveMode && !longExists && Math.random() < 0.4);
        
        obstacles.push(new Obstacle(spawnLong));
        pixelsSinceLastSpawn = 0; 
    }

    obstacles.forEach((obs, i) => {
        obs.update();
        obs.draw();
        if (ship.x + 15 > obs.x && ship.x - 15 < obs.x + obs.w) {
            if (ship.y < obs.topH || ship.y > obs.topH + obs.gap) die();
        }
        if (!obs.passed && obs.x < ship.x) {
            obs.passed = true;
            score++;
            scoreEl.innerText = score.toString().padStart(2, '0');
        }
        if (obs.x < -500) obstacles.splice(i, 1);
    });

    requestAnimationFrame(animate);
}

// --- INPUTS ---
const startH = () => { isHolding = true; if (!isWaveMode && active) ship.v = flapPower; };
const stopH = () => isHolding = false;
window.addEventListener('mousedown', startH);
window.addEventListener('mouseup', stopH);
window.addEventListener('keydown', (e) => { if (e.code === 'Space') startH(); });
window.addEventListener('keyup', (e) => { if (e.code === 'Space') stopH(); });

document.getElementById('start-btn').onclick = () => {
    score = 0; frames = 0; active = true; 
    isWaveMode = false; isHardMode = false;
    currentScrollSpeed = INITIAL_SPEED;
    pixelsSinceLastSpawn = 0;
    obstacles = []; 
    stars = Array.from({length: 80}, (_, i) => new Star(i < 50));
    ship = new Ship();
    scoreEl.innerText = "00";
    overlay.classList.add('hidden');
    animate();
};

document.getElementById('high-score').innerText = localStorage.getItem('best_gf') || 0;
