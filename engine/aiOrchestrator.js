const Groq = require("groq-sdk");

async function askAI(prompt, stateContext) {
  let groqRes = null;
  const apiKey = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY;
  const modelName = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  
  const systemPrompt = `Você é o Mestre Narrador de um RPG de horror e investigação sobrenatural, sombrio, misterioso e imersivo.
Seu objetivo é narrar as consequências das ações do(s) jogador(es) com detalhes atmosféricos, mantendo o suspense e a coerência da cena.
Você recebe a ação do jogador e o estado atual completo (PV, PE, SAN, NEX, inventário, localização).
Sua resposta DEVE ser estritamente em formato JSON válido com TODOS os campos:
{
  "narration": "Narração rica e atmosférica do resultado da ação. Descreva o ambiente, tensão e as consequências imediatas.",
  "bgm_mood": "calmo",
  "state_updates": {
    "pv_current": null,
    "pe_current": null,
    "san_current": null,
    "nex_increase": null,
    "location": null,
    "status_add": [],
    "status_remove": []
  },
  "inventory_updates": { "add": [], "remove": [] },
  "contextual_suggestions": [
    "Sugestão contextual 1 (ex: ação de investigação ou perícia no ambiente atual)",
    "Sugestão contextual 2 (ex: interação tática ou ambiental condizente)",
    "Sugestão contextual 3 (ex: ação defensiva, ofensiva ou cautelosa)"
  ],
  "pending_dice": { "required": false, "attribute": "intelecto", "cd": 15, "reason": "" }
}
REGRAS OBRIGATÓRIAS:
1. Em TODAS as respostas forneça 3 ou 4 "contextual_suggestions" coerentes com o local e a cena atual, sem spoilers.
2. IMPACTO REAL DOS ATRIBUTOS: Exija rolagens (pending_dice.required = true) considerando os atributos do agente:
   - FORÇA (FOR): Arrombar portas, levantar escombros pesados, agarrar ou empurrar inimigos, impacto físico.
   - AGILIDADE (AGI): Esquivar de golpes, correr em perseguição, equilibrar-se em beirais, ações furtivas.
   - VIGOR (VIG): Resistir a venenos/fadiga física, tolerar dor e ferimentos, testes de sobrevivência.
   - INTELECTO (INT): Investigar pistas forenses, decifrar documentos/códigos, analisar rituais e mecanismos.
   - PRESENÇA (PRE): Resistir ao medo do Outro Lado (Vontade/Sanidade), liderança tática, interrogar testemunhas.
3. DANO DE SANIDADE É RARO E EXCLUSIVO DE HORROR EXTREMO: NUNCA reduza Sanidade (san_current) por investigar ambientes escuros, encontrar pistas macabras, ler livros ou ouvir ruídos. Dano de Sanidade é reservado EXCLUSIVAMENTE para choques psicológicos brutais:
   - Presenciar assassinatos de culto ou sacrifícios humanos ocorrendo na frente dos agentes (-2 a -4 SAN).
   - Ataque mental direto de uma entidade ou revelação de sua forma alienígena total (-3 a -6 SAN).
   - Desastres em testes de Vontade contra o Outro Lado (-2 a -4 SAN).
   - Em investigações e ações normais, DEIXE san_current como null.
4. DANO FÍSICO REALISTA: Aplique redução em pv_current quando o personagem for atingido em combate, cair em armadilha ou sofrer dano físico direto (-3 a -8 PV).
5. Se o personagem usar habilidade com custo de PE informado no contexto, reduza pe_current.
6. Se o personagem se curar ou receber auxílio psicológico/físico, aumente os valores correspondentes (nunca ultrapassar o máximo).
7. PROGRESSÃO DE NEX (Exposição Paranormal): O NEX mede a contaminação e exposição ao Outro Lado. Retorne um número inteiro positivo em "nex_increase" de acordo com o impacto sobrenatural da cena:
   - +1 a +2: Pistas ocultas, símbolos de sangue, vislumbres de anomalias, ambiente macabro leve.
   - +3 a +5: Assassinatos ritualísticos, sacrifícios profanos testemunhados, rituais em execução, visões tenebrosas, perda de Sanidade em choque extremo.
   - +5 a +10: Combate direto e derrota de criaturas/monstros do Outro Lado, quebra da membrana, manifestação de entidades completas ou clímax.
   - null: Ações mundanas ou sem novo contato paranormal.
8. NAVEGAÇÃO & MISTÉRIO CENTRAL: Narre a cena respeitando o local atual do mapa e as pistas encontradas. Documentos, chaves e revelações devem sempre convergir para desvendar o segredo da anomalia e preparar o confronto final com o Boss da história.
9. TRILHA SONORA DINÂMICA (bgm_mood): Defina o clima sonoro da cena entre:
   - "calmo": Diálogos, investigações rotineiras, calmaria ou exploração silenciosa.
   - "tenso": Sinais do Outro Lado, rituais macabros, ameaça oculta à espreita, medo iminente.
   - "batalha": Confronto tático armado ou corporal contra cultistas, criaturas e aberrações.
   - "perseguicao": Fuga desesperada, perseguição em alta velocidade, fuga de perigo mortal.
   - "vitoria": Banimento de entidades, fechamento de portais, triunfo dos agentes.
   - "derrota": Morte de personagens, colapso de insanidade, fracasso trágico.
10. SEMPRE preencha state_updates com os NOVOS VALORES ABSOLUTOS de PV/PE/SAN (use null para o que não mudar).
11. Não inclua Markdown ao redor do JSON, apenas o objeto JSON puro.`;


  const userMessage = `ESTADO ATUAL DO PERSONAGEM:
${JSON.stringify(stateContext, null, 2)}

AÇÃO DO JOGADOR: ${prompt}

IMPORTANTE: Responda apenas com JSON puro. Use os valores atuais de PV/PE/SAN/NEX acima como base para calcular state_updates.`;

  // Tenta GROQ primeiro
  if (apiKey && apiKey !== "gsk_placeholder_aqui_precisa_substituir") {
    try {
      const groq = new Groq({ apiKey });
      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        model: modelName,
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
      groqRes = completion.choices[0]?.message?.content;
    } catch (e) {
      console.warn(`[aiOrchestrator] Falha no modelo Groq (${modelName}), tentando modelo de fallback...`, e.message);
      try {
        const groq = new Groq({ apiKey });
        const completion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          model: "llama-3.1-8b-instant",
          temperature: 0.3,
          response_format: { type: "json_object" }
        });
        groqRes = completion.choices[0]?.message?.content;
      } catch (err2) {
        console.warn("[aiOrchestrator] Falha no Groq fallback, tentando Ollama...", err2.message);
      }
    }
  }

  // Fallback para Ollama
  if (!groqRes) {
    try {
      const fetchFn = typeof globalThis.fetch === "function" ? globalThis.fetch : null;
      if (!fetchFn) throw new Error("Fetch não disponível neste ambiente");
      const r = await fetchFn("http://127.0.0.1:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3", // Ou mistral
          system: systemPrompt,
          prompt: userMessage,
          stream: false,
          format: "json"
        })
      });
      if (r.ok) {
        const data = await r.json();
        groqRes = data.response;
      } else {
        throw new Error("Ollama retornou erro: " + r.status);
      }
    } catch (e) {
      console.warn("[aiOrchestrator] Falha no Ollama:", e.message);
      // Fallback final genérico determinístico se ambas falharem
      return generateFallback(prompt);
    }
  }

  try {
    return JSON.parse(groqRes);
  } catch (e) {
    console.error("[aiOrchestrator] Falha ao fazer parse do JSON da IA:", groqRes);
    return generateFallback(prompt);
  }
}

function generateFallback(action) {
  return {
    narration: "A entidade não responde. A ação acontece, mas as consequências são imprevisíveis. Você deve prosseguir.",
    bgm_mood: "calmo",
    state_updates: { pv_current: null, pe_current: null, san_current: null, nex_increase: null, location: null, status_add: [], status_remove: [] },
    inventory_updates: { add: [], remove: [] },
    contextual_suggestions: ["Observar novamente", "Fugir", "Se preparar"],
    pending_dice: { required: true, attribute: "agilidade", cd: 10, reason: "Teste instintivo devido à anomalia." }
  };
}



module.exports = { askAI };
