const APP_DATA = {
    workouts: [
        {
            id: "W1",
            name: "SUPERIORES 1",
            exercises: [
                { id: "E1", name: "Alongamentos", series: "2x 30S", weight: null, interval: "00:30", videoId: "9S_pU6q0Z6c", completed: 0, total: 2, desc: "Aquecimento dinâmico para ombros e peitoral." },
                { id: "E2", name: "Depressão Escapular", series: "2x 8-10", weight: null, interval: "01:30", videoId: "f0aOqLp49lI", completed: 0, total: 2, desc: "Foco em ativação de trapézio inferior e dorsais." },
                { id: "E3", name: "Supino Inclinado Máquina", series: "4x 8-12", weight: 50, interval: "02:00", videoId: "SrqOu55lr6A", completed: 0, total: 4, desc: "Foco em peitoral superior." },
                { id: "E4", name: "Desenvolvimento Máquina", series: "3x 8-12", weight: 48, interval: "02:00", videoId: "WvLMauqrnVA", completed: 0, total: 3, desc: "Desenvolvimento focado em deltoide anterior." },
                { id: "E5", name: "Crucifixo Máquina", series: "2x 8-12", weight: 20, interval: "01:30", videoId: "fC70O2KmsP0", completed: 0, total: 2, desc: "Isolamento de peitoral." },
                { id: "E6", name: "Elevação Lateral", series: "2x 8-12", weight: 10, interval: "01:30", videoId: "3VcKaXpzqRo", completed: 0, total: 2, desc: "Foco em deltoide lateral." },
                { id: "E7", name: "Tríceps Francês Halter", series: "3x 8-12", weight: 18, interval: "01:30", videoId: "nRiJXayFzY0", completed: 0, total: 3, desc: "Extensão de tríceps cabeça longa." }
            ]
        },
        {
            id: "W2",
            name: "PERNAS",
            exercises: [
                { id: "E8", name: "Agachamento Livre", series: "4x 8-12", weight: 60, interval: "03:00", videoId: "U3HlEF_E9fo", completed: 0, total: 4, desc: "Composto fundamental para membros inferiores." }
            ]
        },
        {
            id: "W3",
            name: "SUPERIORES 2",
            exercises: [
                { id: "E9", name: "Puxada Frente", series: "3x 8-12", weight: 45, interval: "02:00", videoId: "CAwf7n6Luuc", completed: 0, total: 3, desc: "Foco em grande dorsal." }
            ]
        }
    ]
};

class TitanLoadApp {
    constructor() {
        this.data = JSON.parse(localStorage.getItem('titan_load_data')) || APP_DATA;
        this.activeWorkoutIndex = 0;
        this.selectedExercise = null;
        this.timer = null;
        
        this.init();
    }

    init() {
        this.renderTabs();
        this.renderExercises();
        this.setupListeners();
        lucide.createIcons();
    }

    setupListeners() {
        // Toggle Between Athlete and Trainer
        document.getElementById('toggle-mode-btn').addEventListener('click', () => {
            const athleteView = document.getElementById('athlete-view');
            const trainerView = document.getElementById('trainer-view');
            const isAthlete = !athleteView.classList.contains('hidden');
            
            if (isAthlete) {
                athleteView.classList.add('hidden');
                trainerView.classList.remove('hidden');
                document.getElementById('toggle-mode-btn').innerHTML = '<i data-lucide="user"></i>';
                this.renderTrainer();
            } else {
                athleteView.classList.remove('hidden');
                trainerView.classList.add('hidden');
                document.getElementById('toggle-mode-btn').innerHTML = '<i data-lucide="shield-check"></i>';
            }
            lucide.createIcons();
        });

        // Close Overlay
        document.querySelector('.close-btn').addEventListener('click', () => {
            document.getElementById('exercise-overlay').classList.add('hidden');
            this.stopTimer();
            // Clear YouTube iframe to stop video
            document.getElementById('youtube-player').innerHTML = '';
        });

        // Confirm Set
        document.getElementById('confirm-set-btn').addEventListener('click', () => this.registerSet());
    }

    renderTabs() {
        const container = document.getElementById('tab-container');
        container.innerHTML = '';
        this.data.workouts.forEach((w, idx) => {
            const btn = document.createElement('button');
            btn.className = `tab-btn ${idx === this.activeWorkoutIndex ? 'active' : ''}`;
            btn.textContent = w.name;
            btn.addEventListener('click', () => {
                this.activeWorkoutIndex = idx;
                this.renderTabs();
                this.renderExercises();
            });
            container.appendChild(btn);
        });
    }

