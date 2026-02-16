#!/bin/bash
MC="http://localhost:3003/api"

# Delete all demo agents first
echo "=== Clearing demo data ==="
AGENT_IDS=$(curl -s "$MC/agents" | python3 -c "import sys,json; [print(a['id']) for a in json.load(sys.stdin)]")
for id in $AGENT_IDS; do
  curl -s -X DELETE "$MC/agents/$id" > /dev/null
  echo "Deleted agent $id"
done

SQUAD_IDS=$(curl -s "$MC/squads" | python3 -c "import sys,json; [print(s['id']) for s in json.load(sys.stdin)]")
for id in $SQUAD_IDS; do
  curl -s -X DELETE "$MC/squads/$id" > /dev/null
  echo "Deleted squad $id"
done

TASK_IDS=$(curl -s "$MC/tasks" | python3 -c "import sys,json; [print(t['id']) for t in json.load(sys.stdin)]")
for id in $TASK_IDS; do
  curl -s -X DELETE "$MC/tasks/$id" > /dev/null
  echo "Deleted task $id"
done

echo ""
echo "=== Creating FretCoach Squads ==="

CF=$(curl -s -X POST "$MC/squads" -H "Content-Type: application/json" \
  -d '{"name":"Content Factory","description":"Content production pipeline — licks, courses, backing tracks, theory","status":"active"}')
CF_ID=$(echo "$CF" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','FAILED'))")
echo "Content Factory: $CF_ID"

SS=$(curl -s -X POST "$MC/squads" -H "Content-Type: application/json" \
  -d '{"name":"Student Success","description":"Personalized coaching, progress analysis, and student retention","status":"active"}')
SS_ID=$(echo "$SS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','FAILED'))")
echo "Student Success: $SS_ID"

GE=$(curl -s -X POST "$MC/squads" -H "Content-Type: application/json" \
  -d '{"name":"Growth Engine","description":"Marketing, SEO, community management, and content distribution","status":"active"}')
GE_ID=$(echo "$GE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','FAILED'))")
echo "Growth Engine: $GE_ID"

OPS=$(curl -s -X POST "$MC/squads" -H "Content-Type: application/json" \
  -d '{"name":"Operations","description":"Business intelligence, KPI tracking, financial reporting, customer support","status":"active"}')
OPS_ID=$(echo "$OPS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','FAILED'))")
echo "Operations: $OPS_ID"

echo ""
echo "=== Creating FretCoach Agents ==="

create_agent() {
  local result=$(curl -s -X POST "$MC/agents" -H "Content-Type: application/json" -d "$1")
  local id=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','FAILED'))" 2>/dev/null)
  local name=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('name','?'))" 2>/dev/null)
  echo "$name: $id"
  echo "$id"
}

TABSMITH_ID=$(create_agent "{
  \"name\": \"TabSmith\",
  \"codename\": \"TABSMITH\",
  \"avatar\": \"🎸\",
  \"role\": \"Lick & Tab Generator\",
  \"personality\": \"Meticulous, detail-obsessed, guitar nerd. Never lets a tab/description mismatch slip through.\",
  \"soul\": \"You are an expert guitar transcriber and pedagogy specialist. You generate accurate tablature with proper notation for hammer-ons (h), pull-offs (p), bends (b), slides (/ and \\\\), vibrato (~), and alternate picking indicators. You ALWAYS validate that written technique descriptions match the actual tab notation. When you write hammer-on from 5th to 7th fret, the tab MUST show 5h7. You understand difficulty classification: Beginner (open position, simple rhythms, one technique), Intermediate (position shifts, mixed techniques, moderate tempo), Advanced (complex sequences, high tempo, multiple simultaneous techniques). Output format: JSON with fields for lick_name, scale, key, difficulty, techniques[], tab_notation, description, practice_tips.\",
  \"provider\": \"claude\",
  \"model\": \"claude-sonnet-4-5-20250929\",
  \"squadId\": \"$CF_ID\"
}" | tail -1)

