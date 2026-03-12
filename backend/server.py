from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
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

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
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
    user = await db.users.find_one({"email": data["email"]}, {"_id": 0})
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
        await db.users.insert_one(user)
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    session_token = data.get("session_token", str(uuid.uuid4()))
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none", path="/", max_age=7*24*60*60
    )
    return user

@api_router.post("/auth/register")
async def register(input_data: RegisterInput, response: Response):
    existing = await db.users.find_one({"email": input_data.email}, {"_id": 0})
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
    await db.users.insert_one(user)
    session_token = str(uuid.uuid4())
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none", path="/", max_age=7*24*60*60
    )
    user_response = {k: v for k, v in user.items() if k not in ("_id", "password_hash")}
    return user_response

@api_router.post("/auth/login")
async def login(input_data: LoginInput, response: Response):
    user = await db.users.find_one({"email": input_data.email}, {"_id": 0})
    if not user or "password_hash" not in user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not bcrypt.checkpw(input_data.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    session_token = str(uuid.uuid4())
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none", path="/", max_age=7*24*60*60
    )
    user_response = {k: v for k, v in user.items() if k not in ("_id", "password_hash")}
    return user_response

@api_router.get("/auth/me")
async def auth_me(request: Request):
    user = await get_current_user(request)
    user_response = {k: v for k, v in user.items() if k not in ("_id", "password_hash")}
    return user_response

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ============ USER/FARM ROUTES ============

@api_router.put("/user/farm")
async def update_farm(farm_data: FarmInfoUpdate, request: Request):
    user = await get_current_user(request)
    update_dict = {k: v for k, v in farm_data.model_dump().items() if v is not None}
    location_update = {}
    if farm_data.location_lat is not None:
        location_update["lat"] = farm_data.location_lat
    if farm_data.location_lon is not None:
        location_update["lon"] = farm_data.location_lon
    if farm_data.location_name:
        location_update["name"] = farm_data.location_name
    farm_update = {k: v for k, v in update_dict.items() if not k.startswith("location_")}
    set_dict = {}
    if farm_update:
        for k, v in farm_update.items():
            set_dict[f"farm_info.{k}"] = v
    if location_update:
        for k, v in location_update.items():
            set_dict[f"location.{k}"] = v
    if set_dict:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": set_dict})
    updated_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {k: v for k, v in updated_user.items() if k != "password_hash"}

@api_router.put("/user/onboarding-complete")
async def complete_onboarding(request: Request):
    user = await get_current_user(request)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"onboarding_complete": True}})
    return {"message": "Onboarding complete"}

@api_router.put("/user/language")
async def update_language(request: Request):
    body = await request.json()
    user = await get_current_user(request)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"language": body.get("language", "en")}})
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
                await db.users.update_one(
                    {"user_id": user["user_id"]},
                    {"$set": {"soil_profile": soil_profile}}
                )
                return soil_profile
            else:
                # Fallback estimation based on region
                soil_profile = _estimate_soil_by_region(lat, lon)
                await db.users.update_one(
                    {"user_id": user["user_id"]},
                    {"$set": {"soil_profile": soil_profile}}
                )
                return soil_profile
    except Exception as e:
        logger.error(f"SoilGrids API error: {e}")
        soil_profile = _estimate_soil_by_region(lat, lon)
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"soil_profile": soil_profile}}
        )
        return soil_profile

def _estimate_soil_by_region(lat, lon):
    """Fallback soil estimation based on Indian geography"""
    if 8 <= lat <= 13:
        return {"soil_type": "Red Laterite", "ph": 6.2, "source": "regional_estimate", "lat": lat, "lon": lon}
    elif 13 <= lat <= 20:
        return {"soil_type": "Black Cotton", "ph": 7.5, "source": "regional_estimate", "lat": lat, "lon": lon}
    elif 20 <= lat <= 28:
        return {"soil_type": "Alluvial", "ph": 7.0, "source": "regional_estimate", "lat": lat, "lon": lon}
    else:
        return {"soil_type": "Loam", "ph": 6.8, "source": "regional_estimate", "lat": lat, "lon": lon}

