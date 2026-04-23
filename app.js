// --- TITAN LOAD CLOUD ARCHITECTURE PRO (RELOADED V2) ---

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
let auth = null;

if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
}

class TitanApp {
    constructor() {
        this.students = [];
        this.library = [];
        this.currentUser = null;
        this.selectedStudent = null;
        this.selectedDay = "SEG";
        this.authUserData = null;
        this.sessionSets = [];
        
        window.app = this;
        this.init();
    }

    async init() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.authUserData = user;
                await this.handleUserLogin(user);
            } else {
                this.switchScreen('login-screen');
            }
        });
        this.setupListeners();
    }

    async handleUserLogin(user) {
        db.collection("library").onSnapshot(snap => {
            if (snap.empty) this.seedLibrary();
            this.library = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.renderLibrary();
        });

        const doc = await db.collection("students").doc(user.uid).get();
        if (!doc.exists) {
            this.currentUser = {
                id: user.uid, name: user.displayName, email: user.email,
                schedule: this.emptySchedule(),
                stats: { totalWorkouts: 0, volume: 0, records: 0 }
            };
            await db.collection("students").doc(user.uid).set(this.currentUser);
        } else {
            this.currentUser = { id: doc.id, ...doc.data() };
        }

        db.collection("students").onSnapshot(snap => {
            this.students = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.syncUI();
        });

        this.switchScreen('home-screen');
    }

    emptySchedule() {
        const sched = {};
        ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"].forEach(day => {
            sched[day] = { name: "TREINO", exercises: [] };
        });
        return sched;
    }

    setupListeners() {
        document.getElementById('google-login-btn').onclick = () => this.login();
        document.getElementById('goto-trainer-btn').onclick = () => this.switchScreen('trainer-screen');
        document.getElementById('back-to-app').onclick = () => this.switchScreen('home-screen');
        document.getElementById('save-ins-btn').onclick = () => this.saveInspectorEdit();
        document.getElementById('add-set-btn').onclick = () => this.addSet();
        document.getElementById('save-lib-btn').onclick = () => this.saveLibUpdate();
        document.getElementById('finish-workout').onclick = () => this.finishWorkout();
        document.getElementById('close-summary').onclick = () => this.switchScreen('home-screen');
        
        // Listener para o Nome do Treino
        document.getElementById('day-workout-name').oninput = (e) => {
            if(this.selectedStudent) {
                this.selectedStudent.schedule[this.selectedDay].name = e.target.value.toUpperCase();
                this.save();
                this.updateWeekUI();
            }
        };

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
                document.querySelectorAll('iframe').forEach(i => i.src = "");
            };
        });
    }

    async login() {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
    }

    switchScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
        if (id === 'home-screen' || id === 'trainer-screen') this.syncUI();
    }

    // --- ATHLETE ---
    renderAthleteHome() {
        if (!this.currentUser) return;
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
                        <h2>${data.name}</h2><p>${data.exercises.length} EXERCÍCIOS</p>
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
        document.getElementById('modal-video-container').innerHTML = `<iframe src="https://www.youtube.com/embed/${vidID}?autoplay=1&mute=1&playsinline=1" frameborder="0" allowfullscreen></iframe>`;
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

    async finishWorkout() {
        const vol = this.sessionSets.reduce((acc, s) => acc + (s.w * s.r), 0);
        this.currentUser.stats.volume += vol;
        this.currentUser.stats.totalWorkouts++;
        await db.collection("sessions").add({ studentId: this.currentUser.id, date: new Date().toLocaleDateString('pt-BR'), volume: vol, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        await this.save();
        this.switchScreen('summary-screen');
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

    async loadStudentHistory() {
        try {
            const snap = await db.collection("sessions").where("studentId", "==", this.selectedStudent.id).orderBy("timestamp", "desc").limit(10).get();
            const histEl = document.getElementById('student-history-list');
            histEl.innerHTML = snap.docs.map(doc => {
                const s = doc.data();
                return `<div class="history-item"><span class="date">${s.date}</span><span class="vol">${(s.volume/1000).toFixed(1)} TON</span></div>`;
            }).join('');
        } catch(e) { console.error("Histórico indisponível (Crie o índice no console do Firebase)"); }
    }

    renderWorkoutBuilder() {
        const dropzone = document.getElementById('active-workout-builder');
        const dayData = this.selectedStudent.schedule[this.selectedDay];
        document.getElementById('day-workout-name').value = dayData.name || "";
        
        dropzone.innerHTML = dayData.exercises.map((ex, idx) => `
            <div class="list-item" onclick="app.inspectExercise('${ex.guid}')">
                <span>${idx + 1}. ${ex.name}</span>
                <i data-lucide="trash-2" size="14" style="margin-left:auto" onclick="event.stopPropagation(); app.removeExercise('${ex.guid}')"></i>
            </div>
        `).join('');
        lucide.createIcons();
    }

    inspectExercise(guid) {
        this.activeExEdit = this.selectedStudent.schedule[this.selectedDay].exercises.find(e => e.guid === guid);
        const libEx = this.library.find(l => l.name === this.activeExEdit.name) || this.activeExEdit;
        document.getElementById('ins-name').textContent = this.activeExEdit.name;
        document.getElementById('ins-series').value = this.activeExEdit.series || "3x";
        const vidID = this.extractYoutubeId(libEx.videoId);
        document.getElementById('inspector-video').innerHTML = `<iframe src="https://www.youtube.com/embed/${vidID}?autoplay=1&mute=1" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`;
    }

    async saveInspectorEdit() {
        this.activeExEdit.series = document.getElementById('ins-series').value;
        this.activeExEdit.totalSets = parseInt(this.activeExEdit.series) || 3;
        await this.save();
        this.toast("Treino Atualizado!");
    }

    renderLibrary() {
        const libEl = document.getElementById('exercise-library');
        if (!libEl) return;
        libEl.innerHTML = this.library.map(ex => `
            <div class="list-item" data-id="${ex.id}">
                <span>${ex.name}</span>
                <i data-lucide="edit-3" size="14" style="margin-left:auto" onclick="app.openLibEditor('${ex.id}')"></i>
            </div>
        `).join('');
        lucide.createIcons();
        this.initSortable();
    }

    openLibEditor(id) {
        this.activeLibEdit = this.library.find(ex => ex.id === id);
        document.getElementById('lib-edit-name').textContent = `Editar: ${this.activeLibEdit.name}`;
        document.getElementById('lib-edit-url').value = this.activeLibEdit.videoId;
        document.getElementById('lib-editor-overlay').classList.remove('hidden');
    }

    async saveLibUpdate() {
        const vid = this.extractYoutubeId(document.getElementById('lib-edit-url').value);
        await db.collection("library").doc(this.activeLibEdit.id).update({ videoId: vid });
        document.getElementById('lib-editor-overlay').classList.add('hidden');
        this.toast("Biblioteca Global Atualizada!");
    }

    syncUI() {
        if (!document.getElementById('home-screen').classList.contains('hidden')) this.renderAthleteHome();
        if (!document.getElementById('trainer-screen').classList.contains('hidden')) this.renderTrainer();
        lucide.createIcons();
    }

    renderTrainer() {
        const slist = document.getElementById('student-list');
        slist.innerHTML = this.students.map(s => `
            <div class="list-item ${this.selectedStudent?.id === s.id ? 'active' : ''}" onclick="app.selectStudent('${s.id}')"><span>${s.name}</span></div>
        `).join('');
    }

    updateWeekUI() {
        document.querySelectorAll('.day-btn').forEach(btn => {
            const day = btn.dataset.day;
            btn.classList.toggle('active', day === this.selectedDay);
            const sched = this.selectedStudent.schedule[day];
            btn.querySelector('.day-status').textContent = sched?.exercises.length > 0 ? (sched.name || 'TREINO') : 'DESC';
        });
    }

    removeExercise(guid) {
        this.selectedStudent.schedule[this.selectedDay].exercises = this.selectedStudent.schedule[this.selectedDay].exercises.filter(e => e.guid !== guid);
        this.save();
        this.renderWorkoutBuilder();
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

    async save() {
        const ref = this.selectedStudent ? this.selectedStudent.id : this.currentUser.id;
        await db.collection("students").doc(ref).set(this.selectedStudent || this.currentUser);
    }

    async seedLibrary() {
        const lib = [{ id: "l1", name: "Supino", videoId: "...", defaultSeries: "3x" }];
        for (const ex of lib) await db.collection("library").doc(ex.id).set(ex);
    }

    extractYoutubeId(url) {
        if(!url) return "";
        let id = url;
        if(url.includes('v=')) id = url.split('v=')[1].split('&')[0];
        else if(url.includes('youtu.be/')) id = url.split('youtu.be/')[1].split('?')[0];
        else if(url.includes('/shorts/')) id = url.split('/shorts/')[1].split('?')[0];
        return id.split('/')[0].trim(); // Limpa barras extras ou espaços
    }

    toast(msg) {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed; bottom:50px; left:50%; transform:translateX(-50%); background:var(--primary); color:#000; padding:12px 24px; border-radius:30px; font-weight:800; z-index:4000;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2500);
    }
}

const app = new TitanApp();
window.app = app;
