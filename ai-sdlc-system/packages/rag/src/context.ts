import * as fs from 'fs';
import * as path from 'path';

export interface RagOptions {
  repoPath: string;
  maxTokens?: number;
}

export async function getCodeContext(query: string, options: RagOptions): Promise<string> {
  const { repoPath, maxTokens = 5000 } = options;
  
  const files = getAllFiles(repoPath);
  
  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
  const relevantFiles: string[] = [];

  for (const file of files) {
    const ext = path.extname(file);
    if (!['.ts', '.js', '.json', '.md'].includes(ext)) continue;
    if (file.includes('node_modules') || file.includes('dist')) continue;

    const content = fs.readFileSync(file, 'utf8');
    const lowerContent = content.toLowerCase();
    
    const isRelevant = keywords.some(kw => lowerContent.includes(kw));
    if (isRelevant) {
      relevantFiles.push(file);
    }
  }

  const relativePaths = files.map(f => path.relative(repoPath, f)).filter(f => !f.includes('node_modules'));
  let context = `## File Structure\n${relativePaths.join('\n')}\n\n`;

  context += `## Relevant Files Context\n\n`;
  let currentLength = context.length;

  for (const file of relevantFiles) {
    const relativePath = path.relative(repoPath, file);
    const content = fs.readFileSync(file, 'utf8');
    
    const fileContext = `--- ${relativePath} ---\n${content}\n\n`;
    
    if ((currentLength + fileContext.length) / 4 > maxTokens) {
      context += `[Truncated...]`;
      break;
    }
    
    context += fileContext;
    currentLength += fileContext.length;
  }

  return context;
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;

  const files = fs.readdirSync(dirPath);

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
      }
    } else {
      arrayOfFiles.push(path.join(dirPath, file));
    }
  });

  return arrayOfFiles;
}
