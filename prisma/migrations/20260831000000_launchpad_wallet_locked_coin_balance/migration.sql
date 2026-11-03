-- Locked goodies (L7-11 coins) earned but not yet spendable — released into
-- coin_balance when the level they were earned at is crossed.
ALTER TABLE "launchpad_wallets" ADD COLUMN "locked_coin_balance" INTEGER NOT NULL DEFAULT 0;
