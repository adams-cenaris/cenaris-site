const { getClient } = require('../_shared/supabase');
const { requireAdmin } = require('../_shared/auth');
const OpenAI = require('openai');

const CHUNK_SIZE = 800;    // characters per chunk
const CHUNK_OVERLAP = 100; // overlap between chunks

function chunkText(text) {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > CHUNK_SIZE && current) {
      chunks.push(current.trim());
      // Keep last part as overlap for next chunk
      current = current.slice(-CHUNK_OVERLAP) + '\n\n' + para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// POST /api/knowledge/seed
// Body: { title, sourceUrl, content }
// Chunks the content, embeds it, and stores in knowledge_chunks
module.exports = requireAdmin(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, sourceUrl, content } = req.body || {};
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'title and content are required' });
  }

  const supabase = getClient();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const chunks = chunkText(content.trim());
  if (chunks.length === 0) return res.status(400).json({ error: 'No content to index' });

  // Delete existing chunks for this sourceUrl if re-seeding
  if (sourceUrl) {
    await supabase.from('knowledge_chunks').delete().eq('source_url', sourceUrl);
  }

  const rows = [];
  for (const chunk of chunks) {
    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk,
    });
    rows.push({
      title: title.trim(),
      source_url: sourceUrl || null,
      chunk_text: chunk,
      embedding: embeddingRes.data[0].embedding,
    });
  }

  const { error } = await supabase.from('knowledge_chunks').insert(rows);
  if (error) {
    console.error('knowledge seed error', error);
    return res.status(500).json({ error: 'Failed to store knowledge chunks' });
  }

  res.status(200).json({ ok: true, chunksCreated: rows.length });
});
