import styles from './logo-mark.module.css';

export function LogoMark() {
  return (
    <span className={styles.logo}>
      <img src="/brand/logo-only.svg" alt="Litter Networks logo" />
    </span>
  );
}
