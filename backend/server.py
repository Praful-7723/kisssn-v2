from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import os
import logging
import uuid
import httpx
import json
import base64
import bcrypt
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Supabase connection
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
db: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def _get_one(table: str, col: str, val: str):
    res = db.table(table).select("*").eq(col, val).execute()
    return res.data[0] if res.data else None

# API Keys
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
SARVAM_API_KEY = os.environ.get('SARVAM_API_KEY', '')
JWT_SECRET = os.environ.get('JWT_SECRET', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ AUTH HELPERS ============

async def get_current_user(request: Request):
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = _get_one("user_sessions", "session_token", session_token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = _get_one("users", "user_id", session["user_id"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ============ PYDANTIC MODELS ============

class RegisterInput(BaseModel):
    email: str
    password: str
    name: str

class LoginInput(BaseModel):
    email: str
    password: str

class FarmInfoUpdate(BaseModel):
    farm_name: Optional[str] = None
    farm_size: Optional[str] = None
    crops: Optional[List[str]] = None
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None
    location_name: Optional[str] = None

class ChatMessageInput(BaseModel):
    message: str
    language: Optional[str] = "en"

class CommunityPostInput(BaseModel):
    title: str
    content: str
    category: Optional[str] = "general"

# ============ AUTH ROUTES ============

@api_router.post("/auth/session")
async def auth_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = resp.json()
    user = _get_one("users", "email", data["email"])
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": data["email"],
            "name": data.get("name", ""),
            "picture": data.get("picture", ""),
            "farm_info": {},
            "location": {},
            "soil_profile": {},
            "language": "en",
            "onboarding_complete": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        db.table("users").insert(user).execute()
        user = _get_one("users", "user_id", user_id)
    session_token = data.get("session_token", str(uuid.uuid4()))
    db.table("user_sessions").insert({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }).execute()
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none", path="/", max_age=7*24*60*60
    )
    return user

@api_router.post("/auth/register")
async def register(input_data: RegisterInput, response: Response):
    existing = _get_one("users", "email", input_data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    hashed = bcrypt.hashpw(input_data.password.encode(), bcrypt.gensalt()).decode()
    user = {
        "user_id": user_id,
        "email": input_data.email,
        "name": input_data.name,
        "picture": "",
        "password_hash": hashed,
        "farm_info": {},
        "location": {},
        "soil_profile": {},
        "language": "en",
        "onboarding_complete": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    db.table("users").insert(user).execute()
    session_token = str(uuid.uuid4())
    db.table("user_sessions").insert({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }).execute()
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none", path="/", max_age=7*24*60*60
    )
    user_response = {k: v for k, v in user.items() if k != "password_hash"}
    return user_response

@api_router.post("/auth/login")
async def login(input_data: LoginInput, response: Response):
    user = _get_one("users", "email", input_data.email)
    if not user or "password_hash" not in user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not bcrypt.checkpw(input_data.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    session_token = str(uuid.uuid4())
    db.table("user_sessions").insert({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }).execute()
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none", path="/", max_age=7*24*60*60
    )
    user_response = {k: v for k, v in user.items() if k != "password_hash"}
    return user_response

@api_router.get("/auth/me")
async def auth_me(request: Request):
    user = await get_current_user(request)
    user_response = {k: v for k, v in user.items() if k != "password_hash"}
    return user_response

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if session_token:
        db.table("user_sessions").delete().eq("session_token", session_token).execute()
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ============ USER/FARM ROUTES ============

@api_router.put("/user/farm")
async def update_farm(farm_data: FarmInfoUpdate, request: Request):
    user = await get_current_user(request)
    update_dict = {k: v for k, v in farm_data.model_dump().items() if v is not None}
    location_update = user.get("location", {})
    if farm_data.location_lat is not None:
        location_update["lat"] = farm_data.location_lat
    if farm_data.location_lon is not None:
        location_update["lon"] = farm_data.location_lon
    if farm_data.location_name:
        location_update["name"] = farm_data.location_name
    
    farm_info = user.get("farm_info", {})
    farm_update = {k: v for k, v in update_dict.items() if not k.startswith("location_")}
    if farm_update:
        for k, v in farm_update.items():
            farm_info[k] = v

    set_dict = {"farm_info": farm_info, "location": location_update}
    db.table("users").update(set_dict).eq("user_id", user["user_id"]).execute()
    updated_user = _get_one("users", "user_id", user["user_id"])
    return {k: v for k, v in updated_user.items() if k != "password_hash"}

@api_router.put("/user/onboarding-complete")
async def complete_onboarding(request: Request):
    user = await get_current_user(request)
    db.table("users").update({"onboarding_complete": True}).eq("user_id", user["user_id"]).execute()
    return {"message": "Onboarding complete"}

@api_router.put("/user/language")
async def update_language(request: Request):
    body = await request.json()
    user = await get_current_user(request)
    db.table("users").update({"language": body.get("language", "en")}).eq("user_id", user["user_id"]).execute()
    return {"message": "Language updated"}

# ============ SOIL ROUTES ============

@api_router.post("/soil/estimate")
async def estimate_soil(request: Request):
    body = await request.json()
    lat = body.get("lat")
    lon = body.get("lon")
    if lat is None or lon is None:
        raise HTTPException(status_code=400, detail="lat and lon required")
    user = await get_current_user(request)
    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.get(
                "https://rest.isric.org/soilgrids/v2.0/properties/query",
                params={
                    "lon": lon, "lat": lat,
                    "property": ["phh2o", "soc", "clay", "sand", "silt"],
                    "depth": ["0-5cm", "5-15cm"],
                    "value": ["Q0.5", "mean"]
                }
            )
            if resp.status_code == 200:
                soil_data = resp.json()
                properties = soil_data.get("properties", {}).get("layers", [])
                soil_profile = {"source": "SoilGrids", "lat": lat, "lon": lon}
                for layer in properties:
                    prop_name = layer.get("name", "")
                    depths = layer.get("depths", [])
                    if depths:
                        values = depths[0].get("values", {})
                        mean_val = values.get("mean") or values.get("Q0.5")
                        if mean_val is not None:
                            if prop_name == "phh2o":
                                soil_profile["ph"] = round(mean_val / 10.0, 1)
                            elif prop_name == "soc":
                                soil_profile["organic_carbon"] = round(mean_val / 10.0, 1)
                            elif prop_name == "clay":
                                soil_profile["clay_pct"] = round(mean_val / 10.0, 1)
                            elif prop_name == "sand":
                                soil_profile["sand_pct"] = round(mean_val / 10.0, 1)
                            elif prop_name == "silt":
                                soil_profile["silt_pct"] = round(mean_val / 10.0, 1)
                # Estimate soil type from texture
                clay = soil_profile.get("clay_pct", 0)
                sand = soil_profile.get("sand_pct", 0)
                if sand > 70:
                    soil_profile["soil_type"] = "Sandy"
                elif clay > 40:
                    soil_profile["soil_type"] = "Clay"
                elif sand > 50:
                    soil_profile["soil_type"] = "Sandy Loam"
                elif clay > 25:
                    soil_profile["soil_type"] = "Clay Loam"
                else:
                    soil_profile["soil_type"] = "Loam"
                db.table("users").update({"soil_profile": soil_profile}).eq("user_id", user["user_id"]).execute()
                return soil_profile
            else:
                soil_profile = await _estimate_soil_with_ai(lat, lon)
                db.table("users").update({"soil_profile": soil_profile}).eq("user_id", user["user_id"]).execute()
                return soil_profile
    except Exception as e:
        logger.error(f"SoilGrids API error: {e}")
        soil_profile = await _estimate_soil_with_ai(lat, lon)
        db.table("users").update({"soil_profile": soil_profile}).eq("user_id", user["user_id"]).execute()
        return soil_profile

async def _estimate_soil_with_ai(lat, lon):
    try:
        from ai_helpers import gemini_chat
        prompt = f"""Estimate the soil properties for coordinates lat={lat}, lon={lon} in India.
Consider the geological region and typical soil data for these specific coordinates.
Return ONLY valid JSON with keys: 'soil_type', 'ph', 'organic_carbon', 'clay_pct', 'sand_pct', 'silt_pct', 'source'.
Set 'source' to 'AI Estimation'.
'ph' should be a float with 1 decimal.
Example: {{"soil_type": "Black Cotton", "ph": 7.4, "organic_carbon": 12.5, "clay_pct": 45, "sand_pct": 20, "silt_pct": 35, "source": "AI Estimation"}}"""
        res_json = await gemini_chat("You are a geological and soil science expert specializing in Indian agriculture.", prompt)
        import json
        # Clean potential markdown from response
        clean_json = res_json.strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json.split("```json")[1].split("```")[0].strip()
        elif clean_json.startswith("```"):
            clean_json = clean_json.split("```")[1].split("```")[0].strip()
        data = json.loads(clean_json)
        data["lat"] = lat
        data["lon"] = lon
        return data
    except Exception as e:
        logger.error(f"AI Soil Estimation failed: {e}")
        return _estimate_soil_by_region(lat, lon)

def _estimate_soil_by_region(lat, lon):
    if 8 <= lat <= 13:
        return {"soil_type": "Red Laterite", "ph": 6.2, "source": "regional_estimate", "lat": lat, "lon": lon}
    elif 13 <= lat <= 20:
        return {"soil_type": "Black Cotton", "ph": 7.5, "source": "regional_estimate", "lat": lat, "lon": lon}
    elif 20 <= lat <= 28:
        return {"soil_type": "Alluvial", "ph": 7.0, "source": "regional_estimate", "lat": lat, "lon": lon}
    else:
        return {"soil_type": "Loam", "ph": 6.8, "source": "regional_estimate", "lat": lat, "lon": lon}

@api_router.post("/soil/analyze-image")
async def analyze_soil_image(request: Request, file: UploadFile = File(...), ph: Optional[str] = Form(None), language: Optional[str] = Form("en")):
    user = await get_current_user(request)
    lang_name = {"en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu", "ml": "Malayalam", "mr": "Marathi"}.get(language, "English")
    image_bytes = await file.read()
    image_b64 = base64.b64encode(image_bytes).decode()
    try:
        from ai_helpers import gemini_chat
        sys_msg = f"""You are an expert soil scientist and agronomist. Analyze the soil image. 
Context provided by user: The estimated geological pH is {ph if ph else 'unknown'}. 
You MUST provide recommendations for fertilizer amounts specifically calculated per acre OR per cent.
Output ONLY valid JSON.
CRITICAL: ALL values inside the JSON, except keys themselves, MUST BE in the {lang_name} language."""
        
        user_msg = "Analyze this soil. Output JSON with these exact keys: 'soil_type', 'estimated_ph_range', 'texture', 'moisture_level', 'fertilizer_recommendation', 'recommended_crops'."
        
        response = await gemini_chat(sys_msg, user_msg, image_b64)
        
        try:
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("\n", 1)[1].rsplit("```", 1)[0]
            if clean_response.startswith("json"):
                clean_response = clean_response[4:].strip()
            result = json.loads(clean_response)
        except json.JSONDecodeError:
            result = {"soil_type": "Unknown", "estimated_ph_range": "Unknown", "error": "Failed to parse JSON", "raw": response}
            
        return result
    except Exception as e:
        logger.error(f"Soil image analysis error: {e}")
        return {"error": str(e), "soil_type": "Unknown", "estimated_ph_range": "6.0-7.0"}

@api_router.post("/soil/analyze-comprehensive")
async def analyze_soil_comprehensive(
    request: Request, 
    image: Optional[UploadFile] = File(None), 
    audio: Optional[UploadFile] = File(None), 
    ph: Optional[str] = Form(None), 
    language: Optional[str] = Form("en")
):
    user = await get_current_user(request)
    lang_name = {"en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu", "ml": "Malayalam", "mr": "Marathi"}.get(language, "English")
    
    image_b64 = None
    if image and image.size > 0:
        image_bytes = await image.read()
        image_b64 = base64.b64encode(image_bytes).decode()
        
    audio_b64 = None
    if audio and audio.size > 0:
        audio_bytes = await audio.read()
        audio_b64 = base64.b64encode(audio_bytes).decode()

    if not image_b64 and not audio_b64:
        return {"error": "Please provide an image or an audio description.", "soil_type": "Unknown", "estimated_ph_range": "Unknown"}

    try:
        from ai_helpers import gemini_chat, sarvam_tts
        sys_msg = f"""You are an expert soil scientist and Indian agronomist named Kissan AI.
Context provided by user: The estimated geological pH is {ph if ph else 'unknown'}. 
You will receive an image of soil AND/OR a voice note describing a soil related issue. Keep your recommendations highly practical.
You MUST provide a comprehensive analysis including:
1. Soil characteristics.
2. Recommended fertilizers (MUST include amounts specifically calculated per acre OR per cent).
3. Recommended crops with the exact number of days they take to grow/harvest based on climate context.
Output ONLY valid JSON.
CRITICAL: ALL values inside the JSON, except keys themselves, MUST BE translated to the {lang_name} language.
Use these EXACT keys: 'soil_type', 'estimated_ph_range', 'texture', 'moisture_level', 'fertilizer_recommendation', 'recommended_crops', 'summary_message'"""
        
        user_msg = "Analyze this input. Output JSON with the required keys."
        
        response = await gemini_chat(sys_msg, user_msg, image_b64=image_b64, audio_b64=audio_b64)
        
        try:
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("\n", 1)[1].rsplit("```", 1)[0]
            if clean_response.startswith("json"):
                clean_response = clean_response[4:].strip()
            result = json.loads(clean_response)
        except json.JSONDecodeError:
            result = {"soil_type": "Unknown", "estimated_ph_range": "Unknown", "error": "Failed to parse JSON", "raw": response}
            
        # Generating Sarvam Audio from the 'summary_message' or 'fertilizer_recommendation'
        text_to_speak = result.get('summary_message', "")
        if not text_to_speak and result.get('fertilizer_recommendation'):
            if isinstance(result['fertilizer_recommendation'], list):
                text_to_speak = ", ".join(result['fertilizer_recommendation'])
            else:
                text_to_speak = str(result['fertilizer_recommendation'])
        
        if text_to_speak:
            # slice to not break TTS
            if len(text_to_speak) > 300:
                text_to_speak = text_to_speak[:297] + "..."
            try:
                audio_res = await sarvam_tts(text_to_speak, target_lang=language)
                result["audio_url"] = f"data:audio/wav;base64,{audio_res}"
            except Exception as tts_e:
                logger.error(f"TTS error during comprehensive analysis: {tts_e}")
                
        return result
    except Exception as e:
        logger.error(f"Comprehensive analysis error: {e}")
        return {"error": str(e), "soil_type": "Unknown", "estimated_ph_range": "6.0-7.0"}

# ============ WEATHER ROUTES ============

@api_router.get("/weather")
async def get_weather(lat: float, lon: float):
    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            resp = await http_client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat, "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
                    "hourly": "temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,dew_point_2m",
                    "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,sunrise,sunset",
                    "timezone": "auto",
                    "forecast_days": 7
                }
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail="Weather API error")
            data = resp.json()
            current = data.get("current", {})
            hourly = data.get("hourly", {})
            daily = data.get("daily", {})
            temp = current.get("temperature_2m", 20)
            humidity = current.get("relative_humidity_2m", 50)
            wind = current.get("wind_speed_10m", 0)
            precip = current.get("precipitation", 0)
            dew_point_temps = hourly.get("dew_point_2m", [])
            current_dew_point = dew_point_temps[0] if dew_point_temps else temp - 5
            delta_t = temp - current_dew_point
            spraying = _calculate_spraying_conditions(temp, humidity, wind, precip, delta_t)
            hourly_planner = []
            for i in range(min(24, len(hourly.get("time", [])))):
                h_temp = hourly.get("temperature_2m", [0]*(i+1))[i]
                h_humidity = hourly.get("relative_humidity_2m", [50]*(i+1))[i]
                h_wind = hourly.get("wind_speed_10m", [0]*(i+1))[i]
                h_precip_prob = hourly.get("precipitation_probability", [0]*(i+1))[i]
                h_dew = hourly.get("dew_point_2m", [h_temp-5]*(i+1))[i]
                h_delta_t = h_temp - h_dew
                h_spray = _calculate_spraying_conditions(h_temp, h_humidity, h_wind, 0 if h_precip_prob < 30 else 1, h_delta_t)
                hourly_planner.append({
                    "time": hourly["time"][i] if i < len(hourly.get("time", [])) else "",
                    "temp": h_temp,
                    "humidity": h_humidity,
                    "wind": h_wind,
                    "precip_prob": h_precip_prob,
                    "delta_t": round(h_delta_t, 1),
                    "status": h_spray["status"],
                    "color": h_spray["color"]
                })
            return {
                "current": {
                    "temperature": temp,
                    "feels_like": current.get("apparent_temperature", temp),
                    "humidity": humidity,
                    "wind_speed": wind,
                    "wind_direction": current.get("wind_direction_10m", 0),
                    "precipitation": precip,
                    "weather_code": current.get("weather_code", 0),
                    "weather_desc": _weather_code_to_desc(current.get("weather_code", 0))
                },
                "spraying": spraying,
                "hourly_planner": hourly_planner,
                "daily": {
                    "time": daily.get("time", []),
                    "max_temp": daily.get("temperature_2m_max", []),
                    "min_temp": daily.get("temperature_2m_min", []),
                    "precipitation": daily.get("precipitation_sum", []),
                    "weather_code": daily.get("weather_code", []),
                    "sunrise": daily.get("sunrise", []),
                    "sunset": daily.get("sunset", [])
                },
                "timezone": data.get("timezone", "UTC")
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Weather error: {e}")
        raise HTTPException(status_code=502, detail=f"Weather service error: {str(e)}")

def _calculate_spraying_conditions(temp, humidity, wind, precip, delta_t):
    issues = []
    if temp < 10 or temp > 35:
        issues.append(f"Temp ({temp}C): {'Too Cold' if temp < 10 else 'Too Hot'}")
    else:
        issues.append(f"Temp ({temp}C): Good")
    if wind > 15:
        issues.append(f"Wind ({wind} km/h): Too Strong")
    elif wind > 10:
        issues.append(f"Wind ({wind} km/h): Marginal")
    else:
        issues.append(f"Wind ({wind} km/h): Ideal")
    if delta_t < 2:
        issues.append(f"Delta T ({round(delta_t,1)}C): Too Moist")
    elif delta_t > 8:
        issues.append(f"Delta T ({round(delta_t,1)}C): Too Dry")
    else:
        issues.append(f"Delta T ({round(delta_t,1)}C): Good")
    if precip > 0:
        issues.append("Rain Risk: High")
    else:
        issues.append("Rain Risk: Low")
    bad_count = sum(1 for i in issues if "Too" in i or "High" in i or "Strong" in i)
    if bad_count >= 2:
        status = "Poor"
        color = "red"
    elif bad_count == 1:
        status = "Marginal"
        color = "orange"
    else:
        status = "Good"
        color = "green"
    return {"status": status, "color": color, "delta_t": round(delta_t, 1), "wind": wind, "conditions": issues}

def _weather_code_to_desc(code):
    weather_codes = {
        0: "Clear Sky", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
        45: "Foggy", 48: "Depositing Rime Fog",
        51: "Light Drizzle", 53: "Moderate Drizzle", 55: "Dense Drizzle",
        61: "Slight Rain", 63: "Moderate Rain", 65: "Heavy Rain",
        71: "Slight Snow", 73: "Moderate Snow", 75: "Heavy Snow",
        80: "Slight Rain Showers", 81: "Moderate Rain Showers", 82: "Violent Rain Showers",
        95: "Thunderstorm", 96: "Thunderstorm with Hail", 99: "Thunderstorm with Heavy Hail"
    }
    return weather_codes.get(code, "Unknown")

# ============ AI CHAT ROUTES ============

@api_router.post("/chat/message")
async def chat_message(input_data: ChatMessageInput, request: Request):
    user = await get_current_user(request)
    user_id = user["user_id"]
    
    lang = input_data.language or user.get("language", "en")
    lang_map = {"en": "en-IN", "hi": "hi-IN", "ta": "ta-IN", "te": "te-IN", "ml": "ml-IN", "mr": "mr-IN"}
    lang_name_map = {"en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu", "ml": "Malayalam", "mr": "Marathi"}
    sarvam_lang = lang_map.get(lang, "en-IN")
    target_lang_name = lang_name_map.get(lang, "English")
    
    original_message = input_data.message

    # Log user message
    msg_id = str(uuid.uuid4())
    db.table("chat_messages").insert({
        "message_id": msg_id,
        "user_id": user_id,
        "role": "user",
        "content": original_message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }).execute()
    
    recent_res = db.table("chat_messages").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(10).execute()
    recent = recent_res.data if recent_res.data else []
    recent.reverse()
    context = "\n".join([f"{'User' if m['role']=='user' else 'AI'}: {m['content']}" for m in recent[:-1]])
    
    farm_info = user.get("farm_info", {})
    soil = user.get("soil_profile", {})
    location = user.get("location", {})
    system_msg = f"""You are Kissan AI, an expert agricultural advisor for Indian farmers. 
You provide advice on crops, fertilizers, irrigation, pest control, and market insights.
Be practical, concise, and helpful. Use simple language and clear sentences.
Do not use very long paragraphs.

CRITICAL INSTRUCTION: You MUST reply entirely in {target_lang_name} language.

Farmer's Profile:
- Location: {location.get('name', 'Unknown')}
- Soil Type: {soil.get('soil_type', 'Unknown')}
- Crops: {', '.join(farm_info.get('crops', [])) if farm_info.get('crops') else 'Not specified'}

Previous context:
{context}"""

    # 2. Call LLM with original Message directly
    try:
        from ai_helpers import gemini_chat
        ai_response_target = await gemini_chat(system_msg, original_message)
    except Exception as e:
        logger.error(f"AI Chat error: {e}")
        ai_response_target = "I'm having trouble processing your request right now. Please try again."

    # 4. Save to db using the TARGET language as the AI's content
    ai_msg_id = str(uuid.uuid4())
    db.table("chat_messages").insert({
        "message_id": ai_msg_id,
        "user_id": user_id,
        "role": "assistant",
        "content": ai_response_target,
        "created_at": datetime.now(timezone.utc).isoformat()
    }).execute()
    
    # 5. Provide Audio Chunks via TTS Pipeline
    import re
    # Match sentences by punctuation
    sentences = re.split(r'(?<=[.!?|।\n])\s+', ai_response_target)
    chunks = []
    current_chunk = ""
    # Max chunk size logic for Sarvam (keep chunks < 350 chars)
    for s in sentences:
        if not s.strip():
            continue
        if len(current_chunk) + len(s) < 350:
            current_chunk += " " + s
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            # if a single sentence is super long, break it by words or just accept it might fail TTS
            # but ideally < 350
            if len(s) >= 350:
                s = s[:340] + "..."
            current_chunk = s

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    if not chunks: 
        chunks = [ai_response_target[:340]]
        
    audio_chunks = []
    try:
        from ai_helpers import sarvam_tts
        for c in chunks:
            try:
                # sarvam_tts uses the base language code e.g. "hi" from "hi-IN"
                lang_code = lang
                audio_b64 = await sarvam_tts(text=c, target_lang=lang_code)
                if audio_b64:
                    audio_chunks.append(audio_b64)
            except Exception as tts_e:
                logger.error(f"TTS minor error passing chunk: {tts_e}")
    except Exception as e:
        logger.error(f"TTS Chunk generation error: {e}")
        
    return {
        "message_id": ai_msg_id, 
        "content": ai_response_target, 
        "primary_text": ai_response_target,
        "audio_chunks": audio_chunks,
        "role": "assistant"
    }

@api_router.get("/chat/history")
async def get_chat_history(request: Request):
    user = await get_current_user(request)
    messages_res = db.table("chat_messages").select("*").eq("user_id", user["user_id"]).order("created_at", desc=False).limit(50).execute()
    return messages_res.data if messages_res.data else []

@api_router.delete("/chat/history")
async def clear_chat_history(request: Request):
    user = await get_current_user(request)
    db.table("chat_messages").delete().eq("user_id", user["user_id"]).execute()
    return {"message": "Chat history cleared"}

# ============ DISEASE SCANNER ROUTES ============

@api_router.post("/disease/scan")
async def scan_disease(request: Request, file: UploadFile = File(...)):
    user = await get_current_user(request)
    
    # 1. Validation
    if file.size and file.size > 10 * 1024 * 1024:
        return {"error": "File size exceeds 10MB limit.", "health_status": "Error", "disease_name": "Upload failed", "plant_name": "Unknown", "confidence": 0, "urgency": "high"}
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        return {"error": "Unsupported file format. Please use JPG, PNG, or WebP.", "health_status": "Error", "disease_name": "Upload failed", "plant_name": "Unknown", "confidence": 0, "urgency": "high"}
        
    try:
        image_bytes = await file.read()
        image_b64 = base64.b64encode(image_bytes).decode()
    except Exception as e:
        logger.error(f"Image read error: {e}")
        return {"error": "Failed to read image file.", "health_status": "Error", "disease_name": "Upload failed", "plant_name": "Unknown", "confidence": 0, "urgency": "high"}
        
    # 2. Upload and API retry mechanism
    max_retries = 3
    result = None
    for attempt in range(max_retries):
        try:
            from ai_helpers import gemini_chat
            sys_msg = """You are an expert plant pathologist. Analyze the plant image and identify any diseases or health issues.
Respond in JSON format with these fields:
- plant_name: identified plant
- health_status: "Healthy", "Mild Issue", "Diseased", or "Critical"
- disease_name: name of disease (or "None" if healthy)
- confidence: percentage confidence (0-100)
- symptoms: list of observed symptoms
- causes: possible causes
- treatment: recommended treatment steps
- prevention: prevention tips
- urgency: "low", "medium", "high", or "critical"
Respond ONLY in valid JSON."""
            user_msg = "Analyze this plant image for diseases or health issues. Identify the plant and any problems."
            response = await gemini_chat(system_prompt=sys_msg, user_prompt=user_msg, image_b64=image_b64)
            
            clean = response.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1].rsplit("```", 1)[0]
            result = json.loads(clean)
            break
        except Exception as e:
            logger.warning(f"Disease scan attempt {attempt + 1} failed: {e}")
            if attempt == max_retries - 1:
                logger.error("All retries failed for disease scan.")
                return {"error": "AI analysis failed after multiple attempts. Please try to re-upload the image.", "health_status": "Error", "disease_name": "Scan failed", "plant_name": "Unknown", "confidence": 0, "urgency": "high"}
                
    try:
        db.table("disease_scans").insert({
            "scan_id": str(uuid.uuid4()),
            "user_id": user["user_id"],
            "result": result,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        return result
    except Exception as e:
        logger.error(f"Database insertion error: {e}")
        return {"error": "Failed to save results. Analysis complete but not saved.", "health_status": "Error", "disease_name": "System error", "plant_name": "Unknown", "confidence": 0, "urgency": "high"}

@api_router.get("/disease/history")
async def get_scan_history(request: Request):
    user = await get_current_user(request)
    scans_res = db.table("disease_scans").select("*").eq("user_id", user["user_id"]).order("created_at", desc=True).limit(20).execute()
    return scans_res.data if scans_res.data else []

# ============ VOICE / TRANSLATION ROUTES ============

@api_router.post("/translate")
async def translate_text(request: Request):
    body = await request.json()
    text = body.get("text", "")
    target_lang = body.get("target_language", "hi-IN")
    try:
        from ai_helpers import sarvam_translate
        # extract just the language code (like "hi" from "hi-IN" or just pass it)
        lang_code = target_lang.split("-")[0] if "-" in target_lang else target_lang
        translated = await sarvam_translate(text, source="en", target=lang_code)
        return {"translated_text": translated, "source": text, "target_language": target_lang}
    except Exception as e:
        logger.error(f"Translation error: {e}")
        return {"translated_text": text, "error": str(e)}

@api_router.post("/voice/tts")
async def text_to_speech(request: Request):
    body = await request.json()
    text = body.get("text", "")
    language = body.get("language", "hi-IN")
    try:
        from ai_helpers import sarvam_tts
        lang_code = language.split("-")[0] if "-" in language else language
        audio_b64 = await sarvam_tts(text=text, target_lang=lang_code)
        return {"audio_base64": audio_b64, "language": language}
    except Exception as e:
        logger.error(f"TTS error: {e}")
        return {"error": str(e), "audio_base64": ""}

# ============ COMMUNITY ROUTES ============

@api_router.get("/community/posts")
async def get_community_posts(skip: int = 0, limit: int = 20):
    posts_res = db.table("community_posts").select("*").order("created_at", desc=True).range(skip, skip + limit - 1).execute()
    return posts_res.data if posts_res.data else []

@api_router.post("/community/posts")
async def create_community_post(input_data: CommunityPostInput, request: Request):
    user = await get_current_user(request)
    post = {
        "post_id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "user_name": user.get("name", "Anonymous"),
        "user_picture": user.get("picture", ""),
        "title": input_data.title,
        "content": input_data.content,
        "category": input_data.category,
        "likes": 0,
        "liked_by": [],
        "comments": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    db.table("community_posts").insert(post).execute()
    return {k: v for k, v in post.items() if k != "_id"}

@api_router.post("/community/posts/{post_id}/like")
async def like_post(post_id: str, request: Request):
    user = await get_current_user(request)
    post = _get_one("community_posts", "post_id", post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    liked_by = post.get("liked_by", [])
    if user["user_id"] in liked_by:
        new_liked_by = [u for u in liked_by if u != user["user_id"]]
        db.table("community_posts").update({"liked_by": new_liked_by, "likes": post.get("likes", 1) - 1}).eq("post_id", post_id).execute()
        return {"liked": False}
    else:
        new_liked_by = liked_by + [user["user_id"]]
        db.table("community_posts").update({"liked_by": new_liked_by, "likes": post.get("likes", 0) + 1}).eq("post_id", post_id).execute()
        return {"liked": True}

@api_router.post("/community/posts/{post_id}/comment")
async def comment_on_post(post_id: str, request: Request):
    user = await get_current_user(request)
    body = await request.json()
    comment = {
        "comment_id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "user_name": user.get("name", "Anonymous"),
        "content": body.get("content", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    post = _get_one("community_posts", "post_id", post_id)
    if post:
        new_comments = post.get("comments", []) + [comment]
        db.table("community_posts").update({"comments": new_comments}).eq("post_id", post_id).execute()
    return comment

# ============ SMART RECOMMENDATIONS ============

@api_router.post("/recommendations")
async def get_recommendations(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    rec_type = body.get("type", "general")
    language = body.get("language", user.get("language", "en"))
    
    lang_name = {"en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu", "ml": "Malayalam", "mr": "Marathi"}.get(language, "English")
    
    farm_info = user.get("farm_info", {})
    soil = user.get("soil_profile", {})
    location = user.get("location", {})
    
    prompts = {
        "crop": f"Recommend best crops for: Soil={soil.get('soil_type','Unknown')}, pH={soil.get('ph','Unknown')}, Location={location.get('name','India')}. Give top 5 crops, AND EXACTLY how many days each crop takes to be grown/harvested. Include the current climate context. Respond exclusively in {lang_name}.",
        "fertilizer": f"Recommend fertilizer schedule for: Soil pH={soil.get('ph','Unknown')}, Type={soil.get('soil_type','Unknown')}, Crops={farm_info.get('crops',[])}. Respond exclusively in {lang_name}.",
        "irrigation": f"Recommend irrigation plan for: Location={location.get('name','India')}, Crops={farm_info.get('crops',[])}. Respond exclusively in {lang_name}.",
        "pest": f"Analyze pest risks for: Location={location.get('name','India')}, Season=current, Crops={farm_info.get('crops',[])}. Respond exclusively in {lang_name}.",
        "general": f"Give a comprehensive farming advisory for: Soil={soil.get('soil_type','Unknown')}, pH={soil.get('ph','Unknown')}, Location={location.get('name','India')}, Crops={farm_info.get('crops',[])}. Respond exclusively in {lang_name}."
    }
    prompt = prompts.get(rec_type, prompts["general"])
    try:
        from ai_helpers import gemini_chat
        sys_msg = f"You are Kissan AI, an expert agricultural advisor. Provide practical, actionable advice. Be concise but thorough. CRITICAL INSTRUCTION: You MUST reply entirely in the {lang_name} language."
        response = await gemini_chat(sys_msg, prompt)
        return {"recommendation": response, "type": rec_type}
    except Exception as e:
        logger.error(f"Recommendation error: {e}")
        return {"error": str(e), "recommendation": "Unable to generate recommendation. Please try again."}

# ============ ROOT & HEALTH ============

@api_router.get("/")
async def root():
    return {"message": "Kissan AI API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ============ APP SETUP ============

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:3001", 
        "https://tame-bikes-flow.loca.lt",
        "https://kisssn-v2.vercel.app",
        "https://kisssn-v2-qz5jlnyj0-prafuls-projects-fa9beed1.vercel.app",
        "https://kisssn-v2-prafuls-projects-fa9beed1.vercel.app"
    ],
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.loca\.lt",
    allow_methods=["*"],
    allow_headers=["*"],
)
