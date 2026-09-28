# Configurar os avisos por e-mail

1. Crie uma conta em [resend.com](https://resend.com) e, em **API Keys**, crie uma chave de envio.
2. No Vercel, abra o projeto do CATTS em **Settings → Environment Variables**.
3. Cadastre `RESEND_API_KEY` com a chave criada.
4. Cadastre `RESEND_FROM` com um remetente verificado no Resend, por exemplo `CATTS <avisos@seudominio.com>`. Para testes, o remetente padrão do Resend pode ter restrições de destinatário.
5. Cadastre `ADMIN_NOTIFICATION_EMAIL` com `juanhanzi@gmail.com`.
6. Marque Production, Preview e Development, salve e faça um novo deploy.

Sem essas três variáveis, o CATTS continua avaliando normalmente; o painel apenas registra que o e-mail está pendente.
