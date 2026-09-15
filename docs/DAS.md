# Design Approval Sheet (DAS)

Projeto: Oficina MVP Backend
Data: 21/04/2026
Versao: 1.0
Identificador: DAS-OFICINA-MVP-001

## Contexto do Projeto
O projeto atende a necessidade de digitalizar o fluxo de Ordem de Servico (OS) de uma oficina mecanica, substituindo controles manuais por uma API com regras de negocio explicitas. O objetivo principal do MVP e garantir rastreabilidade do ciclo da OS, de criacao ate entrega do veiculo.

## Requisitos do sistema
Funcionais:
- Criacao e consulta de OS.
- Fluxo operacional da OS (diagnostico, adicao de itens, orcamento, aprovacao, execucao, finalizacao e entrega).
- Gestao basica de cliente, veiculo, peca e servico.
- Autenticacao e autorizacao por JWT + RBAC.
- Envio de orcamento simulado via endpoint dedicado.

Nao-funcionais:
- Arquitetura em camadas (DDD + Clean Architecture).
- Seguranca basica com validacao de entrada na camada HTTP.
- Testabilidade com testes unitarios e E2E.
- Deploy simplificado com Docker.
- Monitoramento simples de tempo de execucao no fluxo da OS.

## Arquitetura e tecnologias
- Backend: NestJS + TypeScript.
- Arquitetura: DDD no dominio e Clean Architecture na organizacao das camadas.
- Persistencia: in-memory no MVP.
- Autenticacao: JWT (access token) e RBAC.
- Infraestrutura: Docker e docker-compose (apenas API).

Justificativa: as escolhas privilegiam entrega rapida e validacao de regras criticas sem aumentar complexidade fora do escopo.

## Estrutura da arquitetura (C4 Model)
Contexto (C1): usuarios internos (atendente/mecanico/admin) interagem com a API da oficina.

Container (C2):
- API NestJS (regras, endpoints e autenticacao).
- Persistencia in-memory para o MVP.

Componentes (C3):
- Controllers HTTP.
- Use-cases de aplicacao.
- Entidades de dominio (incluindo OrdemServico).
- Repositorios in-memory.
- Modulo de autenticacao JWT.

## Diagramas de arquitetura
Diagramas disponiveis em docs/diagram:
- Contexto C4.
- Container C4.
- Componentes C4.
- Sequencia de autenticacao JWT.

## Restricoes e decisoes tecnicas
- Sem banco de dados neste MVP.
- Sem integracoes externas para envio de orcamento.
- Sem monitoramento avancado (apenas metrica simples de tempo medio).
- Simplificacoes mantidas por decisao arquitetural de escopo/prazo.

## Documentacao de requisitos funcionais e nao-funcionais
A documentacao detalhada de requisitos e criterios de qualidade esta consolidada em DOCUMENTACAO_ARQUITETURA.md, com rastreabilidade por secoes.

## Diagrama de implantacao e configuracao
- Imagem Docker multi-stage para a API.
- Orquestracao local via docker-compose com exposicao de porta 3000.
- Execucao local alternativa via npm scripts.

## ADR (Architecture Decision Record)
ADRs organizadas em docs/adr com contexto, decisao e consequencias.
Cada ADR possui associacao textual a PR, por exemplo: "Relacionado ao PR #simulado-01".

## Plano de testes e monitoramento
Testes:
- Unitarios (dominio e use-cases).
- E2E do fluxo principal e controllers.
- Validacoes finais: build, lint, test e test:e2e.

Monitoramento:
- Registro simples de timestamps no fluxo de execucao da OS.
- Calculo de tempo medio de execucao exposto por endpoint simples.

## Modelo de dados
Modelo orientado a entidades de dominio em memoria:
- OrdemServico (aggregate root).
- ItemOrdemServico.
- Cliente.
- Veiculo.
- Peca.
- Servico.

## Documentacao de API
A API esta documentada via Swagger e organizada por recursos:
- /auth
- /clientes
- /veiculos
- /pecas
- /servicos
- /os

Referencias principais:
- DOCUMENTACAO_ARQUITETURA.md
- docs/adr/README.md
