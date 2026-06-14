from flask import Flask, send_file, abort
from gtts import gTTS
import os
import sqlite3

app = Flask(__name__)
DB_PATH = "/Users/shabirdewji/python/phoneqr/quran.db"

CACHE_DIR = "static/en_audio"
os.makedirs(CACHE_DIR, exist_ok=True)

def generate_all_audio():

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT surah, ayah, text FROM quran")
    rows = cursor.fetchall()

    print(f"Total ayahs: {len(rows)}")

    for i, (surah, ayah, text) in enumerate(rows):

        filename = f"{int(surah):03d}_{int(ayah):03d}.mp3"
        path = os.path.join(CACHE_DIR, filename)

        if os.path.exists(path):
            continue

        try:
            print(f"Generating {filename} ({i+1}/{len(rows)})")

            tts = gTTS(text=text, lang="en")
            tts.save(path)

        except Exception as e:
            print(f"FAILED {surah}:{ayah}", e)

    conn.close()
    print("DONE ✅")


if __name__ == "__main__":
    generate_all_audio()