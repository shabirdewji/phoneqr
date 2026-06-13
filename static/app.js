let ayahs = [];
let currentIndex = 0;
let playing = false;
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


function speakEnglish(text)
{
    return new Promise((resolve) => {

        const speak = () => {

            const utter = new SpeechSynthesisUtterance(text);

            utter.lang = "en-US";
            utter.rate = 0.95;
            utter.pitch = 1;

            utter.onend = () => resolve();
            utter.onerror = () => resolve();

            speechSynthesis.speak(utter);
        };

        // 🔥 iOS fix: wait for voices to load
        let voices = speechSynthesis.getVoices();

        if (voices.length === 0) {
            speechSynthesis.onvoiceschanged = () => {
                speak();
            };
        } else {
            speak();
        }
    });
}


async function playArabicAudio(id, surah, ayah)
{
    const audio = document.getElementById("audioPlayer");
    const reciter = settings.reciter;

    const url = `https://everyayah.com/data/${reciter}/${id}.mp3`;

    return new Promise((resolve) => {

        let finished = false;

        const finish = () => {
            if (finished) return;
            finished = true;

            audio.pause();
            audio.onended = null;
            audio.onerror = null;

            resolve();
        };

        // 🔥 HARD SAFETY: never rely on canplaythrough
        audio.pause();
        audio.src = url;
        audio.currentTime = 0;

        const tryPlay = () => {
            const playPromise = audio.play();

            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        // normal flow
                    })
                    .catch((err) => {
                        console.warn("Play blocked:", err);
                        finish(); // DON'T freeze loop
                    });
            }
        };

        audio.onended = finish;
        audio.onerror = finish;

        // 🔥 iOS FIX: play immediately (no canplaythrough)
        tryPlay();

        // 🔥 fallback so it NEVER freezes loop
        setTimeout(() => {
            if (!finished) {
                console.warn("Audio timeout fallback");
                finish();
            }
        }, 20000);
    });
}

async function playAyah(ayah)
{

    const playArabic = settings.playArabic;
    const playEnglish = settings.playEnglish;
    const reciter = settings.reciter;

    const id = buildId(ayah.surah, ayah.ayah);

    console.log("START AYAH", ayah.ayah);
    console.log("Arabic:", playArabic, "English:", playEnglish);
    console.log("Ayah:", ayah);

    highlightAyah(ayah.surah, ayah.ayah); // 🔥 move here FIRST

    if (playArabic)
    {
    await playArabicAudio(id, ayah.surah, ayah.ayah);
    }

    console.log("AFTER ARABIC");

    highlightAyah(ayah.surah, ayah.ayah);

    if (playEnglish)
    {
        await speakEnglish(ayah.text);
    }
}

async function playSurah()
{
    stopRequested = false;
    currentIndex = 0;



    for (let i = 0; i < ayahs.length; i++)
    {
        if (stopRequested) break;

        currentIndex = i;

        console.log("Playing ayah index:", i);
        await playAyah(ayahs[i]);
    }
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