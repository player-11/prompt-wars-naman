# WanderAI ✈️ — AI Travel Planning & Experience Engine

> **Hack2Skill Prompt Wars 2026** | Topic: Travel Planning & Experience Engine

A prompt-powered AI travel planner that generates personalized, day-by-day itineraries using Google Gemini. Enter your destination, preferences, and constraints in natural language — and watch the AI craft your perfect adventure in seconds.

## 🌟 Features

- **Natural Language Prompting** — Describe your trip in plain English
- **Smart Preference Chips** — Adventure, Luxury, Foodie, Beach, and more
- **Budget Planner** — Slider with real-time budget breakdown by category
- **Streaming AI Response** — Itinerary builds token-by-token in real time
- **Day-by-Day Itinerary** — Morning, afternoon, evening activities with costs & tips
- **Local Insights** — Useful phrases, packing list, weather tips
- **Refine & Regenerate** — Adjust and re-prompt instantly

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Google Gemini API Key (free at [aistudio.google.com](https://aistudio.google.com))

### Local Development

```bash
# 1. Clone the repo
git clone <repo-url>
cd prompt-wars-naman

# 2. Install dependencies
npm install

# 3. Set your API key
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key_here

# 4. Run locally
GEMINI_API_KEY=your_key node server.js
# Visit http://localhost:8080
```

## 🐳 Docker

```bash
docker build -t travel-planner .
docker run -p 8080:8080 -e GEMINI_API_KEY=your_key travel-planner
```

## ☁️ Deploy to Google Cloud Run

```bash
# Set your project
export PROJECT_ID=your-gcp-project-id

# Build and push
gcloud builds submit --tag gcr.io/$PROJECT_ID/travel-planner

# Deploy
gcloud run deploy travel-planner \
  --image gcr.io/$PROJECT_ID/travel-planner \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key_here
```

## 🏗️ Architecture

```
Browser (HTML/CSS/JS)
    ↓  POST /api/plan (SSE stream)
Express Server (Node.js)
    ↓  Gemini API (streaming)
Google Gemini 2.0 Flash
```

## 📁 Project Structure

```
├── server.js          # Express server + Gemini API proxy
├── public/
│   ├── index.html     # Main SPA
│   ├── style.css      # Premium dark glassmorphism theme
│   └── app.js         # Frontend logic + streaming
├── Dockerfile         # Cloud Run container
└── package.json
```

## 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Your Google Gemini API key |
| `PORT` | Server port (default: 8080) |

---

Built with ❤️ for Hack2Skill Prompt Wars 2026
