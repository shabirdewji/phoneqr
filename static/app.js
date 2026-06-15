let ayahs = [];

let settings = {
    playArabic: true,
    playEnglish: true,
    reciter: "Alafasy_128kbps",
    fontSize: 16
};

let playerState = {
    index: 0,
    running: false,
    stop: false
};

let voices = [];


window.addEventListener("DOMContentLoaded", async () => {
    loadSettings();
    await loadSurah();
    applySettings();

    UI.init();
    initVoices();
});

// resume audio context on first click (iOS fix)
document.body.addEventListener("click", () => {
    speechSynthesis.resume();
}, { once: true });

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function logToServer(msg) {
    fetch("/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msg })
    });
}

async function loadSurah() {
    const surahEl = document.getElementById("surahSelect");
    if (!surahEl) return;

    const surah = surahEl.value;

    const res = await fetch(`/surah/${surah}`);
    const data = await res.json();

    ayahs = data.ayahs;
    console.log("FIRST AYAH:", ayahs[0]);

    document.getElementById("status").innerText =
        `Surah ${data.surah_number} - ${data.surah_name}`;

    document.getElementById("ayahs").innerHTML =
        ayahs.map(a => `
            <div class="ayah" id="ayah-${a.surah}-${a.ayah}">
                <b>${a.ayah}</b>. ${a.text}
            </div>
        `).join("");
}

function buildId(surah, ayah) {
    return String(surah).padStart(3, "0") +
           String(ayah).padStart(3, "0");
}

async function playSurah() {
    playerState.stop = false;
    playerState.running = true;
    playerState.index = 0;

    while (playerState.index < ayahs.length && !playerState.stop) {
        const ayah = ayahs[playerState.index];

        highlightAyah(ayah.surah, ayah.ayah);

        logToServer("PLAYING AYAH " + playerState.index);

        await playAyahEngine(ayah);

        if (playerState.stop) break;

        playerState.index++;
    }

    playerState.running = false;
}

async function playAyahEngine(ayah) {

    console.log("START", ayah.ayah);

    const id = buildId(ayah.surah, ayah.ayah);

    if (settings.playArabic) {
        console.log("Arabic start");
        await playArabicSafe(id);
        console.log("Arabic done");
        await sleep(300);
    }

    if (settings.playEnglish) {
        console.log("English start");
        await speak(ayah.text);
        console.log("English done");
    }

    console.log("END", ayah.ayah);
}

/* ---------------- ARABIC AUDIO ---------------- */

async function playArabicSafe(id) {
    const audio = document.getElementById("audioPlayer");
    const reciter = settings.reciter;

    const url = `https://everyayah.com/data/${reciter}/${id}.mp3`;

    return new Promise((resolve) => {

        let done = false;

        const finish = async () => {
            if (done) return;
            done = true;

            audio.onended = null;
            audio.onerror = null;

            audio.pause();
            audio.currentTime = 0;

            await sleep(150);

            resolve();
        };

        audio.onended = finish;
        audio.onerror = finish;

        audio.src = url;

        const p = audio.play();
        if (p) p.catch(finish);

        setTimeout(finish, 30000);
    });
}

/* ---------------- ENGLISH SPEECH ---------------- */

function initVoices() {
    const load = () => {
        voices = speechSynthesis.getVoices();
    };

    load();
    speechSynthesis.onvoiceschanged = load;
}

function speak(text) {
    return new Promise((resolve) => {

        if (!text) return resolve();

        const u = new SpeechSynthesisUtterance(text);

        u.lang = "en-US";
        u.rate = 0.95;
        u.pitch = 1;

        const voice = voices.find(v => v.lang.includes("en"));
        if (voice) u.voice = voice;

        let done = false;

        const finish = () => {
            if (done) return;
            done = true;
            resolve();
        };

        u.onend = finish;
        u.onerror = finish;

        // ⚠️ IMPORTANT: delay speech slightly on iOS
        setTimeout(() => {
            speechSynthesis.speak(u);
        }, 120);
    });
}

/* ---------------- STOP ---------------- */

function stopReading() {
    playerState.stop = true;
    playerState.running = false;

    const audio = document.getElementById("audioPlayer");
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }

    speechSynthesis.cancel();
}

/* ---------------- UI ---------------- */

function highlightAyah(surah, ayahNumber) {
    document.querySelectorAll(".ayah.active")
        .forEach(a => a.classList.remove("active"));

    const el = document.getElementById(`ayah-${surah}-${ayahNumber}`);

    if (!el) return;

    el.classList.add("active");

    el.scrollIntoView({
        behavior: "auto",
        block: "center"
    });
}

/* ---------------- SETTINGS ---------------- */

function loadSettings() {
    const saved = localStorage.getItem("quranSettings");

    if (saved) {
        settings = JSON.parse(saved);
    }

    applySettings();
}

function applySettings() {
    document.querySelectorAll(".ayah").forEach(el => {
        el.style.fontSize = settings.fontSize + "px";
    });
}

/* ---------------- SETTINGS UI ---------------- */

window.addEventListener("DOMContentLoaded", () => {

    const bind = (id, key, type = "value") => {
        const el = document.getElementById(id);
        if (!el) return;

        el.addEventListener(type === "checkbox" ? "change" : "input", () => {

            settings[key] = type === "checkbox" ? el.checked : el.value;

            localStorage.setItem("quranSettings", JSON.stringify(settings));

            applySettings();
        });
    };

    bind("setArabic", "playArabic", "checkbox");
    bind("setEnglish", "playEnglish", "checkbox");
    bind("setReciter", "reciter");
    bind("setFontSize", "fontSize");

});



const UI = {
    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById("playBtn")
            ?.addEventListener("click", () => playSurah());

        document.getElementById("stopBtn")
            ?.addEventListener("click", () => stopReading());

        document.getElementById("gearIcon")
            ?.addEventListener("click", () => UI.openSettings());

        document.getElementById("closeSettingsBtn")
            ?.addEventListener("click", () => UI.closeSettings());

        document.getElementById("surahSelect")
            ?.addEventListener("change", loadSurah);
    },

    openSettings() {
        document.getElementById("settingsModal").classList.remove("hidden");

        document.getElementById("setArabic").checked = settings.playArabic;
        document.getElementById("setEnglish").checked = settings.playEnglish;
        document.getElementById("setReciter").value = settings.reciter;

        document.getElementById("setFontSize").value = settings.fontSize;

        document.getElementById("fontSizeLabel").innerText =
            settings.fontSize + "px";
    },

    closeSettings() {
        document.getElementById("settingsModal").classList.add("hidden");
    }
};

