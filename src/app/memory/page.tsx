'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Search, File, Calendar, FileText, Brain, User, Settings, Zap } from 'lucide-react';

interface MemoryFile {
  name: string;
  path: string;
  size: number;
  modified: string;
  type: 'main' | 'daily';
}

interface SearchResult {
  file: string;
  line: number;
  content: string;
  context: string;
}

const FILE_ICONS = {
  'MEMORY.md': Brain,
  'TOOLS.md': Settings,
  'USER.md': User,
  'SOUL.md': Zap,
  'IDENTITY.md': FileText,
};

export default function MemoryPage() {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<MemoryFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/memory?action=list');
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
        // Auto-select MEMORY.md if it exists
        const memoryFile = data.find((f: MemoryFile) => f.name === 'MEMORY.md');
        if (memoryFile && !selectedFile) {
          setSelectedFile(memoryFile);
        }
      }
    } catch (error) {
      console.error('Failed to fetch memory files:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFileContent = async (file: MemoryFile) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/memory?action=read&file=${encodeURIComponent(file.path)}`);
      if (res.ok) {
        const data = await res.json();
        setFileContent(data.content);
      }
    } catch (error) {
      console.error('Failed to fetch file content:', error);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const res = await fetch(`/api/memory?action=search&q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  useEffect(() => {
    if (selectedFile) {
      fetchFileContent(selectedFile);
    }
  }, [selectedFile]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const mainFiles = files.filter(f => f.type === 'main');
  const dailyFiles = files.filter(f => f.type === 'daily');

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-80 bg-white/5 border-r border-white/10 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <h1 className="text-xl font-bold text-white mb-4">🧠 Memory Browser</h1>
          
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 text-sm"
            />
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-4">
          {searchQuery.trim() && searchResults.length > 0 ? (
            // Search Results
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-3">
                Search Results ({searchResults.length})
                {searchLoading && <span className="ml-2 text-slate-500">...</span>}
              </h3>
              <div className="space-y-2">
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      const file = files.find(f => f.path === result.file);
                      if (file) setSelectedFile(file);
                    }}
                    className="w-full p-3 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText size={14} className="text-slate-400" />
                      <span className="text-sm font-medium text-white">{result.file}</span>
                      <span className="text-xs text-slate-500">:{result.line}</span>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2">
                      {result.content}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Main Files */}
              {mainFiles.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Main Files</h3>
                  <div className="space-y-1">
                    {mainFiles.map((file) => {
                      const Icon = FILE_ICONS[file.name as keyof typeof FILE_ICONS] || File;
                      const isSelected = selectedFile?.path === file.path;
                      return (
                        <button
                          key={file.path}
                          onClick={() => setSelectedFile(file)}
                          className={`w-full p-3 rounded-lg transition-all text-left ${
                            isSelected
                              ? 'bg-amber-500/20 border border-amber-500/30 text-amber-100'
                              : 'hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon size={16} className={isSelected ? 'text-amber-400' : 'text-slate-400'} />
                            <span className="text-sm font-medium">{file.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>{formatFileSize(file.size)}</span>
                            <span>{formatDate(file.modified)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Daily Files */}
              {dailyFiles.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Daily Memory</h3>
                  <div className="space-y-1">
                    {dailyFiles.map((file) => {
                      const isSelected = selectedFile?.path === file.path;
                      return (
                        <button
                          key={file.path}
                          onClick={() => setSelectedFile(file)}
                          className={`w-full p-3 rounded-lg transition-all text-left ${
                            isSelected
                              ? 'bg-amber-500/20 border border-amber-500/30 text-amber-100'
                              : 'hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar size={16} className={isSelected ? 'text-amber-400' : 'text-slate-400'} />
                            <span className="text-sm font-medium">{file.name.replace('.md', '')}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>{formatFileSize(file.size)}</span>
                            <span>{formatDate(file.modified)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedFile ? (
          <>
            {/* File Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/5">
                  {(() => {
                    const Icon = FILE_ICONS[selectedFile.name as keyof typeof FILE_ICONS] || FileText;
                    return <Icon size={20} className="text-amber-400" />;
                  })()}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{selectedFile.name}</h2>
                  <p className="text-sm text-slate-400">
                    {formatFileSize(selectedFile.size)} • Modified {formatDate(selectedFile.modified)}
                  </p>
                </div>
              </div>
            </div>

            {/* File Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-slate-500">Loading...</div>
                </div>
              ) : (
                <div className="max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    className="prose prose-invert prose-slate max-w-none
                      prose-headings:text-white prose-headings:font-bold
                      prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                      prose-p:text-slate-300 prose-p:leading-relaxed
                      prose-strong:text-white prose-em:text-slate-200
                      prose-code:text-amber-300 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                      prose-pre:bg-slate-800 prose-pre:border prose-pre:border-white/10
                      prose-blockquote:border-l-amber-500 prose-blockquote:text-slate-300
                      prose-ul:text-slate-300 prose-ol:text-slate-300
                      prose-li:text-slate-300
                      prose-a:text-amber-400 prose-a:no-underline hover:prose-a:underline
                      prose-hr:border-white/20
                      prose-table:border prose-table:border-white/20
                      prose-thead:bg-white/5
                      prose-th:border-white/20 prose-th:text-white
                      prose-td:border-white/20 prose-td:text-slate-300"
                  >
                    {fileContent}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Brain size={64} className="text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-400 mb-2">No File Selected</h3>
              <p className="text-slate-500">Choose a memory file from the sidebar to view its contents</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}