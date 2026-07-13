# Sistema de Gestão de Saídas — Novos & Seminovos

Sistema web responsivo para controle, acompanhamento e análise de saídas de itens novos e seminovos, focado no cálculo de economia gerada pela substituição operacional.

---

## 🛠️ Stack Tecnológica

- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Recharts, SheetJS.
- **Backend/Banco**: Supabase (PostgreSQL + Auth + RLS).

---

## 🚀 Como Iniciar Localmente

### 1. Configurar Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env` e preencha as chaves do seu projeto Supabase:
```bash
cp .env.example .env
```

### 2. Instalar Dependências
```bash
npm install
```

### 3. Rodar Servidor de Desenvolvimento
```bash
npm run dev
```

### 4. Gerar Build de Produção
```bash
npm run build
```

### Deploy no Netlify

O deploy de produção é executado automaticamente pelo GitHub Actions a cada push na branch `main`.
O workflow também pode ser iniciado manualmente pela aba **Actions** do repositório.

Secrets necessários no ambiente GitHub `production`:

- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

As regras de build e redirecionamento para a SPA estão em `netlify.toml`.

---

## 🗄️ Estruturação do Banco de Dados (Supabase)

Execute os scripts SQL contidos na pasta `/sql` na aba **SQL Editor** do painel do Supabase, seguindo a ordem numérica:
1. `01_schema.sql` (Estruturação das tabelas)
2. `02_rls.sql` (Políticas de segurança de perfis)
3. `03_seed.sql` (Carga inicial de dados e custos padrão)
4. `04_functions.sql` (Triggers e RPCs de economia e dashboard)

### Promovendo o Primeiro Administrador
Para conceder o perfil de `ADMIN` ao primeiro e-mail registrado, execute o comando SQL abaixo no editor do Supabase, substituindo o e-mail:
```sql
UPDATE public.profiles
SET role = 'ADMIN', ativo = true
WHERE email = 'seu-email@dominio.com';
```

---

## 📐 Regra Operacional de Economia

A economia líquida é calculada a partir da quantidade de saídas de itens seminovos multiplicada pela diferença entre o custo médio mensal do item novo e o do seminovo:

$$\text{Economia Líquida} = \text{Quantidade de Seminovos} \times (\text{Valor Médio Novo} - \text{Valor Médio Seminovo})$$

O sistema aplica uma hierarquia (waterfall) para obter os custos médios mensais vigentes na competência:
1. Custo específico do **Item no Almoxarifado** de destino.
2. Custo específico do **Item** (geral para todos os almoxarifados).
3. Custo geral da **Competência** (todos os itens e almoxarifados).
4. Fallback padrão do sistema (**Novo: R$ 40,00 | Seminovo: R$ 4,00**).
