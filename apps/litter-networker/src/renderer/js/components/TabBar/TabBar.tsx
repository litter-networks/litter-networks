import styles from "./styles/TabBar.module.css";

export type TabItem = {
  id: string;
  label: string;
};

type Props = {
  tabs: TabItem[];
  activeTab: string;
  onSelect: (tabId: string) => void;
};

const TabBar = ({ tabs, activeTab, onSelect }: Props) => (
  <div className={styles.tabBar}>
    {tabs.map((tab) => {
      const isActive = tab.id === activeTab;
      return (
        <button
          key={tab.id}
          className={`${styles.tabButton} ${isActive ? styles.active : ""}`.trim()}
          onClick={() => onSelect(tab.id)}
          type="button"
        >
          {tab.label}
        </button>
      );
    })}
  </div>
);

export default TabBar;
