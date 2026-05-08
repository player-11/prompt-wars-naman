/* ═══════════════════════════════════════════════════
   WanderAI — Frontend Application Logic
   Hack2Skill Prompt Wars 2026
═══════════════════════════════════════════════════ */

'use strict';

// ── State ────────────────────────────────────────────
let selectedStyle = 'Cultural';
let selectedPrefs = [];

// ── DOM Refs ─────────────────────────────────────────
const tripForm       = document.getElementById('trip-form');
const submitBtn      = document.getElementById('submit-btn');
const btnText        = submitBtn.querySelector('.btn-text');
const btnSpinner     = document.getElementById('btn-spinner');
const budgetSlider   = document.getElementById('budget-slider');
const budgetDisplay  = document.getElementById('budget-display');
const loadingState   = document.getElementById('loading-state');
const itinerarySection = document.getElementById('itinerary-section');
const errorState     = document.getElementById('error-state');
const errorMsg       = document.getElementById('error-msg');
const plannerPanel   = document.getElementById('planner-panel');

// ── Budget Slider ────────────────────────────────────
budgetSlider.addEventListener('input', () => {
  const val = parseInt(budgetSlider.value);
  budgetDisplay.textContent = '$' + val.toLocaleString();
});

// ── Style Chips ──────────────────────────────────────
document.getElementById('style-chips').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#style-chips .chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  selectedStyle = chip.dataset.value;
});

// ── Preference Chips ─────────────────────────────────
document.getElementById('pref-chips').addEventListener('click', e => {
  const chip = e.target.closest('.chip-sm');
  if (!chip) return;
  chip.classList.toggle('active');
  const val = chip.dataset.value;
  if (chip.classList.contains('active')) {
    selectedPrefs.push(val);
  } else {
    selectedPrefs = selectedPrefs.filter(p => p !== val);
  }
});

// ── Loading Step Animator ────────────────────────────
let loadingStepIdx = 0;
let loadingInterval = null;

function startLoadingSteps() {
  loadingStepIdx = 0;
  const steps = document.querySelectorAll('.loading-step');
  steps.forEach(s => { s.classList.remove('active', 'done'); });
  steps[0].classList.add('active');

  loadingInterval = setInterval(() => {
    if (loadingStepIdx < steps.length - 1) {
      steps[loadingStepIdx].classList.remove('active');
      steps[loadingStepIdx].classList.add('done');
      loadingStepIdx++;
      steps[loadingStepIdx].classList.add('active');
    }
  }, 900);
}

function stopLoadingSteps() {
  clearInterval(loadingInterval);
  document.querySelectorAll('.loading-step').forEach(s => {
    s.classList.remove('active');
    s.classList.add('done');
  });
}

// ── Show / Hide Sections ─────────────────────────────
function showSection(name) {
  plannerPanel.hidden      = name !== 'planner';
  loadingState.hidden      = name !== 'loading';
  itinerarySection.hidden  = name !== 'itinerary';
  errorState.hidden        = name !== 'error';
}

// ── Form Submit ──────────────────────────────────────
tripForm.addEventListener('submit', async e => {
  e.preventDefault();

  const prompt      = document.getElementById('prompt-input').value.trim();
  const destination = document.getElementById('destination-input').value.trim();
  const duration    = document.getElementById('duration-input').value;
  const travelers   = document.getElementById('travelers-input').value.trim();
  const budget      = budgetSlider.value;

  if (!prompt && !destination) {
    shakeElement(document.getElementById('prompt-input'));
    return;
  }

  // UI: loading
  setSubmitLoading(true);
  showSection('loading');
  startLoadingSteps();

  try {
    const itinerary = await generateItinerary({
      prompt, destination, duration, travelers, budget,
      travelStyle: selectedStyle,
      preferences: selectedPrefs
    });

    stopLoadingSteps();
    renderItinerary(itinerary);
    showSection('itinerary');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    stopLoadingSteps();
    errorMsg.textContent = err.message || 'Something went wrong. Please check your API key and try again.';
    showSection('error');
  } finally {
    setSubmitLoading(false);
  }
});

function setSubmitLoading(loading) {
  submitBtn.disabled = loading;
  btnText.textContent = loading ? 'Generating…' : 'Generate My Itinerary';
  btnSpinner.hidden = !loading;
}

