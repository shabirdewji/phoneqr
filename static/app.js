let ayahs = [];
let currentIndex = 0;
let stopRequested = false;

let settings = {
    playArabic: true,
    playEnglish: true,
    reciter: "Alafasy_128kbps",
    fontSize: 20
};

window.onload = () => {
    loadSettings();
    loadSurah();
};

document.body.addEventListener("click", () => {
    speechSynthesis.resume();
}, { once: true });

function sleep(ms)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

function logToServer(msg) {
    fetch("/log", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ msg })
    });
}

async function loadSurah()
{
    let surah = document.getElementById("surahSelect").value;

    let res = await fetch(`/surah/${surah}`);
    let data = await res.json();

    ayahs = data.ayahs;
    
    document.getElementById("status").innerText =
    `Surah ${data.surah_number} - ${data.surah_name}`;

    let html = "";

    ayahs.forEach(a => {
        html += `
        <div class="ayah" id="ayah-${a.surah}-${a.ayah}">
            <b>${a.ayah}</b>.
            ${a.text}
        </div>`;
    });

    document.getElementById("ayahs").innerHTML = html;
}

document.getElementById("surahSelect")
        .addEventListener("change", loadSurah);



function buildId(surah, ayah)
{
    const s = String(surah).padStart(3, "0");
    const a = String(ayah).padStart(3, "0");

    return s + a;
}

async function playSurah()
{
    stopRequested = false;

    for (let i = 0; i < ayahs.length; i++)
    {
        if (stopRequested) break;

        currentIndex = i;

        await playAyahQueue(ayahs[i]);

        await sleep(250);
    }
}

function highlightAyah(surah, ayahNumber)
{
    document.querySelectorAll(".ayah")
        .forEach(a => a.classList.remove("active"));

    const el = document.getElementById(`ayah-${surah}-${ayahNumber}`);

    if (!el) {
        console.log("Highlight NOT FOUND:", surah, ayahNumber);
        return;
    }

    el.classList.add("active");

    el.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

async function speakEnglishSafe(text)
{
    return new Promise((resolve) => {

        speechSynthesis.cancel();

        const utter = new SpeechSynthesisUtterance(text);

        utter.lang = "en-US";
        utter.rate = 0.95;

        let done = false;

        const finish = () => {
            if (done) return;
            done = true;
            resolve();
        };

        utter.onend = finish;
        utter.onerror = finish;

        speechSynthesis.speak(utter);

        // 🔥 iPhone safety fallback
        setTimeout(finish, 6000);
    });
}


async function playAyahQueue(ayah)
{
    logToServer("START AYAH " + ayah.ayah);

    const playArabic = settings.playArabic;
    const playEnglish = settings.playEnglish;

    const id = buildId(ayah.surah, ayah.ayah);

    console.log("START AYAH", ayah.ayah);

    highlightAyah(ayah.surah, ayah.ayah);

    if (playArabic)
    {
        await playArabicAudioSafe(id);
        await sleep(200);
    }

    console.log("AFTER ARABIC");

    if (playEnglish)
    {
        await speakEnglishSafe(ayah.text);
        await sleep(200);
    }
}

async function playArabicAudioSafe(id)
{
    const audio = document.getElementById("audioPlayer");
    const reciter = settings.reciter;

    const url = `https://everyayah.com/data/${reciter}/${id}.mp3`;

    audio.pause();
    audio.currentTime = 0;
    audio.src = url;

    return new Promise((resolve) => {

        let done = false;

        const finish = () => {
            if (done) return;
            done = true;

            audio.pause();
            audio.src = "";
            resolve();
        };

        audio.onended = () => {
            console.log("ARABIC END");
            finish();
        };

        audio.onerror = () => finish();

        // 🔥 IMPORTANT: wait for real playback start
        const p = audio.play();

        if (p !== undefined)
        {
            p.then(() => {
                console.log("ARABIC STARTED");
            }).catch(() => {
                console.log("ARABIC PLAY BLOCKED");
                finish();
            });
        }

        // 🔥 HARD SAFETY TIMEOUT (iPhone fallback)
        setTimeout(() => {
            console.warn("ARABIC TIMEOUT FORCE NEXT");
            finish();
        }, 20000);
    });
}


function stopReading()
{
    stopRequested = true;

    const audio = document.getElementById("audioPlayer");
    audio.pause();
    audio.currentTime = 0;

    speechSynthesis.cancel(); // only here
}

function loadSettings() {
    const saved = localStorage.getItem("quranSettings");
    if (saved) {
        settings = JSON.parse(saved);
    }
}


function openSettings() {
    document.getElementById("settingsModal").classList.remove("hidden");

    // sync UI with current settings
    document.getElementById("setArabic").checked = settings.playArabic;
    document.getElementById("setEnglish").checked = settings.playEnglish;
    document.getElementById("setReciter").value = settings.reciter;
}

function closeSettings() {
    document.getElementById("settingsModal").classList.add("hidden");
}

function loadSettings() {
    const saved = localStorage.getItem("quranSettings");
    if (saved) {
        settings = JSON.parse(saved);
    }

    applySettings();
}

function saveSettings() {
    settings.playArabic = document.getElementById("setArabic").checked;
    settings.playEnglish = document.getElementById("setEnglish").checked;
    settings.reciter = document.getElementById("setReciter").value;
    settings.fontSize = document.getElementById("setFontSize").value;

    localStorage.setItem("quranSettings", JSON.stringify(settings));

    applySettings();
    closeSettings();
}

function applySettings() {

    document.querySelectorAll(".ayah").forEach(el => {
        el.style.fontSize = settings.fontSize + "px";
    });

    const label = document.getElementById("fontSizeLabel");
    if (label) label.innerText = settings.fontSize + "px";
}

function openSettings() {
    document.getElementById("settingsModal").classList.remove("hidden");

    document.getElementById("setArabic").checked = settings.playArabic;
    document.getElementById("setEnglish").checked = settings.playEnglish;
    document.getElementById("setReciter").value = settings.reciter;

    const slider = document.getElementById("setFontSize");
    slider.value = settings.fontSize;

    document.getElementById("fontSizeLabel").innerText = settings.fontSize + "px";
}

window.addEventListener("DOMContentLoaded", () => {

    document.getElementById("setFontSize").addEventListener("input", (e) => {
        const size = e.target.value;

        document.querySelectorAll(".ayah").forEach(el => {
            el.style.fontSize = size + "px";
        });

        document.getElementById("fontSizeLabel").innerText =
            size + "px";
    });

    const widget = document.getElementById("fontWidget");

    let isDragging = false;
    let offsetX, offsetY;

    widget.addEventListener("mousedown", (e) => {
        isDragging = true;
        offsetX = e.clientX - widget.offsetLeft;
        offsetY = e.clientY - widget.offsetTop;
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        widget.style.left = (e.clientX - offsetX) + "px";
        widget.style.top = (e.clientY - offsetY) + "px";
    });

    document.addEventListener("mouseup", () => {
        isDragging = false;
    });

    document.getElementById("quickFont").value = settings.fontSize;

    document.getElementById("quickFont").addEventListener("input", (e) => {
        settings.fontSize = e.target.value;

        document.querySelectorAll(".ayah").forEach(el => {
            el.style.fontSize = settings.fontSize + "px";
        });
    });

});