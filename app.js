/* ================================================================
   TITAN LOAD v2.2 — Performance & Spacing
   Athlete + Trainer + Library + History + Auth + REST TIMER
   ================================================================ */

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCdLVzg_Uns3aRNT8jJLc_C8E2yZfV8RF0",
    authDomain: "titan-load.firebaseapp.com",
    projectId: "titan-load",
    storageBucket: "titan-load.firebasestorage.app",
    messagingSenderId: "406398492962",
    appId: "1:406398492962:web:b94ea9cbe76277c024457b",
    measurementId: "G-SWY71RQCFR"
};

const TRAINER_EMAIL = "leonardovasen@gmail.com"; 

if (firebase.apps.length === 0) firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
const auth = firebase.auth();

class TitanApp {
    constructor() {
        console.log("TITAN LOAD v2.2 — Performance Ready");
        this.currentUser = null;
        this.students = [];
        this.library = [];
        this.selectedStudent = null;
        this.selectedDay = "SEG";
        this.activeWorkout = null;
        this.sessionSets = [];
        this.sessionRecords = 0;
        this.activeExEdit = null;
        this.activeLibEdit = null;

        // Timer State
        this.timerInterval = null;
        this.timerSeconds = 60;

        window.app = this;
        this.boot();
    }

    boot() {
        auth.onAuthStateChanged(user => {
            if (user) this.onLogin(user);
            else this.showScreen("login-screen");
        });
        this.bindAll();
    }

    async onLogin(user) {
        const loggedEmail = user.email.toLowerCase();
        const isTrainer = loggedEmail === TRAINER_EMAIL.toLowerCase();
        console.log("TITAN AUTH — Logged as:", loggedEmail, " | isTrainer:", isTrainer);
        
        const ref = db.collection("students").doc(user.uid);
        const snap = await ref.get();
        if (!snap.exists) {
            this.currentUser = {
                id: user.uid, name: user.displayName || "Atleta", email: user.email,
                schedule: this.blankSchedule(), stats: { totalWorkouts: 0, volume: 0, records: 0 }
            };
            await ref.set(this.currentUser);
        } else {
            this.currentUser = { id: snap.id, ...snap.data() };
        }

        if (isTrainer) {
            db.collection("library").onSnapshot(s => { this.library = s.docs.map(d => ({ id: d.id, ...d.data() })); this.renderLibrary(); });
            db.collection("students").onSnapshot(s => { this.students = s.docs.map(d => ({ id: d.id, ...d.data() })); this.refreshActiveScreen(); });
            document.getElementById("goto-trainer-btn").classList.remove("hidden");
        } else {
            document.getElementById("goto-trainer-btn").classList.add("hidden");
        }
        this.showScreen("home-screen");
    }

    blankSchedule() {
        const s = {};
        ["SEG","TER","QUA","QUI","SEX","SAB","DOM"].forEach(d => { s[d] = { name: "", exercises: [] }; });
        return s;
    }

    showScreen(id) {
        document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
        document.getElementById(id).classList.remove("hidden");
        this.refreshActiveScreen();
    }

    refreshActiveScreen() {
        if (!document.getElementById("home-screen").classList.contains("hidden")) this.renderHome();
        if (!document.getElementById("trainer-screen").classList.contains("hidden")) this.renderTrainerList();
        lucide.createIcons();
    }

    bindAll() {
        document.getElementById("google-login-btn").onclick = () => this.login();
        document.getElementById("logout-btn").onclick = () => this.logout();
        document.getElementById("goto-trainer-btn").onclick = () => this.showScreen("trainer-screen");
        document.getElementById("back-to-app").onclick = () => this.showScreen("home-screen");
        document.getElementById("cancel-workout").onclick = () => this.showScreen("home-screen");
        document.getElementById("finish-workout").onclick = () => this.endWorkout();
        document.getElementById("close-exercise-modal").onclick = () => this.closeExerciseModal();
        document.getElementById("add-set-btn").onclick = () => this.registerSet();
        document.getElementById("save-ins-btn").onclick = () => this.saveInspector();
        document.getElementById("day-workout-name").oninput = (e) => this.onDayNameChange(e);
        document.getElementById("lib-search").oninput = () => this.renderLibrary();
        document.getElementById("lib-filter").onchange = () => this.renderLibrary();
        document.getElementById("skip-timer-btn").onclick = () => this.stopRestTimer();

        document.querySelectorAll(".day-btn").forEach(btn => {
            btn.onclick = () => { this.selectedDay = btn.dataset.day; this.paintWeek(); this.renderBuilder(); };
        });

        document.getElementById("save-lib-btn").onclick = () => this.saveLibVideo();
        document.getElementById("close-lib-editor").onclick = () => this.hideOverlay("lib-editor-overlay");
        document.getElementById("add-lib-exercise-btn").onclick = () => this.showOverlay("new-exercise-overlay");
        document.getElementById("close-new-exercise").onclick = () => this.hideOverlay("new-exercise-overlay");
        document.getElementById("save-new-exercise").onclick = () => this.addNewExercise();
        document.getElementById("close-summary").onclick = () => this.showScreen("home-screen");
    }