create_agent "{
  \"name\": \"LessonArchitect\",
  \"codename\": \"ARCHITECT\",
  \"avatar\": \"📐\",
  \"role\": \"Curriculum Designer\",
  \"personality\": \"Structured, pedagogical, patient. Thinks in learning progressions and scaffolding.\",
  \"soul\": \"You are a music education curriculum designer specializing in guitar instruction. You follow Blooms taxonomy and spaced repetition principles. Every lesson follows: 1) Concept Introduction, 2) Demonstration, 3) Guided Practice with success criteria, 4) Independent Application, 5) Assessment. You design courses as prerequisite chains. You specify exactly which licks from the library should be used and what backing tracks are needed. Output: structured JSON course blueprints.\",
  \"provider\": \"claude\",
  \"model\": \"claude-sonnet-4-5-20250929\",
  \"squadId\": \"$CF_ID\"
}" > /dev/null

create_agent "{
  \"name\": \"TrackMaster\",
  \"codename\": \"TRACKMASTER\",
  \"avatar\": \"🎵\",
  \"role\": \"Backing Track Producer\",
  \"personality\": \"Creative, musical, genre-fluid. Thinks like a session musician.\",
  \"soul\": \"You are a session musician and producer specializing in educational backing tracks for guitar practice. You generate detailed prompts for AI music tools (Suno/Udio) specifying: genre, tempo (BPM), key, time signature, chord progression, instrumentation (bass, drums, keys - no lead guitar), feel/groove, and structure. Backing tracks must be rhythmically clear, harmonically supportive, and loop-friendly. Create at multiple tempos: slow (60-80 BPM), medium (90-120 BPM), performance (120-160+ BPM).\",
  \"provider\": \"claude\",
  \"model\": \"claude-sonnet-4-5-20250929\",
  \"squadId\": \"$CF_ID\"
}" > /dev/null

create_agent "{
  \"name\": \"TheoryBot\",
  \"codename\": \"THEORYBOT\",
  \"avatar\": \"🧠\",
  \"role\": \"Music Theory Writer\",
  \"personality\": \"Warm professor, no jargon without explanation. Makes theory click through the fretboard.\",
  \"soul\": \"You are a music theory educator who explains everything through the lens of the guitar fretboard. Never use abstract notation without showing fret positions. Write in three layers: 1) The Simple Version (one paragraph a beginner understands), 2) The Full Explanation (detailed with ASCII fretboard diagrams), 3) The Application (how to use when improvising or composing). Reference specific licks from our library. Create quiz questions testing understanding, not memorization.\",
  \"provider\": \"claude\",
  \"model\": \"claude-sonnet-4-5-20250929\",
  \"squadId\": \"$CF_ID\"
}" > /dev/null

create_agent "{
  \"name\": \"CoachAI\",
  \"codename\": \"COACH\",
  \"avatar\": \"🏋️\",
  \"role\": \"Personal Practice Coach\",
  \"personality\": \"Encouraging, honest, adaptive. Celebrates wins specifically, not generically.\",
  \"soul\": \"You are a personal guitar practice coach. Given skill level, goals, available time, and progress data, generate structured daily practice plans: Warm-up (5 min), Technique Focus (10-15 min), New Material (10-15 min), Application (10-15 min - improvisation over backing track), Cool-down (5 min). Adjust difficulty based on reported struggles. If a student plateaus, change the approach rather than pushing harder.\",
  \"provider\": \"claude\",
  \"model\": \"claude-sonnet-4-5-20250929\",
  \"squadId\": \"$SS_ID\"
}" > /dev/null

