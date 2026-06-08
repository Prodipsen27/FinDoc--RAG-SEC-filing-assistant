-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users Table (provisioned on login/signup)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Source Documents Table
CREATE TABLE IF NOT EXISTS source_documents (
  id UUID PRIMARY KEY,
  ticker TEXT NOT NULL,
  company_name TEXT NOT NULL,
  form TEXT NOT NULL,
  filing_date TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,
  accession_number TEXT NOT NULL,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document Chunks Table
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES source_documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  text TEXT NOT NULL,
  page TEXT,
  section TEXT,
  chunk_metadata JSONB,
  token_count INT,
  embedding vector(1536),
  search_vector tsvector
);

-- Indexes for retrieval optimization
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS document_chunks_search_vector_idx ON document_chunks USING gin (search_vector);

-- Chat Threads Table
CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY,
  thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT,
  parts JSONB,
  sequence INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message Citations Table
CREATE TABLE IF NOT EXISTS message_citations (
  id UUID PRIMARY KEY,
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES document_chunks(id) ON DELETE CASCADE,
  citation_index INT NOT NULL,
  excerpt TEXT,
  ticker TEXT,
  company_name TEXT,
  form TEXT,
  filing_date TEXT,
  page TEXT,
  section TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
