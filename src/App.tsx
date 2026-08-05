import { RouterProvider } from 'react-router-dom';
import { RepositoryProvider } from './repositories/RepositoryProvider';
import { router } from './app/router';

export default function App() {
  return (
    <RepositoryProvider>
      <RouterProvider router={router} />
    </RepositoryProvider>
  );
}
