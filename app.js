// --- TITAN LOAD CLOUD ARCHITECTURE ---

const firebaseConfig = {
    apiKey: "AIzaSyCdLVzg_Uns3aRNT8jJLc_C8E2yZfV8RF0",
    authDomain: "titan-load.firebaseapp.com",
    projectId: "titan-load",
    storageBucket: "titan-load.firebasestorage.app",
    messagingSenderId: "406398492962",
    appId: "1:406398492962:web:b94ea9cbe76277c024457b",
    measurementId: "G-SWY71RQCFR"
};

const GLOBAL_LIBRARY = [
    { id: "lib1", name: "ALONGAMENTOS", videoId: "9S_pU6q0Z6c", defaultSeries: "2x 30S", defaultReps: "---" },
    { id: "lib2", name: "DEPRESSÃO ESCAPULAR", videoId: "f0aOqLp49lI", defaultSeries: "2x", defaultReps: "10" },
    { id: "lib3", name: "SUPINO INCLINADO MÁQUINA", videoId: "SrqOu55lr6A", defaultSeries: "4x", defaultReps: "8-12" },
    { id: "lib4", name: "DESENVOLVIMENTO MÁQUINA", videoId: "WvLMauqrnVA", defaultSeries: "3x", defaultReps: "8-12" },
    { id: "lib5", name: "CRUCIFIXO MÁQUINA", videoId: "fC70O2KmsP0", defaultSeries: "2x", defaultReps: "8-12" },
    { id: "lib6", name: "ELEVAÇÃO LATERAL", videoId: "3VcKaXpzqRo", defaultSeries: "2x", defaultReps: "8-12" },
    { id: "lib7", name: "TRÍCEPS FRANCÊS HALTER", videoId: "nRiJXayFzY0", defaultSeries: "3x", defaultReps: "8-12" },
    { id: "lib8", name: "EXTENSÃO DE TRONCO MÁQUINA", videoId: "CAwf7n6Luuc", defaultSeries: "3x", defaultReps: "8-12" }
];

let db = null;
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
}

class TitanApp {
    constructor() {
        this.students = [];
        this.currentUser = null;
        this.selectedStudent = null;
        this.selectedDay = "SEG"; // Dia padrão
        this.activeExEdit = null;
        this.sessionSets = [];
        
        this.init();
    }

    async init() {
        this.renderLibrary(); // Garante biblioteca imediata
        
        if (db) {
            db.collection("students").onSnapshot(async (snapshot) => {
                if (snapshot.empty) {
                    await this.seedInitialStudent();
                } else {
                    this.students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    this.syncCurrentState();
                }
            });
        }
        this.setupListeners();
    }

    async seedInitialStudent() {
        const initial = {
            id: "LEO1",
            name: "Leonardo Vasem",
            schedule: {
                "SEG": { name: "SUPERIORES 1", exercises: [] },
                "TER": { name: "COSTA / BICEPS", exercises: [] },
                "QUA": { name: "DESCANSO", exercises: [] },
                "QUI": { name: "PERNAS", exercises: [] },
                "SEX": { name: "PEITO / TRICEPS", exercises: [] },
                "SAB": { name: "DESCANSO", exercises: [] },
                "DOM": { name: "DESCANSO", exercises: [] }
            },
            stats: { totalWorkouts: 0, volume: 0, records: 0 }
        };
        await db.collection("students").doc(initial.id).set(initial);
    }

    syncCurrentState() {
        if (!this.currentUser) this.currentUser = this.students.find(s => s.id === "LEO1") || this.students[0];
        
        if (!document.getElementById('home-screen').classList.contains('hidden')) this.renderAthleteHome();
        if (!document.getElementById('trainer-screen').classList.contains('hidden')) this.renderTrainer();
        lucide.createIcons();
    }

    setupListeners() {
        document.getElementById('goto-trainer-btn').onclick = () => this.switchScreen('trainer-screen');
        document.getElementById('back-to-app').onclick = () => this.switchScreen('home-screen');
        document.getElementById('finish-workout').onclick = () => this.finishWorkout();
        document.getElementById('add-set-btn').onclick = () => this.addSet();
        document.getElementById('save-ins-btn').onclick = () => this.saveInspectorEdit();
        document.getElementById('close-summary').onclick = () => this.switchScreen('home-screen');
        document.querySelector('.close-btn').onclick = () => {
            document.getElementById('exercise-overlay').classList.add('hidden');
            document.getElementById('modal-video-container').innerHTML = '';
        };

        // Week Selector
        document.querySelectorAll('.day-btn').forEach(btn => {
            btn.onclick = (e) => {
                this.selectedDay = btn.dataset.day;
                this.updateWeekUI();
                this.renderWorkoutBuilder();
            };
        });
    }

    switchScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
        this.syncCurrentState();
    }

    // --- ATHLETE LOGIC ---

    renderAthleteHome() {
        const s = this.currentUser.stats || { totalWorkouts: 0, volume: 0, records: 0 };
        document.getElementById('user-name').textContent = `Bem-vindo, ${this.currentUser.name.split(' ')[0]}`;
        document.getElementById('total-workouts').textContent = s.totalWorkouts;
        document.getElementById('total-volume').textContent = (s.volume/1000).toFixed(1) + 'k';
        document.getElementById('total-records').textContent = s.records;

        const container = document.getElementById('workout-cards-container');
        const days = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
        container.innerHTML = days.map(day => {
            const data = this.currentUser.schedule[day];
            if(!data || data.name === "DESCANSO") return "";
            return `
                <div class="workout-card"><div class="workout-card-body">
                    <span style="font-size:0.7rem; color:var(--primary); font-weight:800">${day}</span>
                    <h2>${data.name}</h2><p>${data.exercises.length} EXERCÍCIOS</p>
                    <button class="btn-start" onclick="app.startWorkout('${day}')">INICIAR TREINO</button>
                </div></div>
            `;
        }).join('');
    }

    startWorkout(day) {
        this.activeWorkoutDay = day;
        this.activeWorkout = this.currentUser.schedule[day];
        this.sessionSets = [];
        this.switchScreen('workout-screen');
        this.renderExerciseFeed();
    }

    renderExerciseFeed() {
        const feed = document.getElementById('exercise-feed');
        feed.innerHTML = this.activeWorkout.exercises.map(ex => {
            const done = this.sessionSets.filter(s => s.id === ex.guid).length;
            return `
                <div class="workout-card" onclick="app.openExerciseModal('${ex.guid}')">
                    <div class="workout-card-body" style="padding:15px; background:var(--surface-light); display:flex; justify-content:space-between; align-items:center;">
                        <div><h3>${ex.name}</h3><p style="margin:0">${ex.series} | ${done}/${ex.totalSets || 3} Séries</p></div>
                        <i data-lucide="${done >= (ex.totalSets || 3) ? 'check-circle' : 'circle'}" color="${done >= (ex.totalSets || 3) ? '#bfff00' : '#444'}"></i>
                    </div>
                </div>
            `;
        }).join('');
        lucide.createIcons();
    }

    openExerciseModal(guid) {
        this.selectedEx = this.activeWorkout.exercises.find(e => e.guid === guid);
        document.getElementById('modal-name').textContent = this.selectedEx.name;
        document.getElementById('modal-prev-load').textContent = (this.selectedEx.weight || 0) + 'kg';
        document.getElementById('w-input').value = this.selectedEx.weight || "";
        
        const vidID = this.extractYoutubeId(this.selectedEx.videoId);
        document.getElementById('modal-video-container').innerHTML = `<iframe src="https://www.youtube.com/embed/${vidID}?autoplay=1&mute=1&playsinline=1" frameborder="0"></iframe>`;
        document.getElementById('exercise-overlay').classList.remove('hidden');
    }

    addSet() {
        const w = parseFloat(document.getElementById('w-input').value);
        const r = parseInt(document.getElementById('r-input').value);
        if(!w || !r) return;
        this.sessionSets.push({ id: this.selectedEx.guid, w, r });
        if(w > (this.selectedEx.weight || 0)) {
            this.selectedEx.weight = w;
            this.currentUser.stats.records++;
        }
        this.renderExerciseFeed();
    }

    finishWorkout() {
        const vol = this.sessionSets.reduce((acc, s) => acc + (s.w * s.r), 0);
        this.currentUser.stats.volume += vol;
        this.currentUser.stats.totalWorkouts++;
        this.save();
        this.switchScreen('summary-screen');
    }


    // --- TRAINER LOGIC (THE BUILDER) ---

    renderLibrary() {
        const lib = document.getElementById('exercise-library');
        if(!lib) return;
        lib.innerHTML = GLOBAL_LIBRARY.map(ex => `
            <div class="list-item" data-id="${ex.id}"><span>${ex.name}</span> <i data-lucide="plus" size="14"></i></div>
        `).join('');
        lucide.createIcons();
    }

    renderTrainer() {
        this.renderLibrary();
        const slist = document.getElementById('student-list');
        slist.innerHTML = this.students.map(s => `
            <div class="list-item ${this.selectedStudent?.id === s.id ? 'active' : ''}" onclick="app.selectStudent('${s.id}')">
                <span>${s.name}</span>
            </div>
        `).join('');
        this.initSortable();
    }

    selectStudent(id) {
        this.selectedStudent = this.students.find(s => s.id === id);
        document.getElementById('no-student-selected').classList.add('hidden');
        document.getElementById('student-dashboard').classList.remove('hidden');
        document.getElementById('selected-student-name').textContent = this.selectedStudent.name;
        document.getElementById('selected-student-id').textContent = `ID: ${this.selectedStudent.id}`;
        
        this.updateWeekUI();
        this.renderWorkoutBuilder();
        this.renderTrainer();
    }

    updateWeekUI() {
        document.querySelectorAll('.day-btn').forEach(btn => {
            const day = btn.dataset.day;
            const sched = this.selectedStudent.schedule[day];
            btn.classList.toggle('active', day === this.selectedDay);
            btn.querySelector('.day-status').textContent = sched?.name || '---';
        });
    }

    renderWorkoutBuilder() {
        const dropzone = document.getElementById('active-workout-builder');
        const dayData = this.selectedStudent.schedule[this.selectedDay] || { name: 'DESCANSO', exercises: [] };
        
        dropzone.innerHTML = dayData.exercises.map((ex, idx) => `
            <div class="list-item" onclick="app.inspectExercise('${ex.guid}')">
                <span>${idx + 1}. ${ex.name}</span>
                <div style="margin-left:auto; display:flex; gap:10px;">
                    <i data-lucide="edit-3" size="14"></i>
                    <i data-lucide="trash-2" size="14" onclick="event.stopPropagation(); app.removeExercise('${ex.guid}')"></i>
                </div>
            </div>
        `).join('');
        
        if(dayData.exercises.length === 0) {
            dropzone.innerHTML = `<p style="color:var(--text-dim); text-align:center; padding:20px">Clique em um exercício da biblioteca para adicionar à ${this.selectedDay}</p>`;
        }
        
        lucide.createIcons();
    }

    initSortable() {
        const libEl = document.getElementById('exercise-library');
        const dropEl = document.getElementById('active-workout-builder');
        if(!libEl || !dropEl) return;

        Sortable.get(libEl)?.destroy();
        Sortable.get(dropEl)?.destroy();

        new Sortable(libEl, {
            group: { name: 'shared', pull: 'clone', put: false },
            sort: false,
            animation: 150
        });

        new Sortable(dropEl, {
            group: 'shared',
            animation: 150,
            onAdd: (evt) => {
                const libId = evt.item.dataset.id;
                const libEx = GLOBAL_LIBRARY.find(e => e.id === libId);
                this.addExerciseToWorkout(libEx, evt.newIndex);
                evt.item.remove();
            },
            onEnd: (evt) => {
                this.reorderWorkout(evt.oldIndex, evt.newIndex);
            }
        });
    }

    addExerciseToWorkout(libEx, index) {
        const newEx = {
            guid: 'g' + Date.now(),
            name: libEx.name,
            videoId: libEx.videoId,
            series: libEx.defaultSeries,
            totalSets: parseInt(libEx.defaultSeries) || 3,
            weight: 0
        };
        const sched = this.selectedStudent.schedule[this.selectedDay];
        if(sched.name === "DESCANSO") sched.name = "TREINO " + this.selectedDay;
        sched.exercises.splice(index, 0, newEx);
        this.save();
        this.renderWorkoutBuilder();
        this.updateWeekUI();
    }

    reorderWorkout(oldIdx, newIdx) {
        const exercises = this.selectedStudent.schedule[this.selectedDay].exercises;
        const [moved] = exercises.splice(oldIdx, 1);
        exercises.splice(newIdx, 0, moved);
        this.save();
        this.renderWorkoutBuilder();
    }

    inspectExercise(guid) {
        const exercises = this.selectedStudent.schedule[this.selectedDay].exercises;
        this.activeExEdit = exercises.find(e => e.guid === guid);
        document.getElementById('ins-name').textContent = this.activeExEdit.name;
        document.getElementById('ins-video-id').value = this.activeExEdit.videoId;
        document.getElementById('ins-series').value = this.activeExEdit.series;
        document.getElementById('ins-reps').value = "8-12";
        
        const vidID = this.extractYoutubeId(this.activeExEdit.videoId);
        document.getElementById('inspector-video').innerHTML = `<iframe src="https://www.youtube.com/embed/${vidID}?autoplay=1&mute=1" frameborder="0"></iframe>`;
    }

    saveInspectorEdit() {
        if(!this.activeExEdit) return;
        this.activeExEdit.videoId = this.extractYoutubeId(document.getElementById('ins-video-id').value);
        this.activeExEdit.series = document.getElementById('ins-series').value;
        this.activeExEdit.totalSets = parseInt(this.activeExEdit.series) || 3;
        this.save();
        this.toast("Salvo com sucesso!");
        this.renderWorkoutBuilder();
    }

    extractYoutubeId(url) {
        if(!url) return "";
        let id = url;
        if(url.includes('v=')) id = url.split('v=')[1].split('&')[0];
        else if(url.includes('youtu.be/')) id = url.split('youtu.be/')[1];
        return id;
    }

    removeExercise(guid) {
        const sched = this.selectedStudent.schedule[this.selectedDay];
        sched.exercises = sched.exercises.filter(e => e.guid !== guid);
        this.save();
        this.renderWorkoutBuilder();
    }

    async save() {
        if (db) {
            const ref = db.collection("students").doc(this.selectedStudent ? this.selectedStudent.id : this.currentUser.id);
            await ref.set(this.selectedStudent || this.currentUser);
        }
    }

    toast(msg) {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed; bottom:50px; left:50%; transform:translateX(-50%); background:var(--primary); color:#000; padding:12px 24px; border-radius:30px; font-weight:800; z-index:3000; border:2px solid black;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2500);
    }
}

const app = new TitanApp();
window.app = app;
