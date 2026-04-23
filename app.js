// --- TITAN LOAD CLOUD ARCHITECTURE PRO (RELOADED LUX) ---

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
        console.log("TITAN LOAD LUX v1.0.5 - DEPLOYED 19:10");
        this.students = [];
        this.library = [];
        this.currentUser = null;
        this.selectedStudent = null;
        this.selectedDay = "SEG";
        this.sessionSets = [];
        this.activeWorkout = null;
        
        window.app = this;
        this.init();
    }

    async init() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                await this.handleUserLogin(user);
            } else {
                this.switchScreen('login-screen');
            }
        });
        this.setupListeners();
    }

    async handleUserLogin(user) {
        db.collection("library").onSnapshot(snap => {
            this.library = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });

        const doc = await db.collection("students").doc(user.uid).get();
        if (!doc.exists) {
            this.currentUser = { id: user.uid, name: user.displayName, email: user.email, schedule: this.emptySchedule(), stats: { totalWorkouts: 0, volume: 0, records: 0 }};
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
        ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"].forEach(day => { sched[day] = { name: "TREINO", exercises: [] }; });
        return sched;
    }

    setupListeners() {
        document.getElementById('google-login-btn').onclick = () => this.login();
        document.getElementById('goto-trainer-btn').onclick = () => this.switchScreen('trainer-screen');
        document.getElementById('back-to-app').onclick = () => this.switchScreen('home-screen');
        document.getElementById('add-set-btn').onclick = () => this.addSet();
        document.getElementById('finish-workout').onclick = () => this.finishWorkout();
        document.getElementById('cancel-workout').onclick = () => this.switchScreen('home-screen');
        document.getElementById('close-summary').onclick = () => this.switchScreen('home-screen');
    }

    async login() {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
    }

    switchScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
        if (id === 'home-screen') this.renderAthleteHome();
    }

    // --- ATHLETE LUX ---
    renderAthleteHome() {
        if (!this.currentUser) return;
        document.getElementById('user-name').textContent = this.currentUser.name;
        document.getElementById('total-workouts').textContent = this.currentUser.stats.totalWorkouts;
        document.getElementById('total-volume').textContent = (this.currentUser.stats.volume/1000).toFixed(1) + 't';
        document.getElementById('total-records').textContent = this.currentUser.stats.records;

        const container = document.getElementById('workout-cards-container');
        const days = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
        container.innerHTML = days.map(day => {
            const data = this.currentUser.schedule[day];
            if(!data || data.exercises.length === 0) return "";
            return `
                <div class="workout-card" onclick="app.startWorkout('${day}')">
                    <div class="workout-card-body">
                        <span style="color:var(--primary); font-size:0.7rem; font-weight:800">${day}</span>
                        <h2>${data.name}</h2>
                        <p>${data.exercises.length} EXERCÍCIOS</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    startWorkout(day) {
        this.activeWorkout = this.currentUser.schedule[day];
        this.sessionSets = [];
        this.switchScreen('workout-screen');
        document.getElementById('active-workout-name').textContent = this.activeWorkout.name;
        this.renderExerciseFeed();
        this.updateProgressBar();
    }

    renderExerciseFeed() {
        const feed = document.getElementById('exercise-feed');
        feed.innerHTML = this.activeWorkout.exercises.map(ex => {
            const done = this.sessionSets.filter(s => s.id === ex.guid).length;
            const total = parseInt(ex.series) || 3;
            const isCompleted = done >= total;
            return `
                <div class="ex-card ${isCompleted ? 'completed' : ''}" onclick="app.showExecution('${ex.guid}')">
                    <div class="status-ring">
                        <i data-lucide="${isCompleted ? 'check' : 'play'}" size="18" color="${isCompleted ? '#bfff00' : '#777'}"></i>
                    </div>
                    <div class="info">
                        <h3>${ex.name}</h3>
                        <p>${done}/${total} SÉRIES FINALIZADAS</p>
                    </div>
                    ${isCompleted ? '' : '<i data-lucide="chevron-right" style="margin-left:auto; opacity:0.3"></i>'}
                </div>
            `;
        }).join('');
        lucide.createIcons();
    }

    updateProgressBar() {
        const totalSetsNeeded = this.activeWorkout.exercises.reduce((acc, ex) => acc + (parseInt(ex.series) || 3), 0);
        const done = this.sessionSets.length;
        const perc = Math.min((done / totalSetsNeeded) * 100, 100);
        document.getElementById('workout-progress-bar').style.width = perc + '%';
        
        if (perc >= 100) document.getElementById('finish-btn-container').classList.remove('hidden');
        else document.getElementById('finish-btn-container').classList.add('hidden');
    }

    showExecution(guid) {
        this.selectedEx = this.activeWorkout.exercises.find(e => e.guid === guid);
        const libEx = this.library.find(l => l.name.toUpperCase() === this.selectedEx.name.toUpperCase()) || this.selectedEx;
        
        document.getElementById('modal-name').textContent = this.selectedEx.name;
        document.getElementById('modal-prev-load').textContent = (this.selectedEx.weight || 0) + 'kg';
        document.getElementById('w-input').value = this.selectedEx.weight || "";
        document.getElementById('r-input').value = "";
        
        const vidID = this.extractYoutubeId(libEx.videoId);
        document.getElementById('modal-video-container').innerHTML = `<iframe src="https://www.youtube.com/embed/${vidID}?autoplay=1&mute=1&modestbranding=1&rel=0" frameborder="0" allowfullscreen></iframe>`;
        
        this.renderSetHistory();
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

        this.renderSetHistory();
        this.renderExerciseFeed();
        this.updateProgressBar();

        const done = this.sessionSets.filter(s => s.id === this.selectedEx.guid).length;
        const total = parseInt(this.selectedEx.series) || 3;

        if (done >= total) {
            this.toast("EXCELENTE SÉRIE! 🔥");
            setTimeout(() => {
                document.getElementById('exercise-overlay').classList.add('hidden');
                document.getElementById('modal-video-container').innerHTML = '';
            }, 1000);
        }
    }

    renderSetHistory() {
        const list = document.getElementById('modal-set-history');
        const sets = this.sessionSets.filter(s => s.id === this.selectedEx.guid);
        list.innerHTML = sets.map((s, i) => `
            <div class="set-row">
                <span>SÉRIE ${i+1}</span>
                <b>${s.w}kg x ${s.r}</b>
            </div>
        `).join('');
    }

    async finishWorkout() {
        const vol = this.sessionSets.reduce((acc, s) => acc + (s.w * s.r), 0);
        this.currentUser.stats.volume += vol;
        this.currentUser.stats.totalWorkouts++;
        await db.collection("sessions").add({ studentId: this.currentUser.id, date: new Date().toLocaleDateString('pt-BR'), volume: vol, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        await db.collection("students").doc(this.currentUser.id).set(this.currentUser);
        document.getElementById('sum-volume').textContent = (vol/1000).toFixed(1) + 't';
        this.switchScreen('summary-screen');
    }

    extractYoutubeId(url) {
        if(!url) return "";
        if(url.length === 11) return url;
        let id = "";
        if(url.includes('v=')) id = url.split('v=')[1].split('&')[0];
        else if(url.includes('youtu.be/')) id = url.split('youtu.be/')[1].split('?')[0];
        else if(url.includes('/shorts/')) id = url.split('/shorts/')[1].split('?')[0];
        return id;
    }

    syncUI() {
        if (!document.getElementById('home-screen').classList.contains('hidden')) this.renderAthleteHome();
        lucide.createIcons();
    }

    toast(msg) {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed; bottom:120px; left:50%; transform:translateX(-50%); background:var(--primary); color:#000; padding:12px 24px; border-radius:30px; font-weight:800; z-index:5000; box-shadow:0 0 20px var(--primary-dim);`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2500);
    }
}

const app = new TitanApp();
