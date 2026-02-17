import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { PasswordGate } from '~/chirp/components/PasswordGate';

export const Route = createFileRoute('/chirp_/login')({
  component: LoginComponent,
});

function LoginComponent() {
  const navigate = useNavigate();

  return <PasswordGate onSuccess={() => navigate({ to: '/chirp' })} />;
}