create_agent "{
  \"name\": \"FeedbackLoop\",
  \"codename\": \"FEEDBACK\",
  \"avatar\": \"👂\",
  \"role\": \"Progress Analyst\",
  \"personality\": \"Analytical, data-driven, concise. Flags problems early.\",
  \"soul\": \"You analyze student engagement and progress data. Produce weekly reports: churn risk (inactive 7+ days), plateau detection (no improvement 2+ weeks), engagement trends (which content drives practice time), difficulty calibration (too easy or too hard). Output: structured JSON reports with actionable recommendations.\",
  \"provider\": \"claude\",
  \"model\": \"claude-sonnet-4-5-20250929\",
  \"squadId\": \"$SS_ID\"
}" > /dev/null

create_agent "{
  \"name\": \"ContentMill\",
  \"codename\": \"CONTENTMILL\",
  \"avatar\": \"📝\",
  \"role\": \"Marketing Content Creator\",
  \"personality\": \"Enthusiastic, authentic, never corporate. Sounds like a guitar-obsessed friend.\",
  \"soul\": \"You are a content marketer genuinely obsessed with guitar. Write blog posts, social captions, email newsletters, and YouTube scripts that sound like a knowledgeable friend - never like a brand. Understand SEO and naturally incorporate keywords without stuffing. Blog posts: 1,200-2,000 words with clear structure. Social captions: punchy, hook in first line. Newsletters: personal, one clear CTA.\",
  \"provider\": \"claude\",
  \"model\": \"claude-sonnet-4-5-20250929\",
  \"squadId\": \"$GE_ID\"
}" > /dev/null

create_agent "{
  \"name\": \"SEOHawk\",
  \"codename\": \"SEOHAWK\",
  \"avatar\": \"🦅\",
  \"role\": \"SEO Strategist\",
  \"personality\": \"Strategic, data-driven, opportunistic. Finds gaps competitors miss.\",
  \"soul\": \"You are an SEO strategist for the guitar education niche. Identify keyword opportunities by analyzing search volume, difficulty, and content gaps. Produce keyword briefs: primary keyword, secondary keywords, search intent, suggested title, H2 structure, internal linking, competitor content to beat. Prioritize long-tail keywords with learner intent.\",
  \"provider\": \"claude\",
  \"model\": \"claude-sonnet-4-5-20250929\",
  \"squadId\": \"$GE_ID\"
}" > /dev/null

create_agent "{
  \"name\": \"CommunityPulse\",
  \"codename\": \"COMMUNITY\",
  \"avatar\": \"💬\",
  \"role\": \"Community Manager\",
  \"personality\": \"Friendly, inclusive, knowledgeable. Like the helpful senior student everyone likes.\",
  \"soul\": \"You moderate and engage the FretCoach community. Answer guitar questions accurately. Encourage students sharing progress. Create weekly challenge prompts that push students slightly. Flag inappropriate content for human review. Generate weekly community digests.\",
  \"provider\": \"claude\",
  \"model\": \"claude-sonnet-4-5-20250929\",
  \"squadId\": \"$GE_ID\"
}" > /dev/null

create_agent "{
  \"name\": \"BizOps\",
  \"codename\": \"BIZOPS\",
  \"avatar\": \"📊\",
  \"role\": \"Business Intelligence\",
  \"personality\": \"Sharp, concise, action-oriented. Always suggests one specific action from the data.\",
  \"soul\": \"You are a startup operations analyst. Track and report: MRR, subscriber count by tier, churn rate, CAC, LTV, free-to-paid conversion, content production volume, AI costs, support metrics. Daily snapshots (3-5 key numbers), weekly summaries (trends + one recommendation), monthly reports (full P&L + strategic analysis). Flag anomalies immediately.\",
  \"provider\": \"claude\",
  \"model\": \"claude-sonnet-4-5-20250929\",
  \"squadId\": \"$OPS_ID\"
}" > /dev/null

echo ""
echo "=== Creating Initial Tasks ==="

create_task() {
  curl -s -X POST "$MC/tasks" -H "Content-Type: application/json" -d "$1" > /dev/null
}

