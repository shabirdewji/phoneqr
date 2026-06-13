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

window.onload = loadSurah;


// function speakNext(){
//     if(!playing) return;
//     if(currentIndex >= ayahs.length){
//         document.getElementById("status")
//                 .innerText = "Finished";
//         playing = false;
//         return;
//     }

//     let ayah = ayahs[currentIndex];

//     document.querySelectorAll(".ayah")
//             .forEach(a => a.classList.remove("active"));

//     let row = document.getElementById(`ayah-${ayah.surah}-${ayah.ayah}`)

//     row.classList.add("active");

//     row.scrollIntoView({
//         behavior:"smooth",
//         block:"center"
//     });

//     document.getElementById("status")
//             .innerText =
//             `Reading Ayah ${ayah.ayah}`;

//     let utter =
//         new SpeechSynthesisUtterance(
//             ayah.text
//         );

//     utter.rate = 0.95;
//     utter.pitch = 1;

//     utter.onend = function(){

//         currentIndex++;
//         speakNext();
//     };

//     speechSynthesis.speak(utter);
// }




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
    return new Promise(resolve => {

        speechSynthesis.cancel(); // 🔥 IMPORTANT RESET

        let utter = new SpeechSynthesisUtterance(text);
        utter.lang = "en-US";

        let finished = false;

        const done = () => {
            if (finished) return;
            finished = true;
            resolve();
        };

        utter.onend = () => {
            console.log("ENGLISH ONEND");
            done();
        };

        utter.onerror = (e) => {
            console.log("ENGLISH ERROR", e);
            done();
        };

        speechSynthesis.speak(utter);

        // 🔥 SAFETY NET (Chrome bug workaround)
        setTimeout(() => {
            if (!finished) {
                console.warn("ENGLISH TIMEOUT FALLBACK");
                done();
            }
        }, 8000);
    });
}

async function playArabicAudio(id, surah, ayah)
{
    const audio = document.getElementById("audioPlayer");
    const reciter = document.getElementById("reciter").value;

    const url = `https://everyayah.com/data/${reciter}/${id}.mp3`;

    return new Promise((resolve) => {

        let finished = false;

        const cleanup = () => {
            audio.onended = null;
            audio.onerror = null;
            audio.oncanplaythrough = null;
        };

        audio.pause();
        audio.currentTime = 0;
        audio.src = url;

        audio.oncanplaythrough = async () => {
            try {
                await audio.play();
            } catch (e) {
                console.error("Audio play blocked:", e);
                finish(); // continue anyway
            }
        };

        audio.onended = finish;
        audio.onerror = finish;

        function finish() {
            if (finished) return;
            finished = true;
            cleanup();
            resolve();
        }

        // 🔥 SAFETY NET (prevents infinite lock)
        setTimeout(() => {
            if (!finished) {
                console.warn("Audio timeout fallback triggered");
                finish();
            }
        }, 15000);
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

    speechSynthesis.cancel();

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

        await playAyah(ayahs[i]);
    }
}

function stopReading()
{
    stopRequested = true;

    const audio = document.getElementById("audioPlayer");
    audio.pause();
    audio.currentTime = 0;

    speechSynthesis.cancel();
}

function loadSettings() {
    const saved = localStorage.getItem("quranSettings");
    if (saved) {
        settings = JSON.parse(saved);
    }
}

function saveSettings() {
    settings.playArabic = document.getElementById("setArabic").checked;
    settings.playEnglish = document.getElementById("setEnglish").checked;
    settings.reciter = document.getElementById("setReciter").value;

    localStorage.setItem("quranSettings", JSON.stringify(settings));

    closeSettings();
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

document.getElementById("setFontSize").addEventListener("input", (e) => {
    const size = e.target.value;

    document.querySelectorAll(".ayah").forEach(el => {
        el.style.fontSize = size + "px";
    });

    document.getElementById("fontSizeLabel").innerText = size + "px";
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

