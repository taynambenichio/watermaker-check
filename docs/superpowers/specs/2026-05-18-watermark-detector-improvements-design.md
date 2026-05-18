# Design: Melhorias do Detector de Marcas d'Água

## Contexto

O projeto `watermaker-check` é uma ferramenta web estática de uso pessoal para detectar marcas d'água e elementos de segurança em imagens de documentos. Atualmente consiste em um único `index.html` com CSS e JavaScript embutidos, usando apenas filtros CSS para manipulação da imagem.

## Objetivo

Evoluir o projeto em quatro direções simultâneas:
- **A** — Novas funcionalidades (zoom, antes/depois, exportar)
- **B** — Análise avançada via Canvas API (histograma, Sobel, amplificação de diferenças)
- **C** — UI/UX melhorada (abas, layout mais claro)
- **D** — Qualidade de código (separar em módulos, remover código do HTML)

## Abordagem

Refatoração modular: extrair CSS e JavaScript do `index.html` para arquivos próprios, e reorganizar a lógica em módulos com responsabilidades bem definidas. A análise Canvas complementa os filtros CSS existentes — ambos ficam disponíveis em abas separadas.

---

## Arquitetura

### Estrutura de Arquivos

```
watermaker-check/
├── index.html          — HTML estrutural apenas (sem CSS inline, sem JS)
├── css/
│   └── styles.css      — todos os estilos (extraídos do index.html atual)
├── js/
│   ├── main.js         — inicialização, coordena os demais módulos
│   ├── filters.js      — filtros CSS: sliders, presets, reset
│   ├── canvas.js       — análise de pixels: histograma, Sobel, amplificação
│   └── ui.js           — tabs, drag-and-drop, eventos, painel de info
└── example.png         — imagem de exemplo (mantida)
```

### Responsabilidades dos Módulos

| Módulo | Responsabilidade |
|--------|-----------------|
| `main.js` | Inicializa os módulos, expõe a imagem carregada como estado global |
| `filters.js` | Lê os sliders, compõe a string `filter:` CSS, aplica em `img.style.filter` |
| `canvas.js` | Copia a imagem para um `<canvas>` oculto, processa `ImageData`, exibe resultado |
| `ui.js` | Gerencia tabs, upload/drag-drop, atualiza o painel de análise |

Os módulos se comunicam via um objeto de estado simples em `main.js` — sem framework, sem eventos customizados complexos.

---

## Interface

### Layout

- **Header**: igual ao atual
- **Área principal**: grid com duas colunas
  - Coluna esquerda (flex: 2): área da imagem com zoom habilitado
  - Coluna direita (flex: 1): painel com três abas
- **Painel inferior**: histograma RGB + informações de análise (técnica ativa, nível, recomendação)

### Abas do Painel Direito

**Aba 🎚 Filtros CSS** (padrão)
- Sliders: brilho, contraste, saturação, matiz, inversão, desfoque
- 6 presets predefinidos: UV, Infravermelho, Marca d'Água, Segurança, Bordas, Negativo
- Botão "Restaurar Original"

**Aba 🔬 Análise Canvas**
- Botão **Histograma RGB**: desenha gráfico de barras R/G/B em canvas separado abaixo da imagem
- Botão **Bordas (Sobel)**: aplica operador Sobel via `getImageData` e exibe resultado em canvas sobreposto
- Botão **Amplificar Diferenças**: amplifica variações sutis entre pixels vizinhos em canvas sobreposto
- Botão "Limpar Canvas": remove qualquer canvas de resultado ativo

**Aba 🛠 Ferramentas**
- **Zoom**: scroll do mouse ou pinch amplia/reduz a imagem (min 50%, max 400%)
- **Antes / Depois**: ativa um divisor arrastável sobreposto à imagem — lado esquerdo mostra o original, lado direito mostra com filtros CSS
- **Exportar PNG**: mescla `img` (com filtros CSS) + canvas ativo → `canvas.toDataURL()` → link de download

---

## Fluxo de Dados

```
Upload / drag-and-drop
  → FileReader.readAsDataURL()
  → <img id="currentImage"> no DOM

Filtros CSS (filters.js):
  sliders → compõe string → img.style.filter (imediato, sem custo)

Análise Canvas (canvas.js):
  img → drawImage() em <canvas> oculto
      → getImageData() → Uint8ClampedArray de pixels
      → algoritmo (Sobel / histograma / amplificação)
      → putImageData() / drawRect() em canvas de resultado

Exportar:
  canvas temporário → ctx.filter = img.style.filter → drawImage(img)
  + se canvas de resultado ativo: drawImage(canvasResultado) por cima
  → toDataURL("image/png") → <a download>
  (ctx.filter é suportado em Chrome/Firefox/Edge modernos)
```

---

## Algoritmos Canvas

### Histograma RGB
- Lê todos os pixels via `getImageData`
- Conta frequência de valores 0–255 para canais R, G, B separadamente
- Desenha três séries de barras em um `<canvas>` de 256×100px abaixo da imagem

### Detecção de Bordas (Sobel)
- Converte para escala de cinza
- Aplica kernels Sobel Gx e Gy em cada pixel (vizinhança 3×3)
- Magnitude = √(Gx² + Gy²), normalizada para 0–255
- Resultado exibido em canvas de mesmas dimensões que a imagem

### Amplificação de Diferenças
- Para cada pixel, calcula diferença absoluta em relação à média dos vizinhos (3×3)
- Multiplica por fator fixo de 5× (sem controle exposto — suficiente para revelar marcas sutis)
- Resultado exibido em canvas de mesmas dimensões que a imagem

---

## Tratamento de Erros

- Imagem de origem cruzada (cross-origin): canvas lança `SecurityError` — capturar e exibir mensagem "Análise Canvas não disponível para imagens externas"
- Imagem não carregada: botões Canvas e Ferramentas ficam desabilitados até que uma imagem esteja presente
- Arquivo não é imagem: validar `file.type.startsWith('image/')` no upload e ignorar silenciosamente

---

## O Que Não Muda

- Paleta de cores e visual geral (gradiente azul, glass morphism)
- Funcionalidade dos 6 presets existentes
- Deploy via GitHub Pages (push para `main`)
- Não há build step — os arquivos JS são carregados como módulos ES (`type="module"`)
