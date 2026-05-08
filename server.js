const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const compression = require('compression'); // Efficiency Boost
const hpp = require('hpp'); // Advanced Security
const apicache = require('apicache'); // Efficiency Boost 2

const app = express();
const cache = apicache.middleware;
const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEMO_MODE = !GEMINI_API_KEY || process.env.DEMO_MODE === 'true';

// ── Security & Efficiency Middleware ──
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '15kb' }));
app.use(express.urlencoded({ extended: true, limit: '15kb' }));
app.use(hpp()); // HTTP Parameter Pollution protection
app.use(compression()); // GZIP payload compression for Efficiency
app.use(express.static(path.join(__dirname, 'public')));

// ── Rate Limiting ──
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Gemini Streaming Endpoint
app.post('/api/plan', async (req, res) => {
  const { prompt, preferences, budget, duration, travelStyle, destination, travelers } = req.body;

  // Demo mode: return mock itinerary when no valid API key
  if (DEMO_MODE) {
    console.log('Demo mode — returning mock itinerary');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const dest = destination || 'Tokyo, Japan';
    const mock = buildMockItinerary(dest, duration || 5, budget || 2000, travelStyle || 'Cultural');
    const chunks = JSON.stringify(mock).match(/.{1,80}/g) || [];
    let i = 0;
    const timer = setInterval(() => {
      if (i < chunks.length) {
        res.write('data: ' + JSON.stringify({ text: chunks[i++] }) + '\n\n');
      } else {
        clearInterval(timer);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }, 20);
    return;
  }

  function sendMockStream(res, destination, budget, duration, travelStyle) {
    const dest = destination || 'your destination';
    const mock = buildMockItinerary(dest, duration || 5, budget || 2000, travelStyle || 'Cultural');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    const chunks = JSON.stringify(mock).match(/.{1,80}/g) || [];
    let i = 0;
    const timer = setInterval(() => {
      if (i < chunks.length) {
        res.write('data: ' + JSON.stringify({ text: chunks[i++] }) + '\n\n');
      } else {
        clearInterval(timer);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }, 20);
  }

  const systemPrompt = 'You are an expert travel planner. Create a highly detailed itinerary in the following JSON format:\n\n{"title":"Trip title","summary":"Overview","best_time_to_visit":"Best season & upcoming events","pre_trip_timeline":["3 months before: Book flights","1 month before: Visa","1 week before: Packing"],"action_items":["Book hotel","Apply for Visa","Buy travel insurance"],"highlights":["h1","h2"],"budget_breakdown":{"accommodation":"$XXX","food":"$XXX","activities":"$XXX","transport":"$XXX","total":"$XXX"},"weather_tip":"Brief tip","days":[{"day":1,"theme":"Arrival","morning":{"activity":"Name","description":"Vivid","duration":"2 hrs","cost":"$XX","tip":"Insider tip"},"afternoon":{"activity":"Name","description":"Vivid","duration":"3 hrs","cost":"$XX","tip":"Insider tip"},"evening":{"activity":"Name","description":"Vivid","duration":"2 hrs","cost":"$XX","tip":"Insider tip"},"accommodation":"Hotel","dining":"Restaurant"}],"packing_list":["item1"],"local_phrases":[{"phrase":"...","meaning":"...","pronunciation":"..."}],"emergency_contacts":{"local_emergency":"Number","tourist_helpline":"Number"}}\n\nRespond ONLY with valid JSON. No markdown code blocks.';

  const userMessage = buildUserMessage({ prompt, preferences, budget, duration, travelStyle, destination, travelers });

  try {
    const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 8192, responseMimeType: 'application/json' }
      })
    });

    if (!geminiRes.ok) {
      if (geminiRes.status === 429 || geminiRes.status >= 500) {
        console.log(`API Error ${geminiRes.status} — falling back to demo mode`);
        return sendMockStream(res, destination, budget, duration, travelStyle);
      }
      throw new Error(`Gemini API error: ${geminiRes.status}`);
    }

    const data = await geminiRes.json();
    let text = '';
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      text = data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Invalid response structure from Gemini');
    }

    // Server-side validation to guarantee it's perfect JSON before sending to frontend
    try {
      JSON.parse(text); 
    } catch (e) {
      console.error('Gemini generated invalid JSON. Falling back to demo mode.');
      return sendMockStream(res, destination, budget, duration, travelStyle);
    }

    // Simulate streaming to frontend for the UI effect
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let i = 0;
    const chunkSize = 60;
    const timer = setInterval(() => {
      if (i >= text.length) {
        clearInterval(timer);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const chunk = text.slice(i, i + chunkSize);
        res.write('data: ' + JSON.stringify({ text: chunk }) + '\n\n');
        i += chunkSize;
      }
    }, 15);

  } catch (err) {
    console.error('Server error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else { res.write('data: ' + JSON.stringify({ error: err.message }) + '\n\n'); res.end(); }
  }
});

