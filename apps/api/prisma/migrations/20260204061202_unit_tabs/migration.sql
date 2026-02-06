-- AlterTable
ALTER TABLE "units" ADD COLUMN     "attachments_json" JSONB,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "method_pdf_asset_key" TEXT,
ADD COLUMN     "method_rich_latex" TEXT,
ADD COLUMN     "theory_pdf_asset_key" TEXT,
ADD COLUMN     "theory_rich_latex" TEXT,
ADD COLUMN     "videos_json" JSONB;
