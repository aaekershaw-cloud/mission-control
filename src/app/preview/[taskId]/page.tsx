'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  Eye,
  Code,
  Smartphone,
  Monitor,
  Instagram,
  Twitter,
  Globe,
  CheckCircle,
  RotateCcw,
  XCircle,
  Copy,
  Check,
  Music,
  BookOpen,
  GraduationCap,
  Target,
  Clock,
  ChevronDown,
  ChevronRight,
  Play,
} from 'lucide-react';

type PreviewTab = 'rendered' | 'html' | 'social' | 'raw';

interface TaskResult {
  response: string;
  agent_name: string;
  agent_avatar: string;
  duration_ms: number;
  tokens_used: number;
  cost_usd: number;
}

interface TaskData {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  tags: string;
  assignee_name: string;
  assignee_avatar: string;
}

type ContentType = 'html' | 'markdown' | 'json-licks' | 'json-course' | 'json-lessons' | 'json-other' | 'text';

function tryFixJson(s: string): unknown {
  // Try as-is first
  try { return JSON.parse(s); } catch { /* */ }
  
  // Use jsonrepair for truncated/malformed JSON
  try {
    const { jsonrepair } = require('jsonrepair');
    const repaired = jsonrepair(s);
    return JSON.parse(repaired);
  } catch { return null; }
}

function detectContentType(response: string): ContentType {
  const trimmed = response.trim();
  // Strip code fences to inspect actual content
  let inner = trimmed;
  if (inner.startsWith('```html')) return 'html';
  if (inner.startsWith('```json')) {
    inner = inner.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<div')) return 'html';

  // Try JSON parse (including truncated JSON repair)
  const parsed = tryFixJson(inner);
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed)) {
      const first = (parsed as Record<string, unknown>[])[0];
      if (first?.lick_name || first?.scale || first?.tab || first?.tab_notation) return 'json-licks';
      if (first?.lessonNumber || first?.lessonTitle) return 'json-lessons';
      return 'json-other';
    }
    const obj = parsed as Record<string, unknown>;
    if (obj.courseTitle || obj.lessons) return 'json-course';
    if (obj.lick_name) return 'json-licks';
    return 'json-other';
  }

  if (/^#{1,3}\s/m.test(trimmed) || /\*\*[^*]+\*\*/m.test(trimmed) || /^[-*]\s/m.test(trimmed)) return 'markdown';
  return 'text';
}

function extractContent(response: string): string {
  const trimmed = response.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return trimmed;
}

function extractJson(response: string): unknown {
  const clean = extractContent(response);
  const result = tryFixJson(clean);
  if (result) return result;
  
  // Try to find JSON in the response
  const jsonMatch = clean.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) {
    const inner = tryFixJson(jsonMatch[1]);
    if (inner) return inner;
  }
  return null;
}

