const Database = require('better-sqlite3');
const { v4: uuid } = require('uuid');

const db = new Database('/Users/andrewkershaw/mission-control/mission-control.db');

const agents = {
  TabSmith: 'ef350a8b-8427-4869-8c20-610db423a7c2',
  LessonArchitect: 'aeaea52a-0496-4c12-8b7d-28becd292cd6',
  TrackMaster: 'f9923f4e-aa84-4a9c-a519-234955b5d2fa',
  TheoryBot: 'b161b0ed-cb8f-464f-a211-dae7e44998c3',
  CoachAI: '0388146c-572a-4605-ae31-417e439bd002',
  FeedbackLoop: '18a32d6b-d57d-4010-b7f8-211dfb08782e',
  ContentMill: 'fc1fd5ea-0ffd-4e9d-9f6b-d9bfcc923e60',
  SEOHawk: 'b05470d4-efde-4b21-afa1-b48b98b8fba9',
  CommunityPulse: 'e1ea52a1-9ac8-4bce-b985-9979d5145510',
  BizOps: '09417c15-3e62-46e0-bd7d-15fb8aa0c184',
};

const tasks = [
  // TabSmith 🎸
  { agent: 'TabSmith', title: 'Generate 5 blues licks in E minor pentatonic', description: 'Create 5 intermediate-level blues guitar licks in E minor pentatonic. Include standard tab notation, suggested tempo (BPM), and playing tips for each lick. Focus on techniques like bends, slides, hammer-ons, and pull-offs. Each lick should be 1-2 bars.', tags: ['tabs', 'blues', 'licks'], priority: 'high' },
  { agent: 'TabSmith', title: 'Generate 5 jazz licks using the Dorian mode', description: 'Create 5 jazz guitar licks using D Dorian mode. Include tab notation, suggested tempo, and context for when to use each lick (e.g., over minor 7th chords). Include chromatic passing tones and jazz articulations.', tags: ['tabs', 'jazz', 'licks'], priority: 'high' },
  { agent: 'TabSmith', title: 'Create "Lick of the Week" series outline (12 weeks)', description: 'Design a 12-week "Lick of the Week" content series for FretCoach. Each week should feature a different style/technique. Include: week number, style, key, difficulty level, technique focus, and a brief description. Cover blues, rock, jazz, funk, country, and fingerstyle.', tags: ['tabs', 'content-series', 'planning'], priority: 'medium' },
  { agent: 'TabSmith', title: 'Generate beginner-friendly open position licks', description: 'Create 8 beginner-friendly guitar licks that use only open position (first 3 frets + open strings). Include tab notation and simple playing instructions. Focus on building confidence for new players. Cover basic techniques only.', tags: ['tabs', 'beginner', 'licks'], priority: 'medium' },
  { agent: 'TabSmith', title: 'Create sweep picking exercise patterns', description: 'Design 5 progressive sweep picking exercises from basic 3-string to advanced 5-6 string sweeps. Include tab notation, suggested starting tempo, and practice tips. Note common mistakes to avoid.', tags: ['tabs', 'technique', 'advanced'], priority: 'low' },

  // LessonArchitect 📐
  { agent: 'LessonArchitect', title: 'Design "Pentatonic Mastery" 8-week course outline', description: 'Create a comprehensive 8-week course outline for mastering the pentatonic scale on guitar. Include: weekly objectives, lesson breakdown, exercises, backing track suggestions, and assessment criteria. Progress from basic box shapes to connecting all 5 positions across the neck.', tags: ['course', 'pentatonic', 'curriculum'], priority: 'high' },
  { agent: 'LessonArchitect', title: 'Design "Blues Guitar Fundamentals" course', description: 'Design a complete beginner-to-intermediate blues guitar course. Cover: 12-bar blues, shuffle rhythm, blues scale, essential licks, turnarounds, intro/outros, and classic blues techniques (bends, vibrato, slides). Include lesson sequence, exercises, and recommended listening.', tags: ['course', 'blues', 'curriculum'], priority: 'high' },
  { agent: 'LessonArchitect', title: 'Create beginner onboarding lesson sequence', description: 'Design the first 7 lessons a brand new FretCoach user would experience. Cover: holding the guitar, basic chords (Em, Am, C, G, D), strumming patterns, reading tab, and playing a simple song. Focus on quick wins and motivation.', tags: ['onboarding', 'beginner', 'ux'], priority: 'critical' },
  { agent: 'LessonArchitect', title: 'Design "CAGED System Deep Dive" course', description: 'Create a course outline for understanding and applying the CAGED system. Cover all 5 shapes, chord voicings, scale patterns, arpeggios within each shape, and connecting shapes. Include practical musical examples, not just theory.', tags: ['course', 'caged', 'intermediate'], priority: 'medium' },
  { agent: 'LessonArchitect', title: 'Create practice routine templates (15min, 30min, 60min)', description: 'Design 3 structured practice routine templates: Quick (15min), Standard (30min), and Deep (60min). Each should include warm-up, technique, theory/knowledge, repertoire, and creative sections with time allocations. Provide beginner and intermediate versions of each.', tags: ['practice', 'routine', 'templates'], priority: 'high' },

  // TrackMaster 🎵
  { agent: 'TrackMaster', title: 'Write descriptions for 10 backing tracks', description: 'Write compelling descriptions for 10 backing tracks across genres: blues in A, jazz in Dm, rock in E, funk in Em, country in G, reggae in C, Latin in Am, metal in Drop D, pop in C, and soul in Bb. Each description should include: key, tempo, time sig, chord progression, suggested scales, mood, and difficulty.', tags: ['backing-tracks', 'catalog', 'content'], priority: 'high' },
  { agent: 'TrackMaster', title: 'Create backing track catalog structure', description: 'Design the data structure and organization for FretCoach\'s backing track library. Define categories, metadata fields, filtering/sorting options, difficulty ratings, and genre taxonomy. Consider how tracks relate to lessons and skill levels.', tags: ['product', 'catalog', 'architecture'], priority: 'medium' },
  { agent: 'TrackMaster', title: 'Design "Track of the Day" feature spec', description: 'Write a product spec for a "Track of the Day" feature. Include: selection algorithm (variety, difficulty matching, genre rotation), UI/UX description, notification strategy, social sharing, streak tracking, and how it integrates with the practice system.', tags: ['product', 'feature-spec', 'engagement'], priority: 'medium' },

  // TheoryBot 🧠
  { agent: 'TheoryBot', title: 'Write explanations for all 7 modes', description: 'Create guitarist-friendly explanations for all 7 modes of the major scale (Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian). For each mode include: interval formula, characteristic note, mood/sound description, common uses in music, example songs, and a simple fretboard pattern.', tags: ['theory', 'modes', 'education'], priority: 'high' },
  { agent: 'TheoryBot', title: 'Create "Theory Basics" content series', description: 'Design a 10-part "Theory Basics" content series covering: 1) What are intervals, 2) Major scale construction, 3) Minor scales, 4) How chords are built, 5) Major & minor triads, 6) 7th chords, 7) The number system, 8) Key signatures, 9) Chord functions (I, IV, V), 10) Putting it all together. Each part should be 500-800 words.', tags: ['theory', 'content-series', 'beginner'], priority: 'high' },
  { agent: 'TheoryBot', title: 'Explain circle of fifths for guitarists', description: 'Write a comprehensive but accessible guide to the Circle of Fifths specifically for guitarists. Include: what it is, why it matters, how to use it for finding key signatures, understanding chord relationships, transposing songs, and writing progressions. Use guitar-specific examples.', tags: ['theory', 'circle-of-fifths', 'guide'], priority: 'medium' },
  { agent: 'TheoryBot', title: 'Write chord progression guides', description: 'Create detailed guides for the most important chord progressions: 12-bar blues (and variations), jazz ii-V-I (and turnarounds), pop I-V-vi-IV, rock I-IV-V, soul/R&B progressions, and common modulations. Include: Roman numeral analysis, example keys, strumming patterns, and songs that use each.', tags: ['theory', 'chords', 'progressions'], priority: 'high' },

  // CoachAI 🏋️
  { agent: 'CoachAI', title: 'Design skill assessment questionnaire v2', description: 'Design a detailed skill assessment questionnaire for new FretCoach users. Cover: years playing, current skill level (self-assessed), genres of interest, goals, practice habits, theory knowledge, techniques known, songs they can play, equipment, and learning style preferences. Use a mix of multiple choice, sliders, and short answers.', tags: ['assessment', 'onboarding', 'ux'], priority: 'high' },
  { agent: 'CoachAI', title: 'Create adaptive difficulty algorithm spec', description: 'Write a specification for an adaptive difficulty algorithm that adjusts lesson/exercise difficulty based on user performance. Define: input signals (completion rate, accuracy, speed, streak), difficulty levels, adjustment rules, cooldown periods, and edge cases. Include pseudocode.', tags: ['algorithm', 'product', 'adaptive'], priority: 'high' },
  { agent: 'CoachAI', title: 'Write motivational practice tips (20 tips)', description: 'Write 20 motivational and practical tips for guitar practice. Mix mindset advice, technique tips, and practice strategies. Make them concise (2-3 sentences each), actionable, and encouraging. These will be shown as daily tips in the app.', tags: ['content', 'motivation', 'tips'], priority: 'medium' },
  { agent: 'CoachAI', title: 'Design streak/gamification system', description: 'Design a comprehensive gamification system for FretCoach including: daily practice streaks, XP/levels, badges/achievements, skill trees, weekly challenges, leaderboards, and milestone rewards. Define the mechanics, progression curves, and how it ties into learning outcomes without gamification-washing.', tags: ['gamification', 'product', 'engagement'], priority: 'high' },

  // FeedbackLoop 👂
  { agent: 'FeedbackLoop', title: 'Draft beta tester survey', description: 'Create a comprehensive beta tester survey for FretCoach. Cover: overall satisfaction, feature ratings, UI/UX feedback, content quality, bugs encountered, feature requests, likelihood to recommend, and open-ended feedback. Keep it under 15 questions. Include both quantitative and qualitative questions.', tags: ['feedback', 'survey', 'beta'], priority: 'high' },
  { agent: 'FeedbackLoop', title: 'Create App Store review response templates', description: 'Write 15 response templates for App Store reviews: 5 for positive reviews (varying star ratings), 5 for constructive/mixed reviews, and 5 for negative reviews covering common complaints (bugs, pricing, content). Templates should be professional, empathetic, and brand-consistent.', tags: ['feedback', 'app-store', 'templates'], priority: 'medium' },
  { agent: 'FeedbackLoop', title: 'Design feedback collection strategy', description: 'Design a comprehensive feedback collection strategy for FretCoach. Include: in-app feedback triggers (when/where), email surveys cadence, NPS implementation, user interviews plan, analytics event tracking, social listening, and how to prioritize and act on feedback. Define KPIs for each channel.', tags: ['feedback', 'strategy', 'product'], priority: 'medium' },
  { agent: 'FeedbackLoop', title: 'Write NPS survey questions', description: 'Create a Net Promoter Score survey for FretCoach with: the core NPS question, 5 follow-up questions based on score ranges (promoters, passives, detractors), and optional demographic questions. Include email subject lines and intro copy for the survey invitation.', tags: ['feedback', 'nps', 'survey'], priority: 'medium' },

  // ContentMill 📝
  { agent: 'ContentMill', title: 'Write 10 blog post outlines for fretcoach.ai/blog', description: 'Create 10 detailed blog post outlines for the FretCoach blog. Mix SEO-driven content, educational posts, and engagement content. Each outline should include: title, target keyword, word count target, intro hook, 4-6 section headers with bullet points, CTA, and internal linking opportunities. Topics should attract beginner-intermediate guitarists.', tags: ['content', 'blog', 'seo'], priority: 'high' },
  { agent: 'ContentMill', title: 'Write 20 Twitter/X posts about guitar learning', description: 'Write 20 engaging tweets for the @FretCoach Twitter account. Mix: educational tips (7), motivational quotes (5), engagement questions (4), and promotional (4). Include relevant hashtags. Vary formats: threads, single tweets, polls. Keep brand voice fun, encouraging, and knowledgeable.', tags: ['content', 'social', 'twitter'], priority: 'medium' },
  { agent: 'ContentMill', title: 'Create YouTube video script ideas (10 videos)', description: 'Create 10 YouTube video concepts for FretCoach\'s channel. For each include: title (SEO-optimized), thumbnail concept, video length, script outline (intro, sections, outro), key talking points, and CTA. Mix tutorial content, gear reviews, and entertainment. Target beginner-intermediate audience.', tags: ['content', 'youtube', 'video'], priority: 'medium' },
  { agent: 'ContentMill', title: 'Write email nurture sequence (5 emails)', description: 'Write a 5-email welcome/nurture sequence for new FretCoach subscribers. Email 1: Welcome + quick win. Email 2: Biggest mistake beginners make. Email 3: Practice routine guide. Email 4: Social proof + testimonials. Email 5: Soft CTA to try premium. Include subject lines, preview text, and full copy.', tags: ['content', 'email', 'nurture'], priority: 'high' },
  { agent: 'ContentMill', title: 'Create TikTok content ideas (15 short-form videos)', description: 'Create 15 TikTok/Reels content ideas for FretCoach. Each should include: hook (first 3 seconds), concept, visual description, text overlays, trending sound suggestion if applicable, and expected engagement type. Focus on viral potential: before/after, tips, challenges, satisfying sounds.', tags: ['content', 'tiktok', 'social'], priority: 'medium' },

  // SEOHawk 🦅
  { agent: 'SEOHawk', title: 'Keyword research: guitar learning app competitors', description: 'Conduct comprehensive keyword research for the guitar learning app space. Analyze keywords used by: Guitar Tricks, Fender Play, JustinGuitar, Yousician, and Ultimate Guitar. Identify: high-volume keywords, long-tail opportunities, content gaps, and keyword difficulty estimates. Organize by intent (informational, transactional, navigational).', tags: ['seo', 'research', 'competitive'], priority: 'high' },
  { agent: 'SEOHawk', title: 'Write meta descriptions for all fretcoach.ai pages', description: 'Write optimized meta titles and descriptions for FretCoach pages: Home, About, Features, Pricing, Blog, Lessons, Contact, FAQ, Privacy Policy, and Terms. Each should include primary keyword, compelling copy, and CTA within character limits (title: 60 chars, description: 155 chars).', tags: ['seo', 'on-page', 'meta'], priority: 'high' },
  { agent: 'SEOHawk', title: 'Create link building strategy', description: 'Design a link building strategy for fretcoach.ai. Include: target domains (guitar blogs, music education sites, tech review sites), outreach templates, guest posting plan, resource page targets, broken link opportunities, HARO/journalist outreach, and partnership link opportunities. Prioritize by effort vs impact.', tags: ['seo', 'link-building', 'strategy'], priority: 'medium' },
  { agent: 'SEOHawk', title: 'SEO audit recommendations for fretcoach.ai', description: 'Write comprehensive SEO audit recommendations for fretcoach.ai covering: technical SEO (site speed, mobile, crawlability, schema markup), on-page SEO (title tags, headings, content optimization), content strategy (blog topics, content calendar), and off-page SEO (backlinks, social signals). Prioritize by impact.', tags: ['seo', 'audit', 'technical'], priority: 'high' },
  { agent: 'SEOHawk', title: 'Long-tail keyword list for blog content', description: 'Generate a list of 50+ long-tail keywords for FretCoach blog content. Focus on questions guitarists ask: "how to...", "best way to...", "why does my guitar...". Organize by topic cluster: technique, theory, gear, practice, songs, and beginner tips. Include estimated search volume and difficulty.', tags: ['seo', 'keywords', 'content'], priority: 'medium' },

  // CommunityPulse 💬
  { agent: 'CommunityPulse', title: 'Design Discord server structure for FretCoach', description: 'Design the complete Discord server structure for the FretCoach community. Include: category layout, channel list with descriptions, role hierarchy, bot integrations, welcome flow, verification system, and content channels (show-and-tell, daily challenges, jam sessions). Max 20 channels to start.', tags: ['community', 'discord', 'structure'], priority: 'high' },
  { agent: 'CommunityPulse', title: 'Create community guidelines and rules', description: 'Write comprehensive community guidelines for the FretCoach community (applicable to Discord, Reddit, and social media). Cover: code of conduct, content policies, self-promotion rules, feedback etiquette, moderation policies, and consequences. Keep the tone friendly but clear.', tags: ['community', 'guidelines', 'moderation'], priority: 'high' },
  { agent: 'CommunityPulse', title: 'Plan launch week engagement strategy', description: 'Design a 7-day launch week engagement strategy for the FretCoach community launch. Include: daily themes, activities, giveaways, AMA schedule, content drops, social media coordination, influencer outreach, and success metrics. Create a minute-by-minute Day 1 plan.', tags: ['community', 'launch', 'strategy'], priority: 'high' },
  { agent: 'CommunityPulse', title: 'Draft welcome message sequences for new members', description: 'Write welcome message sequences for new FretCoach community members across platforms: Discord (DM + channel intro), email welcome, and social media. Include: warm greeting, community overview, key channels/resources, first steps, and community challenge invitation. 3 messages over first week.', tags: ['community', 'onboarding', 'messaging'], priority: 'medium' },
  { agent: 'CommunityPulse', title: 'Reddit engagement strategy for guitar subreddits', description: 'Create a Reddit engagement strategy for FretCoach. Identify top guitar subreddits (r/guitar, r/guitarlessons, r/musictheory, etc.), analyze posting patterns, define content types that perform well, create a posting schedule, and write 10 value-add post templates. Note Reddit self-promotion rules.', tags: ['community', 'reddit', 'strategy'], priority: 'medium' },

  // BizOps 📊
  { agent: 'BizOps', title: 'Create financial model/projections outline', description: 'Create a financial model outline for FretCoach covering 24 months. Include: revenue streams (subscriptions, one-time purchases, partnerships), pricing tiers, user growth assumptions, CAC/LTV calculations, operating costs, break-even analysis, and key assumptions. Provide template structure with formulas.', tags: ['business', 'finance', 'projections'], priority: 'high' },
  { agent: 'BizOps', title: 'Design KPI dashboard requirements v2', description: 'Define requirements for FretCoach\'s business KPI dashboard. Include: key metrics (MRR, DAU, MAU, churn, retention, NPS, CAC, LTV), data sources, visualization types, alert thresholds, update frequency, and user access levels. Design for both executive summary and detailed drill-down views.', tags: ['business', 'kpi', 'analytics'], priority: 'medium' },
  { agent: 'BizOps', title: 'Write investor pitch outline', description: 'Write a comprehensive investor pitch deck outline for FretCoach. Cover: problem, solution, market size (TAM/SAM/SOM), product demo highlights, business model, traction/metrics, competitive landscape, team, go-to-market strategy, financial projections, funding ask, and use of funds. Include key talking points for each slide.', tags: ['business', 'fundraising', 'pitch'], priority: 'high' },
  { agent: 'BizOps', title: 'Competitive analysis: Guitar Tricks, Fender Play, JustinGuitar, Yousician', description: 'Conduct detailed competitive analysis of the top 4 guitar learning platforms: Guitar Tricks, Fender Play, JustinGuitar, and Yousician. For each: pricing, features, content library, UX/UI quality, target audience, strengths, weaknesses, market positioning. Include a comparison matrix and identify FretCoach\'s differentiation opportunities.', tags: ['business', 'competitive', 'research'], priority: 'high' },
  { agent: 'BizOps', title: 'Pricing strategy analysis with market comparisons', description: 'Analyze pricing strategies in the guitar learning app market and recommend FretCoach\'s pricing. Cover: competitor pricing analysis, price sensitivity considerations, freemium vs premium models, suggested tier structure, feature gating strategy, annual vs monthly pricing, launch pricing vs long-term, and regional pricing considerations.', tags: ['business', 'pricing', 'strategy'], priority: 'high' },
];

const insert = db.prepare(
  `INSERT INTO tasks (id, title, description, status, priority, assignee_id, tags, created_at, updated_at)
   VALUES (?, ?, ?, 'todo', ?, ?, ?, datetime('now'), datetime('now'))`
);

const insertAll = db.transaction(() => {
  for (const t of tasks) {
    insert.run(
      uuid(),
      t.title,
      t.description,
      t.priority,
      agents[t.agent],
      JSON.stringify(t.tags)
    );
  }
});

insertAll();

console.log(`✅ Seeded ${tasks.length} tasks`);

// Verify
const counts = db.prepare("SELECT status, COUNT(*) as c FROM tasks GROUP BY status").all();
console.log('Task counts by status:', counts);
