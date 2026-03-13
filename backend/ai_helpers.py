import httpx
import os

def get_sarvam_lang_code(code):
    if code == 'en': return 'en-IN'
    if not code: return 'en-IN'
    return f"{code}-IN"

async def gemini_chat(system_prompt: str, user_prompt: str, image_b64: str = None, audio_b64: str = None, use_search: bool = False) -> str:
    api_key = os.environ.get("GEMINI_API_KEY")
    # Use gemini-2.0-flash for better performance and search tool support
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    parts = []
    
    if image_b64:
        if image_b64.startswith("data:"):
            mime_type = image_b64.split(";")[0].split(":")[1]
            b64_data = image_b64.split(",")[1]
            parts.append({"inlineData": {"mimeType": mime_type, "data": b64_data}})
        else:
            parts.append({"inlineData": {"mimeType": "image/jpeg", "data": image_b64}})
            
    if audio_b64:
        if audio_b64.startswith("data:"):
            mime_type = audio_b64.split(";")[0].split(":")[1]
            b64_data = audio_b64.split(",")[1]
            parts.append({"inlineData": {"mimeType": mime_type, "data": b64_data}})
        else:
            parts.append({"inlineData": {"mimeType": "audio/webm", "data": audio_b64}})
            
    parts.append({"text": user_prompt})
    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "systemInstruction": {"role": "user", "parts": [{"text": system_prompt}]}
    }
    
    if use_search:
        payload["tools"] = [{"googleSearchThumbnail": {}}] if "Thumbnail" in os.environ.get("GEMINI_SEARCH_TYPE", "") else [{"googleSearchRetrieval": {}}]

    async with httpx.AsyncClient() as client:
        res = await client.post(url, json=payload, timeout=60.0)
        data = res.json()
        if "candidates" in data:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        raise Exception(f"Gemini error: {data}")

async def sarvam_translate(text: str, source: str, target: str) -> str:
    if source == target: return text
    api_key = os.environ.get("SARVAM_API_KEY")
    url = "https://api.sarvam.ai/translate"
    payload = {
        "input": text,
        "source_language_code": get_sarvam_lang_code(source),
        "target_language_code": get_sarvam_lang_code(target),
        "speaker_gender": "Female",
        "mode": "formal",
        "model": "sarvam-translate"
    }
    head = {"api-subscription-key": api_key, "Content-Type": "application/json"}
    async with httpx.AsyncClient() as client:
        res = await client.post(url, json=payload, headers=head, timeout=60.0)
        data = res.json()
        return data.get("translated_text", text)

async def sarvam_tts(text: str, target_lang: str) -> str:
    api_key = os.environ.get("SARVAM_API_KEY")
    url = "https://api.sarvam.ai/text-to-speech"
    payload = {
        "inputs": [text],
        "target_language_code": get_sarvam_lang_code(target_lang),
        "speaker": "meera",
        "pitch": 0,
        "pace": 1.2,
        "loudness": 1.5,
        "speech_sample_rate": 8000,
        "enable_preprocessing": True,
        "model": "bulbul:v1"
    }
    head = {"api-subscription-key": api_key, "Content-Type": "application/json"}
    async with httpx.AsyncClient() as client:
        res = await client.post(url, json=payload, headers=head, timeout=60.0)
        data = res.json()
        if "audios" in data and data["audios"]:
            return data["audios"][0]
        else:
            raise Exception(f"Sarvam error: {data}")
