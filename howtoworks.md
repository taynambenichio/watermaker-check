--------------------------------------------------------------------------------------------------------------------------

Como Onfido / Jumio / iProov validam documentos com IA

1. Pipeline de análise de documento

 Imagem → Pré-processamento → Extração → Validação → Score de fraude

Pré-processamento

 - Detecção e recorte automático do documento (YOLO / Detectron2)
 - Correção de perspectiva (homografia)
 - Normalização de iluminação / remoção de reflexos

Extração de dados (OCR + NLP)

 - OCR especializado em documentos (Tesseract, AWS Textract, modelos próprios)
 - Leitura da MRZ (Machine Readable Zone) em passaportes/CNHs
 - Extração de nome, data de nascimento, número do documento

--------------------------------------------------------------------------------------------------------------------------

2. Detecção de fraude — camadas

┌─────────────────────────────┬─────────────────────────────────────────────────┬─────────────────────────────────────────┐
│ Camada                      │ Técnica                                         │ O que detecta                           │
├─────────────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────┤
│ Metadados                   │ EXIF, hash, compressão                          │ Screenshots, prints, EXIF editado       │
├─────────────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────┤
│ Análise de pixel            │ Análise de ruído, JPEG artifacts                │ Regiões clonadas, edições Photoshop     │
├─────────────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────┤
│ ELA (Error Level Analysis)  │ Diferença de compressão                         │ Colagem de regiões com compressão       │
│                             │                                                 │ diferente                               │
├─────────────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────┤
│ CNN de autenticidade        │ ResNet/EfficientNet treinado em docs            │ Fontes incorretas, layout alterado      │
│                             │ reais/falsos                                    │                                         │
├─────────────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────┤
│ OCR consistency             │ Cross-check MRZ ↔ campos visuais**              │ Nome na MRZ ≠ nome impresso             │
├─────────────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────┤
│ Liveness detection          │ FaceNet + modelos 3D depth                      │ Foto de foto, máscara, deepfake         │
└─────────────────────────────┴─────────────────────────────────────────────────┴─────────────────────────────────────────┘

--------------------------------------------------------------------------------------------------------------------------

3. ELA — o mais relevante para o nosso projeto

 JPEG original → comprime com qualidade 95 → subtrai pixel a pixel → amplifica diferenças

Regiões editadas têm nível de erro diferente do restante — exatamente o que o amplifyDifferences do nosso canvas já faz! É
o mesmo princípio.

--------------------------------------------------------------------------------------------------------------------------

4. O que podemos adicionar ao projeto

A) ELA real (Error Level Analysis)

 // Recomprimir como JPEG q=95 via canvas.toDataURL
 // Subtrair da original pixel a pixel
 // Amplificar diferenças × 10
 // Regiões editadas ficam visíveis

B) Análise de ruído (Noise inconsistency)

 - Aplicar filtro passa-alta (Sobel/Laplacian) por região
 - Regiões com padrão de ruído diferente = possível edição

C) Análise de metadados EXIF

 - Ler EXIF com exifr (biblioteca JS)
 - Detectar: sem EXIF (screenshot), EXIF de software de edição, datas inconsistentes

D) Score visual de suspeita

 - Combinar ELA + noise + Sobel num score 0–100%
 - Heatmap colorido sobre as regiões suspeitas

--------------------------------------------------------------------------------------------------------------------------

Sugestão de roadmap para o projeto

 Fase atual:  Filtros CSS + Sobel + Histograma
 Fase 2:      ELA real + análise de ruído por região
 Fase 3:      Leitura de metadados EXIF
 Fase 4:      Score de autenticidade + relatório