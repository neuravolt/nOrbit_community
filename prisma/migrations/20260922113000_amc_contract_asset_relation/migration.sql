-- CreateTable
CREATE TABLE "_AmcContractAssets" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AmcContractAssets_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AmcContractAssets_B_index" ON "_AmcContractAssets"("B");

-- AddForeignKey
ALTER TABLE "_AmcContractAssets" ADD CONSTRAINT "_AmcContractAssets_A_fkey" FOREIGN KEY ("A") REFERENCES "AmcContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AmcContractAssets" ADD CONSTRAINT "_AmcContractAssets_B_fkey" FOREIGN KEY ("B") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

