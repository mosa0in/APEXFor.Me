/**
 * Thomas' Calculus Chapter 1 — Diagnostic Questions (from L1 curriculum extraction)
 * These questions map directly to concepts in curriculum.json
 */
import type { Question } from './questions';

export const questionsL1: Question[] = [
  {
    id: 101,
    text: 'إذا كانت f(x) = 2x + 3، ما قيمة f(4)؟',
    rephrasedText: 'الدالة f تعطيك ضعف العدد زائد 3. ما الناتج عندما x = 4؟',
    conceptId: 'sec1_1_con1',
    concept: 'Definition and Notation of Functions',
    sectionType: 'main',
    difficulty: 2,
    options: [
      { label: 'أ', content: '8' },
      { label: 'ب', content: '11' },
      { label: 'ج', content: '14' },
      { label: 'د', content: '5' },
    ],
    correctIndex: 1,
    hint: {
      text: 'عوّض x بالقيمة 4 في الدالة: f(4) = 2(4) + 3',
      stepLabel: 'التعويض:',
      stepContent: 'f(4) = 2(4) + 3 = 8 + 3',
    },
    solution: {
      steps: [
        { number: 1, title: 'التعويض', desc: 'نضع x = 4 في f(x) = 2x + 3.', math: 'f(4) = 2(4) + 3', result: '8 + 3' },
        { number: 2, title: 'الحساب', desc: 'نجمع.', math: '8 + 3', result: '11' },
      ],
      tip: 'تقييم الدالة يعني تعويض المتغير بالقيمة المعطاة.',
    },
    simplerExample: {
      original: 'f(x) = 2x + 3, f(4)',
      simpler: 'f(x) = x + 1, f(2)',
      result: '3',
      explanation: 'عوّض: f(2) = 2 + 1 = 3. نفس الفكرة مع f(4)!',
    },
    errorExample: {
      studentName: 'سارة',
      steps: [
        { step: 'f(x) = 2x + 3', desc: 'الدالة' },
        { step: 'f(4) = 2 + 4 + 3', desc: 'جمعت بدل الضرب' },
        { step: 'f(4) = 9', desc: 'النتيجة' },
      ],
      errorIndex: 1,
      errorExplanation: '2x تعني 2 × x وليس 2 + x. الصحيح: 2(4) + 3 = 11',
    },
  },
  {
    id: 102,
    text: 'ما مجال الدالة f(x) = √(x − 3)؟',
    rephrasedText: 'الدالة جذر (x ناقص 3)... ما القيم المسموحة لـ x؟',
    conceptId: 'sec1_1_con2',
    concept: 'Domain and Range',
    sectionType: 'main',
    difficulty: 3,
    options: [
      { label: 'أ', content: '[3, ∞)' },
      { label: 'ب', content: '(-∞, 3]' },
      { label: 'ج', content: 'ℝ' },
      { label: 'د', content: '(3, ∞)' },
    ],
    correctIndex: 0,
    hint: {
      text: 'الجذر التربيعي يتطلب أن يكون ما تحته ≥ 0.',
      stepLabel: 'الشرط:',
      stepContent: 'x − 3 ≥ 0 → x ≥ 3',
    },
    solution: {
      steps: [
        { number: 1, title: 'شرط الجذر', desc: 'ما تحت الجذر يجب أن يكون ≥ 0.', math: 'x − 3 ≥ 0', result: 'x ≥ 3' },
        { number: 2, title: 'كتابة المجال', desc: 'المجال يبدأ من 3 (شاملة) إلى ما لا نهاية.', math: '[3, ∞)', result: '[3, ∞)' },
      ],
      tip: '[ ] تعني شاملة، ( ) تعني غير شاملة. لأن √0 = 0 فـ 3 مشمولة.',
    },
    simplerExample: {
      original: '√(x − 3)',
      simpler: '√(x)',
      result: '[0, ∞)',
      explanation: 'مجال √x هو x ≥ 0. بنفس المنطق: √(x-3) يتطلب x-3 ≥ 0 أي x ≥ 3.',
    },
    errorExample: {
      studentName: 'أحمد',
      steps: [
        { step: 'f(x) = √(x − 3)', desc: 'الدالة' },
        { step: 'x − 3 > 0', desc: 'وضعت > بدل ≥' },
        { step: 'x > 3 → (3, ∞)', desc: 'استبعدت 3' },
      ],
      errorIndex: 1,
      errorExplanation: '√0 = 0 معرّف! لذا x = 3 مسموح. الصحيح: x ≥ 3 → [3, ∞)',
    },
  },
  {
    id: 103,
    text: 'مساحة مربع ضلعه s تساوي A = s². إذا كانت A = 49، ما قيمة s؟',
    rephrasedText: 'مربع مساحته 49. كم طول ضلعه؟',
    conceptId: 'sec1_1_con3',
    concept: 'Finding Formulas for Functions',
    sectionType: 'main',
    difficulty: 2,
    options: [
      { label: 'أ', content: '5' },
      { label: 'ب', content: '6' },
      { label: 'ج', content: '7' },
      { label: 'د', content: '8' },
    ],
    correctIndex: 2,
    hint: {
      text: 'إذا A = s² فإن s = √A.',
      stepLabel: 'القانون العكسي:',
      stepContent: 's = √49',
    },
    solution: {
      steps: [
        { number: 1, title: 'عكس الصيغة', desc: 'من A = s² نأخذ الجذر.', math: 's = √A = √49', result: 's = 7' },
      ],
      tip: 'عند إيجاد صيغة دالة عكسية، نعكس العملية الرياضية.',
    },
    simplerExample: {
      original: 's² = 49',
      simpler: 's² = 4',
      result: 's = 2',
      explanation: '√4 = 2. بنفس الطريقة √49 = 7.',
    },
    errorExample: {
      studentName: 'خالد',
      steps: [
        { step: 'A = s² = 49', desc: 'المعطيات' },
        { step: 's = 49 / 2', desc: 'قسمت على 2 بدل أخذ الجذر' },
        { step: 's = 24.5', desc: 'النتيجة' },
      ],
      errorIndex: 1,
      errorExplanation: 's² لا تعني s×2! تعني s×s. الصحيح: s = √49 = 7',
    },
  },
  {
    id: 104,
    text: 'إذا f(x) = x² و g(x) = x + 1، ما قيمة (f + g)(2)؟',
    rephrasedText: 'اجمع الدالتين f و g ثم عوّض بـ 2.',
    conceptId: 'sec1_2_con1',
    concept: 'Algebraic Combinations of Functions',
    sectionType: 'main',
    difficulty: 2,
    options: [
      { label: 'أ', content: '5' },
      { label: 'ب', content: '6' },
      { label: 'ج', content: '7' },
      { label: 'د', content: '8' },
    ],
    correctIndex: 2,
    hint: {
      text: '(f + g)(x) = f(x) + g(x). عوّض بـ x = 2.',
      stepLabel: 'التطبيق:',
      stepContent: 'f(2) + g(2) = 2² + (2+1)',
    },
    solution: {
      steps: [
        { number: 1, title: 'حساب f(2)', desc: 'f(x) = x² فـ f(2) = 4.', math: 'f(2) = 2² = 4', result: '4' },
        { number: 2, title: 'حساب g(2)', desc: 'g(x) = x+1 فـ g(2) = 3.', math: 'g(2) = 2 + 1 = 3', result: '3' },
        { number: 3, title: 'الجمع', desc: 'نجمع النتيجتين.', math: '4 + 3', result: '7' },
      ],
      tip: 'جمع الدوال يعني جمع مخرجاتهما عند نفس القيمة.',
    },
    simplerExample: {
      original: '(f+g)(2) = f(2)+g(2)',
      simpler: '(f+g)(1) = 1²+(1+1)',
      result: '3',
      explanation: 'f(1)=1, g(1)=2, المجموع=3. نفس الطريقة!',
    },
    errorExample: {
      studentName: 'نورة',
      steps: [
        { step: 'f(x)=x², g(x)=x+1', desc: 'الدوال' },
        { step: '(f+g)(x) = x² + x + 1', desc: 'صحيح' },
        { step: '(f+g)(2) = 2² + 2 + 1 = 9', desc: 'حسبت 4+2+1' },
      ],
      errorIndex: 2,
      errorExplanation: '2² = 4, والمجموع = 4 + 2 + 1 = 7 وليس 9. راجعي الحساب!',
    },
  },
  {
    id: 105,
    text: 'إذا f(x) = 2x و g(x) = x + 3، ما هي (f ∘ g)(1)؟',
    rephrasedText: 'أولاً طبّق g على 1، ثم طبّق f على النتيجة.',
    conceptId: 'sec1_2_con2',
    concept: 'Composition of Functions',
    sectionType: 'main',
    difficulty: 3,
    options: [
      { label: 'أ', content: '5' },
      { label: 'ب', content: '8' },
      { label: 'ج', content: '6' },
      { label: 'د', content: '10' },
    ],
    correctIndex: 1,
    hint: {
      text: '(f ∘ g)(x) = f(g(x)). ابدأ بحساب g(1) ثم عوّض في f.',
      stepLabel: 'الخطوة الأولى:',
      stepContent: 'g(1) = 1 + 3 = 4',
    },
    solution: {
      steps: [
        { number: 1, title: 'حساب g(1)', desc: 'g(x)=x+3 فـ g(1)=4.', math: 'g(1) = 1 + 3', result: '4' },
        { number: 2, title: 'حساب f(g(1))', desc: 'f(x)=2x فـ f(4)=8.', math: 'f(4) = 2 × 4', result: '8' },
      ],
      tip: 'التركيب f∘g يعني "طبّق g أولاً ثم f".',
    },
    simplerExample: {
      original: '(f∘g)(1)',
      simpler: '(f∘g)(0) = f(g(0))',
      result: '6',
      explanation: 'g(0)=3, f(3)=6. من الداخل للخارج!',
    },
    errorExample: {
      studentName: 'ليلى',
      steps: [
        { step: 'f(x)=2x, g(x)=x+3', desc: 'الدوال' },
        { step: 'f(1) = 2, g(1) = 4', desc: 'حسبت كل واحدة لوحدها' },
        { step: 'f(1) × g(1) = 8', desc: 'ضربت النتائج' },
      ],
      errorIndex: 2,
      errorExplanation: 'التركيب ليس ضرب! (f∘g)(1) = f(g(1)) = f(4) = 8. النتيجة صحيحة صدفة!',
    },
  },
  {
    id: 106,
    text: 'كم يساوي π/2 بالدرجات؟',
    rephrasedText: 'حوّل الزاوية π/2 راديان إلى درجات.',
    conceptId: 'sec1_3_con1',
    concept: 'Angles: Radians and Degrees',
    sectionType: 'main',
    difficulty: 1,
    options: [
      { label: 'أ', content: '45°' },
      { label: 'ب', content: '90°' },
      { label: 'ج', content: '180°' },
      { label: 'د', content: '360°' },
    ],
    correctIndex: 1,
    hint: {
      text: 'π راديان = 180°. إذن π/2 = ؟',
      stepLabel: 'التحويل:',
      stepContent: 'π/2 = 180°/2 = 90°',
    },
    solution: {
      steps: [
        { number: 1, title: 'القاعدة', desc: 'π rad = 180°.', math: 'π = 180°', result: '180°' },
        { number: 2, title: 'القسمة', desc: 'نقسم الطرفين على 2.', math: 'π/2 = 180°/2', result: '90°' },
      ],
      tip: 'للتحويل من راديان لدرجات: اضرب في 180/π.',
    },
    simplerExample: {
      original: 'π/2 rad',
      simpler: 'π rad',
      result: '180°',
      explanation: 'π = 180° هي القاعدة الأساسية. π/2 = نصفها = 90°.',
    },
    errorExample: {
      studentName: 'عمر',
      steps: [
        { step: 'π/2 بالدرجات', desc: 'المطلوب' },
        { step: 'π ≈ 3.14', desc: 'استخدمت القيمة العددية' },
        { step: '3.14/2 ≈ 1.57°', desc: 'النتيجة' },
      ],
      errorIndex: 1,
      errorExplanation: 'π هنا وحدة قياس (راديان) وليس عدداً! π rad = 180°',
    },
  },
  {
    id: 107,
    text: 'ما قيمة sin(π/6)؟',
    rephrasedText: 'ما جيب الزاوية 30 درجة (π/6 راديان)؟',
    conceptId: 'sec1_3_con2',
    concept: 'Definitions of Trigonometric Functions',
    sectionType: 'main',
    difficulty: 2,
    options: [
      { label: 'أ', content: '1/2' },
      { label: 'ب', content: '√3/2' },
      { label: 'ج', content: '√2/2' },
      { label: 'د', content: '1' },
    ],
    correctIndex: 0,
    hint: {
      text: 'π/6 = 30°. تذكر المثلث 30-60-90.',
      stepLabel: 'القيم المعروفة:',
      stepContent: 'sin(30°) = 1/2',
    },
    solution: {
      steps: [
        { number: 1, title: 'التحويل', desc: 'π/6 = 30°.', math: 'π/6 rad = 30°', result: '30°' },
        { number: 2, title: 'القيمة', desc: 'من جدول القيم المثلثية.', math: 'sin(30°)', result: '1/2' },
      ],
      tip: 'احفظ: sin(30°)=1/2, sin(45°)=√2/2, sin(60°)=√3/2.',
    },
    simplerExample: {
      original: 'sin(π/6)',
      simpler: 'sin(0)',
      result: '0',
      explanation: 'sin(0°)=0 هي أبسط قيمة. sin(30°)=1/2 من الجدول.',
    },
    errorExample: {
      studentName: 'فاطمة',
      steps: [
        { step: 'sin(π/6)', desc: 'المطلوب' },
        { step: 'π/6 = 30°', desc: 'صحيح' },
        { step: 'sin(30°) = √3/2', desc: 'خلطت مع cos(30°)' },
      ],
      errorIndex: 2,
      errorExplanation: 'sin(30°) = 1/2 وليس √3/2. الـ √3/2 هي cos(30°) أو sin(60°).',
    },
  },
  {
    id: 108,
    text: 'إذا f(x) = 2ˣ، ما قيمة f(3)؟',
    rephrasedText: '2 مرفوعة للأس 3. كم تساوي؟',
    conceptId: 'sec1_5_con1',
    concept: 'Exponential Functions and Their Graphs',
    sectionType: 'main',
    difficulty: 1,
    options: [
      { label: 'أ', content: '6' },
      { label: 'ب', content: '8' },
      { label: 'ج', content: '9' },
      { label: 'د', content: '4' },
    ],
    correctIndex: 1,
    hint: {
      text: '2ˣ تعني 2 مضروبة في نفسها x مرات.',
      stepLabel: 'التطبيق:',
      stepContent: '2³ = 2 × 2 × 2',
    },
    solution: {
      steps: [
        { number: 1, title: 'التوسيع', desc: '2³ = 2×2×2.', math: '2 × 2 × 2', result: '8' },
      ],
      tip: 'الدالة الأسية aˣ تنمو بسرعة كبيرة كلما زاد x.',
    },
    simplerExample: {
      original: '2³',
      simpler: '2²',
      result: '4',
      explanation: '2² = 2×2 = 4. أضف ضربة واحدة: 2³ = 4×2 = 8.',
    },
    errorExample: {
      studentName: 'محمد',
      steps: [
        { step: 'f(x) = 2ˣ, f(3)', desc: 'المعطيات' },
        { step: '2 × 3 = 6', desc: 'ضربت بدل الرفع' },
      ],
      errorIndex: 1,
      errorExplanation: '2ˣ ليست 2×x! تعني 2 مرفوعة للقوة x: 2³ = 8',
    },
  },
  {
    id: 109,
    text: 'إذا f(x) = 3x + 6، ما هي f⁻¹(x)؟',
    rephrasedText: 'أوجد الدالة العكسية لـ 3x + 6.',
    conceptId: 'sec1_6_con1',
    concept: 'Inverse Functions',
    sectionType: 'main',
    difficulty: 3,
    options: [
      { label: 'أ', content: '(x − 6)/3' },
      { label: 'ب', content: '(x + 6)/3' },
      { label: 'ج', content: '3x − 6' },
      { label: 'د', content: 'x/3 − 6' },
    ],
    correctIndex: 0,
    hint: {
      text: 'ضع y = 3x + 6 ثم حُل لإيجاد x بدلالة y.',
      stepLabel: 'الخطوة الأولى:',
      stepContent: 'y − 6 = 3x',
    },
    solution: {
      steps: [
        { number: 1, title: 'وضع y', desc: 'y = 3x + 6.', math: 'y = 3x + 6', result: 'y − 6 = 3x' },
        { number: 2, title: 'حل لـ x', desc: 'نقسم على 3.', math: 'x = (y − 6)/3', result: 'f⁻¹(x) = (x−6)/3' },
      ],
      tip: 'الدالة العكسية تعكس عملية الدالة الأصلية.',
    },
    simplerExample: {
      original: 'f(x) = 3x + 6',
      simpler: 'f(x) = x + 1',
      result: 'f⁻¹(x) = x − 1',
      explanation: 'العكسية تعكس الجمع لطرح. بنفس المنطق نعكس 3x+6.',
    },
    errorExample: {
      studentName: 'يوسف',
      steps: [
        { step: 'f(x) = 3x + 6', desc: 'الدالة' },
        { step: 'f⁻¹(x) = x/3 − 6', desc: 'قسمت x على 3 ثم طرحت 6' },
      ],
      errorIndex: 1,
      errorExplanation: 'يجب طرح 6 أولاً ثم القسمة: (x−6)/3 وليس x/3 − 6',
    },
  },
  {
    id: 110,
    text: 'ما قيمة log₂(16)؟',
    rephrasedText: '2 مرفوعة لأي قوة تعطينا 16؟',
    conceptId: 'sec1_6_con2',
    concept: 'Logarithmic Functions',
    sectionType: 'main',
    difficulty: 2,
    options: [
      { label: 'أ', content: '2' },
      { label: 'ب', content: '3' },
      { label: 'ج', content: '4' },
      { label: 'د', content: '8' },
    ],
    correctIndex: 2,
    hint: {
      text: 'log₂(16) يسأل: 2 أُس كم = 16؟',
      stepLabel: 'التفكير:',
      stepContent: '2⁴ = 16 → log₂(16) = 4',
    },
    solution: {
      steps: [
        { number: 1, title: 'تعريف اللوغاريتم', desc: 'log_b(x) = n يعني bⁿ = x.', math: '2ⁿ = 16', result: 'نبحث عن n' },
        { number: 2, title: 'الحساب', desc: '2⁴ = 16.', math: '2⁴ = 16', result: 'n = 4' },
      ],
      tip: 'اللوغاريتم هو العملية العكسية للأُس.',
    },
    simplerExample: {
      original: 'log₂(16)',
      simpler: 'log₂(8)',
      result: '3',
      explanation: '2³ = 8 → log₂(8) = 3. وبما أن 2⁴ = 16 → log₂(16) = 4.',
    },
    errorExample: {
      studentName: 'هدى',
      steps: [
        { step: 'log₂(16)', desc: 'المطلوب' },
        { step: '16 / 2 = 8', desc: 'قسمت على الأساس' },
      ],
      errorIndex: 1,
      errorExplanation: 'اللوغاريتم ليس قسمة! نبحث عن الأس: 2⁴ = 16 → الجواب 4',
    },
  },
];