@api_router.post("/soil/analyze-image")
async def analyze_soil_image(request: Request, file: UploadFile = File(...)):
    user = await get_current_user(request)
    image_bytes = await file.read()
    image_b64 = base64.b64encode(image_bytes).decode()
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        chat = LlmChat(
            api_key=GEMINI_API_KEY,
            session_id=f"soil_analyze_{uuid.uuid4().hex[:8]}",
            system_message="You are an expert soil scientist. Analyze the soil image and provide: soil_type, estimated_ph_range (min-max), texture, color_description, moisture_level, and recommendations. Respond ONLY in valid JSON format."
        )
        chat.with_model("gemini", "gemini-2.5-flash")
        image_content = ImageContent(image_base64=image_b64)
        response = await chat.send_message(UserMessage(
            text="Analyze this soil image. Determine the soil type, estimate pH range, describe texture and moisture. Respond in JSON.",
            image_contents=[image_content]
        ))
        try:
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("\n", 1)[1].rsplit("```", 1)[0]
            result = json.loads(clean_response)
        except json.JSONDecodeError:
            result = {"analysis": response, "soil_type": "Unknown", "estimated_ph_range": "6.0-7.0"}
        return result
    except Exception as e:
        logger.error(f"Soil image analysis error: {e}")
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
            # Calculate spraying conditions
            temp = current.get("temperature_2m", 20)
            humidity = current.get("relative_humidity_2m", 50)
            wind = current.get("wind_speed_10m", 0)
            precip = current.get("precipitation", 0)
            # Delta T calculation (simplified)
            dew_point_temps = hourly.get("dew_point_2m", [])
            current_dew_point = dew_point_temps[0] if dew_point_temps else temp - 5
            delta_t = temp - current_dew_point
            spraying = _calculate_spraying_conditions(temp, humidity, wind, precip, delta_t)
            # Build hourly spraying planner (next 24h)
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
    # Store user message
    msg_id = str(uuid.uuid4())
    await db.chat_messages.insert_one({
        "message_id": msg_id,
        "user_id": user_id,
        "role": "user",
        "content": input_data.message,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    # Get recent history for context
    recent = await db.chat_messages.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    recent.reverse()
    context = "\n".join([f"{'User' if m['role']=='user' else 'AI'}: {m['content']}" for m in recent[:-1]])
    # Build system message with user context
    farm_info = user.get("farm_info", {})
    soil = user.get("soil_profile", {})
    location = user.get("location", {})
    system_msg = f"""You are Kissan AI, an expert agricultural advisor for Indian farmers. 
You provide advice on crops, fertilizers, irrigation, pest control, and market insights.
Be practical, concise, and helpful. Use simple language.

Farmer's Profile:
- Location: {location.get('name', 'Unknown')} ({location.get('lat', 'N/A')}, {location.get('lon', 'N/A')})
- Soil Type: {soil.get('soil_type', 'Unknown')}, pH: {soil.get('ph', 'Unknown')}
- Crops: {', '.join(farm_info.get('crops', [])) if farm_info.get('crops') else 'Not specified'}
- Farm Size: {farm_info.get('farm_size', 'Unknown')}

Previous conversation:
{context}"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=GEMINI_API_KEY,
            session_id=f"kissan_chat_{uuid.uuid4().hex[:8]}",
            system_message=system_msg
        )
        chat.with_model("gemini", "gemini-2.5-flash")
        ai_response = await chat.send_message(UserMessage(text=input_data.message))
    except Exception as e:
        logger.error(f"AI Chat error: {e}")
        ai_response = "I'm having trouble processing your request right now. Please try again."
    # Store AI response
    ai_msg_id = str(uuid.uuid4())
    await db.chat_messages.insert_one({
        "message_id": ai_msg_id,
        "user_id": user_id,
        "role": "assistant",
        "content": ai_response,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message_id": ai_msg_id, "content": ai_response, "role": "assistant"}

@api_router.get("/chat/history")
async def get_chat_history(request: Request):
    user = await get_current_user(request)
    messages = await db.chat_messages.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", 1).limit(50).to_list(50)
    return messages

@api_router.delete("/chat/history")
async def clear_chat_history(request: Request):
    user = await get_current_user(request)
    await db.chat_messages.delete_many({"user_id": user["user_id"]})
    return {"message": "Chat history cleared"}

# ============ DISEASE SCANNER ROUTES ============

@api_router.post("/disease/scan")
async def scan_disease(request: Request, file: UploadFile = File(...)):
    user = await get_current_user(request)
    image_bytes = await file.read()
    image_b64 = base64.b64encode(image_bytes).decode()
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        chat = LlmChat(
            api_key=GEMINI_API_KEY,
            session_id=f"disease_scan_{uuid.uuid4().hex[:8]}",
            system_message="""You are an expert plant pathologist. Analyze the plant image and identify any diseases or health issues.
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
        )
        chat.with_model("gemini", "gemini-2.5-flash")
        image_content = ImageContent(image_base64=image_b64)
        response = await chat.send_message(UserMessage(
            text="Analyze this plant image for diseases or health issues. Identify the plant and any problems.",
            image_contents=[image_content]
        ))
        try:
            clean = response.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1].rsplit("```", 1)[0]
            result = json.loads(clean)
        except json.JSONDecodeError:
            result = {"analysis": response, "health_status": "Unknown", "disease_name": "Analysis pending"}
        # Store scan in history
        await db.disease_scans.insert_one({
            "scan_id": str(uuid.uuid4()),
            "user_id": user["user_id"],
            "result": result,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return result
    except Exception as e:
        logger.error(f"Disease scan error: {e}")
        return {"error": str(e), "health_status": "Error", "disease_name": "Scan failed"}

@api_router.get("/disease/history")
async def get_scan_history(request: Request):
    user = await get_current_user(request)
    scans = await db.disease_scans.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    return scans

# ============ VOICE / TRANSLATION ROUTES ============

@api_router.post("/translate")
async def translate_text(request: Request):
    body = await request.json()
    text = body.get("text", "")
    target_lang = body.get("target_language", "hi-IN")
    try:
        from sarvamai import SarvamAI
        sarvam = SarvamAI(api_subscription_key=SARVAM_API_KEY)
        response = sarvam.translation.translate(
            text=text, target_language_code=target_lang, source_language_code="auto"
        )
        return {"translated_text": response.translated_text, "source": text, "target_language": target_lang}
    except Exception as e:
        logger.error(f"Translation error: {e}")
        return {"translated_text": text, "error": str(e)}

@api_router.post("/voice/tts")
async def text_to_speech(request: Request):
    body = await request.json()
    text = body.get("text", "")
    language = body.get("language", "hi-IN")
    try:
        from sarvamai import SarvamAI
        sarvam = SarvamAI(api_subscription_key=SARVAM_API_KEY)
        audio = sarvam.text_to_speech.convert(
            text=text, target_language_code=language,
            model="bulbul:v3", speaker="shubh"
        )
        audio_b64 = audio.audios[0] if audio.audios else ""
        return {"audio_base64": audio_b64, "language": language}
    except Exception as e:
        logger.error(f"TTS error: {e}")
        return {"error": str(e), "audio_base64": ""}

# ============ COMMUNITY ROUTES ============

@api_router.get("/community/posts")
async def get_community_posts(skip: int = 0, limit: int = 20):
    posts = await db.community_posts.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return posts

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
    await db.community_posts.insert_one(post)
    return {k: v for k, v in post.items() if k != "_id"}

@api_router.post("/community/posts/{post_id}/like")
async def like_post(post_id: str, request: Request):
    user = await get_current_user(request)
    post = await db.community_posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if user["user_id"] in post.get("liked_by", []):
        await db.community_posts.update_one(
            {"post_id": post_id},
            {"$pull": {"liked_by": user["user_id"]}, "$inc": {"likes": -1}}
        )
        return {"liked": False}
    else:
        await db.community_posts.update_one(
            {"post_id": post_id},
            {"$push": {"liked_by": user["user_id"]}, "$inc": {"likes": 1}}
        )
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
    await db.community_posts.update_one(
        {"post_id": post_id},
        {"$push": {"comments": comment}}
    )
    return comment

# ============ SMART RECOMMENDATIONS ============

@api_router.post("/recommendations")
async def get_recommendations(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    rec_type = body.get("type", "general")
    farm_info = user.get("farm_info", {})
    soil = user.get("soil_profile", {})
    location = user.get("location", {})
    prompts = {
        "crop": f"Recommend best crops for: Soil={soil.get('soil_type','Unknown')}, pH={soil.get('ph','Unknown')}, Location={location.get('name','India')}. Give top 5 with reasons.",
        "fertilizer": f"Recommend fertilizer schedule for: Soil pH={soil.get('ph','Unknown')}, Type={soil.get('soil_type','Unknown')}, Crops={farm_info.get('crops',[])}.",
        "irrigation": f"Recommend irrigation plan for: Location={location.get('name','India')}, Crops={farm_info.get('crops',[])}.",
        "pest": f"Analyze pest risks for: Location={location.get('name','India')}, Season=current, Crops={farm_info.get('crops',[])}.",
        "general": f"Give a comprehensive farming advisory for: Soil={soil.get('soil_type','Unknown')}, pH={soil.get('ph','Unknown')}, Location={location.get('name','India')}, Crops={farm_info.get('crops',[])}."
    }
    prompt = prompts.get(rec_type, prompts["general"])
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=GEMINI_API_KEY,
            session_id=f"rec_{uuid.uuid4().hex[:8]}",
            system_message="You are Kissan AI, an expert agricultural advisor. Provide practical, actionable advice. Be concise but thorough."
        )
        chat.with_model("gemini", "gemini-2.5-flash")
        response = await chat.send_message(UserMessage(text=prompt))
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
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
