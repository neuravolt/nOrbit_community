-- Phase D2 (Rubric-based review) + D3 (Reviewer Reputation Engine)
ALTER TABLE "peer_review_assignments" ADD COLUMN "rubric_scores" JSONB;
ALTER TABLE "peer_review_assignments" ADD COLUMN "outcome_agreement" BOOLEAN;

-- Phase D4 (Dispute Integration): loose reference from a PEER_CONFLICT dispute to the
-- PeerReviewAssignment it contests.
ALTER TABLE "launchpad_disputes" ADD COLUMN "peer_review_assignment_id" TEXT;
