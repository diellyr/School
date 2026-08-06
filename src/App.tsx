import { RouterProvider } from 'react-router-dom';
import { RepositoryProvider } from './repositories/RepositoryProvider';
import { router } from './app/router';
import { UpdateChecker } from './app/UpdateChecker';

export default function App() {
  return (
    <RepositoryProvider>
      <RouterProvider router={router} />
      <UpdateChecker />
    </RepositoryProvider>
  );
}
