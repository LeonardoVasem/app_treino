/* ================================================================
   TITAN LOAD v2.0 — Full Rebuild
   Athlete + Trainer + Library + History + Auth
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

if (firebase.apps.length === 0) firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
const auth = firebase.auth();

class TitanApp {
    constructor() {
        console.log("TITAN LOAD v2.0 — Full Rebuild");

        // State
        this.currentUser = null;
        this.students = [];
        this.library = [];
        this.selectedStudent = null;
        this.selectedDay = "SEG";

        // Workout session (transient)
        this.activeWorkout = null;
        this.sessionSets = [];
        this.sessionRecords = 0;

        // Inspector (Trainer)
        this.activeExEdit = null;
        this.activeLibEdit = null;

        window.app = this;
        this.boot();
    }

    /* =========================
       BOOT & AUTH
       ========================= */
    boot() {
        auth.onAuthStateChanged(user => {
            if (user) this.onLogin(user);
            else this.showScreen("login-screen");
        });
        this.bindAll();
    }

    async onLogin(user) {
        // 1. Get or create student profile
        const ref = db.collection("students").doc(user.uid);
        const snap = await ref.get();
        if (!snap.exists) {
            this.currentUser = {
                id: user.uid,
                name: user.displayName || "Atleta",
                email: user.email,
                schedule: this.blankSchedule(),
                stats: { totalWorkouts: 0, volume: 0, records: 0 }
            };
            await ref.set(this.currentUser);
        } else {
            this.currentUser = { id: snap.id, ...snap.data() };
        }

        // Importar novos exercícios se necessário
        await this.importNewExercises();

        // 2. Real-time library listener
        db.collection("library").onSnapshot(s => {
            this.library = s.docs.map(d => ({ id: d.id, ...d.data() }));
            this.renderLibrary();
        });

        // 3. Real-time students listener
        db.collection("students").onSnapshot(s => {
            this.students = s.docs.map(d => ({ id: d.id, ...d.data() }));
            // Refresh current user reference
            const fresh = this.students.find(st => st.id === this.currentUser.id);
            if (fresh) this.currentUser = fresh;
            this.refreshActiveScreen();
        });

        this.showScreen("home-screen");
    }

    blankSchedule() {
        const s = {};
        ["SEG","TER","QUA","QUI","SEX","SAB","DOM"].forEach(d => {
            s[d] = { name: "", exercises: [] };
        });
        return s;
    }

    /* =========================
       NAVIGATION
       ========================= */
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

    /* =========================
       EVENT BINDING
       ========================= */
    bindAll() {
        // Auth
        document.getElementById("google-login-btn").onclick = () => this.login();
        document.getElementById("logout-btn").onclick = () => this.logout();

        // Navigation
        document.getElementById("goto-trainer-btn").onclick = () => this.showScreen("trainer-screen");
        document.getElementById("back-to-app").onclick = () => this.showScreen("home-screen");

        // Workout
        document.getElementById("cancel-workout").onclick = () => this.showScreen("home-screen");
        document.getElementById("finish-workout").onclick = () => this.endWorkout();

        // Exercise modal
        document.getElementById("close-exercise-modal").onclick = () => this.closeExerciseModal();
        document.getElementById("add-set-btn").onclick = () => this.registerSet();

        // Trainer inspector
        document.getElementById("save-ins-btn").onclick = () => this.saveInspector();

        // Trainer day name
        document.getElementById("day-workout-name").oninput = (e) => this.onDayNameChange(e);

        // Week day buttons
        document.querySelectorAll(".day-btn").forEach(btn => {
            btn.onclick = () => {
                this.selectedDay = btn.dataset.day;
                this.paintWeek();
                this.renderBuilder();
            };
        });

        // Library editor
        document.getElementById("save-lib-btn").onclick = () => this.saveLibVideo();
        document.getElementById("close-lib-editor").onclick = () => this.hideOverlay("lib-editor-overlay");

        // New exercise
        document.getElementById("add-lib-exercise-btn").onclick = () => this.showOverlay("new-exercise-overlay");
        document.getElementById("close-new-exercise").onclick = () => this.hideOverlay("new-exercise-overlay");
        document.getElementById("save-new-exercise").onclick = () => this.addNewExercise();

        // Summary
        document.getElementById("close-summary").onclick = () => this.showScreen("home-screen");
    }

    async login() {
        try {
            await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
        } catch (e) {
            this.toast("Erro ao entrar: " + e.message);
        }
    }

    async logout() {
        await auth.signOut();
        this.showScreen("login-screen");
    }

    /* =========================
       HOME (ATHLETE)
       ========================= */
    renderHome() {
        if (!this.currentUser) return;
        const u = this.currentUser;
        const stats = u.stats || { totalWorkouts: 0, volume: 0, records: 0 };

        document.getElementById("user-name").textContent = u.name;
        document.getElementById("total-workouts").textContent = stats.totalWorkouts;
        document.getElementById("total-volume").textContent = (stats.volume / 1000).toFixed(1) + "t";
        document.getElementById("total-records").textContent = stats.records;

        const container = document.getElementById("workout-cards-container");
        const DAYS = ["SEG","TER","QUA","QUI","SEX","SAB","DOM"];
        container.innerHTML = DAYS.map(day => {
            const d = u.schedule?.[day];
            if (!d || d.exercises.length === 0) return "";
            return `
                <div class="wk-card" onclick="app.beginWorkout('${day}')">
                    <span class="wk-card-day">${day}</span>
                    <h3>${d.name || "TREINO"}</h3>
                    <p>${d.exercises.length} exercício${d.exercises.length > 1 ? "s" : ""}</p>
                </div>`;
        }).join("");
    }

    /* =========================
       WORKOUT SESSION
       ========================= */
    beginWorkout(day) {
        this.activeWorkoutDay = day;
        this.activeWorkout = JSON.parse(JSON.stringify(this.currentUser.schedule[day])); // deep copy
        this.sessionSets = [];
        this.sessionRecords = 0;
        this.showScreen("workout-screen");
        document.getElementById("active-workout-name").textContent = this.activeWorkout.name || "TREINO";
        this.renderFeed();
        this.updateProgress();
    }

    renderFeed() {
        const feed = document.getElementById("exercise-feed");
        feed.innerHTML = this.activeWorkout.exercises.map(ex => {
            const done = this.sessionSets.filter(s => s.guid === ex.guid).length;
            const total = parseInt(ex.series) || 3;
            const isDone = done >= total;
            return `
                <div class="ex-card ${isDone ? "done" : ""}" onclick="app.openExercise('${ex.guid}')">
                    <div class="status-ring">
                        <i data-lucide="${isDone ? "check" : "play"}" size="18" color="${isDone ? "#bfff00" : "#555"}"></i>
                    </div>
                    <div class="ex-info">
                        <h3>${ex.name}</h3>
                        <p>${done}/${total} séries</p>
                    </div>
                    ${isDone ? "" : '<i data-lucide="chevron-right" size="18" class="ex-chevron"></i>'}
                </div>`;
        }).join("");
        lucide.createIcons();
    }

    updateProgress() {
        const totalNeeded = this.activeWorkout.exercises.reduce((a, e) => a + (parseInt(e.series) || 3), 0);
        const done = this.sessionSets.length;
        const pct = totalNeeded > 0 ? Math.min((done / totalNeeded) * 100, 100) : 0;

        document.getElementById("workout-progress-bar").style.width = pct + "%";
        document.getElementById("workout-set-counter").textContent = `${done}/${totalNeeded}`;

        const finBtn = document.getElementById("finish-btn-container");
        if (pct >= 100) finBtn.classList.remove("hidden");
        else finBtn.classList.add("hidden");
    }

    /* =========================
       EXERCISE MODAL
       ========================= */
    openExercise(guid) {
        this.selectedEx = this.activeWorkout.exercises.find(e => e.guid === guid);
        if (!this.selectedEx) return;

        const libEx = this.library.find(l => l.name.toUpperCase() === this.selectedEx.name.toUpperCase());
        const done = this.sessionSets.filter(s => s.guid === guid).length;
        const total = parseInt(this.selectedEx.series) || 3;

        document.getElementById("modal-ex-name").textContent = this.selectedEx.name;
        document.getElementById("modal-prev-load").textContent = (this.selectedEx.weight || 0) + "kg";
        document.getElementById("modal-set-counter").textContent = `${done}/${total}`;
        document.getElementById("w-input").value = this.selectedEx.weight || "";
        document.getElementById("r-input").value = "";

        // Video
        const videoWrap = document.getElementById("modal-video-wrap");
        const vidId = this.ytId(libEx?.videoId);
        if (vidId) {
            videoWrap.innerHTML = `<iframe src="https://www.youtube.com/embed/${vidId}?autoplay=1&mute=1&playsinline=1&modestbranding=1&rel=0" allowfullscreen></iframe>`;
        } else {
            videoWrap.innerHTML = `<p style="color:var(--text-muted); padding:40px; text-align:center">Sem vídeo cadastrado</p>`;
        }

        this.renderSetLog();
        this.showOverlay("exercise-overlay");
    }

    registerSet() {
        const w = parseFloat(document.getElementById("w-input").value);
        const r = parseInt(document.getElementById("r-input").value);
        if (!w || w <= 0 || !r || r <= 0) {
            this.toast("Preencha Carga e Reps!");
            return;
        }

        // Vibrate feedback
        if (navigator.vibrate) navigator.vibrate(50);

        // Save
        this.sessionSets.push({ guid: this.selectedEx.guid, w, r });

        // Track record
        if (w > (this.selectedEx.weight || 0)) {
            this.selectedEx.weight = w;
            this.sessionRecords++;
        }

        // Visual feedback on button
        const btn = document.getElementById("add-set-btn");
        btn.textContent = "✓ REGISTRADO";
        btn.classList.add("confirmed");
        setTimeout(() => {
            btn.textContent = "REGISTRAR SÉRIE";
            btn.classList.remove("confirmed");
        }, 800);

        // Clear reps for next set
        document.getElementById("r-input").value = "";

        // Update UI
        this.renderSetLog();
        this.renderFeed();
        this.updateProgress();

        // Update counter badge
        const done = this.sessionSets.filter(s => s.guid === this.selectedEx.guid).length;
        const total = parseInt(this.selectedEx.series) || 3;
        document.getElementById("modal-set-counter").textContent = `${done}/${total}`;

        // Auto-close when exercise is complete
        if (done >= total) {
            this.toast("EXERCÍCIO CONCLUÍDO! 🔥");
            setTimeout(() => this.closeExerciseModal(), 1200);
        }
    }

    renderSetLog() {
        const wrap = document.getElementById("modal-set-log");
        const sets = this.sessionSets.filter(s => s.guid === this.selectedEx.guid);
        if (sets.length === 0) {
            wrap.innerHTML = "";
            return;
        }
        wrap.innerHTML = `<p class="set-log-title">SÉRIES REGISTRADAS</p>` +
            sets.map((s, i) => `
                <div class="set-entry">
                    <span class="set-num">SÉRIE ${i + 1}</span>
                    <span class="set-data">${s.w}kg × ${s.r}</span>
                </div>
            `).join("");
    }

    closeExerciseModal() {
        document.getElementById("exercise-overlay").classList.add("hidden");
        document.getElementById("modal-video-wrap").innerHTML = "";
    }

    async endWorkout() {
        const vol = this.sessionSets.reduce((a, s) => a + (s.w * s.r), 0);
        const sets = this.sessionSets.length;

        this.currentUser.stats.volume += vol;
        this.currentUser.stats.totalWorkouts++;
        this.currentUser.stats.records += this.sessionRecords;

        // Persist weight updates back to schedule
        this.activeWorkout.exercises.forEach(ex => {
            const original = this.currentUser.schedule[this.activeWorkoutDay].exercises.find(e => e.guid === ex.guid);
            if (original && ex.weight) original.weight = ex.weight;
        });

        try {
            await db.collection("sessions").add({
                studentId: this.currentUser.id,
                date: new Date().toLocaleDateString("pt-BR"),
                volume: vol,
                sets,
                records: this.sessionRecords,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            await db.collection("students").doc(this.currentUser.id).set(this.currentUser);
        } catch (e) { console.error("Save error:", e); }

        // Show summary
        document.getElementById("sum-volume").textContent = (vol / 1000).toFixed(1) + "t";
        document.getElementById("sum-sets").textContent = sets;
        document.getElementById("sum-records").textContent = this.sessionRecords;
        this.showScreen("summary-screen");
    }

    /* =========================
       TRAINER
       ========================= */
    renderTrainerList() {
        const list = document.getElementById("student-list");
        list.innerHTML = this.students.map(s => `
            <div class="list-item ${this.selectedStudent?.id === s.id ? "active" : ""}" onclick="app.selectStudent('${s.id}')">
                <span>${s.name}</span>
            </div>
        `).join("");
    }

    selectStudent(id) {
        this.selectedStudent = this.students.find(s => s.id === id);
        if (!this.selectedStudent) return;

        document.getElementById("no-student-selected").classList.add("hidden");
        document.getElementById("student-dashboard").classList.remove("hidden");
        document.getElementById("selected-student-name").textContent = this.selectedStudent.name;

        const stats = this.selectedStudent.stats || {};
        document.getElementById("s-vol").textContent = ((stats.volume || 0) / 1000).toFixed(1) + "t";
        document.getElementById("s-count").textContent = stats.totalWorkouts || 0;

        this.selectedDay = "SEG";
        this.paintWeek();
        this.renderBuilder();
        this.loadHistory();
        this.renderTrainerList();
    }

    paintWeek() {
        document.querySelectorAll(".day-btn").forEach(btn => {
            const day = btn.dataset.day;
            btn.classList.toggle("active", day === this.selectedDay);
            const sched = this.selectedStudent.schedule?.[day];
            const tag = btn.querySelector(".day-tag");
            if (tag) {
                tag.textContent = sched?.exercises?.length > 0 ? (sched.name || "TREINO") : "DESC";
            }
        });
    }

    renderBuilder() {
        if (!this.selectedStudent) return;
        const dayData = this.selectedStudent.schedule[this.selectedDay] || { name: "", exercises: [] };
        document.getElementById("day-workout-name").value = dayData.name || "";

        const zone = document.getElementById("active-workout-builder");
        if (dayData.exercises.length === 0) {
            zone.innerHTML = `<p class="drop-hint">Arraste exercícios da biblioteca para cá</p>`;
        } else {
            zone.innerHTML = dayData.exercises.map((ex, i) => `
                <div class="list-item" onclick="app.inspectExercise('${ex.guid}')">
                    <span>${i + 1}. ${ex.name}</span>
                    <i data-lucide="trash-2" size="14" class="edit-icon" onclick="event.stopPropagation(); app.removeExercise('${ex.guid}')"></i>
                </div>
            `).join("");
        }

        // Reset inspector
        document.getElementById("inspector-content").classList.add("hidden");
        document.querySelector(".inspector-empty").classList.remove("hidden");

        lucide.createIcons();
        this.initDragDrop();
    }

    inspectExercise(guid) {
        this.activeExEdit = this.selectedStudent.schedule[this.selectedDay].exercises.find(e => e.guid === guid);
        if (!this.activeExEdit) return;

        document.querySelector(".inspector-empty").classList.add("hidden");
        document.getElementById("inspector-content").classList.remove("hidden");

        document.getElementById("ins-name").textContent = this.activeExEdit.name;
        document.getElementById("ins-series").value = this.activeExEdit.series || "3x";
        document.getElementById("ins-reps").value = this.activeExEdit.metaReps || "";

        const libEx = this.library.find(l => l.name.toUpperCase() === this.activeExEdit.name.toUpperCase());
        const vid = this.ytId(libEx?.videoId);
        const vidBox = document.getElementById("inspector-video");
        if (vid) {
            vidBox.innerHTML = `<iframe src="https://www.youtube.com/embed/${vid}?mute=1" allowfullscreen></iframe>`;
        } else {
            vidBox.innerHTML = `<p style="color:var(--text-muted); padding:20px; text-align:center; font-size:0.8rem">Sem vídeo</p>`;
        }
    }

    async saveInspector() {
        if (!this.activeExEdit) return;
        this.activeExEdit.series = document.getElementById("ins-series").value;
        this.activeExEdit.metaReps = document.getElementById("ins-reps").value;
        await this.persistStudent();
        this.toast("Treino atualizado!");
    }

    onDayNameChange(e) {
        if (!this.selectedStudent) return;
        this.selectedStudent.schedule[this.selectedDay].name = e.target.value.toUpperCase();
        this.persistStudent();
        this.paintWeek();
    }

    removeExercise(guid) {
        const exs = this.selectedStudent.schedule[this.selectedDay].exercises;
        this.selectedStudent.schedule[this.selectedDay].exercises = exs.filter(e => e.guid !== guid);
        this.persistStudent();
        this.renderBuilder();
    }

    addExerciseToDay(libEx, index) {
        const ex = {
            guid: "g" + Date.now(),
            name: libEx.name,
            series: libEx.defaultSeries || "3x",
            metaReps: "",
            weight: 0
        };
        const exs = this.selectedStudent.schedule[this.selectedDay].exercises;
        exs.splice(index, 0, ex);
        this.persistStudent();
        this.renderBuilder();
    }

    initDragDrop() {
        const lib = document.getElementById("exercise-library");
        const drop = document.getElementById("active-workout-builder");
        if (!lib || !drop) return;

        if (Sortable.get(lib)) Sortable.get(lib).destroy();
        if (Sortable.get(drop)) Sortable.get(drop).destroy();

        new Sortable(lib, { group: { name: "titan", pull: "clone", put: false }, sort: false, animation: 150 });
        new Sortable(drop, {
            group: "titan",
            animation: 150,
            onAdd: (evt) => {
                const libEx = this.library.find(e => e.id === evt.item.dataset.id);
                if (libEx) this.addExerciseToDay(libEx, evt.newIndex);
                evt.item.remove();
            }
        });
    }

    async persistStudent() {
        if (!this.selectedStudent) return;
        await db.collection("students").doc(this.selectedStudent.id).set(this.selectedStudent);
    }

    async loadHistory() {
        if (!this.selectedStudent) return;
        try {
            const snap = await db.collection("sessions")
                .where("studentId", "==", this.selectedStudent.id)
                .orderBy("timestamp", "desc")
                .limit(10)
                .get();
            document.getElementById("student-history-list").innerHTML = snap.docs.map(d => {
                const s = d.data();
                return `<div class="history-row"><span class="h-date">${s.date || "—"}</span><span class="h-vol">${((s.volume||0)/1000).toFixed(1)}t</span></div>`;
            }).join("");
        } catch (e) {
            document.getElementById("student-history-list").innerHTML =
                `<p style="font-size:0.75rem; color:var(--text-muted)">Crie o índice no Firebase para ver o histórico.</p>`;
        }
    }

    /* =========================
       LIBRARY
       ========================= */
    renderLibrary() {
        const el = document.getElementById("exercise-library");
        if (!el) return;
        el.innerHTML = this.library.map(ex => `
            <div class="list-item" data-id="${ex.id}">
                <span>${ex.name}</span>
                <i data-lucide="edit-3" size="14" class="edit-icon" onclick="event.stopPropagation(); app.openLibEditor('${ex.id}')"></i>
            </div>
        `).join("");
        lucide.createIcons();
        this.initDragDrop();
    }

    openLibEditor(id) {
        this.activeLibEdit = this.library.find(e => e.id === id);
        if (!this.activeLibEdit) return;
        document.getElementById("lib-edit-name").textContent = `Editar: ${this.activeLibEdit.name}`;
        document.getElementById("lib-edit-url").value = this.activeLibEdit.videoId || "";

        const vid = this.ytId(this.activeLibEdit.videoId);
        const preview = document.getElementById("lib-edit-preview");
        if (vid) {
            preview.innerHTML = `<iframe src="https://www.youtube.com/embed/${vid}?mute=1" allowfullscreen></iframe>`;
        } else {
            preview.innerHTML = "";
        }
        this.showOverlay("lib-editor-overlay");
    }

    async saveLibVideo() {
        if (!this.activeLibEdit) return;
        const url = document.getElementById("lib-edit-url").value;
        const vid = this.ytId(url) || url;
        await db.collection("library").doc(this.activeLibEdit.id).update({ videoId: vid });
        this.hideOverlay("lib-editor-overlay");
        this.toast("Vídeo global atualizado!");
    }

    async addNewExercise() {
        const name = document.getElementById("new-ex-name").value.trim();
        if (!name) { this.toast("Digite um nome!"); return; }
        const url = document.getElementById("new-ex-url").value.trim();
        const series = document.getElementById("new-ex-series").value.trim() || "3x";
        const id = "lib_" + Date.now();
        await db.collection("library").doc(id).set({
            name: name.toUpperCase(),
            videoId: this.ytId(url) || url,
            defaultSeries: series
        });
        document.getElementById("new-ex-name").value = "";
        document.getElementById("new-ex-url").value = "";
        this.hideOverlay("new-exercise-overlay");
        this.toast("Exercício adicionado!");
    }

    /* =========================
       UTILS
       ========================= */
    ytId(url) {
        if (!url) return "";
        if (url.length === 11 && !url.includes("/")) return url;
        if (url.includes("v=")) return url.split("v=")[1].split("&")[0];
        if (url.includes("youtu.be/")) return url.split("youtu.be/")[1].split("?")[0];
        if (url.includes("/shorts/")) return url.split("/shorts/")[1].split("?")[0];
        return url;
    }

    showOverlay(id) { document.getElementById(id).classList.remove("hidden"); }
    hideOverlay(id) {
        document.getElementById(id).classList.add("hidden");
        document.querySelectorAll(`#${id} iframe`).forEach(f => f.src = "");
    }

    toast(msg) {
        const el = document.createElement("div");
        el.className = "toast";
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    async importNewExercises() {
        const list = [
            "ALONGAMENTOS 2,31,30",
            "DEPRESSÃO ESCAPULAR PUXADA ALTA",
            "SUPINO INCLINADO MÁQUINA",
            "REMADA BAIXA PRONADA",
            "DESENVOLVIMENTO NA MÁQUINA",
            "PUXADA ALTA SUPINADA",
            "TRÍCEPS FRANCÊS COM HALTER - BISET",
            "BÍCEPS COM HALTERES NO BANCO INCLINADO - BISET",
            "ALONGAMENTOS 10,20,30",
            "ADUÇÃO DE ESCÁPULAS EM REMADA BAIXA",
            "REMADA NEUTRA NO BANCO INCLINADO - BISET",
            "SUPINO COM HALTERES INCLINADO - BISET",
            "REMADA MÁQUINA PRONADA",
            "CRUCIFIXO NA MÁQUINA",
            "TRÍCEPS CROSSOVER APOIADO - BISET",
            "BÍCEPS COM HALTERES - BISET",
            "EXTENSÃO DE TRONCO MÁQUINA",
            "ALONGAMENTOS 13,18,31",
            "GLÚTEO OSTRA",
            "ELEVAÇÃO PÉLVICA",
            "AGACHAMENTO HACK ANGULAR",
            "CADEIRA FLEXORA",
            "CADEIRA EXTENSORA",
            "LEG PRESS HORIZONTAL PANTURRILHA"
        ];

        for (const name of list) {
            const id = "lib_" + name.replace(/\s+/g, '_').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            await db.collection("library").doc(id).set({
                name: name.toUpperCase(),
                videoId: "",
                defaultSeries: "3x"
            }, { merge: true });
        }
    }
}

const app = new TitanApp();
