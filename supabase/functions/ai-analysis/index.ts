import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    const sarvamKey = Deno.env.get('SARVAM_API_KEY')

    if (!geminiKey || !sarvamKey) {
      throw new Error('API keys are missing in environment')
    }

    const { type, image_b64, audio_b64, language, ph, user_msg, system_msg } = await req.json()

    // --- SARVAM TTS (Text to Speech) ---
    if (type === 'tts') {
      const sarvamRes = await fetch("https://api.sarvam.ai/text-to-speech", {
        method: "POST",
        headers: {
          "api-subscription-key": sarvamKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs: [user_msg],
          target_language_code: language.includes("-") ? language.split("-")[0] + "-IN" : language + "-IN",
          speaker: "meera",
          pitch: 0,
          pace: 1.2,
          loudness: 1.5,
          speech_sample_rate: 8000,
          enable_preprocessing: true,
          model: "bulbul:v1"
        })
      });
      const data = await sarvamRes.json()
      if (data.audios && data.audios.length > 0) {
        return new Response(JSON.stringify({ audio_base64: data.audios[0] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      throw new Error("TTS failed")
    }

    // --- GEMINI ANALYSIS (Image/Audio/Text) ---
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`
    let parts = []

    if (image_b64) {
      const mime = image_b64.startsWith("data:") ? image_b64.split(";")[0].split(":")[1] : "image/jpeg"
      const data = image_b64.startsWith("data:") ? image_b64.split(",")[1] : image_b64
      parts.push({ inlineData: { mimeType: mime, data: data } })
    }

    if (audio_b64) {
      const mime = audio_b64.startsWith("data:") ? audio_b64.split(";")[0].split(":")[1] : "audio/webm"
      const data = audio_b64.startsWith("data:") ? audio_b64.split(",")[1] : audio_b64
      parts.push({ inlineData: { mimeType: mime, data: data } })
    }

    parts.push({ text: user_msg })

    const geminiPayload = {
      contents: [{ role: "user", parts: parts }],
    }
    if (system_msg) {
      geminiPayload.systemInstruction = { role: "user", parts: [{ text: system_msg }] }
    }

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload)
    });

    const geminiData = await geminiRes.json()
    if (geminiData.candidates && geminiData.candidates[0]) {
      const txt = geminiData.candidates[0].content.parts[0].text
      return new Response(JSON.stringify({ text: txt }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error('Gemini API failed: ' + JSON.stringify(geminiData))

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
