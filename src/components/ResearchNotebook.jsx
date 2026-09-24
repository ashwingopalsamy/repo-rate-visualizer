import { useEffect, useRef, useState } from 'react';
import { Bookmark, Download, FolderOpen, Upload } from 'lucide-react';
import { Button } from './ui/button.jsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.jsx';
import { Input } from './ui/input.jsx';

const STORAGE_KEY = 'rbi-research-notebook-v1';

function isSavedView(item) {
  return Boolean(
    item
    && typeof item.name === 'string'
    && item.name.trim()
    && item.state
    && typeof item.state === 'object'
    && typeof item.state.activeView === 'string'
    && item.state.dateRange
    && item.state.recordFilters,
  );
}

function readSavedViews() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter(isSavedView) : [];
  } catch {
    return [];
  }
}

export default function ResearchNotebook({ analysisState, onLoadState }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [savedViews, setSavedViews] = useState(() => readSavedViews());
  const fileRef = useRef(null);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedViews)); } catch { /* local-only enhancement */ }
  }, [savedViews]);

  const saveView = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavedViews(current => [...current.filter(item => item.name !== trimmed), { name: trimmed, savedAt: new Date().toISOString(), state: analysisState }]);
    setName('');
  };

  const downloadNotebook = () => {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), views: savedViews }, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rbi-research-notebook.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const importNotebook = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed.version !== 1 || !Array.isArray(parsed.views)) throw new Error('Invalid notebook');
        setSavedViews(parsed.views.filter(isSavedView));
      } catch {
        // Invalid local imports are ignored rather than changing the active analysis.
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type="button" size="icon" variant="outline" className="size-9" aria-label="Open research notebook" title="Research notebook"><Bookmark className="size-3.5" /></Button></DialogTrigger>
      <DialogContent className="max-h-[min(640px,calc(100vh-2rem))] overflow-y-auto">
        <DialogHeader><DialogTitle>Research notebook</DialogTitle><DialogDescription>Save analysis states locally, then copy or export them for later work. Nothing is uploaded.</DialogDescription></DialogHeader>
        <div className="flex gap-2"><Input value={name} onChange={event => setName(event.target.value)} placeholder="Name this analysis" aria-label="Saved analysis name" onKeyDown={event => { if (event.key === 'Enter') saveView(); }} /><Button type="button" onClick={saveView}>Save</Button></div>
        <div className="space-y-2" aria-label="Saved analyses">{savedViews.length ? savedViews.map(item => <div key={item.name} className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2"><div className="min-w-0"><p className="m-0 truncate text-sm font-medium">{item.name}</p><p className="m-0 text-[11px] text-muted-foreground">{new Date(item.savedAt).toLocaleDateString('en-IN')}</p></div><Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => { onLoadState?.(item.state); setOpen(false); }}><FolderOpen className="size-3" />Load</Button></div>) : <p className="m-0 rounded-lg border border-dashed border-border/70 p-4 text-xs text-muted-foreground">No saved analyses yet.</p>}</div>
        <DialogFooter><input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importNotebook} /><Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={() => fileRef.current?.click()}><Upload className="size-3.5" />Import</Button><Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={downloadNotebook}><Download className="size-3.5" />Export notebook</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
