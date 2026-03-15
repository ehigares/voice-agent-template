import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pinecone, type RecordMetadata } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

async function main() {
  const docsDir = process.argv[2];
  if (!docsDir) {
    console.error('Usage: npm run seed-knowledge -- <path-to-docs-directory>');
    console.error('Example: npm run seed-knowledge -- ./docs/my-business');
    process.exit(1);
  }

  if (!fs.existsSync(docsDir)) {
    console.error(`❌ Directory not found: ${docsDir}`);
    process.exit(1);
  }

  const pineconeKey = process.env.PINECONE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const indexName = process.env.PINECONE_INDEX ?? 'voice-agent';

  if (!pineconeKey || !openaiKey) {
    console.error('❌ PINECONE_API_KEY and OPENAI_API_KEY are required');
    process.exit(1);
  }

  const pinecone = new Pinecone({ apiKey: pineconeKey });
  const openai = new OpenAI({ apiKey: openaiKey });
  const index = pinecone.index(indexName);

  // Read all .txt and .md files
  const files = fs
    .readdirSync(docsDir)
    .filter((f) => f.endsWith('.txt') || f.endsWith('.md'));

  if (files.length === 0) {
    console.error(`❌ No .txt or .md files found in ${docsDir}`);
    process.exit(1);
  }

  console.log(`\n📚 Ingesting ${files.length} files into Pinecone index "${indexName}"...\n`);

  let totalChunks = 0;

  for (const file of files) {
    const filePath = path.join(docsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const chunks = chunkText(content, CHUNK_SIZE, CHUNK_OVERLAP);

    console.log(`  📄 ${file}: ${chunks.length} chunks`);

    // Generate embeddings in batches of 20
    for (let i = 0; i < chunks.length; i += 20) {
      const batch = chunks.slice(i, i + 20);
      const embedResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
      });

      const vectors = embedResponse.data.map((emb, idx) => ({
        id: `${file}-chunk-${i + idx}`,
        values: emb.embedding,
        metadata: {
          content: batch[idx],
          source: file,
          chunkIndex: i + idx,
        } as RecordMetadata,
      }));

      await index.upsert(vectors);
      totalChunks += vectors.length;
    }
  }

  console.log(`\n✅ Ingested ${totalChunks} chunks from ${files.length} files.\n`);
  console.log('Your knowledge base is ready! The voice agent can now search it during calls.\n');
}

main().catch(console.error);
