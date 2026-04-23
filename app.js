// --- CONFIGURAÇÃO FIREBASE ---
// Você vai substituir esse objeto pelas suas chaves do Firebase Console em breve
const firebaseConfig = {
    apiKey: "AIzaSyCdLVzg_Uns3aRNT8jJLc_C8E2yZfV8RF0",
    authDomain: "titan-load.firebaseapp.com",
    projectId: "titan-load",
    storageBucket: "titan-load.firebasestorage.app",
    messagingSenderId: "406398492962",
    appId: "1:406398492962:web:b94ea9cbe76277c024457b",
    measurementId: "G-SWY71RQCFR"
};

// Inicializa Firebase (apenas se as chaves estiverem presentes)
let db = null;
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
}

class TitanApp {
    constructor() {
        this.students = [];
        this.currentUser = null;
        this.activeWorkout = null;
        this.sessionSets = [];
        this.timerInterval = null;
        this.isTrainer = false;

        this.init();
    }

    async init() {
        if (db) {
            // Sincronização em Tempo Real com Firebase
            db.collection("students").onSnapshot(async (snapshot) => {
                if (snapshot.empty) {
                    // SEED: Se a nuvem estiver vazia, cria o seu primeiro aluno
                    console.log("Cloud empty. Seeding initial data...");
                    const initialData = this.getDefaultData();
                    for (const student of initialData) {
                        await db.collection("students").doc(student.id).set(student);
                    }
                } else {
                    this.students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    this.refreshUI();
                }
            }, (error) => {
                console.error("Firebase Sync Error:", error);
                this.toast("Erro de conexão com a Nuvem. Verifique as Regras do Firestore.");
            });
        } else {
            // Fallback para LocalStorage se o Firebase não estiver configurado
            this.students = JSON.parse(localStorage.getItem('titan_students_cloud_v1')) || this.getDefaultData();
            this.refreshUI();
        }

        this.setupGlobalListeners();
        lucide.createIcons();
    }

    getDefaultData() {
        return [
            { 
                id: "AL1", 
                name: "Leonardo Vasem", 
                workouts: [
                    { 
                        id: "W1", name: "SUPERIORES 1", 
                        exercises: [
                            { id: "E1", name: "Alongamentos", series: "2x 30S", weight: 0, videoId: "9S_pU6q0Z6c", total: 2 },
                            { id: "E2", name: "Depressão Escapular", series: "2x 10", weight: 0, videoId: "f0aOqLp49lI", total: 2 },
                            { id: "E3", name: "Supino Máquina", series: "4x 8-12", weight: 50, videoId: "SrqOu55lr6A", total: 4 }
                        ]
                    }
                ],
                stats: { totalWorkouts: 0, volume: 0, records: 0 }
            }
        ];
    }

    refreshUI() {
        // Se ainda não escolhemos um usuário padrão, selecionamos o Leonardo (AL1)
        if (!this.currentUser) this.currentUser = this.students[0];
        
        if (!document.getElementById('home-screen').classList.contains('hidden')) {
            this.renderAthleteHome();
            this.updateAthleteStats();
        }
        if (!document.getElementById('trainer-screen').classList.contains('hidden')) {
            this.renderTrainer();
        }
        lucide.createIcons();
    }

    setupGlobalListeners() {
        document.getElementById('goto-trainer-btn').onclick = () => {
            this.isTrainer = true;
            this.switchScreen('trainer-screen');
        };
        document.getElementById('back-to-app').onclick = () => {
            this.isTrainer = false;
            this.switchScreen('home-screen');
        };
        document.getElementById('cancel-workout').onclick = () => this.switchScreen('home-screen');
        document.getElementById('finish-workout').onclick = () => this.finishWorkout();
        document.querySelector('.close-btn').onclick = () => {
            document.getElementById('exercise-overlay').classList.add('hidden');
            document.getElementById('modal-video-container').innerHTML = '';
        };
        document.getElementById('add-set-btn').onclick = () => this.addSet();
        document.getElementById('close-summary').onclick = () => this.switchScreen('home-screen');
        document.getElementById('save-video-btn').onclick = () => this.saveTrainerUpdate();
    }

    switchScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
        this.refreshUI();
    }

    // --- ATHLETE LOGIC ---

    updateAthleteStats() {
        const s = this.currentUser.stats || { totalWorkouts: 0, volume: 0, records: 0 };
        document.getElementById('user-name').textContent = `Bem-vindo, ${this.currentUser.name.split(' ')[0]}`;
        document.getElementById('total-workouts').textContent = s.totalWorkouts;
        document.getElementById('total-volume').textContent = (s.volume/1000).toFixed(1) + 'k';
        document.getElementById('total-records').textContent = s.records;
    }

    renderAthleteHome() {
        const container = document.getElementById('workout-cards-container');
        container.innerHTML = '';
        (this.currentUser.workouts || []).forEach(w => {
            const card = document.createElement('div');
            card.className = 'workout-card';
            card.innerHTML = `
                <div class="workout-card-body">
                    <h2>${w.name}</h2>
                    <p>${w.exercises.length} EXERCÍCIOS</p>
                    <button class="btn-start" onclick="app.startWorkout('${w.id}')">INICIAR SESSÃO</button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    startWorkout(id) {
        this.activeWorkout = this.currentUser.workouts.find(w => w.id === id);
        this.sessionSets = [];
        this.switchScreen('workout-screen');
        this.renderExerciseFeed();
        this.startTimer();
    }

    renderExerciseFeed() {
        const feed = document.getElementById('exercise-feed');
        feed.innerHTML = '';
        this.activeWorkout.exercises.forEach(ex => {
            const done = this.sessionSets.filter(s => s.id === ex.id).length;
            const card = document.createElement('div');
            card.className = 'workout-card';
            card.innerHTML = `
                <div class="workout-card-body" style="padding: 15px; border-radius: 12px; background: var(--surface-light); display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="font-size:1.1rem">${ex.name}</h3>
                        <p style="margin:0; opacity:0.6">${done}/${ex.total} Séries</p>
                    </div>
                    <i data-lucide="${done >= ex.total ? 'check-circle' : 'circle'}" color="${done >= ex.total ? '#bfff00' : '#444'}"></i>
                </div>
            `;
            card.onclick = () => this.openExerciseModal(ex);
            feed.appendChild(card);
        });
        lucide.createIcons();
    }

    openExerciseModal(ex) {
        this.selectedEx = ex;
        document.getElementById('modal-name').textContent = ex.name;
        document.getElementById('modal-prev-load').textContent = (ex.weight || 0) + 'kg';
        document.getElementById('w-input').value = ex.weight || "";
        
        let id = ex.videoId;
        if(id.includes('v=')) id = id.split('v=')[1].split('&')[0];
        document.getElementById('modal-video-container').innerHTML = `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1" frameborder="0" allowfullscreen></iframe>`;
        
        this.renderModalHistory();
        document.getElementById('exercise-overlay').classList.remove('hidden');
    }

    addSet() {
        const w = parseFloat(document.getElementById('w-input').value);
        const r = parseInt(document.getElementById('r-input').value);
        if(!w || !r) return;

        this.sessionSets.push({ id: this.selectedEx.id, w, r });
        
        if(w > (this.selectedEx.weight || 0)) {
            this.selectedEx.weight = w;
            this.currentUser.stats.records++;
            this.toast("🚀 NOVO RECORDE!");
        }

        this.renderModalHistory();
        this.renderExerciseFeed();
    }

    renderModalHistory() {
        const hist = document.getElementById('modal-set-history');
        const sets = this.sessionSets.filter(s => s.id === this.selectedEx.id);
        hist.innerHTML = sets.map((s, idx) => `
            <div class="set-row"><span>SÉRIE ${idx+1}</span> <b>${s.w}kg x ${s.r}</b></div>
        `).join('');
    }

    finishWorkout() {
        const vol = this.sessionSets.reduce((acc, s) => acc + (s.w * s.r), 0);
        this.currentUser.stats.volume += vol;
        this.currentUser.stats.totalWorkouts++;
        
        document.getElementById('sum-volume').textContent = (vol/1000).toFixed(1) + 't';
        document.getElementById('sum-duration').textContent = document.getElementById('workout-duration').textContent;
        
        this.save();
        this.switchScreen('summary-screen');
        if(this.timerInterval) clearInterval(this.timerInterval);
    }

    startTimer() {
        let t = 0;
        if(this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            t++;
            const m = Math.floor(t/60).toString().padStart(2, '0');
            const s = (t%60).toString().padStart(2, '0');
            document.getElementById('workout-duration').textContent = `${m}:${s}`;
        }, 1000);
    }

    // --- TRAINER LOGIC ---

    renderTrainer() {
        const list = document.getElementById('student-list');
        list.innerHTML = this.students.map(s => `
            <div class="list-item ${this.selectedStudent?.id === s.id ? 'active' : ''}" onclick="app.selectStudent('${s.id}')">
                <div class="avatar" style="width:30px; height:30px; font-size:0.6rem;">${s.name.charAt(0)}</div>
                <span class="name">${s.name}</span>
            </div>
        `).join('');
    }

    selectStudent(id) {
        this.selectedStudent = this.students.find(s => s.id === id);
        document.getElementById('no-student-selected').classList.add('hidden');
        document.getElementById('student-dashboard').classList.remove('hidden');
        document.getElementById('selected-student-name').textContent = this.selectedStudent.name;
        document.getElementById('s-vol').textContent = (this.selectedStudent.stats.volume/1000).toFixed(1) + 'k';
        document.getElementById('s-count').textContent = this.selectedStudent.stats.totalWorkouts;
        
        const container = document.getElementById('student-workout-editor');
        container.innerHTML = (this.selectedStudent.workouts[0]?.exercises || []).map(ex => `
            <div class="list-item" onclick="app.testVideo('${ex.id}')"><span>${ex.name}</span><i data-lucide="play" size="14"></i></div>
        `).join('');
        
        this.renderTrainer();
        lucide.createIcons();
    }

    testVideo(exId) {
        this.activeExEdit = this.selectedStudent.workouts[0].exercises.find(e => e.id === exId);
        document.getElementById('video-tester').innerHTML = `<iframe src="https://www.youtube.com/embed/${this.activeExEdit.videoId}?autoplay=1&mute=1" width="100%" height="100%" frameborder="0"></iframe>`;
        document.getElementById('edit-video-id').value = this.activeExEdit.videoId;
    }

    saveTrainerUpdate() {
        if(!this.activeExEdit) return;
        const raw = document.getElementById('edit-video-id').value;
        let id = raw;
        if(raw.includes('v=')) id = raw.split('v=')[1].split('&')[0];
        else if(raw.includes('youtu.be/')) id = raw.split('youtu.be/')[1];
        
        this.activeExEdit.videoId = id;
        this.save();
        this.toast("Sincronizado na Nuvem!");
        this.testVideo(this.activeExEdit.id);
    }

    async save() {
        if (db) {
            // Salva no Firebase
            const studentRef = db.collection("students").doc(this.isTrainer ? this.selectedStudent.id : this.currentUser.id);
            await studentRef.set(this.isTrainer ? this.selectedStudent : this.currentUser);
        } else {
            // Fallback Local
            localStorage.setItem('titan_students_cloud_v1', JSON.stringify(this.students));
        }
    }

    toast(msg) {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed; bottom:120px; left:50%; transform:translateX(-50%); background:var(--primary); color:#000; padding:12px 24px; border-radius:30px; font-weight:800; z-index:3000; box-shadow:0 0 20px var(--primary-dim);`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2500);
    }
}

const app = new TitanApp();
window.app = app;
