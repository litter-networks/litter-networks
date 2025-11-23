import { usePageTitle } from '@/shared/usePageTitle';
import styles from './styles/join-in.module.css';

interface JoinInPlaceholderPageProps {
  title: string;
  description: string;
}

export function JoinInPlaceholderPage({ title, description }: JoinInPlaceholderPageProps) {
  usePageTitle(title);
  return (
    <div className={styles.placeholderPage}>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
