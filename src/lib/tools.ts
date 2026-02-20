import { getDb } from '@/lib/db';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface Tool {
  name: string;
  description: string;
  parameters: any; // JSON Schema
  execute: (params: any) => Promise<any>;
}

// ============================================================
// Music Theory Data (Hardcoded from musicTheory.ts)
// ============================================================

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES: Record<string, readonly number[]> = {
  'Major (Ionian)': [0, 2, 4, 5, 7, 9, 11],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Phrygian': [0, 1, 3, 5, 7, 8, 10],
  'Lydian': [0, 2, 4, 6, 7, 9, 11],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'Natural Minor (Aeolian)': [0, 2, 3, 5, 7, 8, 10],
  'Locrian': [0, 1, 3, 5, 6, 8, 10],
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  'Melodic Minor': [0, 2, 3, 5, 7, 9, 11],
  'Major Pentatonic': [0, 2, 4, 7, 9],
  'Minor Pentatonic': [0, 3, 5, 7, 10],
  'Blues': [0, 3, 5, 6, 7, 10],
  'Major Blues': [0, 2, 3, 4, 7, 9],
  'Whole Tone': [0, 2, 4, 6, 8, 10],
  'Diminished (H-W)': [0, 1, 3, 4, 6, 7, 9, 10],
  'Diminished (W-H)': [0, 2, 3, 5, 6, 8, 9, 11],
  'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  'Phrygian Dominant': [0, 1, 4, 5, 7, 8, 10],
  'Hungarian Minor': [0, 2, 3, 6, 7, 8, 11],
  'Double Harmonic': [0, 1, 4, 5, 7, 8, 11],
  'Bebop Dominant': [0, 2, 4, 5, 7, 9, 10, 11],
  'Super Locrian': [0, 1, 3, 4, 6, 8, 10],
  'Dorian b2': [0, 1, 3, 5, 7, 9, 10],
  'Lydian Augmented': [0, 2, 4, 6, 8, 9, 11],
  'Lydian Dominant': [0, 2, 4, 6, 7, 9, 10],
  'Mixolydian b6': [0, 2, 4, 5, 7, 8, 10],
  'Aeolian b5': [0, 2, 3, 5, 6, 8, 10],
  'Locrian nat6': [0, 1, 3, 5, 6, 9, 10],
  'Ionian Augmented': [0, 2, 4, 5, 8, 9, 11],
  'Dorian #4': [0, 2, 3, 6, 7, 9, 10],
  'Lydian #2': [0, 3, 4, 6, 7, 9, 11],
  'Ultra Locrian': [0, 1, 3, 4, 6, 8, 9],
  'Lydian #2 #6': [0, 3, 4, 6, 7, 10, 11],
  'Ultra Phrygian': [0, 1, 3, 4, 7, 8, 9],
  'Oriental': [0, 1, 4, 5, 6, 9, 10],
  'Ionian #2 #5': [0, 3, 4, 5, 8, 9, 11],
  'Locrian bb3 bb7': [0, 1, 2, 5, 6, 8, 9],
  'Harmonic Major': [0, 2, 4, 5, 7, 8, 11],
  'Dorian b5': [0, 2, 3, 5, 6, 9, 10],
  'Phrygian b4': [0, 1, 3, 4, 7, 8, 10],
  'Lydian b3': [0, 2, 3, 6, 7, 9, 11],
  'Mixolydian b2': [0, 1, 4, 5, 7, 9, 10],
  'Lydian Augmented #2': [0, 3, 4, 6, 8, 9, 11],
  'Locrian bb7': [0, 1, 3, 5, 6, 8, 9],
  'Bebop Major': [0, 2, 4, 5, 7, 8, 9, 11],
  'Bebop Dorian': [0, 2, 3, 4, 5, 7, 9, 10],
  'Hirajoshi': [0, 2, 3, 7, 8],
  'In-Sen': [0, 1, 5, 7, 10],
  'Kumoi': [0, 2, 3, 7, 9],
  'Augmented': [0, 3, 4, 7, 8, 11],
};

