import type { Question } from '../data/questions';

const MODEL = 'claude-sonnet-4-6';
const BACKEND_API = import.meta.env.VITE_API_URL ?? '';

function getApiKey(): string | null {
  const key = (import.meta as any).env?.VITE_ANTHROPIC_API_KEY;
  if (!key || key === 'YOUR_API_KEY') return null;
  return key;
}

const STATIC_PROMPT = `أنت كوتش رياضيات ذكي ولطيف اسمك "APEX Coach". تتحدث بالعربية بأسلوب مشجع وبسيط — مثل صديق يشرح عبر رسائل.

قواعد الرد:
- أعطِ ردك كـ JSON array من 3 إلى 5 رسائل قصيرة متسلسلة
- كل رسالة = جملة أو جملتان فقط (مثل رسائل واتساب)
- الرسالة الأولى دائماً تعاطفية أو محفّزة
- لا تعطِ الإجابة مباشرة إلا إذا طُلب
- استخدم إيموجي باعتدال (1 لكل رسالتين)

قواعد التنسيق داخل كل رسالة:
- **نص عريض** للتأكيد
- للمعادلات المضمّنة: $f(x) = 2x + 3$
- للمعادلات في سطر منفصل: $$f(4) = 11$$
- لا تخلط المعادلات مع النص العربي في نفس السطر

أعد فقط JSON array صالح، بدون أي نص إضافي:
["رسالة 1", "رسالة 2", "رسالة 3"]`;

// Cache for MCP prompt (refreshes every 5 minutes)
let _cachedMCPPrompt: string | null = null;
let _cacheTimestamp = 0;

async function getSystemPrompt(): Promise<string> {
  const now = Date.now();
  if (_cachedMCPPrompt && (now - _cacheTimestamp) < 300_000) {
    return _cachedMCPPrompt;
  }
  
  const studentId = localStorage.getItem('apex_current_student') || '';
  if (!studentId) return STATIC_PROMPT;

  try {
    const res = await fetch(`${BACKEND_API}/api/mcp/coach-prompt/${studentId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.system_prompt) {
        _cachedMCPPrompt = data.system_prompt;
        _cacheTimestamp = now;
        console.log('[APEX AI] 🧠 Using MCP coach prompt with student context');
        return data.system_prompt;
      }
    }
  } catch {
    console.warn('[APEX AI] MCP prompt unavailable, using static prompt');
  }
  return STATIC_PROMPT;
}

async function callAI(userMessage: string, retries = 1): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const systemPrompt = await getSystemPrompt();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 700,
          temperature: 0.9,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });

      if (res.status === 429) {
        console.warn(`[APEX AI] ⏳ Rate limited, attempt ${attempt + 1}`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        return null;
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[APEX AI] ❌ API error ${res.status}:`, errText);
        return null;
      }

      const data = await res.json();
      const text = data?.content?.[0]?.text ?? '';
      console.log('[APEX AI] ✅ Response:', text.substring(0, 80) + '...');
      return text.trim() || null;
    } catch (e) {
      console.error(`[APEX AI] ❌ Fetch error (attempt ${attempt + 1}):`, e);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      return null;
    }
  }
  return null;
}

export async function getCoachExplanation(
  question: Question,
  helpType: string
): Promise<string> {
  const helpContext: Record<string, string> = {
    start: 'الطالب لا يعرف من أين يبدأ الحل. أعطه خطوة أولى واضحة بدون إعطاء الحل.',
    concept: 'الطالب لا يفهم المفهوم. اشرح المفهوم الأساسي بطريقة بسيطة مع مثال.',
    difficulty: 'الطالب يجد السؤال صعباً. بسّط الفكرة وقسّم المسألة لخطوات صغيرة.',
    methods: 'الطالب يريد طرق تعلم مختلفة. اقترح طريقة بصرية أو عملية لفهم المفهوم.',
  };

  const prompt = `السؤال الحالي: ${question.text}
المفهوم: ${question.concept}
مستوى الصعوبة: ${question.difficulty}/5

نوع المساعدة المطلوبة: ${helpContext[helpType] || helpContext.start}

أعط شرحاً مفيداً ومختصراً:`;

  const result = await callAI(prompt);
  return result || getFallbackExplanation(question, helpType);
}

