-- AlterTable
ALTER TABLE "challenge_test_suites" ADD COLUMN     "contract_id" TEXT,
ADD COLUMN     "validated_against_broken" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "validated_against_expected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "validation_score" DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "challenge_test_suites" ADD CONSTRAINT "challenge_test_suites_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "launchpad_challenge_verification_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