const SCALE_FAMILIES = {
  'Diatonic': ['Major (Ionian)', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Natural Minor (Aeolian)', 'Locrian'],
  'Pentatonic & Blues': ['Major Pentatonic', 'Minor Pentatonic', 'Blues', 'Major Blues'],
  'Modal Scale Families': ['Melodic Minor', 'Dorian b2', 'Lydian Augmented', 'Lydian Dominant', 'Mixolydian b6', 'Aeolian b5', 'Super Locrian', 'Harmonic Minor', 'Locrian nat6', 'Ionian Augmented', 'Dorian #4', 'Phrygian Dominant', 'Lydian #2', 'Ultra Locrian', 'Harmonic Major', 'Dorian b5', 'Phrygian b4', 'Lydian b3', 'Mixolydian b2', 'Lydian Augmented #2', 'Locrian bb7'],
  'Exotic': ['Double Harmonic', 'Lydian #2 #6', 'Ultra Phrygian', 'Hungarian Minor', 'Oriental', 'Ionian #2 #5', 'Locrian bb3 bb7'],
  'Exotic Pentatonics': ['Hirajoshi', 'In-Sen', 'Kumoi'],
  'Symmetric': ['Whole Tone', 'Diminished (H-W)', 'Diminished (W-H)', 'Augmented', 'Chromatic'],
  'Jazz': ['Bebop Dominant', 'Bebop Major', 'Bebop Dorian'],
};

const INTERVALS = {
  0: 'Root', 1: 'Minor 2nd', 2: 'Major 2nd', 3: 'Minor 3rd', 4: 'Major 3rd', 
  5: 'Perfect 4th', 6: 'Tritone', 7: 'Perfect 5th', 8: 'Minor 6th', 
  9: 'Major 6th', 10: 'Minor 7th', 11: 'Major 7th',
};

const POSITION_RANGES = {
  'CAGED': {
    1: [0, 4], 2: [2, 7], 3: [5, 9], 4: [7, 12], 5: [9, 14]
  },
  'Standard': {
    1: [0, 4], 2: [2, 6], 3: [4, 8], 4: [6, 10], 5: [8, 12], 6: [10, 14], 7: [12, 16]
  },
  '3NPS': {
    1: [0, 4], 2: [2, 6], 3: [4, 8], 4: [6, 10], 5: [8, 12], 6: [10, 14], 7: [12, 16]
  }
};

const CHORD_FORMULAS = {
  'major': [0, 4, 7],
  'minor': [0, 3, 7],
  'dom7': [0, 4, 7, 10],
  'maj7': [0, 4, 7, 11],
  'min7': [0, 3, 7, 10],
  'dim': [0, 3, 6],
  'aug': [0, 4, 8],
  'sus4': [0, 5, 7],
  'sus2': [0, 2, 7],
  'add9': [0, 4, 7, 14], // 14 = 2 + 12 (octave up)
  '6': [0, 4, 7, 9],
  'min6': [0, 3, 7, 9],
  '9': [0, 4, 7, 10, 14],
  'maj9': [0, 4, 7, 11, 14],
  'min9': [0, 3, 7, 10, 14],
  '11': [0, 4, 7, 10, 14, 17], // 17 = 5 + 12
  '13': [0, 4, 7, 10, 14, 21], // 21 = 9 + 12
};

// ============================================================
// Tool Implementations
// ============================================================

export const TOOLS: Tool[] = [
  // a) search_web
  {
    name: 'search_web',
    description: 'Search the web using DuckDuckGo HTML and return top results with titles, URLs, and snippets.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        count: { type: 'number', description: 'Number of results to return (default: 5)', minimum: 1, maximum: 10 }
      },
      required: ['query']
    },
    execute: async (params: { query: string; count?: number }) => {
      try {
        const { query, count = 5 } = params;
        const encodedQuery = encodeURIComponent(query);
        const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodedQuery}`);
        
        if (!response.ok) {
          throw new Error(`DuckDuckGo returned ${response.status}`);
        }
        
        const html = await response.text();
        const results = [];
        
        // Parse DuckDuckGo results using regex patterns
        // Result pattern: <a class="result__a" href="/l/?uddg=..." > ... <span class="result__title__domain">
        const resultRegex = /<a[^>]*class="result__a"[^>]*href="\/l\/\?uddg=([^"]*)"[^>]*>(.*?)<\/a>/gs;
        const titleRegex = /<.*?>(.*?)<\/.*?>/gs;
        const snippetRegex = /<div[^>]*class="[^"]*snippet[^"]*"[^>]*>(.*?)<\/div>/gs;
        
        let match;
        let resultCount = 0;
        
        while ((match = resultRegex.exec(html)) !== null && resultCount < count) {
          try {
            const urlMatch = match[1];
            const titleContent = match[2];
            
            // Clean up URL
            const url = decodeURIComponent(urlMatch);
            
            // Clean up title
            let title = titleContent.replace(titleRegex, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
            if (title.length > 100) title = title.substring(0, 100) + '...';
            
            // Find snippet near this result
            const resultIndex = html.indexOf(match[0]);
            const nextResultIndex = html.indexOf('<a class="result__a"', resultIndex + match[0].length);
            const contextHtml = html.substring(resultIndex, nextResultIndex > 0 ? nextResultIndex : resultIndex + 1000);
            
            let snippet = '';
            const snippetMatch = snippetRegex.exec(contextHtml);
            if (snippetMatch) {
              snippet = snippetMatch[1]
                .replace(/<[^>]*>/g, '') // Remove HTML tags
                .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                .replace(/\s+/g, ' ')
                .trim();
              if (snippet.length > 200) snippet = snippet.substring(0, 200) + '...';
            }
            
            if (title && url && url.startsWith('http')) {
              results.push({ title, url, snippet: snippet || 'No snippet available' });
              resultCount++;
            }
          } catch (e) {
            // Skip malformed results
            continue;
          }
        }
        
        return { results };
      } catch (error: any) {
        throw new Error(`Web search failed: ${error.message}`);
      }
    }
  },

  // b) fetch_url
  {
    name: 'fetch_url',
    description: 'Fetch a URL and extract readable text content by stripping HTML tags.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
        maxChars: { type: 'number', description: 'Maximum characters to return (default: 4000)', minimum: 100 }
      },
      required: ['url']
    },
    execute: async (params: { url: string; maxChars?: number }) => {
      try {
        const { url, maxChars = 4000 } = params;
        
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          throw new Error('URL must start with http:// or https://');
        }
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; FretCoach/1.0; +https://fretcoach.ai)'
          },
          redirect: 'follow'
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
          throw new Error(`Unsupported content type: ${contentType}`);
        }
        
        let html = await response.text();
        
        // Extract title
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
        const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : 'Untitled';
        
        // Strip script and style tags first
        html = html.replace(/<script[^>]*>.*?<\/script>/gis, '');
        html = html.replace(/<style[^>]*>.*?<\/style>/gis, '');
        
        // Strip all HTML tags
        let content = html.replace(/<[^>]*>/g, ' ');
        
        // Clean up whitespace
        content = content
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
        
        // Truncate if needed
        if (content.length > maxChars) {
          content = content.substring(0, maxChars) + '...';
        }
        
        return { content, title };
      } catch (error: any) {
        throw new Error(`URL fetch failed: ${error.message}`);
      }
    }
  },

  // c) music_theory
  {
    name: 'music_theory',
    description: 'Query music theory data including scales, intervals, positions, and chord tones.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          enum: ['get_scale', 'list_scales', 'get_scale_positions', 'get_intervals', 'get_chord_tones'],
          description: 'Command to execute'
        },
        name: { type: 'string', description: 'Scale name (for get_scale)' },
        scaleName: { type: 'string', description: 'Scale name (for get_scale_positions)' },
        positionSystem: { 
          type: 'string', 
          enum: ['CAGED', 'Standard', '3NPS'], 
          description: 'Position system (for get_scale_positions)' 
        },
        chordType: { type: 'string', description: 'Chord type (for get_chord_tones)' }
      },
      required: ['command']
    },
    execute: async (params: { command: string; name?: string; scaleName?: string; positionSystem?: string; chordType?: string }) => {
      const { command } = params;
      
      switch (command) {
        case 'get_scale': {
          if (!params.name) throw new Error('Scale name is required');
          const intervals = SCALES[params.name];
          if (!intervals) throw new Error(`Scale "${params.name}" not found`);
          
          // Generate notes in all keys
          const allKeys: Record<string, string[]> = {};
          for (let rootIndex = 0; rootIndex < 12; rootIndex++) {
            const rootNote = NOTES[rootIndex];
            const scaleNotes = intervals.map(interval => NOTES[(rootIndex + interval) % 12]);
            allKeys[rootNote] = scaleNotes;
          }
          
          return {
            name: params.name,
            intervals: Array.from(intervals),
            allKeys,
            description: getScaleDescription(params.name)
          };
        }
        
        case 'list_scales': {
          return { scalesByFamily: SCALE_FAMILIES };
        }
        
        case 'get_scale_positions': {
          if (!params.scaleName || !params.positionSystem) {
            throw new Error('scaleName and positionSystem are required');
          }
          
          const ranges = POSITION_RANGES[params.positionSystem as keyof typeof POSITION_RANGES];
          if (!ranges) throw new Error(`Invalid position system: ${params.positionSystem}`);
          
          return {
            scaleName: params.scaleName,
            positionSystem: params.positionSystem,
            positions: ranges
          };
        }
        
        case 'get_intervals': {
          return { intervals: INTERVALS };
        }
        
        case 'get_chord_tones': {
          if (!params.chordType) throw new Error('chordType is required');
          const intervals = CHORD_FORMULAS[params.chordType as keyof typeof CHORD_FORMULAS];
          if (!intervals) throw new Error(`Chord type "${params.chordType}" not found`);
          
          return {
            chordType: params.chordType,
            intervals,
            availableChordTypes: Object.keys(CHORD_FORMULAS)
          };
        }
        
        default:
          throw new Error(`Invalid command: ${command}`);
      }
    }
  },

  // d) list_content
  {
    name: 'list_content',
    description: 'Query the MC database for existing approved/completed content to avoid duplication.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status (e.g., approved, done, review)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
        agentId: { type: 'string', description: 'Filter by agent ID' },
        search: { type: 'string', description: 'Search in title and description' },
        limit: { type: 'number', description: 'Limit number of results (default: 20)', minimum: 1, maximum: 100 }
      },
      required: []
    },
    execute: async (params: { status?: string; tags?: string[]; agentId?: string; search?: string; limit?: number }) => {
      try {
        const db = getDb();
        const { status, tags, agentId, search, limit = 20 } = params;
        
        let query = `
          SELECT t.id, t.title, t.status, t.tags, t.assignee_id as agentId, 
                 a.name as assigneeName, tr.response,
                 substr(tr.response, 1, 200) as resultPreview
          FROM tasks t
          LEFT JOIN agents a ON t.assignee_id = a.id
          LEFT JOIN task_results tr ON t.id = tr.task_id AND tr.status = 'completed'
          WHERE 1=1
        `;
        
        const conditions = [];
        const values = [];
        
        if (status) {
          conditions.push('t.status = ?');
          values.push(status);
        }
        
        let paramIndex = 1;
        if (agentId) {
          conditions.push(`t.assignee_id = $${paramIndex++}`);
          values.push(agentId);
        }
        
        if (search) {
          conditions.push(`(t.title LIKE $${paramIndex++} OR t.description LIKE $${paramIndex++})`);
          values.push(`%${search}%`, `%${search}%`);
        }
        
        if (tags && tags.length > 0) {
          const tagConditions = tags.map(() => `t.tags::text LIKE $${paramIndex++}`).join(' AND ');
          conditions.push(`(${tagConditions})`);
          tags.forEach(tag => values.push(`%${tag}%`));
        }
        
        if (conditions.length > 0) {
          query += ' AND ' + conditions.join(' AND ');
        }
        
        query += ` ORDER BY t.updated_at DESC LIMIT $${paramIndex++}`;
        values.push(limit);
        
        const results = await db.all(query, values) as any[];
        
        return {
          results: results.map(r => ({
            id: r.id,
            title: r.title,
            status: r.status,
            tags: r.tags || [], // JSONB - already parsed
            assignee: r.assigneeName || 'Unassigned',
            resultPreview: r.resultPreview || 'No result yet'
          }))
        };
      } catch (error: any) {
        throw new Error(`Database query failed: ${error.message}`);
      }
    }
  },

  // e) search_tasks
  {
    name: 'search_tasks',
    description: 'Search task history and results for reference.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for title/description' },
        includeResults: { type: 'boolean', description: 'Include task results in response (default: false)' }
      },
      required: ['query']
    },
    execute: async (params: { query: string; includeResults?: boolean }) => {
      try {
        const db = getDb();
        const { query, includeResults = false } = params;
        
        let sql = `
          SELECT t.id, t.title, t.description, t.status, t.created_at,
                 a.name as assigneeName
        `;
        
        if (includeResults) {
          sql += `, substr(tr.response, 1, 500) as resultPreview`;
        }
        
        sql += `
          FROM tasks t
          LEFT JOIN agents a ON t.assignee_id = a.id
        `;
        
        if (includeResults) {
          sql += `LEFT JOIN task_results tr ON t.id = tr.task_id AND tr.status = 'completed'`;
        }
        
        sql += `
          WHERE (t.title LIKE $1 OR t.description LIKE $2)
          ORDER BY t.updated_at DESC
          LIMIT 10
        `;
        
        const results = await db.all(sql, [`%${query}%`, `%${query}%`]) as any[];
        
        return {
          results: results.map(r => ({
            id: r.id,
            title: r.title,
            description: r.description,
            status: r.status,
            assignee: r.assigneeName || 'Unassigned',
            created_at: r.created_at,
            ...(includeResults && r.resultPreview ? { resultPreview: r.resultPreview } : {})
          }))
        };
      } catch (error: any) {
        throw new Error(`Task search failed: ${error.message}`);
      }
    }
  },

  // f) validate_tab
  {
    name: 'validate_tab',
    description: 'Validate guitar tablature notation for correctness.',
    parameters: {
      type: 'object',
      properties: {
        tab: { type: 'string', description: 'Guitar tablature to validate' }
      },
      required: ['tab']
    },
    execute: async (params: { tab: string }) => {
      const { tab } = params;
      const errors: string[] = [];
      const warnings: string[] = [];
      
      try {
        const lines = tab.split('\n').filter(line => line.trim());
        
        // Check if we have exactly 6 string lines
        const stringLines = lines.filter(line => line.includes('|'));
        if (stringLines.length !== 6) {
          errors.push(`Expected 6 string lines, found ${stringLines.length}`);
        }
        
        // Expected string names (from high to low)
        const expectedStrings = ['e', 'B', 'G', 'D', 'A', 'E'];
        
        // Check string naming and format
        const stringLengths: number[] = [];
        stringLines.forEach((line, index) => {
          const trimmedLine = line.trim();
          
          // Check if line starts with correct string name
          const expectedString = expectedStrings[index];
          if (!trimmedLine.startsWith(expectedString + '|')) {
            errors.push(`Line ${index + 1} should start with "${expectedString}|", found: ${trimmedLine.substring(0, 10)}...`);
          }
          
          // Extract the tablature part (after the string name and |)
          const tabPart = trimmedLine.substring(2); // Remove "X|"
          stringLengths.push(tabPart.length);
          
          // Check valid characters: digits, -, h, p, b, /, \, ~, x, |, spaces
          const validChars = /^[\d\-hpb\/\\~x\|\s]*$/;
          if (!validChars.test(tabPart)) {
            errors.push(`Line ${index + 1} contains invalid characters. Only digits, -, h, p, b, /, \\, ~, x, |, and spaces allowed.`);
          }
          
          // Check fret numbers are reasonable (0-24)
          const fretNumbers = tabPart.match(/\d+/g);
          if (fretNumbers) {
            fretNumbers.forEach(fret => {
              const fretNum = parseInt(fret);
              if (fretNum > 24) {
                warnings.push(`Fret ${fret} on line ${index + 1} is unusually high (>24)`);
              }
            });
          }
        });
        
        // Check if all strings have the same length
        if (stringLengths.length > 0) {
          const firstLength = stringLengths[0];
          if (!stringLengths.every(length => length === firstLength)) {
            errors.push(`All string lines should have the same length. Lengths: ${stringLengths.join(', ')}`);
          }
        }
        
        const valid = errors.length === 0;
        
        return { valid, errors, warnings };
      } catch (error: any) {
        errors.push(`Validation error: ${error.message}`);
        return { valid: false, errors, warnings };
      }
    }
  },

  // g) get_brand_context
  {
    name: 'get_brand_context',
    description: 'Returns FretCoach brand information for consistency across content.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    execute: async () => {
      return {
        brandName: 'FretCoach',
        tagline: 'AI-powered guitar learning that adapts to you',
        url: 'https://fretcoach.ai',
        colors: {
          primary: '#f59e0b', // amber-500
          accent: '#0ea5e9',   // sky-500
          bg: '#0a0a0f',       // dark background
          text: '#ffffff'      // white text
        },
        tone: 'Encouraging, knowledgeable, and approachable. We make guitar learning feel achievable and fun.',
        targetAudience: 'Guitar learners of all levels - from complete beginners to advanced players seeking structured practice.',
        socialAccounts: {
          twitter: '@FretCoach',
          instagram: '@FretCoachAI',
          tiktok: '@fretcoachai',
          youtube: '@FretCoachAI'
        },
        competitorApps: ['Simply Guitar', 'Yousician', 'Fender Play', 'JamPlay', 'Guitar Tricks'],
        keyFeatures: [
          'AI-powered personalized learning paths',
          'Real-time feedback on playing',
          'Interactive fretboard visualization',
          'Progress tracking and analytics',
          'Community features and challenges'
        ]
      };
    }
  },

  // h) write_content
  {
    name: 'write_content',
    description: 'Write generated content to the staging export directory.',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Filename to write' },
        content: { type: 'string', description: 'Content to write' },
        type: { type: 'string', enum: ['html', 'md', 'json'], description: 'Content type' }
      },
      required: ['filename', 'content', 'type']
    },
    execute: async (params: { filename: string; content: string; type: string }) => {
      try {
        const { filename, content, type } = params;
        
        // Ensure filename has correct extension
        let finalFilename = filename;
        if (!finalFilename.endsWith(`.${type}`)) {
          finalFilename = `${filename}.${type}`;
        }
        
        const stagingDir = '/Users/andrewkershaw/.openclaw/workspace/projects/fretboard-mastery/landing-page/public/staging/content';
        
        // Create directory if it doesn't exist
        await fs.mkdir(stagingDir, { recursive: true });
        
        const filePath = path.join(stagingDir, finalFilename);
        await fs.writeFile(filePath, content, 'utf-8');
        
        const url = `https://fretcoach.ai/staging/content/${finalFilename}`;
        
        return {
          path: filePath,
          url,
          filename: finalFilename,
          size: content.length
        };
      } catch (error: any) {
        throw new Error(`Failed to write content: ${error.message}`);
      }
    }
  },

  // i) generate_image
  {
    name: 'generate_image',
    description: 'Generate an image using Flux (via Replicate API). Returns the image URL. Use for social media posts, thumbnails, blog headers, etc. Write a detailed visual prompt — specify style, composition, colors, lighting. Do NOT include text/words in prompts (AI image gen renders text poorly). FretCoach brand colors: amber #f59e0b on dark #0a0a0f.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Detailed image generation prompt. Be specific about style, composition, lighting, colors. Avoid requesting text/words in the image.' },
        aspect_ratio: { type: 'string', enum: ['1:1', '16:9', '9:16', '4:5', '3:2'], description: 'Aspect ratio. 1:1 for Instagram/general, 16:9 for YouTube/blog, 9:16 for TikTok/Stories, 4:5 for Instagram feed.' },
        output_format: { type: 'string', enum: ['png', 'jpg', 'webp'], description: 'Output format (default: jpg)' }
      },
      required: ['prompt']
    },
    execute: async (params: { prompt: string; aspect_ratio?: string; output_format?: string }) => {
      const apiToken = process.env.REPLICATE_API_TOKEN;
      if (!apiToken) throw new Error('REPLICATE_API_TOKEN not set');

      const { prompt, aspect_ratio = '1:1', output_format = 'jpg' } = params;

      const createRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { prompt, aspect_ratio, output_format, num_outputs: 1, go_fast: true }
        })
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        throw new Error(`Replicate API error ${createRes.status}: ${err}`);
      }

      let prediction = await createRes.json();

      const maxWait = 60000;
      const start = Date.now();
      while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
        if (Date.now() - start > maxWait) throw new Error('Image generation timed out (60s)');
        await new Promise(resolve => setTimeout(resolve, 1500));
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
          headers: { 'Authorization': `Bearer ${apiToken}` }
        });
        prediction = await pollRes.json();
      }

      if (prediction.status === 'failed') {
        throw new Error(`Image generation failed: ${prediction.error || 'Unknown error'}`);
      }

      const imageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;

      return {
        url: imageUrl,
        prompt,
        aspect_ratio,
        model: 'flux-schnell',
        prediction_id: prediction.id,
        cost_estimate: '$0.003'
      };
    }
  },
  // j) generate_backing_track — MusicGen via Replicate
  {
    name: 'generate_backing_track',
    description: 'Generate a backing track using MusicGen (via Replicate API). Returns an audio URL (.wav). Describe the musical style, key, tempo, instruments, and feel. Examples: "12-bar blues shuffle in A minor, 120 BPM, electric guitar and bass", "Slow jazz ballad in Bb major, brushed drums, upright bass, 80 BPM". Tracks are ~15-30 seconds by default.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Musical description of the backing track. Include genre, key, tempo/BPM, instruments, and feel/mood.' },
        duration: { type: 'number', description: 'Duration in seconds (default: 15, max: 30)' },
        model_version: { type: 'string', enum: ['stereo-melody-large', 'stereo-large', 'melody-large', 'large'], description: 'MusicGen model variant (default: stereo-melody-large)' },
      },
      required: ['prompt']
    },
    execute: async (params: { prompt: string; duration?: number; model_version?: string }) => {
      const apiToken = process.env.REPLICATE_API_TOKEN;
      if (!apiToken) throw new Error('REPLICATE_API_TOKEN not set');

      const { prompt, duration = 15, model_version = 'stereo-melody-large' } = params;
      const clampedDuration = Math.min(Math.max(duration, 5), 30);

      const createRes = await fetch('https://api.replicate.com/v1/models/meta/musicgen/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            prompt,
            duration: clampedDuration,
            model_version,
            output_format: 'wav',
            normalization_strategy: 'loudness',
          }
        })
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        throw new Error(`Replicate API error ${createRes.status}: ${err}`);
      }

      let prediction = await createRes.json();

      // MusicGen takes longer than image gen — allow up to 3 minutes
      const maxWait = 180000;
      const start = Date.now();
      while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
        if (Date.now() - start > maxWait) throw new Error('Backing track generation timed out (180s)');
        await new Promise(resolve => setTimeout(resolve, 3000));
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
          headers: { 'Authorization': `Bearer ${apiToken}` }
        });
        prediction = await pollRes.json();
      }

      if (prediction.status === 'failed') {
        throw new Error(`Backing track generation failed: ${prediction.error || 'Unknown error'}`);
      }

      const audioUrl = prediction.output;

      return {
        url: audioUrl,
        prompt,
        duration: clampedDuration,
        model: `musicgen-${model_version}`,
        prediction_id: prediction.id,
        cost_estimate: '$0.02'
      };
    }
  },
  // k) delegate_task — recruit another agent
  {
    name: 'delegate_task',
    description: `Create a task and assign it to another agent. Use this whenever you need specialized help — don't try to do everything yourself.

AGENT ROSTER (recruit by codename):
• TABSMITH — Guitar tab notation expert. Writes accurate, well-formatted tablature.
• ARCHITECT — Builds structured lessons with learning objectives, activities, and assessments.
• TRACKMASTER — Creates backing tracks and audio content.
• THEORYBOT — Music theory specialist. Scales, chords, intervals, progressions.
• COACH — Practice plans, technique advice, student guidance.
• FEEDBACK — Reviews content quality, UX, and consistency.
• CONTENTMILL — Social media captions, blog posts, marketing copy.
• SEOHAWK — SEO optimization, keyword research, meta descriptions.
• COMMUNITY — Community engagement, social listening, trend analysis.
• BIZOPS — Business strategy, pricing, market research.
• PRODUCER — Project management, task planning, batch generation.

The delegated task runs automatically. Use when: you need tab written, theory checked, content reviewed, SEO optimized, images generated, or any work outside your specialty.`,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title — be specific about what you need.' },
        description: { type: 'string', description: 'Detailed instructions for the agent. Include context, requirements, and expected output format.' },
        agent_codename: { type: 'string', description: 'Codename of the agent to assign. Available: TABSMITH, ARCHITECT, TRACKMASTER, THEORYBOT, COACH, FEEDBACK, CONTENTMILL, SEOHAWK, COMMUNITY, BIZOPS, PRODUCER' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Task priority (default: medium)' },
      },
      required: ['title', 'description', 'agent_codename']
    },
    execute: async (params: { title: string; description: string; agent_codename: string; priority?: string }) => {
      const { v4: uuid } = await import('uuid');
      const db = getDb();

      // Find the agent by codename
      const agent = await db.get(
        `SELECT id, name, codename FROM agents WHERE UPPER(codename) = $1`,
        [params.agent_codename.toUpperCase()]
      ) as Record<string, string> | undefined;

      if (!agent) {
        return { error: `Agent "${params.agent_codename}" not found. Available: TABSMITH, LESSON_ARCHITECT, TRACKMASTER, THEORYBOT, COACH, FEEDBACK_LOOP, SEOHAWK, COMMUNITY_PULSE, BIZOPS` };
      }

      // Get the requesting agent from caller context
      const caller = params._callerContext as { agentId: string; agentName: string; agentAvatar: string; agentCodename: string } | undefined;
      const fromName = caller?.agentName || 'Another agent';
      const fromAvatar = caller?.agentAvatar || '🤖';
      const fromCodename = caller?.agentCodename || 'unknown';
      const fromId = caller?.agentId || 'system';

      // Embed delegation context in the task description
      const enrichedDesc = `**📨 Delegated by ${fromName} (@${fromCodename})**\n\n${params.description}`;

      const taskId = uuid();
      await db.run(`
        INSERT INTO tasks (id, title, description, status, priority, assignee_id, tags, created_at, updated_at)
        VALUES ($1, $2, $3, 'todo', $4, $5, '["delegated"]', NOW(), NOW())
      `, [taskId, params.title, enrichedDesc, params.priority || 'medium', agent.id]);

      // Post comms message so both agents and humans can see the recruitment
      const msgId = uuid();
      await db.run(
        `INSERT INTO messages (id, from_agent_id, to_agent_id, content, type, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [msgId, fromId, agent.id, `📨 **${fromName}** recruited **${agent.name}**: ${params.title}`, 'delegation']
      );

      // Trigger the queue so it picks up immediately
      const { triggerQueueIfNeeded } = await import('@/lib/autoQueue');
      triggerQueueIfNeeded();

      return {
        success: true,
        task_id: taskId,
        assigned_to: agent.name,
        codename: agent.codename,
        delegated_by: fromName,
        message: `Task "${params.title}" created and assigned to ${agent.name}. ${agent.name} has been notified. It will execute automatically.`
      };
    }
  },
];

// Helper function to get scale description (used by music_theory tool)
function getScaleDescription(scaleName: string): string {
  const descriptions: Record<string, string> = {
    'Major (Ionian)': 'Bright, happy, resolved. The foundation of Western music.',
    'Dorian': 'Jazzy minor with a bright 6th. Think Santana, Pink Floyd.',
    'Phrygian': 'Dark, Spanish, exotic. Flamenco and metal staple.',
    'Lydian': 'Dreamy, floating, ethereal. The brightest mode with its raised 4th.',
    'Mixolydian': 'Bluesy major feel. Classic rock, country, and funk.',
    'Natural Minor (Aeolian)': 'Sad, dark, introspective. The natural minor sound.',
    'Locrian': 'Unstable, dissonant, tense. Rarely used as a tonal center.',
    'Harmonic Minor': 'Classical, dramatic, Middle Eastern tension.',
    'Melodic Minor': 'Smooth, jazzy minor. Bridges minor and major tonalities.',
    'Major Pentatonic': 'Simple, bright, uplifting. Country, pop, and folk essential.',
    'Minor Pentatonic': 'The go-to rock/blues scale. Raw, emotional, versatile.',
    'Blues': 'Gritty, soulful, expressive. Minor pentatonic with added blue note.',
    'Major Blues': 'Bright blues flavor with a chromatic passing tone.',
    'Whole Tone': 'Floating, ambiguous, dreamlike. Pure symmetry.',
    'Diminished (H-W)': 'Tense, symmetric, jazzy. Used over diminished chords.',
    'Diminished (W-H)': 'Dark, symmetric, versatile. Used over dominant 7th chords.',
    'Chromatic': 'All 12 notes. Used for passing tones and chromatic runs.',
    'Phrygian Dominant': 'Intense, Middle Eastern, flamenco. 5th mode of harmonic minor.',
    'Hungarian Minor': 'Exotic, dramatic, augmented 4th gives unique tension.',
    'Double Harmonic': 'Arabic/Byzantine feel. Symmetric and intensely exotic.',
    'Bebop Dominant': 'Smooth jazz lines. Added chromatic passing tone.',
    'Super Locrian': 'Altered dominant scale. Maximum tension for jazz.',
  };
  
  return descriptions[scaleName] || '';
}

// Export helper function to get tool by name
export function getTool(name: string): Tool | undefined {
  return TOOLS.find(tool => tool.name === name);
}