/* ─── Lick Preview ─── */
function LickCard({ lick, index }: { lick: Record<string, unknown>; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const tab = (lick.tab || lick.tablature || lick.tab_notation || '') as string;
  const techniques = (lick.techniques || lick.technique || []) as string[];
  const tips = lick.playing_tips || lick.practice_tips || lick.tips || null;

  return (
    <div className="glass rounded-xl overflow-hidden border border-white/5 hover:border-amber-500/20 transition-all">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-5 py-4 border-b border-white/5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-lg">#{index + 1}</span>
              <h3 className="text-base font-semibold text-slate-100">{lick.lick_name as string || lick.name as string || `Lick ${index + 1}`}</h3>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              {lick.scale ? <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20">{String(lick.scale)}</span> : null}
              {lick.key ? <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/15 text-purple-400 border border-purple-500/20">Key: {String(lick.key)}</span> : null}
              {lick.difficulty ? <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">{String(lick.difficulty)}</span> : null}
              {lick.tempo ? <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/15 text-slate-400 border border-slate-500/20">♩ {String(lick.tempo)} BPM</span> : null}
            </div>
          </div>
          <Music className="text-amber-400/40" size={24} />
        </div>
      </div>

      {/* Tab notation */}
      {tab && (
        <div className="bg-[#1a1a2e] p-4 font-mono text-sm overflow-x-auto">
          <pre className="text-amber-200/90 leading-relaxed whitespace-pre">{tab}</pre>
        </div>
      )}

      {/* Body */}
      <div className="px-5 py-4 space-y-3">
        {/* Techniques */}
        {Array.isArray(techniques) && techniques.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Techniques:</span>
            {techniques.map((t, i) => (
              <span key={i} className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/15">{t}</span>
            ))}
          </div>
        )}

        {/* Description / Tips */}
        {(lick.description || tips || lick.notes) && (
          <div>
            <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {expanded ? 'Hide' : 'Show'} details
            </button>
            {expanded && (
              <div className="mt-2 text-sm text-slate-400 leading-relaxed space-y-2">
                {lick.description && <p>{lick.description as string}</p>}
                {tips && (
                  <div>
                    <span className="text-xs text-slate-500 font-medium">Tips: </span>
                    <span>{typeof tips === 'string' ? tips : (tips as string[]).join(' • ')}</span>
                  </div>
                )}
                {lick.notes && <p className="text-xs italic text-slate-500">{lick.notes as string}</p>}
              </div>
            )}
          </div>
        )}

        {/* Fret range */}
        {(lick.fret_range || lick.position) && (
          <div className="text-[11px] text-slate-500">
            Position: {(lick.fret_range || lick.position) as string}
          </div>
        )}
      </div>
    </div>
  );
}

function LicksPreview({ data }: { data: unknown }) {
  const licks = Array.isArray(data) ? data : [data];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Music className="text-amber-400" size={18} />
        <h2 className="text-lg font-bold text-slate-100">{licks.length} Lick{licks.length !== 1 ? 's' : ''}</h2>
      </div>
      {licks.map((lick, i) => (
        <LickCard key={i} lick={lick as Record<string, unknown>} index={i} />
      ))}
    </div>
  );
}

/* ─── Course / Lesson Preview ─── */
function LessonCard({ lesson, index }: { lesson: Record<string, unknown>; index: number }) {
  const [expanded, setExpanded] = useState(false);
  // Support both activity-array format and named-section format
  let activities = (lesson.activities || []) as Record<string, unknown>[];
  if (activities.length === 0) {
    // Build activities from named sections
    const sectionKeys = ['conceptIntroduction', 'concept_introduction', 'demonstration', 'guidedPractice', 'guided_practice', 'independentApplication', 'independent_application', 'assessment'];
    for (const key of sectionKeys) {
      if (lesson[key] && typeof lesson[key] === 'object') {
        const sec = lesson[key] as Record<string, unknown>;
        activities.push({ ...sec, activityType: sec.activityType || key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim() });
      }
    }
  }
  const objectives = (lesson.learningObjectives || lesson.learning_objectives || []) as string[];

  return (
    <div className="glass rounded-xl overflow-hidden border border-white/5 hover:border-emerald-500/20 transition-all">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0">
          {(lesson.lessonNumber as number) || index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-100">{lesson.lessonTitle as string || lesson.title as string || `Lesson ${index + 1}`}</h3>
          {lesson.bloomsLevel && (
            <p className="text-[11px] text-slate-500 mt-0.5">Bloom&apos;s: {lesson.bloomsLevel as string}</p>
          )}
          {objectives.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Target size={10} className="text-emerald-400/60 shrink-0" />
              <span className="text-[11px] text-slate-500 truncate">{objectives[0]}{objectives.length > 1 ? ` +${objectives.length - 1} more` : ''}</span>
            </div>
          )}
        </div>
        <div className="shrink-0 text-slate-500">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-4 border-t border-white/5 pt-4">
          {/* Objectives */}
          {objectives.length > 0 && (
            <div>
              <h4 className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                <Target size={12} className="text-emerald-400" />
                Learning Objectives
              </h4>
              <ul className="space-y-1.5">
                {objectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle size={12} className="text-emerald-400/50 mt-1 shrink-0" />
                    {obj}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Activities */}
          {activities.length > 0 && (
            <div>
              <h4 className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                <Play size={12} className="text-blue-400" />
                Activities ({activities.length})
              </h4>
              <div className="space-y-3">
                {activities.map((act, i) => (
                  <div key={i} className="glass-sm rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/15">
                        {act.activityType as string || 'Activity'}
                      </span>
                      <span className="text-xs font-medium text-slate-200">{act.title as string}</span>
                    </div>
                    {act.content && <p className="text-xs text-slate-400 leading-relaxed mt-1">{act.content as string}</p>}
                    {act.tasks && (
                      <ul className="mt-2 space-y-1">
                        {(act.tasks as string[]).map((task, j) => (
                          <li key={j} className="text-xs text-slate-400 flex items-start gap-1.5">
                            <span className="text-slate-600">→</span> {task}
                          </li>
                        ))}
                      </ul>
                    )}
                    {act.successCriteria && (
                      <div className="mt-2 px-2 py-1.5 rounded bg-emerald-500/5 border border-emerald-500/10">
                        <span className="text-[10px] text-emerald-400 font-medium">✓ Success Criteria: </span>
                        <span className="text-[11px] text-emerald-300/80">{act.successCriteria as string}</span>
                      </div>
                    )}
                    {act.questions && (
                      <div className="mt-2 space-y-1">
                        <span className="text-[10px] text-amber-400 font-medium">Assessment:</span>
                        {(act.questions as string[]).map((q, j) => (
                          <p key={j} className="text-xs text-slate-400 pl-2">• {q}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CoursePreview({ data }: { data: unknown }) {
  const course = data as Record<string, unknown>;
  const lessons = (course.lessons || []) as Record<string, unknown>[];
  const isLessonArray = Array.isArray(data) && ((data as Record<string, unknown>[])[0]?.lessonNumber || (data as Record<string, unknown>[])[0]?.lessonTitle);

  const lessonList = isLessonArray ? (data as Record<string, unknown>[]) : lessons;

  return (
    <div className="space-y-4">
      {/* Course header */}
      {course.courseTitle && (
        <div className="glass rounded-xl p-6 bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 border border-emerald-500/10">
          <div className="flex items-start gap-3">
            <GraduationCap className="text-emerald-400 shrink-0" size={28} />
            <div>
              <h2 className="text-xl font-bold text-slate-100">{course.courseTitle as string}</h2>
              {(course.courseDescription || course.description) && (
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">{(course.courseDescription || course.description) as string}</p>
              )}
              <div className="flex items-center gap-4 mt-3">
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <BookOpen size={12} />
                  {lessonList.length} Lessons
                </span>
                {course.duration && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock size={12} />
                    {course.duration as string}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lessons */}
      <div className="space-y-2">
        {lessonList.map((lesson, i) => (
          <LessonCard key={i} lesson={lesson} index={i} />
        ))}
      </div>
    </div>
  );
}

/* ─── JSON Fallback ─── */
function JsonPreview({ data }: { data: unknown }) {
  return (
    <div className="glass rounded-xl overflow-hidden">
      <pre className="p-5 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

/* ─── Social Preview ─── */
function SocialPreview({ content, platform }: { content: string; platform: 'instagram' | 'twitter' }) {
  const posts = content.split(/\n---\n/).map(p => p.trim()).filter(Boolean);

  if (platform === 'instagram') {
    return (
      <div className="space-y-6">
        {posts.map((post, i) => (
          <div key={i} className="max-w-[420px] mx-auto bg-white rounded-xl overflow-hidden shadow-xl">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold">FC</div>
              <div>
                <p className="text-sm font-semibold text-gray-900">fretcoach.ai</p>
                <p className="text-[10px] text-gray-500">Sponsored</p>
              </div>
            </div>
            <div className="w-full aspect-square bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
              <div className="text-center">
                <p className="text-amber-400 text-4xl mb-2">🎸</p>
                <p className="text-amber-400/60 text-sm font-medium">FretCoach.ai</p>
              </div>
            </div>
            <div className="flex items-center gap-4 px-4 py-2.5">
              <span className="text-xl">♡</span>
              <span className="text-xl">💬</span>
              <span className="text-xl">📤</span>
              <span className="text-xl ml-auto">🔖</span>
            </div>
            <div className="px-4 pb-4">
              <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
                <span className="font-semibold">fretcoach.ai </span>
                {post.replace(/^\*\*.*?\*\*\n*/m, '').replace(/^#+\s.*\n*/gm, '')}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {posts.map((post, i) => (
        <div key={i} className="max-w-[520px] mx-auto bg-black border border-gray-700 rounded-2xl overflow-hidden">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-sm font-bold shrink-0">FC</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-white font-bold text-[15px]">FretCoach.ai</span>
                  <span className="text-blue-400 text-sm">✓</span>
                  <span className="text-gray-500 text-sm">@fretcoach_ai · 1h</span>
                </div>
                <p className="text-white text-[15px] leading-relaxed mt-1 whitespace-pre-wrap">
                  {post.replace(/^\*\*.*?\*\*\n*/m, '').replace(/^#+\s.*\n*/gm, '').slice(0, 280)}
                </p>
                <div className="flex items-center justify-between mt-3 text-gray-500 text-sm max-w-[380px]">
                  <span>💬 12</span>
                  <span>🔁 28</span>
                  <span>♡ 142</span>
                  <span>📊 2.4K</span>
                  <span>📤</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Page ─── */
export default function PreviewPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  const [task, setTask] = useState<TaskData | null>(null);
  const [result, setResult] = useState<TaskResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PreviewTab>('rendered');
  const [socialPlatform, setSocialPlatform] = useState<'instagram' | 'twitter'>('instagram');
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [copied, setCopied] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    fetch(`/api/tasks/${taskId}/review`)
      .then(r => r.json())
      .then(data => {
        setTask(data.task);
        setResult(data.result);
        if (data.result) {
          const type = detectContentType(data.result.response);
          if (type === 'html') setActiveTab('html');
          else setActiveTab('rendered');
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [taskId]);

  const contentType = useMemo(() => result ? detectContentType(result.response) : 'text', [result]);
  const cleanContent = useMemo(() => result ? extractContent(result.response) : '', [result]);
  const jsonData = useMemo(() => {
    if (contentType.startsWith('json')) return extractJson(result?.response || '');
    return null;
  }, [result, contentType]);

  async function handleReviewAction(action: 'approve' | 'reject' | 'revise') {
    if ((action === 'reject' || action === 'revise') && !reviewFeedback.trim()) return;
    setReviewLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, feedback: reviewFeedback.trim() || undefined }),
      });
      if (res.ok) {
        // If inside an iframe (preview overlay), message parent to close & refresh
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'preview-action', action, taskId }, '*');
        } else {
          router.push('/');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReviewLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(cleanContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading preview...</div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-slate-400">No content to preview</div>
      </div>
    );
  }

  const tabs: { id: PreviewTab; label: string; icon: React.ReactNode }[] = [
    { id: 'rendered', label: contentType.startsWith('json-lick') ? 'Licks' : contentType.startsWith('json-course') || contentType === 'json-lessons' ? 'Course' : 'Rendered', icon: <Eye size={14} /> },
    ...(contentType === 'html' ? [{ id: 'html' as PreviewTab, label: 'HTML Preview', icon: <Globe size={14} /> }] : []),
    { id: 'social', label: 'Social', icon: <Instagram size={14} /> },
    { id: 'raw', label: 'Raw', icon: <Code size={14} /> },
  ];

  const contentTypeLabel = {
    'html': 'HTML',
    'markdown': 'Markdown',
    'json-licks': 'Licks',
    'json-course': 'Course',
    'json-lessons': 'Lessons',
    'json-other': 'JSON',
    'text': 'Text',
  }[contentType];

  return (
    <div className="h-screen bg-[#0a0a0f] text-slate-200 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-[#0d1117]/95 backdrop-blur-md border-b border-white/5 shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={() => router.push('/')} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-all">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">{task?.title}</h1>
            <p className="text-[11px] text-slate-500">
              {result.agent_avatar} {result.agent_name} · {result.tokens_used} tokens · {(result.duration_ms / 1000).toFixed(1)}s · ${(result.cost_usd || 0).toFixed(4)}
            </p>
          </div>
          <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-white/10 transition-all">
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <span className="px-2 py-1 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase">
            {contentTypeLabel}
          </span>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}

          {activeTab === 'social' && (
            <div className="ml-3 flex items-center gap-1 border-l border-white/10 pl-3">
              <button onClick={() => setSocialPlatform('instagram')} className={`px-2 py-1 rounded text-xs transition-all ${socialPlatform === 'instagram' ? 'bg-pink-500/20 text-pink-400' : 'text-slate-500 hover:text-slate-300'}`}>
                <Instagram size={14} />
              </button>
              <button onClick={() => setSocialPlatform('twitter')} className={`px-2 py-1 rounded text-xs transition-all ${socialPlatform === 'twitter' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
                <Twitter size={14} />
              </button>
            </div>
          )}

          {activeTab === 'html' && (
            <div className="ml-3 flex items-center gap-1 border-l border-white/10 pl-3">
              <button onClick={() => setViewport('desktop')} className={`px-2 py-1 rounded text-xs transition-all ${viewport === 'desktop' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
                <Monitor size={14} />
              </button>
              <button onClick={() => setViewport('mobile')} className={`px-2 py-1 rounded text-xs transition-all ${viewport === 'mobile' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
                <Smartphone size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex gap-6">
            {/* Main preview */}
            <div className="flex-1 min-w-0">
              {activeTab === 'rendered' && (
                <>
                  {contentType === 'json-licks' && jsonData && <LicksPreview data={jsonData} />}
                  {(contentType === 'json-course' || contentType === 'json-lessons') && jsonData && <CoursePreview data={jsonData} />}
                  {contentType === 'json-other' && jsonData && <JsonPreview data={jsonData} />}
                  {(contentType === 'markdown' || contentType === 'text') && (
                    <div className="glass p-6 rounded-xl prose prose-invert prose-sm max-w-none prose-headings:text-slate-100 prose-p:text-slate-300 prose-strong:text-slate-200 prose-li:text-slate-300 prose-a:text-emerald-400 prose-code:text-amber-300 prose-pre:bg-black/40">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanContent}</ReactMarkdown>
                    </div>
                  )}
                  {contentType === 'html' && (
                    <div className="glass rounded-xl overflow-hidden">
                      <iframe srcDoc={cleanContent} className="w-full bg-white" style={{ height: '80vh', border: 'none' }} sandbox="allow-scripts" title="HTML Preview" />
                    </div>
                  )}
                </>
              )}

              {activeTab === 'html' && (
                <div className={`mx-auto transition-all duration-300 ${viewport === 'mobile' ? 'max-w-[390px]' : 'max-w-full'}`}>
                  <div className="glass rounded-xl overflow-hidden">
                    {viewport === 'mobile' && (
                      <div className="bg-gray-900 px-4 py-2 flex items-center justify-center">
                        <div className="w-20 h-1 bg-gray-700 rounded-full" />
                      </div>
                    )}
                    <iframe srcDoc={cleanContent} className="w-full bg-white" style={{ height: '80vh', border: 'none' }} sandbox="allow-scripts" title="HTML Preview" />
                  </div>
                </div>
              )}

              {activeTab === 'social' && (
                <div className="py-4">
                  <SocialPreview content={cleanContent} platform={socialPlatform} />
                </div>
              )}

              {activeTab === 'raw' && (
                <div className="glass rounded-xl overflow-hidden">
                  <pre className="p-4 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">
                    {result.response}
                  </pre>
                </div>
              )}
            </div>

            {/* Review sidebar */}
            {task?.status === 'review' && (
              <div className="w-72 shrink-0">
                <div className="glass rounded-xl p-4 space-y-4 sticky top-6">
                  <h3 className="text-sm font-semibold text-slate-200">Review</h3>

                  <textarea
                    value={reviewFeedback}
                    onChange={e => setReviewFeedback(e.target.value)}
                    placeholder="Feedback for revision..."
                    rows={4}
                    className="w-full glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none resize-none focus:border-amber-500/30 transition-colors rounded-lg"
                  />

                  <div className="space-y-2">
                    <button onClick={() => handleReviewAction('approve')} disabled={reviewLoading} className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all disabled:opacity-50">
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button onClick={() => handleReviewAction('revise')} disabled={reviewLoading || !reviewFeedback.trim()} className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-blue-300 bg-blue-500/15 border border-blue-500/30 hover:bg-blue-500/25 transition-all disabled:opacity-50">
                      <RotateCcw size={14} /> Revise
                    </button>
                    <button onClick={() => handleReviewAction('reject')} disabled={reviewLoading || !reviewFeedback.trim()} className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-red-300 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 transition-all disabled:opacity-50">
                      <XCircle size={14} /> Reject
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    Approve → Done. Revise/Reject require feedback and send back to queue.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
