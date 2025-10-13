# Gestão de Laboratórios e Recursos

## Status
Módulo disponível. As instruções abaixo auxiliam na validação do fluxo de cadastro e consulta.

## Contas de mock geradas pela seed
- **Administrador**: `admin@acadlab.local`
- **Técnico**: `tech@acadlab.local`
- **Professor**: `prof@acadlab.local`
- **Senha padrão**: `ChangeMe123!`

## Passo a passo para preparar o ambiente
1. Defina `DATABASE_URL` no `.env`.
2. Execute `npm install`.
3. Rode `npx prisma db push`.
4. Popule as contas mock com `npx prisma db seed`.
5. Inicie `npm run dev`.
6. Autentique-se com a conta de administrador ou técnico.

## Checklist de validação
- Confirme que o card “Gestão de Laboratórios e Recursos” direciona para `/laboratories` e está disponível para todos os perfis.
- Valide que a tabela lista os laboratórios cadastrados e suporta filtros por disponibilidade e softwares instalados.
- Clique em uma linha e verifique que os detalhes do laboratório aparecem em um modal. Técnicos/administradores conseguem editar dados e gerenciar softwares; professores acessam o modo somente leitura.
- Utilize o botão “Novo laboratório” para cadastrar um ambiente e confirme a atualização automática da tabela.

## Observações futuras
- Adicionar demonstrações com capturas de tela quando o ambiente estiver acessível.
- Expandir os cenários de teste cobrindo integrações com o sistema de reservas (Módulo 3).
