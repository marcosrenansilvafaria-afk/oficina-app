# RFC-001 - Escolha da nuvem (AWS) e uso do EKS para orquestracao

Data: 15/09/2026
Status: Aceita

## Resumo

Migrar a orquestracao de containers da Fase 2 (cluster Kind local) para a
AWS, usando Amazon EKS como cluster Kubernetes gerenciado, dentro da
arquitetura de 4 repositorios independentes da Fase 3.

## Motivacao

A Fase 2 rodava tudo localmente (Kind), o que nao demonstra a capacidade do
time de operar em um provedor de nuvem real, nem permite avaliar decisoes
de rede, seguranca e custo que so aparecem em um ambiente gerenciado de
verdade. A Fase 3 exige explicitamente infraestrutura provisionada via
Terraform em um provedor cloud, com bancos gerenciados, funcoes serverless
e um cluster Kubernetes gerenciado.

## Alternativas consideradas

1. **Manter Kind/local**: descartado - nao atende ao requisito da Fase 3 de
   infraestrutura em nuvem real, nem exercita habilidades de IaC contra uma
   API de provedor cloud.
2. **ECS (Fargate ou EC2)**: mais simples e mais barato que EKS (sem taxa de
   control plane), mas foge do requisito explicito de orquestracao
   Kubernetes gerenciada pedido no enunciado, e o time ja tinha experiencia
   com manifestos K8s da Fase 2 (Deployment/Service/HPA/Job) que seriam
   descartados.
3. **EKS (escolhida)**: atende literalmente ao requisito, reaproveita 100%
   dos manifestos K8s ja escritos na Fase 2 (apenas trocando o endpoint do
   banco), e usa o mesmo Metrics Server/HPA ja modelados.
4. **Outro provedor cloud (GCP/Azure)**: descartado por falta de familiaridade
   do time e por AWS ja ser o provedor usado no Repositorio 1 (RDS) e
   Repositorio 2 (Lambda), evitando fragmentar credenciais/contas entre
   provedores.

## Decisao

Usar AWS como provedor unico da Fase 3, com EKS para orquestracao,
provisionado via Terraform (modulo oficial `terraform-aws-modules/eks/aws`)
no Repositorio 3 (`oficina-k8s-infrastructure`).

Decisoes de dimensionamento adotadas para conter custo (a conta usada tem
free tier limitado, sem cobrir o control plane do EKS de forma alguma):

- 1 Managed Node Group `t3.small` (min 1, max 2) - dimensionado para os
  requests de CPU/memoria da aplicacao (100m/128Mi por pod, ate 5 replicas
  via HPA).
- 1 unico NAT Gateway (nao um por AZ) para os nodes alcancarem a internet
  (pull de imagens/addons).
- Sem CloudWatch Logs do control plane e sem KMS CMK para secrets do
  cluster - ambos tem custo adicional nao coberto pelo free tier.
- IRSA (IAM Roles for Service Accounts) habilitado para uso futuro por
  addons/aplicacoes que precisem de permissoes AWS via Service Account.

## Consequencias

- Positivas: reaproveitamento quase total dos manifestos K8s da Fase 2;
  cluster gerenciado com upgrades de control plane e patching de nodes
  simplificados; HPA/Metrics Server funcionam de forma identica ao Kind.
- Negativas: **custo fixo real e significativo** - o control plane do EKS
  custa ~US$0,10/hora (~US$73/mes) independente de uso, sem free tier. Some
  o node (~US$15/mes) e o NAT Gateway (~US$32/mes), totalizando ~US$120/mes
  se o cluster ficar ligado continuamente. Mitigado recomendando
  `terraform destroy` fora de janelas de uso/avaliacao (documentado no
  README do Repositorio 3).
- Descobertas durante a implementacao: a conta AWS usada tem restricoes de
  free tier mais agressivas que o esperado (ex: `enable_cluster_creator_admin_permissions`
  precisou ser adicionado explicitamente, pois o modulo nao concede RBAC ao
  criador do cluster por padrao na versao usada), documentadas nos commits
  do Repositorio 3.

Relacionado ao PR #fase3-rfc-001
