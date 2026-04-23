const DEFAULT_EXERCISES = [
    { id: "E1", name: "Alongamentos", series: "2x 30S", weight: 0, videoId: "9S_pU6q0Z6c", desc: "Aquecimento dinâmico." },
    { id: "E2", name: "Depressão Escapular", series: "2x 8-10", weight: 0, videoId: "f0aOqLp49lI", desc: "Ativação de dorsais." },
    { id: "E3", name: "Supino Inclinado Máquina", series: "4x 8-12", weight: 50, videoId: "SrqOu55lr6A", desc: "Peitoral superior." },
    { id: "E4", name: "Desenvolvimento Máquina", series: "3x 8-12", weight: 48, videoId: "WvLMauqrnVA", desc: "Deltoide anterior." },
    { id: "E5", name: "Crucifixo Máquina", series: "2x 8-12", weight: 20, videoId: "fC70O2KmsP0", desc: "Isolamento de peitoral." },
    { id: "E6", name: "Elevação Lateral", series: "2x 8-12", weight: 10, videoId: "3VcKaXpzqRo", desc: "Deltoide lateral." },
    { id: "E7", name: "Tríceps Francês Halter", series: "3x 8-12", weight: 18, videoId: "nRiJXayFzY0", desc: "Tríceps cabeça longa." }
];

const WORKOUT_CONFIGS = [
    { id: "W1", name: "SUPERIORES 1", exercises: ["E1", "E2", "E3", "E4", "E5", "E6", "E7"] },
    { id: "W2", name: "PERNAS", exercises: ["E8"] },
    { id: "W3", name: "SUPERIORES 2", exercises: ["E9"] }
];

class TitanApp {
    constructor() {
        this.exercises = JSON.parse(localStorage.getItem('titan_exercises')) || DEFAULT_EXERCISES;
        this.sessions = JSON.parse(localStorage.getItem('titan_sessions')) || [];
        
        this.activeWorkout = null;
        this.activeSessionTime = 0;
        this.timerInterval = null;
        this.sessionSets = [];

        this.init();
    }

    init() {
        this.renderHome();
        this.setupGlobalListeners();
        this.updateStats();
        lucide.createIcons();
    }

