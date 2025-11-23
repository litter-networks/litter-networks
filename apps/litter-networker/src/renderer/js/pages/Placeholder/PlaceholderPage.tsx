import styles from "./styles/PlaceholderPage.module.css";

type Props = {
  name: string;
};

const PlaceholderPage = ({ name }: Props) => (
  <div className={styles.placeholder}>
    <div className={styles.card}>
      <p className={styles.label}>Coming soon</p>
      <h2>{name}</h2>
      <p>This panel will house the {name} workflows from LNAdminWeb.</p>
    </div>
  </div>
);

export default PlaceholderPage;
