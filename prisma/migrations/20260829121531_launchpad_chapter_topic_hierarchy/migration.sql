-- AlterTable
ALTER TABLE "launchpad_roadmap_nodes" ADD COLUMN     "topic_id" TEXT;

-- CreateTable
CREATE TABLE "launchpad_chapters" (
    "id" TEXT NOT NULL,
    "technology_level_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "objectives_summary" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launchpad_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launchpad_topics" (
    "id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "learning_objectives" JSONB,
    "prerequisite_topic_ids" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launchpad_topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "launchpad_chapters_technology_level_id_idx" ON "launchpad_chapters"("technology_level_id");

-- CreateIndex
CREATE INDEX "launchpad_topics_chapter_id_idx" ON "launchpad_topics"("chapter_id");

-- AddForeignKey
ALTER TABLE "launchpad_chapters" ADD CONSTRAINT "launchpad_chapters_technology_level_id_fkey" FOREIGN KEY ("technology_level_id") REFERENCES "launchpad_technology_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launchpad_topics" ADD CONSTRAINT "launchpad_topics_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "launchpad_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launchpad_roadmap_nodes" ADD CONSTRAINT "launchpad_roadmap_nodes_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "launchpad_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

