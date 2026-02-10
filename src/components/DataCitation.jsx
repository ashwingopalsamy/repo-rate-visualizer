import { Button } from './ui/button.jsx';
import { Separator } from './ui/separator.jsx';

export default function DataCitation() {
  return (
    <footer className="mt-auto pt-2 text-sm text-muted-foreground" role="contentinfo" aria-label="Project source">
      <Separator />
      <div className="flex flex-col items-center gap-2 py-6 text-center leading-6">
        <p className="m-0 text-center leading-6">
          <span className="inline-block sm:inline">Built by{' '}<Button asChild className="h-7 align-middle px-0 text-sm text-foreground" size="sm" variant="link"><a href="https://ashwingopalsamy.in" target="_blank" rel="noopener noreferrer">Ashwin Gopalsamy</a></Button>.{' '}</span>
          <span className="inline-block sm:inline">The source code is available on{' '}<Button asChild className="h-7 align-middle items-center gap-1 px-1 text-sm text-foreground" size="sm" variant="link">
            <a href="https://github.com/ashwingopalsamy/repo-rate-visualizer" target="_blank" rel="noopener noreferrer" aria-label="Open the Repo Rate Visualizer source code on GitHub">
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.74.08-.74 1.2.09 1.83 1.23 1.83 1.23 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.94 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.53.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.29-1.23 3.29-1.23.65 1.65.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.93.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5Z" />
              </svg>
              GitHub
            </a>
          </Button>{' '}</span>
          <span className="inline-block sm:inline">and the dataset is available in{' '}<Button asChild className="h-7 align-middle items-center gap-1 px-1 text-sm text-foreground" size="sm" variant="link">
            <a href="https://huggingface.co/datasets/ashwingopalsamy/india-repo-rate-dataset" target="_blank" rel="noopener noreferrer" aria-label="Open the RBI repo-rate dataset on Hugging Face">
              <img className="size-4" src="/hf-logo.svg" alt="" aria-hidden="true" /> HuggingFace
            </a>
          </Button>.</span>
        </p>
        <p className="m-0 max-w-2xl text-xs leading-5 text-muted-foreground">Independent educational reference. Not affiliated with or endorsed by the Reserve Bank of India. Not financial advice.</p>
      </div>
    </footer>
  );
}
