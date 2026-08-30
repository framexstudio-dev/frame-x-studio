FRAME X STUDIO — V10 CLOUD ONLINE

Esta versão foi preparada para o site publicado no Cloudflare Pages.

INFRAESTRUTURA ESPERADA
- D1 binding: DB -> frame-x-db
- R2 binding: MEDIA -> frame-x-media

O QUE MUDA
- O painel /admin.html usa autenticação online.
- Login/senha ficam no D1 (hash seguro PBKDF2, nunca senha em texto puro).
- Sites, vídeos, imagens, restaurações, leads, avaliações e configurações ficam no D1.
- Uploads de imagens/vídeos/screenshots ficam no R2.
- Alterações feitas no admin online aparecem no site público sem editar o GitHub.
- O GitHub continua sendo usado apenas quando houver mudança no código/layout.

PUBLICAR
1. Abra o repositório frame-x-studio no GitHub.
2. Substitua os arquivos atuais pelo conteúdo DESTA pasta.
3. Garanta que a pasta functions/ e o arquivo _routes.json também sejam enviados.
4. Faça o commit: "V10 Cloud Online - D1 R2".
5. A Cloudflare fará novo deploy automaticamente.
6. Aguarde o deploy terminar.
7. Teste: https://frame-x-studio.pages.dev/api/health
   Deve retornar JSON com d1:true e r2:true.
8. Abra https://frame-x-studio.pages.dev/admin.html
9. No primeiro acesso, crie o login e a senha.

MIGRAÇÃO
Se houver conteúdo salvo no localStorage desse MESMO domínio, o painel tenta migrá-lo automaticamente para o D1 no primeiro acesso autenticado quando o banco ainda estiver vazio.

IMPORTANTE
- Para alterar conteúdo, use o admin. Não precisa fazer novo commit.
- Para alterar código/design, envie uma nova versão pelo GitHub.
