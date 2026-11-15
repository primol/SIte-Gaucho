# Gaúcho Figueiras Grill · site

Novo site da churrascaria **Gaúcho Figueiras Grill** (Rua das Figueiras, 1408 · Santo André/SP).
Site estático (HTML, CSS e JavaScript puros), sem dependências nem build: basta publicar a pasta.

## Como visualizar

Abra o `index.html` no navegador ou, para testar como em produção, rode um servidor local na pasta:

```bash
python3 -m http.server 8000
# depois acesse http://localhost:8000
```

## O que tem no site

| Seção | Destaques |
|---|---|
| **Intro** | Animação de um bife sendo cortado por uma faca; o logo surge por trás do corte, com brasas e fumaça. Botão "Pular intro" (ou tecla Esc). Quem usa "reduzir movimento" no sistema vê uma versão curta. |
| **Hero** | Foto da brasa com zoom lento, fumaça e brasas animadas em canvas, nota do Google e horário. |
| **A Casa** | Texto "Quem somos", +20 tipos de cortes e as 4 etapas do atendimento. |
| **Qualidade** | Foco na qualidade da carne gaúcha: seleção, tradição, preparo na hora e fartura. |
| **Cortes** | Cards dos cortes estrela (Picanha Prime, Bife Ancho Prime, Chorizo, Costela no bafo...). |
| **Ponto da carne** | Controle interativo que mostra o corte do bife do mal ao bem passado. |
| **Cardápio** | Abas por categoria com preços (cardápio de out/2026) e link para o PDF completo. |
| **Avaliações** | Notas públicas (Google, iFood, Restaurant Guru), pratos mais elogiados e carrossel de depoimentos. |
| **Galeria** | Fotos da casa com visualização ampliada (lightbox). |
| **Delivery, outras casas, contato** | iFood, telefone, WhatsApp, mapa, Instagram e Facebook. |

## Como atualizar

- **Preços e pratos:** seção `CARDÁPIO` do `index.html` (cada prato é uma linha `<li>`). Os preços dos cards de cortes ficam na seção `CORTES`.
- **Cardápio em PDF:** substitua `assets/cardapio-gaucho-figueiras.pdf`.
- **Depoimentos:** cole avaliações **reais** de clientes em `assets/js/reviews.js` (o formato está explicado no arquivo). Com a lista vazia, o carrossel fica oculto.
- **Notas e número de avaliações:** seção `AVALIAÇÕES` do `index.html` e o selo do topo (`hero__facts`). Valores consultados em nov/2026: Google 4,6 (~1.195 avaliações), iFood 4,9 (~1.183), Restaurant Guru 4,8 (~1.204). Confira e atualize de tempos em tempos.
- **Fotos:** ficam em `assets/img/` (formato WebP). Para trocar, mantenha o mesmo nome do arquivo ou ajuste o `src` no HTML.
- **WhatsApp:** número `551125344654` nos links `wa.me` (busque por `wa.me` no `index.html`).

## Publicação

Funciona em qualquer hospedagem de site estático: a hospedagem atual (enviando os arquivos por FTP para a pasta pública),
Netlify, Vercel, Cloudflare Pages ou GitHub Pages. Publique o conteúdo desta pasta na raiz do domínio.

> Observação: o site antigo (WordPress) tinha formulário de contato e cadastro de e-mail. Esta versão estática direciona
> os contatos para WhatsApp, telefone e e-mail. Se quiser manter um formulário, dá para ligar um serviço como Formspree.

## Estrutura

```
index.html
assets/
  css/style.css      estilos, cores e animações
  js/main.js         intro, brasas/fumaça, menu, abas, ponto da carne, galeria
  js/reviews.js      depoimentos de clientes (editar aqui)
  img/               logo, fotos e ícones
  cardapio-gaucho-figueiras.pdf
```
