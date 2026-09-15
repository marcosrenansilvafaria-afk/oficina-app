-- CreateTable
CREATE TABLE "ordens_servico_status_historico" (
    "id" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "status" "StatusOrdemServico" NOT NULL,
    "alteradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordens_servico_status_historico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ordens_servico_status_historico_ordemServicoId_idx" ON "ordens_servico_status_historico"("ordemServicoId");

-- CreateIndex
CREATE INDEX "ordens_servico_status_historico_status_idx" ON "ordens_servico_status_historico"("status");

-- AddForeignKey
ALTER TABLE "ordens_servico_status_historico" ADD CONSTRAINT "ordens_servico_status_historico_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: registra o status atual de cada OS existente como um evento de
-- historico inicial (usando criadaEm como aproximacao do momento da
-- transicao, ja que nao havia rastreamento anterior).
INSERT INTO "ordens_servico_status_historico" ("id", "ordemServicoId", "status", "alteradoEm")
SELECT gen_random_uuid()::text, "id", "status", "criadaEm"
FROM "ordens_servico";
