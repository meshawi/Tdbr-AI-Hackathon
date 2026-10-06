import { Link } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';
import { BRAND_NAME, MAIN_SITE } from '../lib/brand';

export function Footer() {
  const { t } = useSettings();
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <Link to="/" className="brand" aria-label={t('home')}>
            <img className="brand__logo" src="/apple-touch-icon.png" alt="" width={36} height={36} />
            <span className="brand__title">{BRAND_NAME}</span>
          </Link>
          <span className="site-footer__sep" aria-hidden />
          <span>© {new Date().getFullYear()}</span>
        </div>
        <nav className="site-footer__links" aria-label="footer">
          <a href={MAIN_SITE}>{t('mainSite')}</a>
          <a href={`${MAIN_SITE}/privacy`}>{t('privacy')}</a>
          <a href={`${MAIN_SITE}/terms`}>{t('terms')}</a>
          <a href={`${MAIN_SITE}/disclaimer`}>{t('religiousPolicy')}</a>
        </nav>
      </div>
      <p className="site-footer__note">
        {t('sourceNote')}{' '}
        <a href="https://qurancomplex.gov.sa/quran-dev/" target="_blank" rel="noreferrer">qurancomplex.gov.sa/quran-dev</a>
      </p>
    </footer>
  );
}
