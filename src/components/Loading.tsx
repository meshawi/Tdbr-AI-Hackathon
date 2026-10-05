import { useSettings } from '../hooks/useSettings';

export function Loading() {
  const { t } = useSettings();
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden />
      <span>{t('loading')}</span>
    </div>
  );
}

export function ErrorBox({ error }: { error?: Error }) {
  const { t } = useSettings();
  return (
    <div className="error-box" role="alert">
      <strong>{t('error')}</strong>
      {error && <div className="muted">{error.message}</div>}
    </div>
  );
}
