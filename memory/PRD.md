# Kissan AI - Product Requirements Document

## Original Problem Statement
Build a complete PWA agricultural AI assistant app called "Kissan AI" with GPS-based soil pH estimation, AI advisory (Gemini), disease scanner, weather dashboard, voice I/O (Sarvam AI), community features, and premium mobile-first dark UI inspired by warm sunset/aurora gradients.

## Architecture
- **Frontend**: React 19 + TailwindCSS + Shadcn UI + Framer Motion (PWA)
- **Backend**: FastAPI + MongoDB + Motor (async)
- **AI**: Google Gemini (via emergentintegrations) for chat, disease detection, soil analysis
- **Voice**: Sarvam AI (sarvamai) for TTS/translation, Web Speech API for STT
- **Weather**: Open-Meteo API (free, no key)
- **Soil**: ISRIC SoilGrids API + regional fallback
- **Auth**: Google OAuth (Emergent Auth) + email/password with session cookies

## User Personas
1. **Indian Farmer** - Primary user, needs crop advice, weather monitoring, pest control
2. **Agricultural Advisor** - Uses community features, shares knowledge
3. **Farm Manager** - Monitors multiple aspects of farm operations

## Core Requirements (Static)
- GPS-based soil pH estimation (no manual entry)
- Real-time weather data + spraying condition planner
- AI-powered crop advisory and fertilizer recommendations
- Plant disease detection via image upload
- Community forum for farmer knowledge sharing
- Multi-language support (Hindi/English) with voice I/O
- Premium dark UI with warm orange/red accent theme

## What's Been Implemented (March 2026)
### Backend APIs (100% working)
- Auth: register, login, logout, Google OAuth, session management
- User/Farm: profile update, farm info, location, crop selection, language
- Soil: GPS-based estimation via SoilGrids + regional fallback
- Weather: Open-Meteo integration with spraying condition calculator
- AI Chat: Gemini-powered with conversation history
- Disease Scanner: Gemini Vision for plant disease detection
- Voice: Sarvam AI TTS, translation API
- Community: Posts CRUD, likes, comments
- Recommendations: AI-powered crop/fertilizer/pest advice

### Frontend Pages (100% working)
- Onboarding: 3-step animated flow with "Namaste" splash
- Auth: Google OAuth + email/password forms
- Dashboard: Weather card, soil profile, quick actions, daily tip
- Weather: Current conditions, spraying planner (Herbicide/Fungicide/Insecticide), 7-day forecast
- AI Chat: Text/voice input, image upload, suggestion chips, TTS playback
- Disease Scanner: Camera/upload with detailed diagnosis results
- Community: Post feed with likes, comments, category filtering
- Profile: Farm info editing, soil profile, location management, language toggle

### Design
- "Digital Twilight" theme: Deep indigo (#0B1121) backgrounds
- Warm orange-to-red gradient accents (#E67E22 → #C0392B)
- Glassmorphism cards with backdrop blur
- Outfit + Manrope typography
- Framer Motion page transitions and micro-animations
- Bottom tab navigation with animated indicator

## Prioritized Backlog
### P0 (Critical)
- [x] Core auth flow
- [x] Dashboard with weather
- [x] AI Chat
- [x] Disease Scanner
- [x] Soil estimation

### P1 (High)
- [ ] Soil image analysis (upload soil photo for analysis)
- [ ] Push notifications for weather alerts
- [ ] Offline mode (service worker caching)
- [ ] Full PWA install experience

### P2 (Medium)
- [ ] Community comment system (UI)
- [ ] More Indian languages (Tamil, Telugu, Bengali, etc.)
- [ ] Market price API integration
- [ ] Farm activity tracking & 7-day chart
- [ ] Admin dashboard for community moderation
- [ ] Smart recommendations cards on dashboard

## Next Tasks
1. Enhance community with comments UI and image upload for posts
2. Add offline service worker for PWA functionality
3. Integrate soil image analysis feature (Gemini Vision)
4. Add push notification support for weather alerts
5. Expand language support beyond Hindi/English