function parseMessagesJSON(raw: string): string[] | null {
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const arr = JSON.parse(match[0]);
    if (Array.isArray(arr) && arr.every(m => typeof m === 'string') && arr.length > 0) {
      return arr.map(s => s.trim()).filter(Boolean);
    }
  } catch {}
  return null;
}

export async function getCoachMessages(
  question: Question,
  helpType: string
): Promise<string[]> {
  const helpContext: Record<string, string> = {
    start: 'الطالب لا يعرف من أين يبدأ الحل. ساعده يبدأ بدون إعطاء الحل مباشرة.',
    concept: 'الطالب لا يفهم المفهوم. اشرح المفهوم بطريقة بسيطة مع مثال.',
    difficulty: 'الطالب يجد السؤال صعباً. بسّط الفكرة وقسّمها لأجزاء صغيرة.',
    methods: 'الطالب يريد طرق تعلم مختلفة. اقترح طريقة بصرية أو عملية.',
  };

  const prompt = `السؤال: ${question.text}
المفهوم: ${question.concept}
الصعوبة: ${question.difficulty}/5
المساعدة المطلوبة: ${helpContext[helpType] || helpContext.start}

أرسل ردك كـ JSON array من 3-5 رسائل قصيرة متسلسلة:`;

  const raw = await callAI(prompt);
  if (raw) {
    const msgs = parseMessagesJSON(raw);
    if (msgs) return msgs;
    // fallback: treat as single message
    return [raw];
  }
  return [getFallbackExplanation(question, helpType)];
}

export async function getCoachReply(
  userMessage: string,
  question: Question,
): Promise<string[]> {
  const prompt = `السياق: الطالب يحل سؤالاً رياضياً.
السؤال: ${question.text}
المفهوم: ${question.concept}

رسالة الطالب: "${userMessage}"

أجب بـ JSON array من 2-4 رسائل قصيرة متسلسلة كصديق مشجع. لا تعطِ الإجابة مباشرة:`;

  const raw = await callAI(prompt);
  if (raw) {
    const msgs = parseMessagesJSON(raw);
    if (msgs) return msgs;
    return [raw];
  }
  return ['فهمت! خلينا نفكر سوا 💭'];
}

const REPHRASE_CONFIGS = [
  {
    styleLabel: 'أكاديمي',
    questionInstruction: 'أعد صياغة هذا السؤال بأسلوب أكاديمي رسمي بنفس لغة السؤال الأصلي. حافظ على المصطلحات العلمية ومستوى التعقيد.',
    hintInstruction: 'اكتب تلميحاً أكاديمياً منهجياً يوجّه الطالب بخطوات واضحة.',
  },
  {
    styleLabel: 'شبابي علمي',
    questionInstruction: 'أعد صياغة هذا السؤال بأسلوب شبابي لطيف مع الحفاظ على الدقة العلمية — مثل صديق يشرح لصديقه. استخدم كلمات مألوفة وقريبة.',
    hintInstruction: 'اكتب تلميحاً بأسلوب ودّي ومحفّز.',
  },
  {
    styleLabel: 'مبسّط جداً',
    questionInstruction: 'أعد صياغة هذا السؤال بأبسط طريقة ممكنة مع مثال من الحياة اليومية. تجنب المصطلحات المعقدة. اجعله واضحاً لأي شخص.',
    hintInstruction: 'اكتب تلميحاً بسيطاً جداً مع مثال من الحياة اليومية.',
  },
];

