export type RetrievedContext = {
  source: string;
  content: string;
  score: number;
};

export interface Retriever {
  retrieve(query: string): Promise<RetrievedContext[]>;
}

export class EmptyRetriever implements Retriever {
  async retrieve(): Promise<RetrievedContext[]> {
    return [];
  }
}

export function formatRetrievedContext(items: RetrievedContext[]): string {
  if (items.length === 0) {
    return "No indexed code context is available yet.";
  }

  return items
    .map((item) => `SOURCE: ${item.source}\nSCORE: ${item.score}\n${item.content}`)
    .join("\n\n---\n\n");
}