    setupGlobalListeners() {
        // Navigation
        document.getElementById('goto-trainer-btn').addEventListener('click', () => this.switchScreen('trainer-screen'));
        document.getElementById('back-to-app').addEventListener('click', () => this.switchScreen('home-screen'));
        document.getElementById('finish-workout').addEventListener('click', () => this.finishWorkout());
        document.getElementById('close-summary').addEventListener('click', () => this.switchScreen('home-screen'));
        document.getElementById('cancel-workout').addEventListener('click', () => {
            if(confirm("Deseja cancelar o treino? O progresso não será salvo.")) this.switchScreen('home-screen');
        });

        // Overlay actions
        document.querySelector('.close-btn').addEventListener('click', () => document.getElementById('exercise-overlay').classList.add('hidden'));
        document.getElementById('add-set-btn').addEventListener('click', () => this.addSet());
        
        // Trainer form
        document.getElementById('exercise-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTrainerExercise();
        });
    }

    switchScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(screenId).classList.remove('hidden');
        
        if(screenId === 'trainer-screen') this.renderTrainer();
        if(screenId === 'home-screen') {
            this.renderHome();
            this.updateStats();
        }
        lucide.createIcons();
    }

    updateStats() {
        const totalVol = this.sessions.reduce((acc, s) => acc + (s.volume || 0), 0);
        const totalRecords = this.exercises.reduce((acc, ex) => acc + (ex.recordsCount || 0), 0);
        
        document.getElementById('total-workouts').textContent = this.sessions.length;
        document.getElementById('total-volume').textContent = (totalVol / 1000).toFixed(1) + 'k';
        document.getElementById('total-records').textContent = totalRecords;
    }

    renderHome() {
        const container = document.getElementById('workout-cards-container');
        container.innerHTML = '';
        
        WORKOUT_CONFIGS.forEach(conf => {
            const card = document.createElement('div');
            card.className = 'workout-card';
            card.innerHTML = `
                <div class="workout-card-body">
                    <h2>${conf.name}</h2>
                    <p>${conf.exercises.length} EXERCÍCIOS · FOCO EM CARGA</p>
                    <button class="btn-start" onclick="app.startWorkout('${conf.id}')">INICIAR TREINO</button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    startWorkout(workoutId) {
        const config = WORKOUT_CONFIGS.find(c => c.id === workoutId);
        this.activeWorkout = config;
        this.activeSessionTime = 0;
        this.sessionSets = [];
        this.switchScreen('workout-screen');
        
        this.renderExerciseFeed();
        
        // Start Timer
        if(this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.activeSessionTime++;
            const m = Math.floor(this.activeSessionTime / 60);
            const s = this.activeSessionTime % 60;
            document.getElementById('workout-duration').textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        }, 1000);
    }

    renderExerciseFeed() {
        const feed = document.getElementById('exercise-feed');
        feed.innerHTML = '';
        
        this.activeWorkout.exercises.forEach(exId => {
            const exData = this.exercises.find(e => e.id === exId);
            if(!exData) return;
            
            const setsDone = this.sessionSets.filter(s => s.exerciseId === exId).length;
            const card = document.createElement('div');
            card.className = `item-card ${setsDone > 0 ? 'done' : ''}`;
            card.innerHTML = `
                <div class="item-card-info">
                    <h4>${exData.name}</h4>
                    <p>${exData.series} · Record: ${exData.weight || 0}kg</p>
                </div>
                <div class="item-card-status">${setsDone} SÉRIES</div>
            `;
            card.addEventListener('click', () => this.openExerciseOverlay(exData));
            feed.appendChild(card);
        });
    }

    openExerciseOverlay(ex) {
        this.selectedExercise = ex;
        document.getElementById('modal-name').textContent = ex.name;
        document.getElementById('modal-prev-load').textContent = (ex.weight || 0) + 'kg';
        document.getElementById('w-input').value = ex.weight || "";
        
        // Video Preview
        const videoCont = document.getElementById('modal-video-container');
        videoCont.innerHTML = `<iframe src="https://www.youtube.com/embed/${ex.videoId}?mute=1" frameborder="0"></iframe>`;
        
        this.renderSetHistory();
        document.getElementById('exercise-overlay').classList.remove('hidden');
    }

    addSet() {
        const w = parseFloat(document.getElementById('w-input').value);
        const r = parseInt(document.getElementById('r-input').value);
        
        if(!w || !r) return this.toast("Preencha carga e reps!");

        const newSet = { 
            exerciseId: this.selectedExercise.id, 
            weight: w, 
            reps: r, 
            timestamp: Date.now() 
        };
        
        this.sessionSets.push(newSet);
        
        // Record logic
        if(w > (this.selectedExercise.weight || 0)) {
            this.selectedExercise.weight = w;
            this.selectedExercise.recordsCount = (this.selectedExercise.recordsCount || 0) + 1;
            this.toast("🚀 NOVO RECORDE!");
            this.save();
        }

        this.renderSetHistory();
        this.renderExerciseFeed();
    }

    renderSetHistory() {
        const hist = document.getElementById('modal-set-history');
        const sets = this.sessionSets.filter(s => s.exerciseId === this.selectedExercise.id);
        hist.innerHTML = sets.map((s, i) => `
            <div style="padding: 10px; border-bottom: 1px solid #222; display: flex; justify-content: space-between;">
                <span>Série ${i+1}</span>
                <span>${s.weight}kg x ${s.reps}</span>
            </div>
        `).join('');
    }

    finishWorkout() {
        if(this.sessionSets.length === 0) return this.toast("Faça pelo menos uma série!");
        
        const volume = this.sessionSets.reduce((acc, s) => acc + (s.weight * s.reps), 0);
        const duration = Math.floor(this.activeSessionTime / 60);
        
        const session = {
            id: Date.now(),
            workoutName: this.activeWorkout.name,
            volume: volume,
            duration: duration,
            date: new Date().toLocaleDateString()
        };
        
        this.sessions.push(session);
        this.save();
        
        // Summary
        document.getElementById('sum-volume').textContent = volume + 'kg';
        document.getElementById('sum-duration').textContent = duration + 'm';
        this.switchScreen('summary-screen');
        
        clearInterval(this.timerInterval);
    }

    renderTrainer() {
        const list = document.getElementById('full-exercise-list');
        list.innerHTML = this.exercises.map(ex => `
            <div class="ex-tester-card" onclick="app.testVideo('${ex.id}')">
                <span>${ex.name}</span>
                <i data-lucide="play-circle" size="16"></i>
            </div>
        `).join('');
        lucide.createIcons();
    }

    testVideo(exId) {
        const ex = this.exercises.find(e => e.id === exId);
        const tester = document.getElementById('video-tester');
        tester.innerHTML = `<iframe src="https://www.youtube.com/embed/${ex.videoId}?autoplay=1" width="100%" height="100%" frameborder="0"></iframe>`;
        
        // Fill form
        const form = document.getElementById('exercise-form');
        form.name.value = ex.name;
        form.videoId.value = ex.videoId;
        form.series.value = ex.series;
        this.selectedTrainerEx = ex;
    }

    saveTrainerExercise() {
        const form = document.getElementById('exercise-form');
        this.selectedTrainerEx.name = form.name.value;
        this.selectedTrainerEx.videoId = form.videoId.value;
        this.selectedTrainerEx.series = form.series.value;
        this.save();
        this.toast("Alterações salvas!");
        this.renderTrainer();
    }

    save() {
        localStorage.setItem('titan_exercises', JSON.stringify(this.exercises));
        localStorage.setItem('titan_sessions', JSON.stringify(this.sessions));
    }

    toast(msg) {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:var(--primary); color:#000; padding:15px 30px; border-radius:30px; font-weight:800; z-index:2000; box-shadow:0 10px 30px var(--primary-glow);`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2500);
    }
}

const app = new TitanApp();
window.app = app;
