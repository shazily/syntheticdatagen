-- Admin Analytics Database Schema
-- Created for feedback analysis and reinforcement learning

-- Chat Logs Table: Store all A.I. Mode interactions
CREATE TABLE IF NOT EXISTS chat_logs (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    user_prompt TEXT NOT NULL,
    ai_message TEXT,
    generated_schema JSON,
    generated_data_sample JSON,
    record_count INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    response_time_ms INTEGER,
    timestamp TIMESTAMP DEFAULT NOW(),
    user_agent TEXT,
    qdrant_indexed BOOLEAN DEFAULT FALSE
);

-- Create index on session_id for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_logs_session ON chat_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_timestamp ON chat_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_chat_logs_qdrant_indexed ON chat_logs(qdrant_indexed) WHERE qdrant_indexed = FALSE;

-- AI Ratings Table: Store user ratings for reinforcement learning
CREATE TABLE IF NOT EXISTS ai_ratings (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    chat_log_id INTEGER REFERENCES chat_logs(id) ON DELETE CASCADE,
    rating VARCHAR(20) NOT NULL CHECK (rating IN ('thumbs_up', 'thumbs_down')),
    feedback_comment TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Create index on chat_log_id for faster joins
CREATE INDEX IF NOT EXISTS idx_ai_ratings_chat_log ON ai_ratings(chat_log_id);
CREATE INDEX IF NOT EXISTS idx_ai_ratings_timestamp ON ai_ratings(timestamp DESC);

-- Data Requests Table: Store requests for large datasets (>1000 records)
CREATE TABLE IF NOT EXISTS data_requests (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    topic TEXT,
    field_count INTEGER,
    requested_record_count INTEGER NOT NULL,
    schema_details TEXT,
    additional_notes TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on email and status for faster queries
CREATE INDEX IF NOT EXISTS idx_data_requests_email ON data_requests(email);
CREATE INDEX IF NOT EXISTS idx_data_requests_status ON data_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_requests_created_at ON data_requests(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE chat_logs IS 'Stores all A.I. Mode chat interactions for analytics and RL';
COMMENT ON TABLE ai_ratings IS 'Stores user ratings (thumbs up/down) for AI responses';
COMMENT ON TABLE data_requests IS 'Stores user requests for large datasets exceeding 1000 records';
COMMENT ON COLUMN chat_logs.generated_data_sample IS 'First 3 records of generated data for context';
COMMENT ON COLUMN ai_ratings.rating IS 'User rating: thumbs_up or thumbs_down';
COMMENT ON COLUMN data_requests.status IS 'Request status: pending, in_progress, completed, or rejected';

