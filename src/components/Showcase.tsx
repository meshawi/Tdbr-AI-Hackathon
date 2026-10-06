import { Link } from 'react-router-dom';
import { MAIN_SITE } from '../lib/brand';

/**
 * Landing-page showcase: what this project is, the challenge it was built for, the problem it solves,
 * how it solves it, the numbers behind it and the technology. All figures come from the verification
 * reports in the repository (data/tafsir/quranpedia/VERIFICATION.md, rag/README.md, rag/redteam/REPORT.md).
 */
export function Showcase() {
  return (
    <section className="showcase" dir="rtl" aria-labelledby="showcase-title">
      <div className="showcase__badge">
        <span>مشاركة في</span>
        <strong>تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي ٢٠٢٦</strong>
        <span>مؤسسة باذل الأهلية · المسار الثالث: التجارب التفاعلية والرحلة المعرفية</span>
      </div>

      <h2 id="showcase-title" className="showcase__title">تدبّر: قارئ مصحف دقيق، ومساعد تفسير يستشهد بمصادره</h2>
      <p className="showcase__lead">
        مشروع فريق <a href={MAIN_SITE}>تدبّر</a> في التحدي: قراءة الآية، ثم فهمها من كتب التفسير نفسها، مع ذكاء اصطناعي
        لا يجيب إلا من مصدر ويرفض ما ليس من اختصاصه. بعد التحدي ينتقل هذا العمل إلى تطبيق تدبّر وموقع tdbr.app.
      </p>

      <div className="showcase__grid">
        <article className="showcase__card">
          <h3>المشكلة</h3>
          <p>من يريد فهم آية يقف بين خيارين: تفسير واحد طويل لا يمكن سؤاله، أو روبوت محادثة يجيب بطلاقة بلا مصدر ويخلط بين الآيات ويخرج إلى ما لا يعنيه. كتب التفسير واسعة ومكتوبة للمتخصصين ولا تُبحث بالمعنى.</p>
        </article>
        <article className="showcase__card">
          <h3>الحل</h3>
          <p>نص مصحف المدينة من مجمع الملك فهد حرفيًا، وفوائد «علمتني آية» تظهر عند الوصول إلى آيتها، ومساعد يُعطى الآية وتفسيرها قبل أن يجيب، ويضع رقم المصدر على كل معلومة، وكل إجابة يمكن تتبّعها حتى الصفحة في الكتاب.</p>
        </article>
        <article className="showcase__card">
          <h3>الموثوقية</h3>
          <p>النص القرآني مُتحقَّق منه آليًا مقابل البنية القياسية لرواية حفص. كل مقطع تفسير مُتحقَّق منه من ثلاثة مصادر. المساعد اجتاز ١٠٠ محاولة اختراق موثّقة (تغيير الدور، استخراج التعليمات، التشفير والأحرف المخفية، الحقن غير المباشر، الحقن عبر سجل المحادثة، إساءة استخدام الأداة) وله سجل تتبّع عام.</p>
        </article>
      </div>

      <div className="showcase__stats">
        {[
          ['٦٬٢٣٦', 'آية بنص مجمع الملك فهد'],
          ['١٠٥', 'فائدة من «علمتني آية»'],
          ['١٦٤', 'كتاب تفسير عربي'],
          ['٤٨', 'سورة مفهرسة في هذه المرحلة'],
          ['٦٣٣٬٥٠١', 'مقطعًا في فهرس البحث'],
          ['٠٫٨٢', 'استدعاء@١٠ للاسترجاع المقيّد بالآية'],
          ['١٠٠/١٠٠', 'اختبارات الحماية ناجحة'],
        ].map(([n, label]) => (
          <div key={label} className="showcase__stat"><strong>{n}</strong><span>{label}</span></div>
        ))}
      </div>

      <div className="showcase__tech">
        <h3>التقنيات</h3>
        <ul>
          {['React 19 + Vite + TypeScript', 'خط وبيانات مجمع الملك فهد (Hafs v30)', 'FastAPI', 'BGE-M3 (كثيف + متفرّق)', 'Qdrant (بحث هجين RRF)', 'bge-reranker-v2-m3', 'DeepSeek مع التفكير الممتد وأداة بحث عبر القرآن', 'Docker / Coolify'].map((x) => <li key={x}>{x}</li>)}
        </ul>
      </div>

      <div className="showcase__links">
        <Link className="btn" to="/al-baqarah?startingVerse=255">جرّب آية الكرسي مع المساعد</Link>
        <Link className="btn btn--ghost" to="/ai-history">سجل الذكاء الاصطناعي (التتبّع الكامل)</Link>
        <a className="btn btn--ghost" href="https://qurancomplex.gov.sa/quran-dev/" target="_blank" rel="noreferrer">مصدر النص القرآني</a>
      </div>
      <p className="showcase__note muted">
        التغطية الحالية ٤٨ سورة اختيرت لأنها تضم آيات الكتاب؛ بعد التحدي تُستكمل بقية السور بالمنهجية نفسها. الإجابات مولَّدة آليًا من كتب التفسير وقد تحتمل الخطأ؛ المصادر مذكورة للمراجعة.
      </p>
    </section>
  );
}