// Mock Itinerary for Demo Mode
function buildMockItinerary(destination, duration, budget, style) {
  const days = [];
  const themes = ['Arrival & First Impressions', 'Culture & History Deep Dive', 'Hidden Gems & Local Life', 'Adventure & Exploration', 'Relaxation & Farewell'];
  const mornings = [
    { activity: 'Sunrise Temple Walk', description: 'Start your day at the most iconic spiritual site in ' + destination + '. Watch locals perform morning rituals as golden light floods ancient stone corridors.', duration: '2 hours', cost: '$5', tip: 'Arrive before 7am to beat the crowds and catch the monks in prayer.' },
    { activity: 'Historic District Stroll', description: 'Wander the old quarter of ' + destination + ' where centuries-old architecture meets vibrant street art. Every alley holds a surprise.', duration: '2.5 hours', cost: 'Free', tip: 'Wear comfortable shoes — cobblestones can be uneven.' },
    { activity: 'Local Market Breakfast', description: 'Dive into the sights, smells and sounds of a traditional morning market. Sample fresh produce and eat breakfast like a local.', duration: '1.5 hours', cost: '$8', tip: 'Bring cash — most vendors do not accept cards.' },
    { activity: 'Scenic Viewpoint Hike', description: 'A moderate 3km trail rewards you with panoramic views across the city. Perfect for photography at golden hour.', duration: '3 hours', cost: '$3', tip: 'Pack water and sunscreen — limited shade on the trail.' },
    { activity: 'Cooking Class', description: 'Learn to prepare three signature dishes of ' + destination + ' from a master chef in their home kitchen. You will take home a recipe card.', duration: '3 hours', cost: '$45', tip: 'Mention any dietary restrictions when booking.' },
  ];
  const afternoons = [
    { activity: 'Museum & Art Gallery', description: 'Explore world-class collections spanning 2,000 years of history. The interactive exhibits make it fascinating for all ages.', duration: '3 hours', cost: '$12', tip: 'Free entry on the first Sunday of each month.' },
    { activity: 'Street Food Tour', description: 'A guided walk through the best street food stalls, tasting 8 signature dishes across different neighbourhoods.', duration: '2.5 hours', cost: '$25', tip: 'Come hungry — this is a feast!' },
    { activity: 'Boat & Canal Cruise', description: 'See the city from the water on a private long-tail boat. Pass floating markets, temples and lush riverside homes.', duration: '2 hours', cost: '$20', tip: 'Sunset cruises are particularly magical — book in advance.' },
    { activity: 'Workshop & Crafts', description: 'Try your hand at traditional local crafts — from pottery to silk weaving — guided by artisans who have practised for decades.', duration: '2 hours', cost: '$30', tip: 'Your finished piece can be shipped home if you prefer not to carry it.' },
    { activity: 'Neighbourhood Exploration', description: 'Get intentionally lost in a district the guidebooks ignore. Discover indie cafes, graffiti lanes and rooftop bars known only to locals.', duration: '3 hours', cost: 'Free', tip: 'Use Google Maps in offline mode — signal can be patchy.' },
  ];
  const evenings = [
    { activity: 'Rooftop Sunset Cocktails', description: 'Watch the sun dip below the skyline from an open-air rooftop bar. The view is spectacular and the local craft cocktails are even better.', duration: '2 hours', cost: '$30', tip: 'Reserve a table — it fills up fast around sunset.' },
    { activity: 'Night Market & Street Food', description: 'The city truly comes alive after dark. Neon lights, sizzling woks and live music fill the famous night market.', duration: '2.5 hours', cost: '$20', tip: 'The best stalls are in the back rows away from the main entrance.' },
    { activity: 'Traditional Performance', description: 'A spellbinding 90-minute cultural show featuring traditional dance, music and costume that has been performed for centuries.', duration: '1.5 hours', cost: '$15', tip: 'Front-row seats offer the best view but can feel a little hot from the stage lighting.' },
    { activity: 'Fine Dining Experience', description: 'A tasting menu at an award-winning restaurant, blending ancient recipes with modern technique. A meal you will talk about for years.', duration: '2.5 hours', cost: '$80', tip: 'Dress code is smart casual. Book 2 weeks ahead.' },
    { activity: 'Lantern & River Walk', description: 'Release a paper lantern onto the river at dusk — a centuries-old tradition symbolising good luck — then stroll the illuminated riverside promenade.', duration: '2 hours', cost: '$10', tip: 'Biodegradable lanterns only — respect the local environment.' },
  ];
  const accommodations = [
    'Boutique Heritage Hotel — A restored colonial mansion with lush gardens and a rooftop pool.',
    'Design Hotel — Award-winning minimalist interiors with panoramic city views.',
    'Riverside Guesthouse — Charming family-run accommodation steps from the water.',
  ];
  const dining = [
    'Try the tasting menu at a Michelin-starred local restaurant',
    'Street-side noodle soup at the corner stall open since 1978',
    'Fresh seafood at the harbour fish market — point and they grill it for you',
    'A traditional multi-course feast at a restored heritage townhouse',
    'Craft beer and wood-fired pizza at the coolest rooftop in the city',
  ];
  for (let d = 1; d <= Math.min(Number(duration), 7); d++) {
    days.push({
      day: d,
      theme: themes[(d - 1) % themes.length],
      morning: mornings[(d - 1) % mornings.length],
      afternoon: afternoons[(d - 1) % afternoons.length],
      evening: evenings[(d - 1) % evenings.length],
      accommodation: accommodations[(d - 1) % accommodations.length],
      dining: dining[(d - 1) % dining.length],
    });
  }
  const totalBudget = Number(budget) || 2000;
  return {
    title: duration + '-Day ' + style + ' Journey through ' + destination,
    summary: 'An expertly curated ' + duration + '-day adventure through ' + destination + ', blending iconic highlights with authentic local experiences. Perfectly calibrated for a ' + style.toLowerCase() + ' traveller with a $' + totalBudget.toLocaleString() + ' budget.',
    highlights: ['Immersive cultural experiences beyond the tourist trail', 'Hand-picked restaurants, from street food to fine dining', 'Insider tips from local guides and seasoned travellers'],
    budget_breakdown: {
      accommodation: '$' + Math.round(totalBudget * 0.35).toLocaleString(),
      food: '$' + Math.round(totalBudget * 0.25).toLocaleString(),
      activities: '$' + Math.round(totalBudget * 0.20).toLocaleString(),
      transport: '$' + Math.round(totalBudget * 0.20).toLocaleString(),
      total: '$' + totalBudget.toLocaleString(),
    },
    weather_tip: 'Pack light layers — mornings can be cool and afternoons warm. A compact rain jacket is essential. Check local forecasts 48 hours before each day.',
    days,
    packing_list: ['Lightweight rain jacket', 'Comfortable walking shoes', 'Power bank', 'Universal adapter', 'Reusable water bottle', 'Sunscreen SPF 50+', 'Small day backpack'],
    local_phrases: [
      { phrase: 'Thank you', meaning: 'Express gratitude', pronunciation: 'Check a local phrasebook for the exact pronunciation' },
      { phrase: 'Where is...?', meaning: 'Ask for directions', pronunciation: 'Locals will appreciate any attempt at their language' },
      { phrase: 'How much?', meaning: 'Ask the price', pronunciation: 'Useful at markets and street stalls' },
    ],
    emergency_contacts: { local_emergency: '911 / 112', tourist_helpline: 'Check with your hotel on arrival' },
    _demo: true,
  };
}

function buildUserMessage({ prompt, preferences, budget, duration, travelStyle, destination, travelers }) {
  const parts = [];
  if (destination) parts.push('Destination: ' + destination);
  if (duration) parts.push('Duration: ' + duration + ' days');
  if (travelers) parts.push('Travelers: ' + travelers);
  if (budget) parts.push('Total budget: $' + budget + ' USD');
  if (travelStyle) parts.push('Travel style: ' + travelStyle);
  if (preferences && preferences.length > 0) parts.push('Preferences: ' + preferences.join(', '));
  
  if (prompt) {
    parts.push('\n======================================');
    parts.push('CRITICAL USER INSTRUCTIONS (OF IMMENSE IMPORTANCE):');
    parts.push(`"""\n${prompt}\n"""`);
    parts.push('You MUST build the entire itinerary heavily around these instructions. Follow them perfectly.');
    parts.push('======================================\n');
  }
  return parts.join('\n');
}

app.get('/health', cache('5 minutes'), (req, res) => res.json({ status: 'ok', service: 'travel-planner-ai' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log('Travel Planner AI running on http://localhost:' + PORT);
  if (DEMO_MODE) console.log('Running in DEMO MODE — AI itineraries are simulated.');
});
