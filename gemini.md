# Registro do Sistema — Gestão Novos & Seminovos

Este arquivo registra a arquitetura do sistema, suas principais tecnologias, os fluxos de autenticação nativa implementados e as configurações de segurança vigentes.

---

## 1. Visão Geral da Arquitetura

O sistema é construído sobre uma arquitetura moderna e desacoplada, utilizando serviços gerenciados para banco de dados e autenticação, com hospedagem serverless.

* **Front-end**: React 18, Vite, TypeScript, TailwindCSS.
* **Back-end e Banco de Dados**: Supabase (PostgreSQL com Row Level Security - RLS).
* **Autenticação**: Supabase Auth (integrado a tabelas públicas).
* **Hospedagem e CI/CD**: Netlify (com publicação contínua automatizada via GitHub Actions).

---

## 2. Fluxo de Autenticação Nativa

Implementamos um ecossistema nativo completo de autenticação e recuperação de credenciais:

```
                  ┌──────────────────────┐
                  │   [1. Cadastro]      │
                  │   CadastroPage.tsx   │
                  └──────────┬───────────┘
                             │
                             ▼
┌───────────────┐  Login  ┌──────────────────────┐  Esqueci  ┌──────────────────────────┐
│ [Dashboard]   │◄────────┤    [2. Login]        ├──────────►│ [3. Esqueci a Senha]     │
│  (Privado)    │         │    LoginPage.tsx     │   Senha   │ RecuperarSenhaPage.tsx   │
└──────┬────────┘         └──────────────────────┘           └──────────┬───────────────┘
       │                                                                │
       │ Clique                                                         │ Link
       │ Ícone Chave                                                    │ E-mail
       ▼                                                                ▼
┌────────────────────────┐                                   ┌──────────────────────────┐
│ [4. Alterar Interno]   │                                   │ [5. Redefinir Senha]     │
│ AlterarSenhaModal.tsx  │                                   │ ResetarSenhaPage.tsx     │
└────────────────────────┘                                   └──────────────────────────┘
```

1. **Cadastro Próprio (`/cadastro`)**: Usuários preenchem Nome, E-mail, Senha e Confirmação. Os novos cadastros são inseridos no Supabase Auth e replicados no banco.
2. **Entrar no Sistema (`/login`)**: Autenticação convencional via e-mail e senha.
3. **Esqueci a Senha (`/recuperar-senha`)**: Envia um e-mail com token temporário de redefinição.
4. **Redefinir Senha (`/resetar-senha`)**: Tela de destino do link de recuperação enviado por e-mail, onde o usuário insere a nova senha.
5. **Alteração de Senha Logado**: Modal interno (`AlterarSenhaModal`) acessível pela barra superior (ícone de chave 🔑) para usuários autenticados trocarem sua senha sem deslogar.

---

## 3. Segurança e Políticas do Banco de Dados

### Tabela `public.profiles`
* Vinculada por chave estrangeira à tabela interna `auth.users(id)`.
* **Gatilho de Criação (`handle_new_user`)**: Sempre que uma conta é criada no Supabase Auth, o banco de dados insere um registro na tabela `profiles`. 
* **Regra de Hardening**: Por segurança, todo novo usuário cadastrado recebe o perfil padrão **`VISUALIZADOR`** e status **`ativo = false`**. A liberação do acesso e promoção para operador/administrador depende da aprovação manual de um administrador.

### Row Level Security (RLS)
* **Status**: RLS ativado em todas as tabelas (profiles, almoxarifados, setores, itens, custos, lotes, saidas, auditoria).
* **Restrições em Perfis**: Apenas administradores podem atualizar papéis (`role`) ou status de ativação (`ativo`). Usuários não administrativos estão bloqueados de editar qualquer perfil.
* **Auditoria de Ações**: Toda inserção ou alteração na tabela de saídas é auditada de forma segura por funções do PostgreSQL (`SECURITY DEFINER`), as quais colhem a identidade do usuário diretamente da assinatura do token JWT do Supabase (`auth.uid()`), prevenindo spoofing do front-end.

---

## 4. Variáveis de Ambiente Necessárias

O arquivo `.env` local ou as variáveis configuradas no Netlify devem conter:

```env
VITE_SUPABASE_URL=https://[sua-url-projeto].supabase.co
VITE_SUPABASE_ANON_KEY=[sua-chave-publica-anon-key]
```
