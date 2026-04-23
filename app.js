// --- TITAN LOAD CLOUD ARCHITECTURE PRO ---

const firebaseConfig = {
    apiKey: "AIzaSyCdLVzg_Uns3aRNT8jJLc_C8E2yZfV8RF0",
    authDomain: "titan-load.firebaseapp.com",
    projectId: "titan-load",
    storageBucket: "titan-load.firebasestorage.app",
    messagingSenderId: "406398492962",
    appId: "1:406398492962:web:b94ea9cbe76277c024457b",
    measurementId: "G-SWY71RQCFR"
};

let db = null;
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
}

class TitanApp {
    constructor() {
        this.students = [];
        this.library = [];
        this.currentUser = null;
        this.selectedStudent = null;
        this.selectedDay = "SEG";
        this.activeExEdit = null;
        window.app = this; // Expose app globally for inline clicks
        this.init();
    }

    async init() {
        if (db) {
            db.collection("students").onSnapshot(async (snap) => {
                if (snap.empty) await this.seedInitialStudent();
                this.students = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.syncUI();
            }, (err) => this.handleDbError(err));

            db.collection("library").onSnapshot(snap => {
                if (snap.empty) this.seedLibrary();
                this.library = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.renderLibrary();
            });
        }
        this.setupListeners();
    }

    handleDbError(err) {
        if (err.code === 'not-found') {
            this.toast("ERRO: Ative o 'Firestore Database' no console do Firebase!");
        }
        console.error(err);
    }

    async seedInitialStudent() {
        const initial = {
            id: "LEO1", name: "Leonardo Vasem",
            schedule: {
                "SEG": { name: "SUPERIORES 1", exercises: [] }, "TER": { name: "DESCANSO", exercises: [] },
                "QUA": { name: "DESCANSO", exercises: [] }, "QUI": { name: "DESCANSO", exercises: [] },
                "SEX": { name: "DESCANSO", exercises: [] }, "SAB": { name: "DESCANSO", exercises: [] },
                "DOM": { name: "DESCANSO", exercises: [] }
            },
            stats: { totalWorkouts: 0, volume: 0, records: 0 }
        };
        await db.collection("students").doc(initial.id).set(initial);
    }

    async seedLibrary() {
        const lib = [
            { id: "lib1", name: "Alongamentos", videoId: "9S_pU6q0Z6c", defaultSeries: "2x" },
            { id: "lib2", name: "Depressão Escapular", videoId: "f0aOqLp49lI", defaultSeries: "2x" },
            { id: "lib3", name: "Supino Máquina", videoId: "SrqOu55lr6A", defaultSeries: "4x" }
        ];
        for (const ex of lib) await db.collection("library").doc(ex.id).set(ex);
    }

    syncUI() {
        if (!this.currentUser) this.currentUser = this.students.find(s => s.id === "LEO1") || this.students[0];
        if (!document.getElementById('home-screen').classList.contains('hidden')) this.renderAthleteHome();
        if (!document.getElementById('trainer-screen').classList.contains('hidden')) {
            this.renderTrainer();
            if (this.selectedStudent) this.loadStudentHistory();
        }
        lucide.createIcons();
    }

    renderLibrary() {
        const libEl = document.getElementById('exercise-library');
        if (!libEl) return;
        libEl.innerHTML = this.library.map(ex => `
            <div class="list-item" data-id="${ex.id}">
                <span>${ex.name}</span>
                <i data-lucide="edit-3" size="14" style="margin-left:auto; cursor:pointer;" onclick="app.openLibEditor('${ex.id}')"></i>
            </div>
        `).join('');
        lucide.createIcons();
        this.initSortable();
    }

    setupListeners() {
        document.getElementById('goto-trainer-btn').onclick = () => this.switchScreen('trainer-screen');
        document.getElementById('back-to-app').onclick = () => this.switchScreen('home-screen');
        document.getElementById('save-ins-btn').onclick = () => this.saveInspectorEdit();
        document.getElementById('add-set-btn').onclick = () => this.addSet();
        document.getElementById('finish-workout').onclick = () => this.finishWorkout();
        document.getElementById('close-summary').onclick = () => this.switchScreen('home-screen');
        document.getElementById('save-lib-btn').onclick = () => this.saveLibUpdate();
        
        document.querySelectorAll('.day-btn').forEach(btn => {
            btn.onclick = () => {
                this.selectedDay = btn.dataset.day;
                this.updateWeekUI();
                this.renderWorkoutBuilder();
            };
        });

        document.querySelectorAll('.close-btn').forEach(b => {
            b.onclick = () => {
                document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
                document.querySelectorAll('iframe').forEach(i => i.src = ""); // Para o som
            };
        });
    }

    switchScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
        this.syncUI();
    }

    // --- ATHLETE ---
    renderAthleteHome() {
        const s = this.currentUser.stats || { totalWorkouts: 0, volume: 0, records: 0 };
        document.getElementById('user-name').textContent = `Bem-vindo, ${this.currentUser.name.split(' ')[0]}`;
        document.getElementById('total-workouts').textContent = s.totalWorkouts;
        document.getElementById('total-volume').textContent = (parseFloat(s.volume)/1000).toFixed(1) + 'k';
        document.getElementById('total-records').textContent = s.records;

        const container = document.getElementById('workout-cards-container');
        const days = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
        container.innerHTML = days.map(day => {
            const data = this.currentUser.schedule[day];
            if(!data || data.exercises.length === 0) return "";
            return `
                <div class="workout-card">
                    <div class="workout-card-body">
                        <span style="font-size:0.7rem; color:var(--primary); font-weight:800; display:block; margin-bottom:5px;">${day}</span>
                        <h2>${data.name}</h2>
                        <p>${data.exercises.length} EXERCÍCIOS</p>
                        <button class="btn-start" onclick="app.startWorkout('${day}')">INICIAR TREINO</button>
                    </div>
                </div>
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
                        <div>
                            <h3 style="font-size:1.1rem; color:white;">${ex.name}</h3>
                            <p style="margin:0; opacity:0.6">${ex.series} | ${done}/${ex.totalSets || 3} Séries</p>
                        </div>
                        <i data-lucide="${done >= (ex.totalSets || 3) ? 'check-circle' : 'circle'}" color="${done >= (ex.totalSets || 3) ? '#bfff00' : '#444'}"></i>
                    </div>
                </div>
            `;
        }).join('');
        lucide.createIcons();
    }

    openExerciseModal(guid) {
        this.selectedEx = this.activeWorkout.exercises.find(e => e.guid === guid);
        const libEx = this.library.find(l => l.name === this.selectedEx.name) || this.selectedEx;
        document.getElementById('modal-name').textContent = this.selectedEx.name;
        document.getElementById('modal-prev-load').textContent = (this.selectedEx.weight || 0) + 'kg';
        document.getElementById('w-input').value = this.selectedEx.weight || "";
        
        const vidID = this.extractYoutubeId(libEx.videoId);
        document.getElementById('modal-video-container').innerHTML = `<iframe src="https://www.youtube.com/embed/${vidID}?autoplay=1&mute=1&playsinline=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
        document.getElementById('exercise-overlay').classList.remove('hidden');
    }

    // --- TRAINER ---
    selectStudent(id) {
        this.selectedStudent = this.students.find(s => s.id === id);
        document.getElementById('no-student-selected').classList.add('hidden');
        document.getElementById('student-dashboard').classList.remove('hidden');
        document.getElementById('selected-student-name').textContent = this.selectedStudent.name;
        this.updateWeekUI();
        this.renderWorkoutBuilder();
        this.loadStudentHistory();
        this.renderTrainer();
    }

    openLibEditor(id) {
        this.activeLibEdit = this.library.find(ex => ex.id === id);
        document.getElementById('lib-edit-name').textContent = `Editar: ${this.activeLibEdit.name}`;
        document.getElementById('lib-edit-url').value = this.activeLibEdit.videoId;
        const vidID = this.extractYoutubeId(this.activeLibEdit.videoId);
        document.getElementById('lib-edit-video').innerHTML = `<iframe src="https://www.youtube.com/embed/${vidID}?mute=1" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`;
        document.getElementById('lib-editor-overlay').classList.remove('hidden');
    }

    async saveLibUpdate() {
        const vid = this.extractYoutubeId(document.getElementById('lib-edit-url').value);
        await db.collection("library").doc(this.activeLibEdit.id).update({ videoId: vid });
        document.getElementById('lib-editor-overlay').classList.add('hidden');
        this.toast("Biblioteca Global Atualizada! 🌍");
    }

    inspectExercise(guid) {
        this.activeExEdit = this.selectedStudent.schedule[this.selectedDay].exercises.find(e => e.guid === guid);
        const libEx = this.library.find(l => l.name === this.activeExEdit.name) || this.activeExEdit;
        document.getElementById('ins-name').textContent = this.activeExEdit.name;
        document.getElementById('ins-series').value = this.activeExEdit.series || "3x";
        document.getElementById('ins-reps').value = "8-12";
        
        const vidID = this.extractYoutubeId(libEx.videoId);
        document.getElementById('inspector-video').innerHTML = `<iframe src="https://www.youtube.com/embed/${vidID}?autoplay=1&mute=1" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`;
    }

    async saveInspectorEdit() {
        if(!this.activeExEdit) return;
        this.activeExEdit.series = document.getElementById('ins-series').value;
        this.activeExEdit.totalSets = parseInt(this.activeExEdit.series) || 3;
        await this.save();
        this.toast("Treino Atualizado! ✅");
        this.renderWorkoutBuilder();
    }

    renderTrainer() {
        const slist = document.getElementById('student-list');
        slist.innerHTML = this.students.map(s => `
            <div class="list-item ${this.selectedStudent?.id === s.id ? 'active' : ''}" onclick="app.selectStudent('${s.id}')">
                <span>${s.name}</span>
            </div>
        `).join('');
    }

    async loadStudentHistory() {
        const snap = await db.collection("sessions").where("studentId", "==", this.selectedStudent.id).orderBy("timestamp", "desc").limit(10).get();
        document.getElementById('student-history-list').innerHTML = snap.docs.map(doc => {
            const s = doc.data();
            return `<div class="history-item"><span class="date">${s.date}</span><span class="vol">${(s.volume/1000).toFixed(1)} TON</span><span class="recs">${s.records} REC</span></div>`;
        }).join('');
    }

    updateWeekUI() {
        document.querySelectorAll('.day-btn').forEach(btn => {
            const day = btn.dataset.day;
            btn.classList.toggle('active', day === this.selectedDay);
            const sched = this.selectedStudent.schedule[day];
            btn.querySelector('.day-status').textContent = sched?.exercises.length > 0 ? 'TREINO' : 'DESC';
        });
    }

    renderWorkoutBuilder() {
        const dropzone = document.getElementById('active-workout-builder');
        const exercises = this.selectedStudent.schedule[this.selectedDay].exercises;
        dropzone.innerHTML = exercises.map((ex, idx) => `
            <div class="list-item" onclick="app.inspectExercise('${ex.guid}')">
                <span>${idx + 1}. ${ex.name}</span>
                <i data-lucide="trash-2" size="14" style="margin-left:auto; cursor:pointer;" onclick="event.stopPropagation(); app.removeExercise('${ex.guid}')"></i>
            </div>
        `).join('');
        lucide.createIcons();
    }

    initSortable() {
        const libEl = document.getElementById('exercise-library');
        const dropEl = document.getElementById('active-workout-builder');
        if(!libEl || !dropEl) return;
        Sortable.get(libEl)?.destroy();
        Sortable.get(dropEl)?.destroy();
        new Sortable(libEl, { group: { name:'sh', pull:'clone', put:false }, sort:false });
        new Sortable(dropEl, {
            group: 'sh', animation:150,
            onAdd: (evt) => {
                const libEx = this.library.find(e => e.id === evt.item.dataset.id);
                this.addExercise(libEx, evt.newIndex);
                evt.item.remove();
            }
        });
    }

    addExercise(libEx, idx) {
        const newEx = { guid: 'g'+Date.now(), name: libEx.name, series: libEx.defaultSeries || "3x", weight: 0 };
        this.selectedStudent.schedule[this.selectedDay].exercises.splice(idx, 0, newEx);
        this.save();
        this.renderWorkoutBuilder();
    }

    removeExercise(guid) {
        this.selectedStudent.schedule[this.selectedDay].exercises = this.selectedStudent.schedule[this.selectedDay].exercises.filter(e => e.guid !== guid);
        this.save();
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
        if (db && this.selectedStudent) await db.collection("students").doc(this.selectedStudent.id).set(this.selectedStudent);
    }

    async addSet() {
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

    toast(msg) {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed; bottom:50px; left:50%; transform:translateX(-50%); background:var(--primary); color:#000; padding:12px 24px; border-radius:30px; font-weight:800; z-index:4000; border:2px solid black;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2500);
    }
}

const app = new TitanApp();
window.app = app;
