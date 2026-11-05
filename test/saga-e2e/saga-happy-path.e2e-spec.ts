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
 * Valida o fluxo feliz completo do Saga coreografado entre os 3
 * microsservicos reais (oficina-os-service, oficina-billing-service,
 * oficina-execution-service), publicando/consumindo eventos no SNS/SQS
 * FIFO real (ver oficina-app/test/saga-e2e/README.md para pre-requisitos).
 *
 * Abertura OS -> Orcamento -> Pagamento Aprovado -> Execucao Iniciada ->
 * Execucao Concluida -> OS Finalizada.
 */
describe('Saga E2E - fluxo feliz', () => {
  jest.setTimeout(120_000);

  it('propaga a OS de RECEBIDA a FINALIZADA atraves dos 3 servicos', async () => {
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

    // Garante o estado do gateway fake do Mercado Pago (pode ter sido
    // alterado por outro cenario do mesmo suite run).
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

    const diagRes = await post(
      OS_BASE_URL,
      `/os/${ordemServicoId}/diagnostico`,
      {},
      mecanicoOsToken,
    );
    expect(diagRes.status).toBe(201);

    const itemRes = await post(
      OS_BASE_URL,
      `/os/${ordemServicoId}/item`,
      {
        tipo: 'SERVICO',
        descricao: 'Troca de oleo (simulacao E2E)',
        preco: 150,
        quantidade: 1,
      },
      atendenteToken,
    );
    expect(itemRes.status).toBe(201);

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
    expect(pagamento.status).toBe('PENDENTE');
    console.log(
      `[saga-e2e] correlationId=${ordemServicoId} Billing criou pagamento mercadoPagoPaymentId=${pagamento.mercadoPagoPaymentId}`,
    );

    const webhookRes = await post(BILLING_BASE_URL, '/webhooks/mercadopago', {
      type: 'payment',
      data: { id: pagamento.mercadoPagoPaymentId },
    });
    expect(webhookRes.status).toBe(200);
    console.log(
      `[saga-e2e] correlationId=${ordemServicoId} PagamentoAprovadoEvent publicado`,
    );

    await waitUntil(
      async () => {
        const res = await get<OsStatusResponse>(
          OS_BASE_URL,
          `/os/${ordemServicoId}/status`,
          atendenteToken,
        );
        return res.body.status === 'APROVADA' ? res.body : null;
      },
      { label: 'OS reage ao PagamentoAprovadoEvent (APROVADA)' },
    );
    console.log(`[saga-e2e] correlationId=${ordemServicoId} OS -> APROVADA`);

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
    expect(execucao.status).toBe('NA_FILA');
    console.log(
      `[saga-e2e] correlationId=${ordemServicoId} Execution criou execucaoId=${execucao.id}`,
    );

    const iniciarRes = await post<ExecucaoResponse>(
      EXECUTION_BASE_URL,
      `/execucoes/${execucao.id}/iniciar`,
      { mecanicoId: 'mec-saga-e2e' },
      mecanicoToken,
    );
    expect(iniciarRes.status).toBe(201);
    expect(iniciarRes.body.status).toBe('EM_EXECUCAO');
    console.log(
      `[saga-e2e] correlationId=${ordemServicoId} ExecucaoIniciadaEvent publicado`,
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

    const finalizarRes = await post<ExecucaoResponse>(
      EXECUTION_BASE_URL,
      `/execucoes/${execucao.id}/finalizar`,
      {},
      mecanicoToken,
    );
    expect(finalizarRes.status).toBe(201);
    expect(finalizarRes.body.status).toBe('CONCLUIDA');
    console.log(
      `[saga-e2e] correlationId=${ordemServicoId} ExecucaoConcluidaEvent publicado`,
    );

    await waitUntil(
      async () => {
        const res = await get<OsStatusResponse>(
          OS_BASE_URL,
          `/os/${ordemServicoId}/status`,
          atendenteToken,
        );
        return res.body.status === 'FINALIZADA' ? res.body : null;
      },
      { label: 'OS reage ao ExecucaoConcluidaEvent (FINALIZADA)' },
    );
    console.log(
      `[saga-e2e] correlationId=${ordemServicoId} OS -> FINALIZADA (fim)`,
    );
  });
});
