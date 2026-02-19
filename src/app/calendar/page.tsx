'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  type: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  metadata: any;
}

const EVENT_COLORS = {
  manual: '#9333ea', // purple-600
  task: '#10b981', // emerald-500
  content: '#f97316', // orange-500
  cron: '#3b82f6', // blue-500
  social: '#ec4899', // pink-500
};

const EVENT_ICONS = {
  manual: '🟣',
  task: '🟢', 
  content: '🟠',
  cron: '🔵',
  social: '📱',
};

const SOCIAL_PLATFORMS = {
  x: { icon: '𝕏', label: 'X/Twitter', color: '#000000' },
  instagram: { icon: '📷', label: 'Instagram', color: '#E4405F' },
  tiktok: { icon: '🎵', label: 'TikTok', color: '#000000' },
  youtube: { icon: '📺', label: 'YouTube', color: '#FF0000' },
};

const EVENT_TYPES = [
  { id: 'cron', label: 'Cron Jobs', icon: '🔵', color: '#3b82f6' },
  { id: 'tasks', label: 'Tasks', icon: '🟢', color: '#10b981' },
  { id: 'content', label: 'Content', icon: '🟠', color: '#f97316' },
  { id: 'social', label: 'Social', icon: '📱', color: '#ec4899' },
  { id: 'manual', label: 'Manual', icon: '🟣', color: '#9333ea' },
];

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [eventTypeFilters, setEventTypeFilters] = useState<string[]>([]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const filterParam = eventTypeFilters.length > 0 ? `&filters=${eventTypeFilters.join(',')}` : '';
      const res = await fetch(`/api/calendar?year=${year}&month=${month}${filterParam}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentMonth, eventTypeFilters]);

  const toggleEventTypeFilter = (type: string) => {
    setEventTypeFilters(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad with previous month days to fill first week
  const firstDayOfWeek = monthStart.getDay(); // 0 = Sunday
  const paddingDays = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(monthStart);
    date.setDate(date.getDate() - (i + 1));
    paddingDays.push(date);
  }

  // Pad with next month days to fill last week
  const lastDayOfWeek = monthEnd.getDay(); // 0 = Sunday
  const trailingDays = [];
  for (let i = 1; i <= (6 - lastDayOfWeek); i++) {
    const date = new Date(monthEnd);
    date.setDate(date.getDate() + i);
    trailingDays.push(date);
  }

  const allDays = [...paddingDays, ...monthDays, ...trailingDays];

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start);
      return isSameDay(eventDate, day);
    });
  };

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  const handleCreateEvent = async (eventData: {
    title: string;
    description: string;
    start_time: string;
    end_time?: string;
    all_day: boolean;
    color: string;
  }) => {
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });
      if (res.ok) {
        fetchEvents();
        setShowEventModal(false);
      }
    } catch (error) {
      console.error('Failed to create event:', error);
    }
  };

  const handleCreateSocialPost = async (postData: {
    title: string;
    content: string;
    platform: string;
    publish_time: string;
    image_url?: string;
  }) => {
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: postData.title,
          description: `${SOCIAL_PLATFORMS[postData.platform as keyof typeof SOCIAL_PLATFORMS]?.label || postData.platform} post`,
          start_time: postData.publish_time,
          event_type: 'social',
          color: '#ec4899', // pink-500
          metadata: {
            platform: postData.platform,
            content: postData.content,
            image_url: postData.image_url,
            status: 'scheduled'
          }
        }),
      });
      if (res.ok) {
        fetchEvents();
        setShowSocialModal(false);
      }
    } catch (error) {
      console.error('Failed to create social post:', error);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newMonth;
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">📅 Calendar</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-xl font-semibold text-white min-w-[200px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedDay(new Date());
              setShowSocialModal(true);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-pink-500 text-white rounded-lg font-medium hover:bg-pink-400 transition-all"
          >
            <span>📱</span>
            Social Post
          </button>
          <button
            onClick={() => setShowEventModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg font-medium hover:bg-amber-400 transition-all"
          >
            <Plus size={18} />
            Add Event
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-xl">
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-300">Show:</span>
          <div className="flex items-center gap-3 flex-wrap">
            {EVENT_TYPES.map((type) => (
              <label key={type.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={eventTypeFilters.length === 0 || eventTypeFilters.includes(type.id)}
                  onChange={() => toggleEventTypeFilter(type.id)}
                  className="rounded border-white/20 bg-white/5 text-amber-500"
                />
                <span className="text-sm text-slate-300">
                  {type.icon} {type.label}
                </span>
              </label>
            ))}
            {eventTypeFilters.length > 0 && (
              <button
                onClick={() => setEventTypeFilters([])}
                className="text-xs text-slate-400 hover:text-slate-200 underline"
              >
                Show All
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Calendar Grid */}
        <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-slate-400 text-sm font-medium py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-2 flex-1">
            {allDays.map((day, index) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const isCurrentDay = isToday(day);

              return (
                <button
                  key={index}
                  onClick={() => setSelectedDay(day)}
                  className={`
                    relative min-h-[120px] p-2 rounded-lg border transition-all text-left
                    ${isCurrentMonth ? 'border-white/10 hover:border-white/20' : 'border-white/5 opacity-40'}
                    ${isSelected ? 'border-amber-500 bg-amber-500/10' : ''}
                    ${isCurrentDay ? 'bg-amber-500/20 border-amber-500/50' : ''}
                    hover:bg-white/5
                  `}
                >
                  <div className={`text-sm font-medium mb-1 ${isCurrentDay ? 'text-amber-400' : 'text-white'}`}>
                    {format(day, 'd')}
                  </div>
                  
                  {/* Event dots */}
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className="text-xs px-1.5 py-0.5 rounded truncate text-white cursor-pointer hover:opacity-80"
                        style={{ backgroundColor: event.color + '80' }}
                        title={event.title}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(event);
                        }}
                      >
                        {event.type === 'social' && event.metadata?.platform 
                          ? SOCIAL_PLATFORMS[event.metadata.platform as keyof typeof SOCIAL_PLATFORMS]?.icon || '📱'
                          : EVENT_ICONS[event.type as keyof typeof EVENT_ICONS]
                        } {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-slate-400">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Event Detail Panel */}
        {selectedDay && (
          <div className="w-80 bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {format(selectedDay, 'MMM d, yyyy')}
              </h3>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {selectedDayEvents.length === 0 ? (
                <p className="text-slate-400 text-sm">No events for this day</p>
              ) : (
                selectedDayEvents.map((event) => (
                  <div 
                    key={event.id} 
                    className="p-3 rounded-lg border border-white/10 cursor-pointer hover:border-white/20"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-lg">
                        {event.type === 'social' && event.metadata?.platform 
                          ? SOCIAL_PLATFORMS[event.metadata.platform as keyof typeof SOCIAL_PLATFORMS]?.icon || '📱'
                          : EVENT_ICONS[event.type as keyof typeof EVENT_ICONS]
                        }
                      </span>
                      <div className="flex-1">
                        <h4 className="text-white font-medium">{event.title}</h4>
                        {event.description && (
                          <p className="text-slate-300 text-sm mt-1">{event.description}</p>
                        )}
                        {event.type === 'social' && event.metadata?.content && (
                          <p className="text-slate-300 text-sm mt-1 line-clamp-2">
                            {event.metadata.content}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-xs text-slate-400 space-y-1">
                      <div>Type: {event.type}</div>
                      {!event.allDay && (
                        <div>Time: {format(new Date(event.start), 'h:mm a')}</div>
                      )}
                      {event.metadata?.agent && (
                        <div>Agent: {event.metadata.avatar} {event.metadata.agent}</div>
                      )}
                      {event.metadata?.platform && (
                        <div>Platform: {SOCIAL_PLATFORMS[event.metadata.platform as keyof typeof SOCIAL_PLATFORMS]?.label || event.metadata.platform}</div>
                      )}
                      {event.metadata?.status && (
                        <div>Status: <span className={event.metadata.status === 'posted' ? 'text-emerald-400' : 'text-amber-400'}>
                          {event.metadata.status}
                        </span></div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {showEventModal && (
        <EventModal
          onClose={() => setShowEventModal(false)}
          onCreate={handleCreateEvent}
          selectedDate={selectedDay}
        />
      )}

      {/* Social Post Modal */}
      {showSocialModal && (
        <SocialPostModal
          onClose={() => setShowSocialModal(false)}
          onCreate={handleCreateSocialPost}
          selectedDate={selectedDay}
        />
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}

// Event creation modal component
function EventModal({
  onClose,
  onCreate,
  selectedDate
}: {
  onClose: () => void;
  onCreate: (data: any) => void;
  selectedDate: Date | null;
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_time: selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm") : '',
    end_time: '',
    all_day: false,
    color: '#f59e0b',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    
    onCreate({
      ...formData,
      start_time: formData.start_time || new Date().toISOString(),
      end_time: formData.end_time || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Create Event</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400"
              placeholder="Event title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 resize-none"
              rows={3}
              placeholder="Event description"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                End Time
              </label>
              <input
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.all_day}
                onChange={(e) => setFormData(prev => ({ ...prev, all_day: e.target.checked }))}
                className="rounded border-white/20 bg-white/5 text-amber-500"
              />
              <span className="text-sm text-slate-300">All day</span>
            </label>

            <div className="ml-auto flex items-center gap-2">
              <label className="text-sm text-slate-300">Color:</label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                className="w-8 h-8 rounded border border-white/10 bg-transparent"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-white/10 rounded-lg text-slate-300 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-amber-500 text-black rounded-lg font-medium hover:bg-amber-400 transition-all"
            >
              Create Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Social Post Modal component
function SocialPostModal({
  onClose,
  onCreate,
  selectedDate
}: {
  onClose: () => void;
  onCreate: (data: any) => void;
  selectedDate: Date | null;
}) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    platform: 'x',
    publish_time: selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm") : '',
    image_url: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim() || !formData.publish_time) return;
    
    const title = formData.title || `${SOCIAL_PLATFORMS[formData.platform as keyof typeof SOCIAL_PLATFORMS]?.label} Post`;
    onCreate({
      ...formData,
      title,
    });
  };

  const remainingChars = (() => {
    const limits = { x: 280, instagram: 2200, tiktok: 300, youtube: 5000 };
    const limit = limits[formData.platform as keyof typeof limits] || 280;
    return limit - formData.content.length;
  })();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Schedule Social Post</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Platform *
              </label>
              <select
                value={formData.platform}
                onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value }))}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
              >
                {Object.entries(SOCIAL_PLATFORMS).map(([key, platform]) => (
                  <option key={key} value={key} className="bg-slate-900">
                    {platform.icon} {platform.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Publish Time *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.publish_time}
                onChange={(e) => setFormData(prev => ({ ...prev, publish_time: e.target.value }))}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Title (optional)
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400"
              placeholder="Auto-generated from platform"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Content *
              <span className={`ml-2 text-xs ${remainingChars < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {remainingChars} characters remaining
              </span>
            </label>
            <textarea
              required
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 resize-none"
              rows={6}
              placeholder="Write your post content..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Image URL (optional)
            </label>
            <input
              type="url"
              value={formData.image_url}
              onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-white/10 rounded-lg text-slate-300 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={remainingChars < 0}
              className="flex-1 px-4 py-2 bg-pink-500 text-white rounded-lg font-medium hover:bg-pink-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Schedule Post
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Event Detail Modal component  
function EventDetailModal({
  event,
  onClose
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const isSocial = event.type === 'social';
  const platform = isSocial ? SOCIAL_PLATFORMS[event.metadata?.platform as keyof typeof SOCIAL_PLATFORMS] : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {isSocial && platform ? platform.icon : EVENT_ICONS[event.type as keyof typeof EVENT_ICONS]}
            </span>
            <div>
              <h3 className="text-xl font-semibold text-white">{event.title}</h3>
              {isSocial && platform && (
                <p className="text-slate-400 text-sm">{platform.label}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Type:</span>
              <span className="ml-2 text-white capitalize">{event.type}</span>
            </div>
            <div>
              <span className="text-slate-400">Time:</span>
              <span className="ml-2 text-white">
                {event.allDay ? 'All day' : format(new Date(event.start), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
            {event.metadata?.status && (
              <div>
                <span className="text-slate-400">Status:</span>
                <span className={`ml-2 capitalize ${event.metadata.status === 'posted' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {event.metadata.status}
                </span>
              </div>
            )}
          </div>

          {event.description && (
            <div>
              <h4 className="font-medium text-white mb-2">Description</h4>
              <p className="text-slate-300 text-sm">{event.description}</p>
            </div>
          )}

          {isSocial && event.metadata?.content && (
            <div>
              <h4 className="font-medium text-white mb-2">Content</h4>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-slate-300 text-sm whitespace-pre-wrap">
                  {event.metadata.content}
                </p>
              </div>
            </div>
          )}

          {event.metadata?.image_url && (
            <div>
              <h4 className="font-medium text-white mb-2">Image</h4>
              <img 
                src={event.metadata.image_url} 
                alt="Post image" 
                className="max-w-full h-auto rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {event.metadata?.agent && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">Agent:</span>
              <span className="text-white">{event.metadata.avatar} {event.metadata.agent}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}