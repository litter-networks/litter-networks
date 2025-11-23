import { Outlet, useParams } from 'react-router-dom';
import { Header } from '@/components/header/Header';
import { Footer } from '@/components/footer/Footer';
import { NavDataProvider } from '@/features/nav/NavDataContext';
import styles from './styles/app-layout.module.css';

/**
 * Renders the application layout and provides navigation data context from an optional `filterString` route parameter.
 *
 * The layout includes a Header, a main content area that renders an Outlet for nested routes, and a Footer, all wrapped by NavDataProvider with `filterString` forwarded as `filterStringParam`.
 *
 * @returns The JSX element representing the application layout.
 */
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