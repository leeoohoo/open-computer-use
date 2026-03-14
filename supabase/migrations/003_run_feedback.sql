-- Run feedback table: stores per-run ratings, comments, and NPS responses
CREATE TABLE IF NOT EXISTS "public"."run_feedback" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
    "chat_id" text,
    "swarm_id" text,
    "message_id" text,
    "rating" smallint CHECK (rating >= 1 AND rating <= 4),
    "comment" text,
    "nps_score" smallint CHECK (nps_score >= 0 AND nps_score <= 10),
    "feedback_type" text NOT NULL DEFAULT 'run' CHECK (feedback_type IN ('run', 'swarm', 'nps')),
    "credits_awarded" integer NOT NULL DEFAULT 0,
    "metadata" jsonb DEFAULT '{}',
    "created_at" timestamp with time zone DEFAULT now()
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_run_feedback_user_id ON "public"."run_feedback" ("user_id");

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_run_feedback_rating ON "public"."run_feedback" ("rating", "created_at");
CREATE INDEX IF NOT EXISTS idx_run_feedback_nps ON "public"."run_feedback" ("nps_score") WHERE nps_score IS NOT NULL;

-- RLS policies
ALTER TABLE "public"."run_feedback" ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback" ON "public"."run_feedback"
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own feedback
CREATE POLICY "Users can read own feedback" ON "public"."run_feedback"
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can read all feedback (for analytics)
CREATE POLICY "Service role can read all feedback" ON "public"."run_feedback"
    FOR SELECT USING (auth.role() = 'service_role');
