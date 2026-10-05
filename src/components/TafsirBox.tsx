import { useAsync } from '../hooks/useAsync';
import { useSettings } from '../hooks/useSettings';
import { getTafsir } from '../lib/api';

/** Tafseer Muyassar text for one verse (KFGQPC). Loaded lazily per surah and cached. */
export function TafsirBox({ chapterId, verse }: { chapterId: number; verse: number }) {
  const { t } = useSettings();
  const { data, loading, error } = useAsync(() => getTafsir(chapterId), [chapterId]);
  return (
    <div className="tafsir" dir="rtl" lang="ar">
      <div className="tafsir__head">
        <span className="tafsir__title">{t('tafsirMuyassar')}</span>
        <span className="muted tafsir__src">{t('tafsirSource')}</span>
      </div>
      {loading && <p className="muted">{t('loading')}</p>}
      {error && <p className="error">{t('error')}</p>}
      {data && <p className="tafsir__body" dangerouslySetInnerHTML={{ __html: data.tafsir[String(verse)] ?? '' }} />}
    </div>
  );
}
