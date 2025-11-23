import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import styles from './route-error.module.css';

export function RouteErrorBoundary() {
  const error = useRouteError();

  const message = isRouteErrorResponse(error)
    ? error.statusText
    : error instanceof Error
      ? error.message
      : 'Something went wrong.';

  return (
    <div className={styles.container}>
      <h1>Oops!</h1>
      <p>{message}</p>
      <a href="/">Go home</a>
    </div>
  );
}
