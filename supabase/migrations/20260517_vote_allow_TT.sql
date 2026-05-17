-- Allow vote value 'TT' (Tidak Tahu — voter doesn't remember/disclose pilih
-- 1 atau 2). Used during eVote phase for tracked voters with unknown choice.

ALTER TABLE members DROP CONSTRAINT IF EXISTS members_vote_check;
ALTER TABLE members
  ADD CONSTRAINT members_vote_check
  CHECK (vote IN ('Sudah', 'Belum', '1', '2', 'TT') OR vote IS NULL);
