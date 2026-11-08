# Diário de Enxaqueca

Webapp (PWA) em português de Portugal para registar e acompanhar crises de enxaqueca.
Funciona offline e instala-se no telemóvel com atalho no ecrã inicial. Todos os dados
ficam guardados apenas no dispositivo (localStorage) — nada é enviado para a internet.

## Funcionalidades

- **Registar crise**: início/fim, intensidade (1–10) com descritor, localização da dor,
  sintomas, possíveis gatilhos, medicação e eficácia, notas.
- **Início**: resumo rápido (crises no mês, dias sem crise, intensidade média), aviso de
  crise em curso e últimos registos.
- **Histórico**: lista cronológica agrupada por mês, com editar e apagar.
- **Estatísticas**: crises por mês, gatilhos e sintomas mais frequentes, duração média,
  eficácia da medicação.
- **Dados**: exportar (.json / .csv), importar (.json) e apagar tudo.

## Ficheiros

- `index.html`, `app.css`, `app.js` — a aplicação
- `manifest.webmanifest`, `sw.js` — PWA (instalação + offline)
- `icons/` — ícones (SVG + PNG)

## Correr localmente

```bash
python3 -m http.server 8731
```

Depois abra `http://localhost:8731/` no browser.
(O service worker precisa de `http`/`https`, não funciona abrindo o ficheiro diretamente.)

## Instalar no telemóvel

É preciso servir a app num endereço **HTTPS** público. Opções simples e gratuitas:
GitHub Pages, Netlify ou Cloudflare Pages — basta carregar esta pasta.

- **iPhone (Safari)**: abrir o site → botão Partilhar → *Adicionar ao ecrã principal*.
- **Android (Chrome)**: abrir o site → menu ⋮ → *Instalar aplicação* / *Adicionar ao ecrã principal*.

## Aviso

Esta app é um diário pessoal e não substitui aconselhamento médico.
