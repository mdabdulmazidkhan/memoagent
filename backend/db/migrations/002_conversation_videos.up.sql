-- Add table for tracking uploaded videos per conversation
CREATE TABLE IF NOT EXISTS conversation_videos (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  video_no TEXT NOT NULL,
  video_name TEXT NOT NULL,
  upload_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'UNPARSE',
  UNIQUE(conversation_id, video_no)
);

CREATE INDEX IF NOT EXISTS idx_conversation_videos_conversation_id ON conversation_videos(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_videos_video_no ON conversation_videos(video_no);
