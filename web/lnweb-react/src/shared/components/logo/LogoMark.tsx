import styles from './logo-mark.module.css';

/**
 * Renders the brand logo image inside a styled container.
 *
 * @returns A JSX element containing the logo image (`/brand/logo-only.svg`) with accessible alt text.
 */
export function LogoMark() {
  return (
    <span className={styles.logo}>
      <img src="/brand/logo-only.svg" alt="Litter Networks logo" />
    </span>
  );
}