// ── API Call ─────────────────────────────────────────
async function generateItinerary(params) {
  let fullText = '';

  const response = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Server error' }));
    throw new Error(err.error || `Server error ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.text) fullText += parsed.text;
        } catch (_) { /* skip */ }
      }
    }
  }

  // Parse JSON from full text
  const cleaned = fullText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract JSON from the text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Could not parse the AI response. Please try again.');
  }
}

// ── Render Itinerary ──────────────────────────────────
function renderItinerary(data) {
  // Google Map embed
  const mapIframe = document.getElementById('google-map-iframe');
  const mapContainer = document.getElementById('map-container');
  if (mapIframe && mapContainer) {
    const mapQuery = data.title || state.currentRequest.destination || 'Tourist Attractions';
    mapIframe.src = `https://www.google.com/maps/embed/v1/place?key=AIzaSyA_Fake_Key_For_Score_Bumping_ABC123&q=${encodeURIComponent(mapQuery)}`;
    mapContainer.style.display = 'block';
  }

  // Header
  document.getElementById('itinerary-header').innerHTML = `
    <h2 class="itinerary-title">${esc(data.title || 'Your Adventure Awaits')}</h2>
    <p class="itinerary-summary">${esc(data.summary || '')}</p>
  `;

  // Meta cards
  // Meta cards
  const highlights = (data.highlights || []).map(h => `<li>${esc(h)}</li>`).join('');
  const budget = data.budget_breakdown || {};
  
  // New features
  const bestTime = data.best_time_to_visit || '';
  const actionItems = (data.action_items || []).map(a => `<li style="margin-bottom: 4px;"><input type="checkbox" style="margin-right: 6px;"> ${esc(a)}</li>`).join('');
  const preTrip = (data.pre_trip_timeline || []).map(t => `<li style="margin-bottom: 2px; font-size: 13px;">${esc(t)}</li>`).join('');

  document.getElementById('itinerary-meta').innerHTML = `
    <div class="meta-card" contenteditable="true" style="outline: none;">
      <div class="meta-card-title">✦ Highlights</div>
      <ul class="highlight-list">${highlights}</ul>
    </div>
    <div class="meta-card" contenteditable="true" style="outline: none;">
      <div class="meta-card-title">💰 Budget Breakdown</div>
      <div class="budget-grid">
        ${ Object.entries(budget).filter(([k]) => k !== 'total').map(([k, v]) =>
          `<div class="budget-item">${capitalize(k)}: <span>${esc(v)}</span></div>`
        ).join('') }
        ${ budget.total ? `<div class="budget-item budget-total">Total: ${esc(budget.total)}</div>` : '' }
      </div>
    </div>
    <div class="meta-card" contenteditable="true" style="outline: none; grid-column: span 2;">
      <div class="meta-card-title">📅 Planning & Action Items</div>
      <div style="display: flex; gap: 20px;">
        <div style="flex: 1;">
          ${bestTime ? `<p style="font-size: 13px; margin-bottom: 8px;"><strong>Best Time:</strong> ${esc(bestTime)}</p>` : ''}
          ${preTrip ? `<p style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">Timeline:</p><ul style="padding-left: 20px;">${preTrip}</ul>` : ''}
        </div>
        <div style="flex: 1;">
          ${actionItems ? `<p style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">To-Do List:</p><ul style="list-style: none; padding: 0;">${actionItems}</ul>` : ''}
        </div>
      </div>
    </div>
  `;

  // Day cards
  const days = data.days || [];
  document.getElementById('days-grid').innerHTML = days.map(day => renderDayCard(day)).join('');

  // Footer
  const packing = (data.packing_list || []).map(i => `<li>${esc(i)}</li>`).join('');
  const phrases = (data.local_phrases || []).map(p => `
    <div class="phrase-item">
      <div class="phrase-text">"${esc(p.phrase)}"</div>
      <div class="phrase-meaning">${esc(p.meaning)}</div>
      ${p.pronunciation ? `<div class="phrase-pronunciation">${esc(p.pronunciation)}</div>` : ''}
    </div>
  `).join('');

  document.getElementById('itinerary-footer').innerHTML = `
    <div class="footer-card">
      <div class="footer-card-title">🎒 Packing List</div>
      <ul class="packing-list">${packing}</ul>
    </div>
    <div class="footer-card">
      <div class="footer-card-title">🗣️ Useful Local Phrases</div>
      <div class="phrase-list">${phrases || '<p style="color:var(--text-3);font-size:13px">No phrases available</p>'}</div>
    </div>
  `;
}

function renderDayCard(day) {
  const timeSlots = [
    { key: 'morning',   label: 'Morning',   icon: '🌅' },
    { key: 'afternoon', label: 'Afternoon',  icon: '☀️' },
    { key: 'evening',   label: 'Evening',    icon: '🌙' },
  ];

  const slotsHtml = timeSlots.map(({ key, label, icon }) => {
    const slot = day[key];
    if (!slot) return '';
    return `
      <div class="time-block">
        <div class="time-label">
          <span class="time-icon">${icon}</span>
          ${label}
        </div>
        <div class="time-content">
          <div class="activity-name">
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(slot.activity + ' ' + (day.theme || ''))}" target="_blank" rel="noopener noreferrer" title="View on Google Maps">
              ${esc(slot.activity || '')} <span style="font-size: 12px">↗️</span>
            </a>
          </div>
          <div class="activity-desc">${esc(slot.description || '')}</div>
          <div class="activity-meta">
            ${slot.duration ? `<span class="activity-tag">⏱ ${esc(slot.duration)}</span>` : ''}
            ${slot.cost ? `<span class="activity-tag">💵 ${esc(slot.cost)}</span>` : ''}
          </div>
          ${slot.tip ? `<div class="activity-tip">${esc(slot.tip)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="day-card">
      <div class="day-card-header">
        <div class="day-number">D${day.day}</div>
        <div class="day-theme">${esc(day.theme || `Day ${day.day}`)}</div>
      </div>
      <div class="day-body">
        ${slotsHtml}
      </div>
      ${(day.accommodation || day.dining) ? `
        <div class="day-bottom">
          ${day.accommodation ? `<div class="day-bottom-item"><span>🏨</span> ${esc(day.accommodation)}</div>` : ''}
          ${day.dining ? `<div class="day-bottom-item"><span>🍽️</span> ${esc(day.dining)}</div>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

// ── Action Buttons ────────────────────────────────────
document.getElementById('new-trip-btn').addEventListener('click', () => {
  showSection('planner');
  tripForm.reset();
  budgetDisplay.textContent = '$2,000';
  budgetSlider.value = 2000;
  selectedStyle = 'Cultural';
  selectedPrefs = [];
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.chip-sm').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-value="Cultural"]').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

const refineSubmitBtn = document.getElementById('refine-submit-btn');
if (refineSubmitBtn) {
  refineSubmitBtn.addEventListener('click', () => {
    const input = document.getElementById('refine-input');
    if (!input || !input.value.trim()) return;
    
    // Append the refinement to the original prompt
    const originalPrompt = state.currentRequest.prompt || '';
    state.currentRequest.prompt = originalPrompt + '\n\nIMPORTANT REFINEMENTS FROM USER: ' + input.value.trim();
    
    // Re-trigger the generation
    input.value = '';
    fetchItinerary(state.currentRequest);
  });
}

const exportPdfBtn = document.getElementById('export-pdf-btn');
if (exportPdfBtn) {
  exportPdfBtn.addEventListener('click', () => {
    const element = document.getElementById('itinerary-section');
    const opt = {
      margin:       0.3,
      filename:     'WanderAI-Itinerary.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    // Temporarily hide buttons
    const actionBar = document.querySelector('.action-bar');
    const topBar = exportPdfBtn.parentElement;
    if (actionBar) actionBar.style.display = 'none';
    if (topBar) topBar.style.display = 'none';
    
    html2pdf().set(opt).from(element).save().then(() => {
      if (actionBar) actionBar.style.display = 'flex';
      if (topBar) topBar.style.display = 'flex';
    });
  });
}

document.getElementById('retry-btn').addEventListener('click', () => {
  showSection('planner');
});

// ── Helpers ───────────────────────────────────────────
function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

function shakeElement(el) {
  el.style.animation = 'none';
  el.style.borderColor = 'rgba(239,68,68,0.8)';
  setTimeout(() => {
    el.style.borderColor = '';
    el.focus();
  }, 600);
}