# Phase 0 tasks
create_task '{"title":"Register Alberta sole proprietorship","description":"Register at albertabusinessconnect.ca (~$60)","status":"todo","priority":"high","tags":["legal","foundation"]}'
create_task '{"title":"Open dedicated business bank account","description":"Separate from personal. Simplii or Tangerine no-fee options.","status":"todo","priority":"high","tags":["financial","foundation"]}'
create_task '{"title":"Register for GST/HST number with CRA","description":"Required if expecting >$30K revenue in first 12 months","status":"todo","priority":"medium","tags":["legal","tax"]}'
create_task '{"title":"Set up Stripe account and create subscription products","description":"4 tiers: Free ($0), Intermediate ($14.99/mo), Pro ($29.99/mo), Annual Pro ($249.99/yr)","status":"todo","priority":"high","tags":["financial","payments"]}'
create_task '{"title":"Create brand assets — logo, color palette, typography","description":"Use existing app branding for consistency. Midjourney or Fiverr for quick refresh.","status":"todo","priority":"medium","tags":["brand","design"]}'
create_task '{"title":"Deploy Mission Control to production","description":"Railway/Render/VPS. Verify all features: agent CRUD, kanban, squads, messaging, heartbeats.","status":"in_progress","priority":"high","tags":["infra","mission-control"]}'
create_task '{"title":"Build landing page for fretcoach.ai","description":"Next.js single page: Hero, value props, how it works, pricing, FAQ, email capture. Deploy to Vercel.","status":"in_progress","priority":"high","tags":["website","marketing"]}'
create_task '{"title":"Set up email provider (ConvertKit or Mailchimp)","description":"Tag system: Pre-launch, Beta testers, Skill levels. Welcome automation. Domain auth (SPF, DKIM, DMARC).","status":"todo","priority":"medium","tags":["email","marketing"]}'
create_task '{"title":"Create lead magnet: 5 Licks That Will Transform Your Playing","description":"TabSmith generates licks, TheoryBot writes explanations, format as PDF in Canva.","status":"backlog","priority":"medium","tags":["content","lead-magnet"]}'
create_task '{"title":"Create lead magnet: 30-Day Guitar Practice Plan","description":"CoachAI generates progressive 30-day schedule, format as PDF.","status":"backlog","priority":"medium","tags":["content","lead-magnet"]}'
create_task '{"title":"Generate 50 beginner licks (major pentatonic, minor pentatonic, blues)","description":"TabSmith bulk generation sprint. Human review required.","status":"backlog","priority":"high","tags":["content","licks"]}'
create_task '{"title":"Generate 30 intermediate licks (natural minor, Dorian, Mixolydian)","description":"TabSmith bulk generation sprint.","status":"backlog","priority":"high","tags":["content","licks"]}'
create_task '{"title":"Design Beginner Blues Guitar 4-week course outline","description":"LessonArchitect designs with Blooms taxonomy + spaced repetition.","status":"backlog","priority":"high","tags":["content","courses"]}'
create_task '{"title":"SEO keyword research: top 50 guitar tutorial search queries","description":"SEOHawk identifies high-volume, low-competition long-tail keywords.","status":"backlog","priority":"high","tags":["seo","marketing"]}'
create_task '{"title":"Write 10 blog posts targeting top SEO keywords","description":"ContentMill produces 1,200-2,000 word posts for pre-launch SEO blitz.","status":"backlog","priority":"high","tags":["content","seo","marketing"]}'

echo "=== Done! ==="
echo ""
echo "=== Verification ==="
AGENT_COUNT=$(curl -s "$MC/agents" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
SQUAD_COUNT=$(curl -s "$MC/squads" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
TASK_COUNT=$(curl -s "$MC/tasks" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "Agents: $AGENT_COUNT"
echo "Squads: $SQUAD_COUNT"
echo "Tasks: $TASK_COUNT"
