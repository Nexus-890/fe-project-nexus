import { Card, CardContent } from "../components/card";

function BackofficePlaceholderPage({ title }: { title: string }) {
  return <section aria-labelledby="placeholder-title"><h1 id="placeholder-title" className="text-heading-32">{title}</h1><Card className="mt-6"><CardContent className="pt-6"><h2 className="text-heading-20">Coming soon</h2><p className="mt-3 text-sm text-muted-foreground">This workspace is a placeholder. No management actions are available yet.</p></CardContent></Card></section>;
}

export default BackofficePlaceholderPage;
