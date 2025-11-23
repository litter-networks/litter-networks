import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import styles from './route-error.module.css';

/**
 * Renders a fallback UI that displays a route error message and a link to the home page.
 *
 * The displayed message is derived from the current route error: uses `statusText` for
 * route error responses, `message` for `Error` instances, or a generic fallback string.
 *
 * @returns A JSX element containing an error heading, the computed message, and a "Go home" link.
 */
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