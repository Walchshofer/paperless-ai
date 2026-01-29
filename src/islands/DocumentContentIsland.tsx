import { h, Fragment } from 'preact';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import type { DocumentContentContract } from '../ui/contracts/DocumentContent.contract';

type Match = {
  index: number;
  start: number;
  end: number;
};

export default function DocumentContentIsland(props: DocumentContentContract) {
  const [documentId, setDocumentId] = useState(props.documentId ?? null);
  const [content, setContent] = useState(props.content || '');
  const [searchQuery, setSearchQuery] = useState(props.initialQuery || '');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [regexError, setRegexError] = useState<string | null>(null);

  const contentRef = useRef<HTMLDivElement | null>(null);

  // Listen for document selection events from ManualWorkspaceIsland
  useEffect(() => {
    const handler = (e: any) => {
      const detail = e.detail || {};
      if (detail.documentId !== undefined) setDocumentId(detail.documentId);
      if (detail.content !== undefined) {
        setContent(detail.content);
        // Reset search on new document
        setSearchQuery('');
        setMatches([]);
        setCurrentMatchIndex(-1);
      }
    };
    window.addEventListener('document:selected', handler as EventListener);
    return () => window.removeEventListener('document:selected', handler as EventListener);
  }, []);

  // Search Logic with Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!searchQuery) {
        setMatches([]);
        setCurrentMatchIndex(-1);
        setRegexError(null);
        return;
      }

      try {
        const flags = caseSensitive ? 'g' : 'gi';
        let regex: RegExp;
        
        if (useRegex) {
          regex = new RegExp(searchQuery, flags);
        } else {
          // Escape special regex chars for literal search
          const escaped = searchQuery.replace(/[.*+?^${}()|[\\]/g, '\\$&');
          regex = new RegExp(escaped, flags);
        }

        const newMatches: Match[] = [];
        let match;
        // Limit matches for performance?
        let count = 0;
        const maxMatches = 1000; 

        while ((match = regex.exec(content)) !== null && count < maxMatches) {
          newMatches.push({
            index: count,
            start: match.index,
            end: match.index + match[0].length
          });
          count++;
        }

        setMatches(newMatches);
        setRegexError(null);
        if (newMatches.length > 0) {
          setCurrentMatchIndex(0);
        } else {
          setCurrentMatchIndex(-1);
        }
      } catch (e: any) {
        setRegexError(e.message);
        setMatches([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [content, searchQuery, caseSensitive, useRegex]);

  // Scroll to match
  useEffect(() => {
    if (currentMatchIndex >= 0 && matches[currentMatchIndex]) {
      const matchId = `match-${currentMatchIndex}`;
      const el = document.getElementById(matchId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentMatchIndex, matches]);

  const navigate = (dir: 1 | -1) => {
    if (matches.length === 0) return;
    setCurrentMatchIndex(prev => {
      const next = prev + dir;
      if (next >= matches.length) return 0;
      if (next < 0) return matches.length - 1;
      return next;
    });
  };

  // Render content with highlights
  const renderedContent = useMemo(() => {
    if (!content) return <div className="text-gray-400 italic p-4">No content available.</div>;
    if (matches.length === 0) return <div className="font-mono text-sm whitespace-pre-wrap">{content}</div>;

    const parts = [];
    let lastIndex = 0;

    matches.forEach((m, i) => {
      // Text before match
      if (m.start > lastIndex) {
        parts.push(content.substring(lastIndex, m.start));
      }
      
      // Match highlight
      const isCurrent = i === currentMatchIndex;
      parts.push(
        <mark
          id={`match-${i}`}
          key={`match-${i}`}
          className={`${isCurrent ? 'bg-yellow-400 ring-2 ring-yellow-600' : 'bg-yellow-200'}`}
        >
          {content.substring(m.start, m.end)}
        </mark>
      );
      
      lastIndex = m.end;
    });

    // Remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return <div className="font-mono text-sm whitespace-pre-wrap">{parts}</div>;
  }, [content, matches, currentMatchIndex]);

  return (
    <div data-testid="document-content-island-root" className="h-full flex flex-col">
      {/* Search Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 p-2 flex flex-wrap gap-2 items-center text-sm sticky top-0 z-10">
        <div className="relative flex-1 min-w-[200px]">
          <input 
            type="text"
            data-testid="search-input"
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            placeholder="Search in document..."
            className={`w-full pl-8 pr-4 py-1.5 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${regexError ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
          />
          <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"></i>
        </div>

        <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-md p-0.5">
          <button
            onClick={() => navigate(-1)}
            disabled={matches.length === 0}
            className="p-1 px-2 hover:bg-gray-100 rounded disabled:opacity-50"
            title="Previous match"
            data-testid="search-prev"
          >
            <i className="fas fa-chevron-up"></i>
          </button>
          <span className="text-xs text-gray-500 min-w-[60px] text-center" data-testid="search-count">
            {matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : '0/0'}
          </span>
          <button
            onClick={() => navigate(1)}
            disabled={matches.length === 0}
            className="p-1 px-2 hover:bg-gray-100 rounded disabled:opacity-50"
            title="Next match"
            data-testid="search-next"
          >
            <i className="fas fa-chevron-down"></i>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            className={`px-2 py-1 border rounded text-xs ${caseSensitive ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600'}`}
            title="Match Case"
            data-testid="search-case-sensitive"
          >
            Aa
          </button>
          <button
            onClick={() => setUseRegex(!useRegex)}
            className={`px-2 py-1 border rounded text-xs ${useRegex ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600'}`}
            title="Use Regular Expression"
            data-testid="search-regex"
          >
            .*
          </button>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('export:text-requested', { detail: { text: content } }));
              }
            }}
            className="px-2 py-1 border rounded text-xs bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
            title="Export Document Text"
            data-testid="export-text"
          >
            <i className="fas fa-download"></i>
          </button>
          <button
            onClick={() => {
              const context = { type: 'text', data: { text: content.substring(0, 5000) }, documentId }; // Limit text size
              window.location.href = `/chat?context=${encodeURIComponent(JSON.stringify(context))}`;
            }}
            className="px-2 py-1 border rounded text-xs bg-white border-gray-300 text-gray-600 hover:bg-gray-50 text-green-600"
            title="Send to Chat"
            data-testid="send-to-chat"
          >
            <i className="fas fa-comment-dots"></i>
          </button>
        </div>
      </div>

      {regexError && (
        <div className="bg-red-50 text-red-700 text-xs px-3 py-1 border-b border-red-100">
          Invalid Regex: {regexError}
        </div>
      )}

      {/* Content Area */}
      <div 
        ref={contentRef}
        data-testid="document-content-area"
        className="flex-1 overflow-auto p-4 bg-white"
      >
        {renderedContent}
      </div>
    </div>
  );
}
