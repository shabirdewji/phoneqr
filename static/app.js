let ayahs = [];
let currentIndex = 0;
let playing = false;
let stopRequested = false;


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
            <b>${a.ayah}</b><br>
            ${a.text}
        </div>`;
    });

    document.getElementById("ayahs").innerHTML = html;
}

document.getElementById("surahSelect")
        .addEventListener("change", loadSurah);

window.onload = loadSurah;


function speakNext(){
    if(!playing) return;
    if(currentIndex >= ayahs.length){
        document.getElementById("status")
                .innerText = "Finished";
        playing = false;
        return;
    }

    let ayah = ayahs[currentIndex];

    document.querySelectorAll(".ayah")
            .forEach(a => a.classList.remove("active"));

    let row =
        document.getElementById(
            `ayah-${ayah.ayah}`
        );

    row.classList.add("active");

    row.scrollIntoView({
        behavior:"smooth",
        block:"center"
    });

    document.getElementById("status")
            .innerText =
            `Reading Ayah ${ayah.ayah}`;

    let utter =
        new SpeechSynthesisUtterance(
            ayah.text
        );

    utter.rate = 0.95;
    utter.pitch = 1;

    utter.onend = function(){

        currentIndex++;
        speakNext();
    };

    speechSynthesis.speak(utter);
}




function buildId(surah, ayah)
{
    const s = String(surah).padStart(3, "0");
    const a = String(ayah).padStart(3, "0");

    return s + a;
}


function highlightAyah(surah, ayah)
{
    document.querySelectorAll(".ayah")
        .forEach(a => a.classList.remove("active"));

    const el = document.getElementById(`ayah-${surah}-${ayah}`);

    if (!el) {
        console.log("Highlight NOT FOUND:", surah, ayah);
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
    const playArabic = document.getElementById("playArabic")?.checked;
    const playEnglish = document.getElementById("playEnglish")?.checked;

    const id = buildId(ayah.surah, ayah.ayah);

    console.log("START AYAH", ayah.ayah);
    console.log("Arabic:", playArabic, "English:", playEnglish);
    console.log("Ayah:", ayah);

    if (playArabic)
    {
       await playArabicAudio(id, ayah.surah, ayah.ayah);
        if (stopRequested) return;
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