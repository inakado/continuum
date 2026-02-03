-- CreateTable
CREATE TABLE "unit_graph_edges" (
    "id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "prereq_unit_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_graph_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_graph_layout" (
    "id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_graph_layout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unit_graph_edges_section_id_prereq_unit_id_unit_id_key" ON "unit_graph_edges"("section_id", "prereq_unit_id", "unit_id");

-- CreateIndex
CREATE INDEX "unit_graph_edges_section_id_unit_id_idx" ON "unit_graph_edges"("section_id", "unit_id");

-- CreateIndex
CREATE INDEX "unit_graph_edges_section_id_prereq_unit_id_idx" ON "unit_graph_edges"("section_id", "prereq_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "unit_graph_layout_section_id_unit_id_key" ON "unit_graph_layout"("section_id", "unit_id");

-- CreateIndex
CREATE INDEX "unit_graph_layout_section_id_idx" ON "unit_graph_layout"("section_id");

-- AddForeignKey
ALTER TABLE "unit_graph_edges" ADD CONSTRAINT "unit_graph_edges_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_graph_edges" ADD CONSTRAINT "unit_graph_edges_prereq_unit_id_fkey" FOREIGN KEY ("prereq_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_graph_edges" ADD CONSTRAINT "unit_graph_edges_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_graph_layout" ADD CONSTRAINT "unit_graph_layout_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_graph_layout" ADD CONSTRAINT "unit_graph_layout_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