    renderExercises() {
        const workout = this.data.workouts[this.activeWorkoutIndex];
        document.getElementById('workout-title').textContent = workout.name;
        
        const list = document.getElementById('exercise-list');
        list.innerHTML = '';
        
        let totalSets = 0;
        let completedSets = 0;

        workout.exercises.forEach(ex => {
            totalSets += ex.total;
            completedSets += ex.completed;

            const card = document.createElement('div');
            card.className = `exercise-card ${ex.completed >= ex.total ? 'completed' : ''}`;
            card.innerHTML = `
                <div class="card-main">
                    <h3>${ex.name}</h3>
                    <div class="card-meta">
                        <span><i data-lucide="repeat"></i> ${ex.series}</span>
                        <span><i data-lucide="clock"></i> ${ex.interval}</span>
                    </div>
                </div>
                <div class="load-display">
                    <span class="weight">${ex.weight ? ex.weight + 'kg' : '---'}</span>
                    <span class="sets">${ex.completed}/${ex.total} SÉRIES</span>
                </div>
            `;
            card.addEventListener('click', () => this.openExercise(ex));
            list.appendChild(card);
        });

        const progress = (completedSets / totalSets) * 100;
        document.querySelector('.progress-fill').style.width = `${progress}%`;
        
        lucide.createIcons();
    }

    openExercise(ex) {
        this.selectedExercise = ex;
        const overlay = document.getElementById('exercise-overlay');
        
        document.getElementById('modal-exercise-name').textContent = ex.name;
        document.getElementById('modal-exercise-desc').textContent = ex.desc;
        document.getElementById('prev-load-val').textContent = ex.weight ? `${ex.weight}kg` : 'N/A';
        document.getElementById('weight-input').value = ex.weight || "";

        // Embed YouTube
        if (ex.videoId) {
            document.getElementById('youtube-player').innerHTML = `
                <iframe src="https://www.youtube.com/embed/${ex.videoId}?autoplay=1&mute=1" 
                        frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen></iframe>`;
        }

        overlay.classList.remove('hidden');
    }

    registerSet() {
        const weight = document.getElementById('weight-input').value;
        const reps = document.getElementById('reps-input').value;

        if (!weight || !reps) {
            this.toast("Insira carga e reps!");
            return;
        }

        // Update Data
        const workout = this.data.workouts[this.activeWorkoutIndex];
        const ex = workout.exercises.find(e => e.id === this.selectedExercise.id);
        
        if (ex.completed < ex.total) {
            ex.completed++;
            if (parseFloat(weight) > (ex.weight || 0)) {
                this.toast("🚀 NOVO RECORD!");
                ex.weight = parseFloat(weight);
            }
            this.save();
            this.renderExercises();
            this.startTimer(ex.interval);
        } else {
            this.toast("Todas as séries concluídas!");
        }
    }

    startTimer(durationStr) {
        this.stopTimer();
        const display = document.getElementById('timer-display');
        const timeSpan = display.querySelector('.time');
        display.classList.remove('hidden');
        
        let [mins, secs] = durationStr.split(':').map(Number);
        let totalSecs = (mins * 60) + secs;

        this.timer = setInterval(() => {
            totalSecs--;
            const m = Math.floor(totalSecs / 60);
            const s = totalSecs % 60;
            timeSpan.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            
            if (totalSecs <= 0) {
                this.stopTimer();
                this.toast("DESCANSO FINISHED!");
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timer) clearInterval(this.timer);
        document.getElementById('timer-display').classList.add('hidden');
    }

    renderTrainer() {
        const bank = document.getElementById('bank-list');
        const canvas = document.getElementById('builder-canvas');
        bank.innerHTML = '<p style="color: var(--text-dim); padding: 10px;">Arraste exercícios para montar o treino (Desktop - Em breve)</p>';
        canvas.innerHTML = `
            <div style="background: var(--surface); padding: 40px; border-radius: 24px; text-align: center; border: 2px dashed var(--border);">
                <i data-lucide="layout" size="48" style="color: var(--primary); margin-bottom: 20px;"></i>
                <h3>MODO TRAINER</h3>
                <p style="color: var(--text-dim)">Interface de edição disponível apenas em resoluções Desktop.</p>
            </div>
        `;
        lucide.createIcons();
    }

    save() {
        localStorage.setItem('titan_load_data', JSON.stringify(this.data));
    }

    toast(msg) {
        const t = document.createElement('div');
        t.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: var(--primary); color: #000; padding: 12px 24px;
            border-radius: 30px; font-weight: 800; z-index: 3000;
            box-shadow: 0 10px 30px var(--primary-glow); animation: slideIn 0.3s ease-out;
        `;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => {
            t.style.opacity = '0';
            setTimeout(() => t.remove(), 300);
        }, 2000);
    }
}

// Global Animation for Toast
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translate(-50%, -100%); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
    new TitanLoadApp();
});