    async login() { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    async logout() { await auth.signOut(); this.showScreen("login-screen"); }

    // --- ATHLETE ---
    renderHome() {
        if (!this.currentUser) return;
        const u = this.currentUser; const stats = u.stats || { totalWorkouts: 0, volume: 0, records: 0 };
        document.getElementById("user-name").textContent = u.name;
        document.getElementById("total-workouts").textContent = stats.totalWorkouts;
        document.getElementById("total-volume").textContent = (stats.volume / 1000).toFixed(1) + "t";
        document.getElementById("total-records").textContent = stats.records;
        const container = document.getElementById("workout-cards-container");
        const DAYS = ["SEG","TER","QUA","QUI","SEX","SAB","DOM"];
        container.innerHTML = DAYS.map(day => {
            const d = u.schedule?.[day]; if (!d || d.exercises.length === 0) return "";
            return `<div class="wk-card" onclick="app.beginWorkout('${day}')"><span class="wk-card-day">${day}</span><h3>${d.name || "TREINO"}</h3><p>${d.exercises.length} exercícios</p></div>`;
        }).join("");
    }

    beginWorkout(day) {
        this.activeWorkoutDay = day; this.activeWorkout = JSON.parse(JSON.stringify(this.currentUser.schedule[day]));
        this.sessionSets = []; this.sessionRecords = 0;
        this.showScreen("workout-screen");
        document.getElementById("active-workout-name").textContent = this.activeWorkout.name || "TREINO";
        this.renderFeed(); this.updateProgress();
    }

    renderFeed() {
        const feed = document.getElementById("exercise-feed");
        feed.innerHTML = this.activeWorkout.exercises.map(ex => {
            const done = this.sessionSets.filter(s => s.guid === ex.guid).length;
            const total = parseInt(ex.series) || 3; const isDone = done >= total;
            return `<div class="ex-card ${isDone ? "done" : ""}" onclick="app.openExercise('${ex.guid}')"><div class="status-ring"><i data-lucide="${isDone ? "check" : "play"}" size="18" color="${isDone ? "#bfff00" : "#555"}"></i></div><div class="ex-info"><h3>${ex.name}</h3><p>${done}/${total} séries</p></div>${isDone ? "" : '<i data-lucide="chevron-right" size="18" class="ex-chevron"></i>'}</div>`;
        }).join("");
        lucide.createIcons();
    }

    updateProgress() {
        const totalNeeded = this.activeWorkout.exercises.reduce((a, e) => a + (parseInt(e.series) || 3), 0);
        const done = this.sessionSets.length;
        const pct = totalNeeded > 0 ? Math.min((done / totalNeeded) * 100, 100) : 0;
        document.getElementById("workout-progress-bar").style.width = pct + "%";
        document.getElementById("workout-set-counter").textContent = `${done}/${totalNeeded}`;
        if (pct >= 100) document.getElementById("finish-btn-container").classList.remove("hidden");
        else document.getElementById("finish-btn-container").classList.add("hidden");
    }

    openExercise(guid) {
        this.selectedEx = this.activeWorkout.exercises.find(e => e.guid === guid);
        const libEx = this.library.find(l => l.name.toUpperCase() === this.selectedEx.name.toUpperCase());
        const done = this.sessionSets.filter(s => s.guid === guid).length;
        const total = parseInt(this.selectedEx.series) || 3;
        document.getElementById("modal-ex-name").textContent = this.selectedEx.name;
        document.getElementById("modal-prev-load").textContent = (this.selectedEx.weight || 0) + "kg";
        document.getElementById("modal-set-counter").textContent = `${done}/${total}`;
        document.getElementById("w-input").value = this.selectedEx.weight || "";
        document.getElementById("r-input").value = "";
        const vidId = this.ytId(libEx?.videoId);
        document.getElementById("modal-video-wrap").innerHTML = vidId ? `<iframe src="https://www.youtube.com/embed/${vidId}?autoplay=1&mute=1&playsinline=1&modestbranding=1&rel=0" allowfullscreen></iframe>` : "";
        this.renderSetLog();
        this.showOverlay("exercise-overlay");
    }

    registerSet() {
        const w = parseFloat(document.getElementById("w-input").value);
        const r = parseInt(document.getElementById("r-input").value);
        if (!w || !r) { this.toast("Preencha carga e reps!"); return; }
        if (navigator.vibrate) navigator.vibrate(50);
        this.sessionSets.push({ guid: this.selectedEx.guid, w, r });
        if (w > (this.selectedEx.weight || 0)) { this.selectedEx.weight = w; this.sessionRecords++; }
        
        const btn = document.getElementById("add-set-btn");
        btn.textContent = "✓ REGISTRADO"; btn.classList.add("confirmed");
        setTimeout(() => { btn.textContent = "REGISTRAR SÉRIE"; btn.classList.remove("confirmed"); }, 800);
        
        document.getElementById("r-input").value = "";
        this.renderSetLog(); this.renderFeed(); this.updateProgress();
        const done = this.sessionSets.filter(s => s.guid === this.selectedEx.guid).length;
        const total = parseInt(this.selectedEx.series) || 3;
        document.getElementById("modal-set-counter").textContent = `${done}/${total}`;

        if (done < total) {
            this.startRestTimer();
        } else {
            this.toast("EXCELENTE! 🔥"); setTimeout(() => this.closeExerciseModal(), 1200);
        }
    }

    startRestTimer() {
        this.stopRestTimer();
        this.timerSeconds = 60;
        document.getElementById("rest-timer-overlay").classList.remove("hidden");
        this.updateTimerUI();
        this.timerInterval = setInterval(() => {
            this.timerSeconds--;
            if (this.timerSeconds <= 0) {
                if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                this.stopRestTimer();
            }
            this.updateTimerUI();
        }, 1000);
    }

    stopRestTimer() {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        document.getElementById("rest-timer-overlay").classList.add("hidden");
    }

    updateTimerUI() {
        const m = Math.floor(this.timerSeconds / 60);
        const s = this.timerSeconds % 60;
        document.getElementById("timer-display").textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    renderSetLog() {
        const wrap = document.getElementById("modal-set-log");
        const sets = this.sessionSets.filter(s => s.guid === this.selectedEx.guid);
        wrap.innerHTML = sets.length > 0 ? `<p class="set-log-title">SÉRIES REGISTRADAS</p>` + sets.map((s, i) => `<div class="set-entry"><span class="set-num">SÉRIE ${i + 1}</span><span class="set-data">${s.w}kg × ${s.r}</span></div>`).join("") : "";
    }

    closeExerciseModal() { 
        this.stopRestTimer();
        document.getElementById("exercise-overlay").classList.add("hidden"); 
        document.getElementById("modal-video-wrap").innerHTML = ""; 
    }

    async endWorkout() {
        const vol = this.sessionSets.reduce((a, s) => a + (s.w * s.r), 0);
        this.currentUser.stats.volume += vol; this.currentUser.stats.totalWorkouts++; this.currentUser.stats.records += this.sessionRecords;
        this.activeWorkout.exercises.forEach(ex => {
            const original = this.currentUser.schedule[this.activeWorkoutDay].exercises.find(e => e.guid === ex.guid);
            if (original && ex.weight) original.weight = ex.weight;
        });
        await db.collection("sessions").add({ studentId: this.currentUser.id, date: new Date().toLocaleDateString("pt-BR"), volume: vol, sets: this.sessionSets.length, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        await db.collection("students").doc(this.currentUser.id).set(this.currentUser);
        document.getElementById("sum-volume").textContent = (vol/1000).toFixed(1) + "t";
        document.getElementById("sum-sets").textContent = this.sessionSets.length;
        document.getElementById("sum-records").textContent = this.sessionRecords;
        this.showScreen("summary-screen");
    }

    // --- TRAINER ---
    renderTrainerList() {
        const list = document.getElementById("student-list");
        list.innerHTML = this.students.map(s => `<div class="list-item ${this.selectedStudent?.id === s.id ? "active" : ""}" onclick="app.selectStudent('${s.id}')"><span>${s.name}</span><i data-lucide="trash-2" size="14" class="edit-icon" onclick="event.stopPropagation(); app.deleteStudent('${s.id}')"></i></div>`).join("");
        lucide.createIcons();
    }

    async deleteStudent(id) {
        if (!confirm("Remover este aluno?")) return;
        await db.collection("students").doc(id).delete();
        if (this.selectedStudent?.id === id) { this.selectedStudent = null; document.getElementById("student-dashboard").classList.add("hidden"); document.getElementById("no-student-selected").classList.remove("hidden"); }
        this.toast("Aluno removido.");
    }

    selectStudent(id) {
        this.selectedStudent = this.students.find(s => s.id === id);
        document.getElementById("no-student-selected").classList.add("hidden");
        document.getElementById("student-dashboard").classList.remove("hidden");
        document.getElementById("selected-student-name").textContent = this.selectedStudent.name;
        const stats = this.selectedStudent.stats || {};
        document.getElementById("s-vol").textContent = ((stats.volume || 0) / 1000).toFixed(1) + "t";
        document.getElementById("s-count").textContent = stats.totalWorkouts || 0;
        this.selectedDay = "SEG"; this.paintWeek(); this.renderBuilder(); this.loadHistory(); this.renderTrainerList();
    }

    paintWeek() {
        document.querySelectorAll(".day-btn").forEach(btn => {
            const day = btn.dataset.day; btn.classList.toggle("active", day === this.selectedDay);
            const sched = this.selectedStudent.schedule?.[day];
            const tag = btn.querySelector(".day-tag"); if (tag) tag.textContent = sched?.exercises?.length > 0 ? (sched.name || "TREINO") : "DESC";
        });
    }

    renderBuilder() {
        const dayData = this.selectedStudent.schedule[this.selectedDay] || { name: "", exercises: [] };
        document.getElementById("day-workout-name").value = dayData.name || "";
        const zone = document.getElementById("active-workout-builder");
        zone.innerHTML = dayData.exercises.length === 0 ? `<p class="drop-hint">Arraste exercícios</p>` : dayData.exercises.map((ex, i) => `<div class="list-item" onclick="app.inspectExercise('${ex.guid}')"><span>${i + 1}. ${ex.name}</span><i data-lucide="trash-2" size="14" class="edit-icon" onclick="event.stopPropagation(); app.removeExercise('${ex.guid}')"></i></div>`).join("");
        document.getElementById("inspector-content").classList.add("hidden");
        document.querySelector(".inspector-empty").classList.remove("hidden");
        lucide.createIcons(); this.initDragDrop();
    }

    inspectExercise(guid) {
        this.activeExEdit = this.selectedStudent.schedule[this.selectedDay].exercises.find(e => e.guid === guid);
        document.querySelector(".inspector-empty").classList.add("hidden");
        document.getElementById("inspector-content").classList.remove("hidden");
        document.getElementById("ins-name").textContent = this.activeExEdit.name;
        document.getElementById("ins-series").value = this.activeExEdit.series || "3x";
        document.getElementById("ins-reps").value = this.activeExEdit.metaReps || "";
        const libEx = this.library.find(l => l.name.toUpperCase() === this.activeExEdit.name.toUpperCase());
        const vid = this.ytId(libEx?.videoId);
        document.getElementById("inspector-video").innerHTML = vid ? `<iframe src="https://www.youtube.com/embed/${vid}?mute=1" allowfullscreen></iframe>` : "";
    }

    async saveInspector() { this.activeExEdit.series = document.getElementById("ins-series").value; this.activeExEdit.metaReps = document.getElementById("ins-reps").value; await this.persistStudent(); this.toast("Atualizado!"); }
    onDayNameChange(e) { this.selectedStudent.schedule[this.selectedDay].name = e.target.value.toUpperCase(); this.persistStudent(); this.paintWeek(); }
    removeExercise(guid) { this.selectedStudent.schedule[this.selectedDay].exercises = this.selectedStudent.schedule[this.selectedDay].exercises.filter(e => e.guid !== guid); this.persistStudent(); this.renderBuilder(); }

    initDragDrop() {
        const lib = document.getElementById("exercise-library"); const drop = document.getElementById("active-workout-builder");
        if (Sortable.get(lib)) Sortable.get(lib).destroy(); if (Sortable.get(drop)) Sortable.get(drop).destroy();
        new Sortable(lib, { group: { name: "titan", pull: "clone", put: false }, sort: false, animation: 150 });
        new Sortable(drop, { group: "titan", animation: 150, onAdd: (evt) => { 
            const libEx = this.library.find(e => e.id === evt.item.dataset.id);
            if (libEx) this.addExerciseToDay(libEx, evt.newIndex); evt.item.remove();
        }});
    }

    addExerciseToDay(libEx, index) { this.selectedStudent.schedule[this.selectedDay].exercises.splice(index, 0, { guid: "g" + Date.now(), name: libEx.name, series: libEx.defaultSeries || "3x", weight: 0 }); this.persistStudent(); this.renderBuilder(); }
    async persistStudent() { await db.collection("students").doc(this.selectedStudent.id).set(this.selectedStudent); }

    async loadHistory() {
        try {
            const snap = await db.collection("sessions").where("studentId", "==", this.selectedStudent.id).orderBy("timestamp", "desc").limit(5).get();
            document.getElementById("student-history-list").innerHTML = snap.docs.map(d => `<div class="history-row"><span class="h-date">${d.data().date}</span><span class="h-vol">${(d.data().volume/1000).toFixed(1)}t</span></div>`).join("");
        } catch (e) {}
    }

    renderLibrary() {
        const search = document.getElementById("lib-search").value.toUpperCase();
        const category = document.getElementById("lib-filter").value;
        const el = document.getElementById("exercise-library");
        let filtered = this.library.filter(ex => ex.name.includes(search));
        if (category !== "ALL") filtered = filtered.filter(ex => ex.category === category);
        el.innerHTML = filtered.map(ex => `<div class="list-item" data-id="${ex.id}"><span>${ex.name}</span><i data-lucide="edit-3" size="14" class="edit-icon" onclick="event.stopPropagation(); app.openLibEditor('${ex.id}')"></i></div>`).join("");
        lucide.createIcons(); this.initDragDrop();
    }

    openLibEditor(id) { this.activeLibEdit = this.library.find(e => e.id === id); document.getElementById("lib-edit-name").textContent = `Editar: ${this.activeLibEdit.name}`; document.getElementById("lib-edit-url").value = this.activeLibEdit.videoId || ""; this.showOverlay("lib-editor-overlay"); }
    async saveLibVideo() { await db.collection("library").doc(this.activeLibEdit.id).update({ videoId: this.ytId(document.getElementById("lib-edit-url").value) }); this.hideOverlay("lib-editor-overlay"); this.toast("Atualizado!"); }
    async addNewExercise() { const name = document.getElementById("new-ex-name").value.toUpperCase(); if (!name) return; await db.collection("library").doc("lib_" + Date.now()).set({ name, videoId: "", defaultSeries: "3x", category: "ALL" }); this.hideOverlay("new-exercise-overlay"); this.toast("Adicionado!"); }

    ytId(url) {
        if (!url) return ""; if (url.length === 11) return url;
        if (url.includes("v=")) return url.split("v=")[1].split("&")[0];
        if (url.includes("youtu.be/")) return url.split("youtu.be/")[1].split("?")[0];
        if (url.includes("/shorts/")) return url.split("/shorts/")[1].split("?")[0];
        return url;
    }

    showOverlay(id) { document.getElementById(id).classList.remove("hidden"); }
    hideOverlay(id) { document.getElementById(id).classList.add("hidden"); document.querySelectorAll(`#${id} iframe`).forEach(f => f.src = ""); }
    toast(msg) { const el = document.createElement("div"); el.className = "toast"; el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), 2500); }
}
const app = new TitanApp();
