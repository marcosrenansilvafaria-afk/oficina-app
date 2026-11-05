import {
  OS_BASE_URL,
  BILLING_BASE_URL,
  EXECUTION_BASE_URL,
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
interface ExecucaoResponse {
  id: string;
  ordemServicoId: string;
  status: string;
}

/**
 * Valida a compensacao do Saga quando a execucao (reparo) falha depois de
 * iniciada: PagamentoAprovado -> ExecucaoIniciada -> FalhaTecnica ->
 * CompensarOSEvent(origemFalha=EXECUCAO) -> Reembolso no Billing +
 * Cancelamento da OS e da Execucao.
 */
describe('Saga E2E - compensacao por falha na execucao', () => {
  jest.setTimeout(120_000);

  it('cancela OS/Execucao e reembolsa o pagamento quando o reparo falha', async () => {
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

    await post(BILLING_BASE_URL, '/test/mercadopago/proximo-status', {
      status: 'approved',
    });

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
        descricao: 'Retifica de motor (simulacao E2E)',
        preco: 2000,
        quantidade: 1,
      },
      atendenteToken,
    );
    await post(
      OS_BASE_URL,
      `/os/${ordemServicoId}/orcamento`,
      {},
      atendenteToken,
    );
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

    await post(BILLING_BASE_URL, '/webhooks/mercadopago', {
      type: 'payment',
      data: { id: pagamento.mercadoPagoPaymentId },
    });
    console.log(
      `[saga-e2e] correlationId=${ordemServicoId} PagamentoAprovadoEvent publicado`,
    );

    const mecanicoToken = await login(
      EXECUTION_BASE_URL,
      MECANICO.email,
      MECANICO.senha,
    );

    const execucao = await waitUntil(
      async () => {
        const res = await get<ExecucaoResponse[]>(
          EXECUTION_BASE_URL,
          '/execucoes',
          mecanicoToken,
        );
        return (
          res.body.find((e) => e.ordemServicoId === ordemServicoId) ?? null
        );
      },
      { label: 'execution-service recebe PagamentoAprovadoEvent (NA_FILA)' },
    );

    await post(
      EXECUTION_BASE_URL,
      `/execucoes/${execucao.id}/iniciar`,
      { mecanicoId: 'mec-saga-e2e' },
      mecanicoToken,
    );
    await waitUntil(
      async () => {
        const res = await get<OsStatusResponse>(
          OS_BASE_URL,
          `/os/${ordemServicoId}/status`,
          atendenteToken,
        );
        return res.body.status === 'EM_EXECUCAO' ? res.body : null;
      },
      { label: 'OS reage ao ExecucaoIniciadaEvent (EM_EXECUCAO)' },
    );
    console.log(`[saga-e2e] correlationId=${ordemServicoId} OS -> EM_EXECUCAO`);

    const falharRes = await post<ExecucaoResponse>(
      EXECUTION_BASE_URL,
      `/execucoes/${execucao.id}/falhar`,
      { motivo: 'Falha tecnica no reparo (simulacao E2E)' },
      mecanicoToken,
    );
    expect(falharRes.status).toBe(201);
    expect(falharRes.body.status).toBe('CANCELADA');
    console.log(
      `[saga-e2e] correlationId=${ordemServicoId} CompensarOSEvent(origemFalha=EXECUCAO) publicado`,
    );

    await waitUntil(
      async () => {
        const res = await get<OsStatusResponse>(
          OS_BASE_URL,
          `/os/${ordemServicoId}/status`,
          atendenteToken,
        );
        return res.body.status === 'CANCELADA' ? res.body : null;
      },
      { label: 'OS reage ao CompensarOSEvent (CANCELADA)' },
    );
    console.log(`[saga-e2e] correlationId=${ordemServicoId} OS -> CANCELADA`);

    await waitUntil(
      async () => {
        const res = await get<PagamentoResponse>(
          BILLING_BASE_URL,
          `/pagamentos/${ordemServicoId}`,
          atendenteToken,
        );
        return res.body.status === 'REEMBOLSADO' ? res.body : null;
      },
      { label: 'billing reembolsa o pagamento (CompensarPagamento)' },
    );
    console.log(
      `[saga-e2e] correlationId=${ordemServicoId} Billing -> REEMBOLSADO (fim)`,
    );
  });
});
