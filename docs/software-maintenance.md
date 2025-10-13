# Software e Manutenções

## Status
Catálogo de software disponível. Fluxos de solicitações e manutenção seguem em planejamento.

## Contas de mock geradas pela seed
- **Administrador**: `admin@acadlab.local`
- **Técnico**: `tech@acadlab.local`
- **Professor**: `prof@acadlab.local`
- **Senha padrão**: `ChangeMe123!`

## Passo a passo para preparar o ambiente
1. Defina `DATABASE_URL` no `.env`.
2. Instale pacotes com `npm install`.
3. Sincronize o schema: `npx prisma db push`.
4. Execute `npx prisma db seed` para criar as contas mock.
5. Inicie a aplicação: `npm run dev`.
6. Acesse `/software` com uma conta de administrador ou técnico.

## Checklist de validação
- Card “Catálogo de Software” deve aparecer para administradores e técnicos e apontar para `/software`.
- Tabela apresenta os softwares cadastrados e permite abrir o modal de edição ao clicar em uma linha.
- Botão “Novo software” exibe o modal de cadastro e revalida a listagem após salvar.
- A exclusão de um software exibe mensagem de confirmação e atualiza a tabela.

## Observações futuras
- Adicionar documentação específica sobre solicitações de instalação e manutenção quando o módulo for desenvolvido.
- Seeds complementares deverão criar softwares de exemplo e relacionamentos com laboratórios para cenários de teste realistas.
