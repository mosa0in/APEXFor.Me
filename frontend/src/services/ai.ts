import type { Question } from '../data/questions';

const MODEL = 'claude-sonnet-4-6';
const BACKEND_API = import.meta.env.VITE_API_URL ?? '';

function getApiKey(): string | null {
  const key = (import.meta as any).env?.VITE_ANTHROPIC_API_KEY;
  if (!key || key === 'YOUR_API_KEY') return null;
  return key;
}

const STATIC_PROMPT = `أنت كوتش رياضيات ذكي ولطيف اسمك "APEX Coach". تتحدث بالعربية بأسلوب مشجع وبسيط.
قواعد مهمة:
- اشرح بأسلوب مبسط مناسب لطالب مبتدئ
- استخدم أمثلة من الحياة اليومية
- لا تعطِ الإجابة مباشرة إلا إذا طُلب منك
- شجع الطالب واستخدم تعبيرات محفزة
- اجعل ردك مختصراً (3-5 جمل)
- استخدم إيموجي باعتدال`;

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
          max_tokens: 300,
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

export async function aiRephraseQuestion(question: Question): Promise<{ text: string; isAI: boolean }> {
  const styles = [
    'استخدم كلمات بسيطة جداً وأمثلة من الحياة اليومية',
    'اشرحه كأنك تتحدث لطفل عمره 10 سنوات',
    'حوّله لقصة قصيرة أو موقف عملي',
    'استخدم أسلوب "تخيّل أنك..." لجعله ملموساً',
    'اعد صياغته بطريقة مختلفة تماماً مع الحفاظ على المعنى',
    'بسّطه واستخدم أرقام وكلمات واضحة بدون رموز رياضية',
  ];
  const style = styles[Math.floor(Math.random() * styles.length)];

  const result = await callAI(
    `أعد صياغة هذا السؤال الرياضي بطريقة مختلفة وأبسط. اكتب السؤال فقط بدون شرح إضافي.
الأسلوب المطلوب: ${style}

السؤال الأصلي: ${question.text}

الصياغة الجديدة:`
  );

  if (result) return { text: result, isAI: true };
  return { text: question.rephrasedText, isAI: false };
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

export function isAIAvailable(): boolean {
  return getApiKey() !== null;
}