export async function aiRephraseQuestion(
  question: Question,
  attemptNumber = 1
): Promise<{ text: string; hint: string; styleLabel: string; isAI: boolean }> {
  const config = REPHRASE_CONFIGS[Math.min(attemptNumber - 1, 2)];

  const result = await callAI(
    `${config.questionInstruction}

السؤال الأصلي: "${question.text}"
التلميح الأصلي: "${question.hint?.text || ''}"

القواعد: لا تغير الأرقام أو قيم الإجابات، فقط أسلوب الصياغة.

اكتب:
[نص السؤال الجديد فقط]
HINT: [${config.hintInstruction}]`
  );

  if (result) {
    const hintMatch = result.match(/HINT:\s*([\s\S]+)$/m);
    const questionText = result.replace(/HINT:[\s\S]*$/m, '').trim();
    const hint = hintMatch ? hintMatch[1].trim() : (question.hint?.text || '');
    if (questionText) return { text: questionText, hint, styleLabel: config.styleLabel, isAI: true };
  }

  return {
    text: question.rephrasedText || question.text,
    hint: question.hint?.text || '',
    styleLabel: config.styleLabel,
    isAI: false,
  };
}

export async function aiBrainstormFeedback(
  question: Question,
  ideas: string[]
): Promise<string> {
  const result = await callAI(
    `السؤال: ${question.text}
أفكار الطالب حتى الآن:
${ideas.map((idea, i) => `${i + 1}. ${idea}`).join('\n')}

علّق على أفكار الطالب بإيجابية وأرشده للخطوة التالية بدون إعطاء الحل. جملتين أو ثلاث كحد أقصى:`
  );
  return result || 'أفكار جيدة! حاول ربطها معاً للوصول للحل. 💡';
}

export async function aiExplainSolution(question: Question): Promise<string> {
  const result = await callAI(
    `السؤال: ${question.text}
الإجابة الصحيحة: ${question.options[question.correctIndex].content}

اشرح الحل بطريقة ممتعة وبسيطة مع ربطه بمثال من الحياة اليومية. 3-4 جمل:`
  );
  return result || question.solution.tip;
}

function getFallbackExplanation(question: Question, helpType: string): string {
  switch (helpType) {
    case 'start':
      return `🎯 لنبدأ خطوة بخطوة!\n\n${question.hint.text}\n\nجرّب تطبيق هذه الخطوة الأولى وشوف وين توصلك!`;
    case 'concept':
      return `📚 المفهوم هنا هو "${question.concept}".\n\n${question.solution.tip}\n\nفكّر فيها كأنها لعبة توازن ⚖️`;
    case 'difficulty':
      return `💪 لا تقلق، خلنا نبسطها!\n\n${question.hint.text}\n\nلو حسيت إنها صعبة، جرّب "مثال أبسط" من الاستراتيجيات.`;
    case 'methods':
      return `🧩 جرّب هالطريقة:\n\n1. اقرأ السؤال مرتين\n2. حدد المعطيات\n3. ${question.hint.text}\n\nأو جرّب الأحجية التفاعلية لفهم المفهوم!`;
    default:
      return question.hint.text;
  }
}

/** Returns true if the text is predominantly English (>55% ASCII letters). */
export function isEnglishText(text: string): boolean {
  const letters = text.replace(/\s|\d|[^\w؀-ۿ]/g, '');
  if (letters.length === 0) return false;
  const ascii = letters.replace(/[؀-ۿ]/g, '').length;
  return ascii / letters.length > 0.55;
}

// Plain-text API call — no JSON-array system prompt, no student context.
// Used for question explanation where we need a direct Arabic paragraph, not chat bubbles.
async function callAIPlain(userMessage: string, system: string): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        temperature: 0.5,
        system,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.content?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Generate a plain Arabic paraphrase of an English question.
 * No hints, no answers — just "what is this question asking?"
 */
export async function getArabicQuestionExplanation(question: Question): Promise<string> {
  const result = await callAIPlain(
    `السؤال التالي:\n"${question.text}"\n\nاشرح ما يطلبه هذا السؤال بالعربية البسيطة في 2-3 جمل. لا تذكر الإجابة أو الخيارات. فقط وضّح "ماذا يسأل؟" بأسلوب سهل.`,
    'أنت مساعد تعليمي. أجب بالعربية فقط في 2-3 جمل قصيرة، بدون تنسيق JSON أو ترقيم أو نقاط.'
  );
  return result || `هذا السؤال يختبر مفهوم "${question.concept}".`;
}

export function isAIAvailable(): boolean {
  return getApiKey() !== null;
}
