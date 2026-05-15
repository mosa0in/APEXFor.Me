export interface QuestionOption {
  label: string;
  content: string;
}

export interface SolutionStep {
  number: number;
  title: string;
  desc: string;
  math: string;
  result: string;
}

export type QuestionType = 'mcq' | 'true_false' | 'text_input' | 'image_upload';

export interface Question {
  id: number;
  text: string;
  questionType?: QuestionType;
  rephrasedText?: string;
  conceptId: string;
  concept: string;
  sectionType: 'prerequisite' | 'main';
  difficulty: number;
  options: QuestionOption[];
  correctIndex: number;
  correctAnswer?: string;
  hint?: { text: string; stepLabel: string; stepContent: string };
  solution?: { steps: SolutionStep[]; tip: string };
  simplerExample?: {
    original: string;
    simpler: string;
    result: string;
    explanation: string;
  };
  errorExample?: {
    studentName: string;
    steps: { step: string; desc: string }[];
    errorIndex: number;
    errorExplanation: string;
  };
}

export const questions: Question[] = [
  {
    id: 1,
    text: 'ما ناتج حل المعادلة 3x + 5 = 20 ؟',
    rephrasedText: 'إذا كان 3 أضعاف عدد مجهول مضافاً إليه 5 يساوي 20، فما هو العدد؟',
    conceptId: 'CON_ALG_001',
    concept: 'الجبر الأساسي',
    sectionType: 'prerequisite',
    difficulty: 2,
    options: [
      { label: 'أ', content: 'x = 5' },
      { label: 'ب', content: 'x = 15' },
      { label: 'ج', content: 'x = 25' },
      { label: 'د', content: 'x = 3' },
    ],
    correctIndex: 0,
    hint: {
      text: 'تذكر أن الهدف هو عزل المتغير x. ابدأ بطرح 5 من طرفي المعادلة.',
      stepLabel: 'الخطوة الأولى:',
      stepContent: '3x + 5 - 5 = 20 - 5',
    },
    solution: {
      steps: [
        { number: 1, title: 'عزل الحد المتغير', desc: 'نقوم بطرح 5 من طرفي المعادلة للتخلص من الثابت.', math: '3x + 5 - 5 = 20 - 5', result: '3x = 15' },
        { number: 2, title: 'إيجاد قيمة x', desc: 'نقسم طرفي المعادلة على 3.', math: '3x / 3 = 15 / 3', result: 'x = 5' },
      ],
      tip: 'ما تفعله في أحد طرفي المعادلة، يجب أن تفعله في الطرف الآخر.',
    },
    simplerExample: {
      original: '3x + 5 = 20',
      simpler: 'x + 2 = 5',
      result: 'x = 3',
      explanation: 'هل لاحظت كيف قمنا بالتخلص من (+2) بنقله للطرف الآخر مع عكس إشارته؟ نفس المبدأ ينطبق على معادلتك.',
    },
    errorExample: {
      studentName: 'أنس',
      steps: [
        { step: '3x + 5 = 20', desc: 'المعادلة الأصلية' },
        { step: '3x = 20 + 5', desc: 'نقل الـ 5 للطرف الآخر' },
        { step: '3x = 25', desc: 'جمع الطرف الأيمن' },
        { step: 'x = 25 / 3', desc: 'قسمة على المعامل' },
      ],
      errorIndex: 1,
      errorExplanation: 'الإشارة يجب أن تكون سالبة عند النقل: 3x = 20 - 5',
    },
  },
  {
    id: 2,
    text: 'ما ناتج حل المعادلة 2x - 8 = 12 ؟',
    rephrasedText: 'عدد مجهول ضُرب في 2 ثم طُرح منه 8 فكان الناتج 12. ما هو العدد؟',
    conceptId: 'CON_ALG_001',
    concept: 'الجبر الأساسي',
    sectionType: 'prerequisite',
    difficulty: 2,
    options: [
      { label: 'أ', content: 'x = 2' },
      { label: 'ب', content: 'x = 10' },
      { label: 'ج', content: 'x = 6' },
      { label: 'د', content: 'x = 4' },
    ],
    correctIndex: 1,
    hint: {
      text: 'ابدأ بإضافة 8 لطرفي المعادلة لعزل الحد الذي يحتوي على x.',
      stepLabel: 'الخطوة الأولى:',
      stepContent: '2x - 8 + 8 = 12 + 8',
    },
    solution: {
      steps: [
        { number: 1, title: 'إضافة 8 للطرفين', desc: 'نتخلص من الثابت -8 بإضافة 8.', math: '2x - 8 + 8 = 12 + 8', result: '2x = 20' },
        { number: 2, title: 'القسمة على 2', desc: 'نقسم الطرفين على معامل x.', math: '2x / 2 = 20 / 2', result: 'x = 10' },
      ],
      tip: 'العملية العكسية للطرح هي الجمع.',
    },
    simplerExample: {
      original: '2x - 8 = 12',
      simpler: 'x - 3 = 7',
      result: 'x = 10',
      explanation: 'أضفنا 3 للطرفين: x = 7 + 3 = 10. نفس الفكرة مع معادلتك!',
    },
    errorExample: {
      studentName: 'سارة',
      steps: [
        { step: '2x - 8 = 12', desc: 'المعادلة الأصلية' },
        { step: '2x = 12 - 8', desc: 'نقل الـ 8' },
        { step: '2x = 4', desc: 'طرح' },
        { step: 'x = 2', desc: 'قسمة على 2' },
      ],
      errorIndex: 1,
      errorExplanation: 'عند نقل -8 يجب عكس الإشارة: 2x = 12 + 8 = 20',
    },
  },
  {
    id: 3,
    text: 'ما ناتج العملية 2 + 3 × 4 ؟',
    rephrasedText: 'احسب ناتج: اثنين زائد ثلاثة مضروبة في أربعة (تذكر ترتيب العمليات)',
    conceptId: 'CON_OPS_001',
    concept: 'ترتيب العمليات',
    sectionType: 'prerequisite',
    difficulty: 1,
    options: [
      { label: 'أ', content: '20' },
      { label: 'ب', content: '14' },
      { label: 'ج', content: '24' },
      { label: 'د', content: '9' },
    ],
    correctIndex: 1,
    hint: {
      text: 'تذكر قاعدة PEMDAS: الضرب يُنفّذ قبل الجمع.',
      stepLabel: 'الخطوة الأولى:',
      stepContent: '2 + (3 × 4) = 2 + 12',
    },
    solution: {
      steps: [
        { number: 1, title: 'تنفيذ الضرب أولاً', desc: 'حسب ترتيب العمليات، الضرب قبل الجمع.', math: '3 × 4 = 12', result: '12' },
        { number: 2, title: 'تنفيذ الجمع', desc: 'نجمع النتيجة مع 2.', math: '2 + 12', result: '14' },
      ],
      tip: 'ترتيب العمليات: أقواس → أُسس → ضرب وقسمة → جمع وطرح.',
    },
    simplerExample: {
      original: '2 + 3 × 4',
      simpler: '1 + 2 × 3',
      result: '7',
      explanation: 'نحسب الضرب أولاً (2×3=6) ثم نجمع (1+6=7). لاحظ أنها ليست 9!',
    },
    errorExample: {
      studentName: 'خالد',
      steps: [
        { step: '2 + 3 × 4', desc: 'العملية الأصلية' },
        { step: '5 × 4', desc: 'جمعت 2+3 أولاً' },
        { step: '20', desc: 'النتيجة النهائية' },
      ],
      errorIndex: 1,
      errorExplanation: 'الضرب يُنفّذ قبل الجمع. الصحيح: 2 + 12 = 14',
    },
  },
  {
    id: 4,
    text: 'ما مساحة مستطيل طوله 8 سم وعرضه 5 سم ؟',
    rephrasedText: 'لديك مستطيل أبعاده 8 سم × 5 سم. كم تبلغ مساحته؟',
    conceptId: 'CON_GEO_001',
    concept: 'الهندسة - المساحة',
    sectionType: 'prerequisite',
    difficulty: 1,
    options: [
      { label: 'أ', content: '26 سم²' },
      { label: 'ب', content: '40 سم²' },
      { label: 'ج', content: '13 سم²' },
      { label: 'د', content: '45 سم²' },
    ],
    correctIndex: 1,
    hint: {
      text: 'مساحة المستطيل = الطول × العرض.',
      stepLabel: 'تطبيق القانون:',
      stepContent: 'المساحة = 8 × 5',
    },
    solution: {
      steps: [
        { number: 1, title: 'تطبيق قانون المساحة', desc: 'مساحة المستطيل = الطول × العرض.', math: '8 × 5', result: '40 سم²' },
      ],
      tip: 'لا تخلط بين المساحة (ضرب) والمحيط (جمع الأضلاع).',
    },
    simplerExample: {
      original: '8 × 5',
      simpler: '3 × 2',
      result: '6 سم²',
      explanation: 'مستطيل 3×2: مساحته = 6. نفس الطريقة مع 8×5!',
    },
    errorExample: {
      studentName: 'نورة',
      steps: [
        { step: 'الطول = 8، العرض = 5', desc: 'المعطيات' },
        { step: '2 × (8 + 5)', desc: 'حسبت المحيط بدل المساحة' },
        { step: '2 × 13 = 26', desc: 'النتيجة' },
      ],
      errorIndex: 1,
      errorExplanation: 'هذا المحيط وليس المساحة! المساحة = الطول × العرض = 40',
    },
  },
  {
    id: 5,
    text: 'ما الكسر المكافئ لـ 4/8 ؟',
    rephrasedText: 'الكسر 4 على 8... ما أبسط صورة له؟',
    conceptId: 'CON_FRC_001',
    concept: 'الكسور',
    sectionType: 'prerequisite',
    difficulty: 1,
    options: [
      { label: 'أ', content: '2/4' },
      { label: 'ب', content: '1/2' },
      { label: 'ج', content: '1/4' },
      { label: 'د', content: '2/3' },
    ],
    correctIndex: 1,
    hint: {
      text: 'حاول قسمة البسط والمقام على نفس الرقم.',
      stepLabel: 'الخطوة الأولى:',
      stepContent: '4 ÷ 4 / 8 ÷ 4',
    },
    solution: {
      steps: [
        { number: 1, title: 'إيجاد القاسم المشترك', desc: 'القاسم المشترك الأكبر لـ 4 و 8 هو 4.', math: 'ق.م.أ(4, 8) = 4', result: '4' },
        { number: 2, title: 'التبسيط', desc: 'نقسم البسط والمقام على 4.', math: '4÷4 / 8÷4', result: '1/2' },
      ],
      tip: 'الكسر المكافئ هو كسر له نفس القيمة بأبسط صورة.',
    },
    simplerExample: {
      original: '4/8',
      simpler: '2/4',
      result: '1/2',
      explanation: '2÷2 = 1 و 4÷2 = 2، إذن 2/4 = 1/2. نفس الطريقة مع 4/8!',
    },
    errorExample: {
      studentName: 'يوسف',
      steps: [
        { step: '4/8', desc: 'الكسر الأصلي' },
        { step: '4-2 / 8-2', desc: 'طرحت 2 من البسط والمقام' },
        { step: '2/6 = 1/3', desc: 'النتيجة' },
      ],
      errorIndex: 1,
      errorExplanation: 'نقسم (لا نطرح!) البسط والمقام على نفس العدد: 4÷4 / 8÷4 = 1/2',
    },
  },
  {
    id: 6,
    text: 'ما قيمة 25% من العدد 80 ؟',
    rephrasedText: 'لو عندك 80 تفاحة وأخذت ربعها (25%)، كم تفاحة أخذت؟',
    conceptId: 'CON_PCT_001',
    concept: 'النسبة المئوية',
    sectionType: 'prerequisite',
    difficulty: 2,
    options: [
      { label: 'أ', content: '25' },
      { label: 'ب', content: '20' },
      { label: 'ج', content: '15' },
      { label: 'د', content: '40' },
    ],
    correctIndex: 1,
    hint: {
      text: '25% تعني 25 من كل 100. يمكنك الضرب: 80 × 0.25',
      stepLabel: 'التحويل:',
      stepContent: '25% = 25/100 = 0.25',
    },
    solution: {
      steps: [
        { number: 1, title: 'تحويل النسبة لكسر', desc: 'نحوّل 25% إلى كسر عشري.', math: '25% = 0.25', result: '0.25' },
        { number: 2, title: 'الضرب', desc: 'نضرب العدد في الكسر.', math: '80 × 0.25', result: '20' },
      ],
      tip: '25% = ربع العدد. يمكنك ببساطة قسمة 80 ÷ 4 = 20.',
    },
    simplerExample: {
      original: '25% × 80',
      simpler: '50% × 10',
      result: '5',
      explanation: '50% = نصف العدد. نصف 10 = 5. بنفس المنطق: 25% = ربع العدد.',
    },
    errorExample: {
      studentName: 'ليلى',
      steps: [
        { step: '25% من 80', desc: 'المطلوب' },
        { step: '80 ÷ 25', desc: 'قسمت على 25 مباشرة' },
        { step: '= 3.2', desc: 'النتيجة' },
      ],
      errorIndex: 1,
      errorExplanation: 'يجب ضرب 80 × 0.25 أو قسمة 80 ÷ 4 = 20',
    },
  },
  {
    id: 7,
    text: 'ما ناتج -3 + 7 ؟',
    rephrasedText: 'إذا كانت درجة الحرارة -3 وارتفعت 7 درجات، كم تصبح؟',
    conceptId: 'CON_INT_001',
    concept: 'الأعداد الصحيحة',
    sectionType: 'prerequisite',
    difficulty: 1,
    options: [
      { label: 'أ', content: '-10' },
      { label: 'ب', content: '10' },
      { label: 'ج', content: '4' },
      { label: 'د', content: '-4' },
    ],
    correctIndex: 2,
    hint: {
      text: 'عند جمع عدد سالب مع موجب، اطرح الأصغر من الأكبر وخذ إشارة الأكبر.',
      stepLabel: 'التفكير:',
      stepContent: '7 - 3 = 4 (الإشارة موجبة لأن 7 > 3)',
    },
    solution: {
      steps: [
        { number: 1, title: 'تحديد العملية', desc: 'جمع عددين بإشارات مختلفة = طرح القيم المطلقة.', math: '|7| - |-3| = 7 - 3', result: '4' },
        { number: 2, title: 'تحديد الإشارة', desc: 'الإشارة تتبع العدد الأكبر مطلقاً (7 موجب).', math: '-3 + 7', result: '+4' },
      ],
      tip: 'تخيل خط الأعداد: ابدأ من -3 وتقدم 7 خطوات لليمين.',
    },
    simplerExample: {
      original: '-3 + 7',
      simpler: '-1 + 3',
      result: '2',
      explanation: 'ابدأ من -1 وتقدم 3 خطوات: -1 → 0 → 1 → 2. نفس الفكرة!',
    },
    errorExample: {
      studentName: 'محمد',
      steps: [
        { step: '-3 + 7', desc: 'العملية' },
        { step: '-(3 + 7)', desc: 'جمعت الأرقام وأخذت السالب' },
        { step: '-10', desc: 'النتيجة' },
      ],
      errorIndex: 1,
      errorExplanation: 'الإشارات مختلفة فنطرح لا نجمع: 7 - 3 = 4 (موجب)',
    },
  },
  {
    id: 8,
    text: 'محيط مربع طول ضلعه 7 سم يساوي:',
    rephrasedText: 'مربع كل أضلاعه 7 سم. ما مجموع أطوال أضلاعه الأربعة؟',
    conceptId: 'CON_GEO_002',
    concept: 'الهندسة - المحيط',
    sectionType: 'prerequisite',
    difficulty: 1,
    options: [
      { label: 'أ', content: '49 سم' },
      { label: 'ب', content: '14 سم' },
      { label: 'ج', content: '28 سم' },
      { label: 'د', content: '21 سم' },
    ],
    correctIndex: 2,
    hint: {
      text: 'المربع له 4 أضلاع متساوية. المحيط = 4 × طول الضلع.',
      stepLabel: 'القانون:',
      stepContent: 'المحيط = 4 × 7',
    },
    solution: {
      steps: [
        { number: 1, title: 'تطبيق قانون المحيط', desc: 'محيط المربع = 4 × طول الضلع.', math: '4 × 7', result: '28 سم' },
      ],
      tip: 'لا تخلط بين المحيط (4 × ضلع) والمساحة (ضلع × ضلع).',
    },
    simplerExample: {
      original: '4 × 7',
      simpler: '4 × 3',
      result: '12 سم',
      explanation: 'مربع ضلعه 3: محيطه = 3+3+3+3 = 12. نفس الطريقة مع 7!',
    },
    errorExample: {
      studentName: 'أحمد',
      steps: [
        { step: 'طول الضلع = 7', desc: 'المعطيات' },
        { step: '7 × 7', desc: 'ضربت الضلع في نفسه' },
        { step: '49 سم', desc: 'النتيجة' },
      ],
      errorIndex: 1,
      errorExplanation: 'هذه المساحة لا المحيط! المحيط = 4 × 7 = 28 سم',
    },
  },
  {
    id: 9,
    text: 'إذا كانت x/4 = 3 فما قيمة x ؟',
    rephrasedText: 'عدد مجهول قسمته على 4 فحصلت على 3. ما هو العدد؟',
    conceptId: 'CON_ALG_001',
    concept: 'الجبر الأساسي',
    sectionType: 'prerequisite',
    difficulty: 2,
    options: [
      { label: 'أ', content: 'x = 7' },
      { label: 'ب', content: 'x = 1' },
      { label: 'ج', content: 'x = 12' },
      { label: 'د', content: 'x = 4/3' },
    ],
    correctIndex: 2,
    hint: {
      text: 'العملية العكسية للقسمة هي الضرب. اضرب طرفي المعادلة في 4.',
      stepLabel: 'الخطوة:',
      stepContent: 'x/4 × 4 = 3 × 4',
    },
    solution: {
      steps: [
        { number: 1, title: 'ضرب الطرفين في 4', desc: 'نتخلص من المقام بالضرب.', math: '(x/4) × 4 = 3 × 4', result: 'x = 12' },
      ],
      tip: 'للتحقق: 12 ÷ 4 = 3 ✓',
    },
    simplerExample: {
      original: 'x/4 = 3',
      simpler: 'x/2 = 5',
      result: 'x = 10',
      explanation: 'نضرب الطرفين في 2: x = 5 × 2 = 10. نفس الفكرة مع القسمة على 4!',
    },
    errorExample: {
      studentName: 'فاطمة',
      steps: [
        { step: 'x/4 = 3', desc: 'المعادلة' },
        { step: 'x = 3 + 4', desc: 'جمعت بدل الضرب' },
        { step: 'x = 7', desc: 'النتيجة' },
      ],
      errorIndex: 1,
      errorExplanation: 'العكسية للقسمة هي الضرب لا الجمع: x = 3 × 4 = 12',
    },
  },
  {
    id: 10,
    text: 'سيارة تسير بسرعة 60 كم/ساعة لمدة ساعتين. ما المسافة المقطوعة؟',
    rephrasedText: 'لو مشيت بسيارتك بسرعة 60 كيلومتر في الساعة لمدة ساعتين، كم كيلومتر قطعت؟',
    conceptId: 'CON_SPD_001',
    concept: 'السرعة والمسافة',
    sectionType: 'prerequisite',
    difficulty: 3,
    options: [
      { label: 'أ', content: '30 كم' },
      { label: 'ب', content: '62 كم' },
      { label: 'ج', content: '120 كم' },
      { label: 'د', content: '90 كم' },
    ],
    correctIndex: 2,
    hint: {
      text: 'المسافة = السرعة × الزمن',
      stepLabel: 'القانون:',
      stepContent: 'المسافة = 60 × 2',
    },
    solution: {
      steps: [
        { number: 1, title: 'تطبيق القانون', desc: 'المسافة = السرعة × الزمن.', math: '60 × 2', result: '120 كم' },
      ],
      tip: 'السرعة = المسافة ÷ الزمن → المسافة = السرعة × الزمن.',
    },
    simplerExample: {
      original: '60 × 2',
      simpler: '10 × 3',
      result: '30 كم',
      explanation: 'سرعة 10 كم/س لمدة 3 ساعات = 30 كم. نفس القانون!',
    },
    errorExample: {
      studentName: 'عمر',
      steps: [
        { step: 'السرعة = 60، الزمن = 2', desc: 'المعطيات' },
        { step: '60 ÷ 2', desc: 'قسمت السرعة على الزمن' },
        { step: '30 كم', desc: 'النتيجة' },
      ],
      errorIndex: 1,
      errorExplanation: 'المسافة = السرعة × الزمن (ضرب لا قسمة): 60 × 2 = 120 كم',
    },
  },
];
