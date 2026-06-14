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

window.onload = async () => {
    loadSettings();
    await loadSurah();
    applySettings(); // 🔥 IMPORTANT
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
    playerState.stop = false;
    playerState.running = true;
    playerState.index = 0;

    while (
        playerState.index < ayahs.length &&
        !playerState.stop
    ) {
        const ayah = ayahs[playerState.index];

        console.log("▶ AYAH INDEX:", playerState.index);
        logToServer("PLAYING AYAH INDEX " + playerState.index);

        await playAyahEngine(ayah);

        playerState.index++;
    }

    playerState.running = false;

    console.log("🏁 FINISHED SURAH");
}




function playEnglishSafe(text)
{
    return new Promise((resolve) => {

        logToServer("ENGLISH FUNCTION ENTER");

        if (!('speechSynthesis' in window))
        {
            logToServer("NO SPEECH SYNTHESIS");
            resolve();
            return;
        }

        const utter = new SpeechSynthesisUtterance(text);

        utter.lang = "en-US";
        utter.rate = 0.95;

        let done = false;

        const finish = (reason) => {
            if (done) return;

            done = true;

            logToServer("ENGLISH FINISH: " + reason);

            resolve();
        };

        utter.onstart = () => {
            logToServer("ENGLISH ONSTART");
        };

        utter.onend = () => {
            logToServer("ENGLISH ONEND");
            finish("onend");
        };

        utter.onerror = (e) => {
            logToServer("ENGLISH ONERROR " + e.error);
            finish("onerror");
        };

        try
        {
            logToServer("CALLING SPEAK");
            speechSynthesis.speak(utter);



            setTimeout(() => {
                logToServer(
                    "after speak paused=" +
                    speechSynthesis.paused +
                    " speaking=" +
                    speechSynthesis.speaking +
                    " pending=" +
                    speechSynthesis.pending
                );
            }, 1000);



            logToServer("voices=" + speechSynthesis.getVoices().length);
            logToServer(
                        "paused=" + speechSynthesis.paused +
                        " speaking=" + speechSynthesis.speaking +
                        " pending=" + speechSynthesis.pending
                    );
        }
        catch(e)
        {
            logToServer("SPEAK EXCEPTION " + e);
            finish("exception");
        }

        setTimeout(() => {
            finish("timeout");
        }, 10000);
    });
}

function playArabicSafe(id)
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

            audio.onended = null;
            audio.onerror = null;

            resolve();
        };

        audio.onended = finish;
        audio.onerror = finish;

        const p = audio.play();

        if (p) {
            p.catch(() => finish());
        }

        // 🔥 iPhone safety net
        setTimeout(() => {
            console.warn("ARABIC TIMEOUT");
            finish();
        }, 30000);
    });
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

async function playAyahEngine(ayah)
{
    const id = buildId(ayah.surah, ayah.ayah);

    console.log("START AYAH", ayah.ayah);

    highlightAyah(ayah.surah, ayah.ayah);

    // 🔥 ARABIC PHASE
    if (settings.playArabic)
    {
        await playArabicSafe(id);

        if (playerState.stop) return;
    }

    console.log("AFTER ARABIC");

    // 🔥 ENGLISH PHASE
if (settings.playEnglish)
    {
        logToServer("START ENGLISH " + ayah.ayah);

        await playEnglishSafe(ayah.text);

        logToServer("END ENGLISH " + ayah.ayah);

        if (playerState.stop) return;
    }

    console.log("END AYAH");
}





function stopReading()
{
    playerState.stop = true;
    playerState.running = false;

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

    applySettings();
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

function closeSettings() {
    document.getElementById("settingsModal").classList.add("hidden");
}


window.addEventListener("DOMContentLoaded", () => {

    const set = (id, event, key, isCheckbox = false) => {
        const el = document.getElementById(id);
        if (!el) return;

        el.addEventListener(event, () => {

            settings[key] = isCheckbox ? el.checked : el.value;

            localStorage.setItem("quranSettings", JSON.stringify(settings));

            applySettings();
        });
    };

    set("setArabic", "change", "playArabic", true);
    set("setEnglish", "change", "playEnglish", true);
    set("setReciter", "change", "reciter", false);
    set("setFontSize", "input", "fontSize", false);

    // optional: ensure UI matches stored settings
    document.getElementById("setArabic").checked = settings.playArabic;
    document.getElementById("setEnglish").checked = settings.playEnglish;
    document.getElementById("setReciter").value = settings.reciter;
    document.getElementById("setFontSize").value = settings.fontSize;
});

function applySettings() {

    document.querySelectorAll(".ayah").forEach(el => {
        el.style.fontSize = settings.fontSize + "px";
    });

    const label = document.getElementById("fontSizeLabel");
    if (label) label.innerText = settings.fontSize + "px";
}