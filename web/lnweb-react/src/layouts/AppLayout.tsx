import { Outlet, useParams } from 'react-router-dom';
import { Header } from '@/components/header/Header';
import { Footer } from '@/components/footer/Footer';
import { NavDataProvider } from '@/features/nav/NavDataContext';
import styles from './styles/app-layout.module.css';

export function AppLayout() {
  const { filterString } = useParams<{ filterString?: string }>();

  return (
    <NavDataProvider filterStringParam={filterString}>
      <div className={styles.appShell}>
        <Header />
        <main className={styles.content}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </NavDataProvider>
  );
}
