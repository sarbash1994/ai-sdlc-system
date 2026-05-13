export interface RagOptions {
    repoPath: string;
    maxTokens?: number;
}
export declare function getCodeContext(query: string, options: RagOptions): Promise<string>;
//# sourceMappingURL=context.d.ts.map