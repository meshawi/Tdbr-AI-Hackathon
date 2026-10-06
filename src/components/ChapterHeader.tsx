import { useSettings } from '../hooks/useSettings';
import { BISMILLAH, num } from '../lib/format';
import type { Chapter } from '../lib/types';

export function ChapterHeader({ chapter, compact = false }: { chapter: Chapter; compact?: boolean }) {
  const { settings, t } = useSettings();
  const lang = settings.lang;
  return (
    <header className={`chapter-header ${compact ? 'chapter-header--compact' : ''}`}>
      <div className="chapter-header__frame">
        <div className="chapter-header__meta">
          <span>{t(chapter.revelation)}</span>
          <span>·</span>
          <span>{num(chapter.versesCount, lang)} {t('verses')}</span>
        </div>
        <h1 className="chapter-header__name" dir="rtl">
          <span className="chapter-header__label">سُورَةُ</span> {chapter.nameAr}
        </h1>
      </div>
      {!compact && chapter.bismillahPre && (
        <p className="quran-text bismillah" dir="rtl" lang="ar">{BISMILLAH}</p>
      )}
    </header>
  );
}
