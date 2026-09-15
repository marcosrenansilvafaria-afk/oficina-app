# ADR-011 - Transicao para PostgreSQL com Prisma ORM

Data: 03/06/2026
Status: Aceita

## Contexto
Na Fase 1 do projeto oficina, a persistência de dados foi implementada inteiramente em memória (*In-Memory*) utilizando o padrão Singleton para agilizar a validação das regras de negócio do MVP. 
Para a Fase 2, os requisitos obrigatórios exigem a evolução da aplicação para utilizar um banco de dados relacional real, containerizado via Docker, além de garantir suporte a transações e integridade referencial (como a exclusão lógica e em cascata de itens da Ordem de Serviço). 

Precisávamos escolher uma abordagem de persistência que:
1. Não violasse os princípios de Clean Architecture e DDD adotados na Fase 1 (mantendo as entidades de domínio puras e sem acoplamento com decorators de banco)[cite: 2].
2. Fornecesse suporte nativo a TypeScript (Type Safety) para mitigar erros em tempo de compilação.
3. Facilitasse a automação de migrações (Migrations) dentro do pipeline de CI/CD.

## Decisão
Decidimos utilizar o **PostgreSQL** como banco de dados relacional, gerenciado localmente via Docker, e o **Prisma ORM** (versão 7.x) como ferramenta de mapeamento objeto-relacional.

A execução seguirá a seguinte estratégia arquitetural:
* **Abordagem Schema-First:** Toda a modelagem de tabelas e relacionamentos ficará isolada no arquivo `schema.prisma` dentro da camada de *Infrastructure*. As entidades da pasta `src/domain/entities` permanecerão códigos TypeScript puros[cite: 2].
* **Inversão de Dependência:** Os Casos de Uso (*Use Cases*) continuarão acoplados apenas às interfaces dos repositórios (`IClienteRepository`, `IOrdemRepository`, etc.) definidas no *Domain*[cite: 2]. A implementação concreta (`PrismaClienteRepository`, etc.) estenderá o `PrismaService` na camada de *Infrastructure* e fará o *Data Mapping* (conversão de tipos do Prisma para entidades de domínio)[cite: 2].
* **Execução Local via Docker:** O arquivo `docker-compose.yml` será atualizado para incluir o serviço do PostgreSQL, garantindo que o comando `docker-compose up` configure o ecossistema completo de forma automatizada.

## Consequências

### Positivas:
* **Isolamento do Domínio:** O domínio continua agnóstico a banco de dados, respeitando 100% as regras da Clean Architecture[cite: 2].
* **Segurança e Produtividade:** A geração automática de tipos do Prisma reduz o código boilerplate e acelera o desenvolvimento de novas consultas com autocompletar nativo.
* **Rastreabilidade:** O histórico de alterações do banco de dados fica documentado na pasta de migrations em formato SQL puro, facilitando o deploy contínuo (CI/CD).

### Negativas / Riscos:
* **Necessidade de Mapeadores (Mappers):** Como o Prisma gera seus próprios tipos, há um pequeno overhead de código nos repositórios para transformar os objetos do Prisma de volta em instâncias de classes de domínio através de construtores ou métodos como `reconstitute`.