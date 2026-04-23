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

// Global Exercise Library (Source of Truth for Trainer)
const GLOBAL_LIBRARY = [
    { id: "lib1", name: "Alongamentos", videoId: "9S_pU6q0Z6c", defaultSeries: "2x 30S", defaultReps: "---" },
    { id: "lib2", name: "Depressão Escapular", videoId: "f0aOqLp49lI", defaultSeries: "2x", defaultReps: "10" },
    { id: "lib3", name: "Supino Inclinado Máquina", videoId: "SrqOu55lr6A", defaultSeries: "4x", defaultReps: "8-12" },
    { id: "lib4", name: "Desenvolvimento Máquina", videoId: "WvLMauqrnVA", defaultSeries: "3x", defaultReps: "8-12" },
    { id: "lib5", name: "Crucifixo Máquina", videoId: "fC70O2KmsP0", defaultSeries: "2x", defaultReps: "8-12" },
    { id: "lib6", name: "Elevação Lateral", videoId: "3VcKaXpzqRo", defaultSeries: "2x", defaultReps: "8-12" },
    { id: "lib7", name: "Tríceps Francês Halter", videoId: "nRiJXayFzY0", defaultSeries: "3x", defaultReps: "8-12" },
    { id: "lib8", name: "Extensão de Tronco Máquina", videoId: "CAwf7n6Luuc", defaultSeries: "3x", defaultReps: "8-12" }
];

let db = null;
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
}

class TitanApp {
    constructor() {
        this.students = [];
        this.currentUser = null; // Athlete Profile
        this.selectedStudent = null; // Trainer Profile Selection
        this.activeExEdit = null;
        
        this.sessionSets = [];
        this.init();
    }

    async init() {
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
            workouts: [{ id: "W1", name: "SUPERIORES 1", exercises: [] }],
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
        container.innerHTML = (this.currentUser.workouts || []).map(w => `
            <div class="workout-card"><div class="workout-card-body">
                <h2>${w.name}</h2><p>${w.exercises.length} EXERCÍCIOS</p>
                <button class="btn-start" onclick="app.startWorkout('${w.id}')">INICIAR TREINO</button>
            </div></div>
        `).join('');
    }

    startWorkout(id) {
        this.activeWorkout = this.currentUser.workouts.find(w => w.id === id);
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
                        <i data-lucide="${done >= (ex.totalSets || 3) ? 'check-circle' : 'circle'}" color="${done >= (ex.totalSets || 3) ? '#bfff00' : '#333'}"></i>
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
        document.getElementById('sum-volume').textContent = (vol/1000).toFixed(1) + 't';
        this.save();
        this.switchScreen('summary-screen');
    }

    // --- TRAINER LOGIC (THE BUILDER) ---

    renderTrainer() {
        const slist = document.getElementById('student-list');
        slist.innerHTML = this.students.map(s => `
            <div class="list-item ${this.selectedStudent?.id === s.id ? 'active' : ''}" onclick="app.selectStudent('${s.id}')">
                <span>${s.name}</span>
            </div>
        `).join('');

        const lib = document.getElementById('exercise-library');
        lib.innerHTML = GLOBAL_LIBRARY.map(ex => `
            <div class="list-item" data-id="${ex.id}"><span>${ex.name}</span> <i data-lucide="plus" size="14"></i></div>
        `).join('');
        
        lucide.createIcons();
        this.initSortable();
    }

    initSortable() {
        // Source Library (Cloning)
        new Sortable(document.getElementById('exercise-library'), {
            group: { name: 'shared', pull: 'clone', put: false },
            sort: false,
            animation: 150
        });

        // Destination Workout
        const dropzone = document.getElementById('active-workout-builder');
        Sortable.get(dropzone)?.destroy(); // Clean previous
        new Sortable(dropzone, {
            group: 'shared',
            animation: 150,
            onAdd: (evt) => {
                const libId = evt.item.dataset.id;
                const libEx = GLOBAL_LIBRARY.find(e => e.id === libId);
                this.addExerciseToWorkout(libEx, evt.newIndex);
                evt.item.remove(); // Remove the domestic DOM element, we will re-render
            },
            onEnd: (evt) => {
                this.reorderWorkout(evt.oldIndex, evt.newIndex);
            }
        });
    }

    selectStudent(id) {
        this.selectedStudent = this.students.find(s => s.id === id);
        document.getElementById('no-student-selected').classList.add('hidden');
        document.getElementById('student-dashboard').classList.remove('hidden');
        document.getElementById('selected-student-name').textContent = this.selectedStudent.name;
        document.getElementById('selected-student-id').textContent = `ID: ${this.selectedStudent.id}`;
        this.renderWorkoutBuilder();
    }

    renderWorkoutBuilder() {
        const dropzone = document.getElementById('active-workout-builder');
        const exercises = this.selectedStudent.workouts[0]?.exercises || [];
        dropzone.innerHTML = exercises.map((ex, idx) => `
            <div class="list-item" onclick="app.inspectExercise('${ex.guid}')">
                <span>${idx + 1}. ${ex.name}</span>
                <div style="margin-left:auto; display:flex; gap:10px;">
                    <i data-lucide="edit-3" size="14"></i>
                    <i data-lucide="trash-2" size="14" onclick="event.stopPropagation(); app.removeExercise('${ex.guid}')"></i>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
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
        const workout = this.selectedStudent.workouts[0];
        workout.exercises.splice(index, 0, newEx);
        this.save();
        this.renderWorkoutBuilder();
    }

    reorderWorkout(oldIdx, newIdx) {
        const exercises = this.selectedStudent.workouts[0].exercises;
        const [moved] = exercises.splice(oldIdx, 1);
        exercises.splice(newIdx, 0, moved);
        this.save();
        this.renderWorkoutBuilder();
    }

    removeExercise(guid) {
        const workout = this.selectedStudent.workouts[0];
        workout.exercises = workout.exercises.filter(e => e.guid !== guid);
        this.save();
        this.renderWorkoutBuilder();
    }

    inspectExercise(guid) {
        this.activeExEdit = this.selectedStudent.workouts[0].exercises.find(e => e.guid === guid);
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
        this.toast("Treino Atualizado na Nuvem!");
        this.renderWorkoutBuilder();
    }

    extractYoutubeId(url) {
        if(!url) return "";
        let id = url;
        if(url.includes('v=')) id = url.split('v=')[1].split('&')[0];
        else if(url.includes('youtu.be/')) id = url.split('youtu.be/')[1];
        return id;
    }

    async save() {
        if (db) {
            const ref = db.collection("students").doc(this.selectedStudent ? this.selectedStudent.id : this.currentUser.id);
            await ref.set(this.selectedStudent || this.currentUser);
        }
    }

    toast(msg) {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed; bottom:50px; left:50%; transform:translateX(-50%); background:var(--primary); color:#000; padding:12px 24px; border-radius:30px; font-weight:800; z-index:3000;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2500);
    }
}

const app = new TitanApp();
window.app = app;
