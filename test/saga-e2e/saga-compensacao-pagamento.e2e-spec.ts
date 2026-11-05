import {
  OS_BASE_URL,
  BILLING_BASE_URL,
  login,
  get,
  post,
  ATENDENTE,
  MECANICO,
} from './helpers/http-client';
import { waitUntil } from './helpers/wait-until';

interface OsStatusResponse {
  status: string;
}
interface PagamentoResponse {
  status: string;
  mercadoPagoPaymentId?: string;
}

/**
 * Valida a compensacao do Saga quando o pagamento e recusado:
 * OrcamentoGerado -> PagamentoRecusado -> CompensarOSEvent -> a OS volta
 * para EM_DIAGNOSTICO (comportamento real de recusarOrcamento() em
 * ordem-servico.ts - reabre para um novo diagnostico/orcamento; ver nota
 * no SAGA_PATTERN_SPEC.md sobre essa transicao).
 *
 * Usa o seam de teste POST /test/mercadopago/proximo-status do
 * oficina-billing-service (so ativo com ENABLE_SAGA_E2E_TEST_ENDPOINTS=true
 * e gateway fake) para forcar a recusa, já que o FakeMercadoPagoGateway
 * tem um status fixo por instancia de processo.
 */
describe('Saga E2E - compensacao por pagamento recusado', () => {
  jest.setTimeout(120_000);

  afterAll(async () => {
    // Nao deixa o container compartilhado "preso" em rejected para os
    // outros cenarios do mesmo suite run.
    await post(BILLING_BASE_URL, '/test/mercadopago/proximo-status', {
      status: 'approved',
    });
  });

  it('reverte a OS para EM_DIAGNOSTICO quando o pagamento e recusado', async () => {
    const atendenteToken = await login(
      OS_BASE_URL,
      ATENDENTE.email,
      ATENDENTE.senha,
    );
    const mecanicoOsToken = await login(
      OS_BASE_URL,
      MECANICO.email,
      MECANICO.senha,
    );

    const seamRes = await post(
      BILLING_BASE_URL,
      '/test/mercadopago/proximo-status',
      {
        status: 'rejected',
        motivoRecusa: 'Simulacao E2E - pagamento recusado',
      },
    );
    expect(seamRes.status).toBe(204);

    const osRes = await post<{ id: string }>(
      OS_BASE_URL,
      '/os',
      {},
      atendenteToken,
    );
    expect(osRes.status).toBe(201);
    const ordemServicoId = osRes.body.id;
    console.log(`[saga-e2e] correlationId=${ordemServicoId} OS criada`);

    await post(
      OS_BASE_URL,
      `/os/${ordemServicoId}/diagnostico`,
      {},
      mecanicoOsToken,
    );
    await post(
      OS_BASE_URL,
      `/os/${ordemServicoId}/item`,
      {
        tipo: 'SERVICO',
        descricao: 'Pintura completa (simulacao E2E)',
        preco: 900,
        quantidade: 1,
      },
      atendenteToken,
    );

    const orcamentoRes = await post(
      OS_BASE_URL,
      `/os/${ordemServicoId}/orcamento`,
      {},
      atendenteToken,
    );
    expect(orcamentoRes.status).toBe(201);
    console.log(
      `[saga-e2e] correlationId=${ordemServicoId} OrcamentoGeradoEvent publicado`,
    );

    const pagamento = await waitUntil(
      async () => {
        const res = await get<PagamentoResponse>(
          BILLING_BASE_URL,
          `/pagamentos/${ordemServicoId}`,
          atendenteToken,
        );
        return res.status === 200 && res.body.mercadoPagoPaymentId
          ? res.body
          : null;
      },
      {
        label: 'billing recebe OrcamentoGeradoEvent e cria pagamento PENDENTE',
      },
    );

    const webhookRes = await post(BILLING_BASE_URL, '/webhooks/mercadopago', {
      type: 'payment',
      data: { id: pagamento.mercadoPagoPaymentId },
    });
    expect(webhookRes.status).toBe(200);
    console.log(
      `[saga-e2e] correlationId=${ordemServicoId} PagamentoRecusadoEvent + CompensarOSEvent(origemFalha=PAGAMENTO) publicados`,
    );

    const pagamentoFinal = await waitUntil(
      async () => {
        const res = await get<PagamentoResponse>(
          BILLING_BASE_URL,
          `/pagamentos/${ordemServicoId}`,
          atendenteToken,
        );
        return res.body.status === 'RECUSADO' ? res.body : null;
      },
      { label: 'billing marca o pagamento como RECUSADO' },
    );
    expect(pagamentoFinal.status).toBe('RECUSADO');

    await waitUntil(
      async () => {
        const res = await get<OsStatusResponse>(
          OS_BASE_URL,
          `/os/${ordemServicoId}/status`,
          atendenteToken,
        );
        return res.body.status === 'EM_DIAGNOSTICO' ? res.body : null;
      },
      { label: 'OS reage ao CompensarOSEvent (volta para EM_DIAGNOSTICO)' },
    );
    console.log(
      `[saga-e2e] correlationId=${ordemServicoId} OS -> EM_DIAGNOSTICO (compensada, fim)`,
    );
  });
});
