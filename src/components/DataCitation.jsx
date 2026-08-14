export default function DataCitation() {
  return (
    <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/70 pt-4 text-xs text-muted-foreground" role="contentinfo" aria-label="RBI reference links">
      <span>Reference links</span>
      <a className="underline decoration-border-strong underline-offset-4 transition-colors hover:text-foreground" href="https://www.rbi.org.in/Scripts/bs_viewcontent.aspx?Id=624" target="_blank" rel="noopener noreferrer">RBI historical data</a>
      <a className="underline decoration-border-strong underline-offset-4 transition-colors hover:text-foreground" href="https://bulletin.rbi.org.in/" target="_blank" rel="noopener noreferrer">RBI Bulletin</a>
      <span className="basis-full leading-5">Historical naming follows the source note: before 29 Oct 2004, “repo rate” referred to the reverse repo rate.</span>
    </footer>
  );
}
