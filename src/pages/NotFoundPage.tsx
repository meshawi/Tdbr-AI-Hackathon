import { Link } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';

export function NotFoundPage() {
  const { t } = useSettings();
  return (
    <main className="page not-found">
      <h1>404</h1>
      <p>{t('notFound')}</p>
      <Link className="btn" to="/">{t('backHome')}</Link>
    </main>
  );
}
