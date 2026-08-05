import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, Info, ShieldCheck } from 'lucide-react';
import { loginSchema, signupSchema, type LoginFormValues, type SignupFormValues } from './loginSchema';
import {
  AccountBlockedError,
  createAccountAndLogin,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  loginWithPassword,
  useAuthStore,
} from '../../auth/authStore';
import { DEMO_CREDENTIALS } from '../../auth/demoUsers';
import { Button } from '../../components/Button';
import { FormField, Input } from '../../components/form/Field';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useDemoDataActions, useDemoDataStatus } from '../settings/useDemoData';
import { Dialog } from '../../components/Dialog';

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmSeedOpen, setConfirmSeedOpen] = useState(false);
  const demoLoaded = useDemoDataStatus();
  const { loading: seeding, handleLoad } = useDemoDataActions();
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const setRememberMe = useAuthStore((s) => s.setRememberMe);
  const repositories = useRepositories();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  const {
    register: registerSignup,
    handleSubmit: handleSignupSubmit,
    formState: { errors: signupErrors, isSubmitting: isSigningUp },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', organizationName: '', email: '', password: '', confirmPassword: '' },
  });

  async function afterAuthenticated(session: Awaited<ReturnType<typeof loginWithPassword>>, action: 'login' | 'create') {
    setSession(session);
    await repositories.audit.record(
      { userId: session.user.id, role: session.role, organizationId: session.user.organizationId },
      { action, module: action === 'create' ? 'users' : 'auth', entityId: session.user.id },
    );
    const from = (location.state as { from?: string })?.from ?? '/';
    navigate(from, { replace: true });
  }

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    try {
      const session = await loginWithPassword(values.email, values.password);
      setRememberMe(values.rememberMe);
      await afterAuthenticated(session, 'login');
    } catch (err) {
      if (err instanceof AccountBlockedError) {
        setFormError(err.message);
      } else if (err instanceof InvalidCredentialsError) {
        setFormError(err.message);
      } else {
        setFormError('Não foi possível entrar. Tente novamente.');
      }
    }
  }

  async function onSignupSubmit(values: SignupFormValues) {
    setFormError(null);
    try {
      const session = await createAccountAndLogin(values);
      setRememberMe(true);
      await afterAuthenticated(session, 'create');
    } catch (err) {
      if (err instanceof EmailAlreadyExistsError) {
        setFormError(err.message);
      } else {
        setFormError('Não foi possível criar a conta. Tente novamente.');
      }
    }
  }

  function fillDemo(email: string, password: string) {
    setMode('login');
    setValue('email', email);
    setValue('password', password);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-4 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-600/30">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Acompanha+</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Acompanhamento escolar para famílias e educadores</p>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          <Info className="h-4 w-4 shrink-0" />
          <span>Ambiente de demonstração local. Nenhum dado real de criança deve ser inserido aqui.</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
            <button
              type="button"
              onClick={() => { setMode('login'); setFormError(null); }}
              className={`rounded-md py-1.5 font-medium transition-colors ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setFormError(null); }}
              className={`rounded-md py-1.5 font-medium transition-colors ${mode === 'signup' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}
            >
              Criar conta
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <FormField label="E-mail" htmlFor="email" error={errors.email?.message} required>
                <Input id="email" type="email" autoComplete="email" placeholder="voce@escola.app" {...register('email')} />
              </FormField>

              <FormField label="Senha" htmlFor="password" error={errors.password?.message} required>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pr-10"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <input type="checkbox" className="rounded border-slate-300" {...register('rememberMe')} />
                  Lembrar acesso
                </label>
                <button
                  type="button"
                  className="font-medium text-sky-600 hover:underline"
                  onClick={() =>
                    setFormError(
                      'No modo demo local não há recuperação de senha por e-mail. Use uma das credenciais de demonstração abaixo, ou crie uma conta nova.',
                    )
                  }
                >
                  Esqueci minha senha
                </button>
              </div>

              {formError && (
                <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                  {formError}
                </div>
              )}

              <Button type="submit" className="w-full" loading={isSubmitting}>
                Entrar
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignupSubmit(onSignupSubmit)} noValidate className="space-y-4">
              <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300">
                Cria uma conta real (perfil Owner) com sua própria organização, sem depender de dados de
                demonstração — ideal para começar a importar seus próprios dados. Você pode carregar dados de
                demonstração depois, em Configurações, se quiser.
              </p>

              <FormField label="Nome completo" htmlFor="signupFullName" error={signupErrors.fullName?.message} required>
                <Input id="signupFullName" autoComplete="name" placeholder="Seu nome" {...registerSignup('fullName')} />
              </FormField>

              <FormField label="Nome da escola ou rede" htmlFor="signupOrgName" error={signupErrors.organizationName?.message} required>
                <Input id="signupOrgName" placeholder="Ex.: Escola Girassol" {...registerSignup('organizationName')} />
              </FormField>

              <FormField label="E-mail" htmlFor="signupEmail" error={signupErrors.email?.message} required>
                <Input id="signupEmail" type="email" autoComplete="email" placeholder="voce@escola.app" {...registerSignup('email')} />
              </FormField>

              <FormField label="Senha" htmlFor="signupPassword" error={signupErrors.password?.message} required hint="Mínimo de 6 caracteres.">
                <Input id="signupPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••" {...registerSignup('password')} />
              </FormField>

              <FormField label="Confirmar senha" htmlFor="signupConfirmPassword" error={signupErrors.confirmPassword?.message} required>
                <Input id="signupConfirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••" {...registerSignup('confirmPassword')} />
              </FormField>

              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} className="rounded border-slate-300" />
                Mostrar senha
              </label>

              {formError && (
                <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                  {formError}
                </div>
              )}

              <Button type="submit" className="w-full" loading={isSigningUp}>
                Criar conta e entrar
              </Button>
            </form>
          )}

          {mode === 'login' && (
            <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Acessos de demonstração</p>
              {demoLoaded === false && (
                <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300">
                  Nenhum dado de demonstração carregado ainda.{' '}
                  <button type="button" className="font-semibold underline" onClick={() => setConfirmSeedOpen(true)}>
                    Carregar dados de demonstração
                  </button>{' '}
                  para poder entrar com um destes acessos.
                </div>
              )}
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {DEMO_CREDENTIALS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => fillDemo(c.email, c.password)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-left text-xs text-slate-600 hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-sky-500/10"
                  >
                    <span className="block font-medium text-slate-800 dark:text-slate-100">{c.label}</span>
                    <span className="block text-slate-400">{c.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Dialog
          open={confirmSeedOpen}
          onClose={() => setConfirmSeedOpen(false)}
          title="Carregar dados de demonstração?"
          description="Serão criadas escolas, turmas, alunos, responsáveis, professores e demais registros fictícios, claramente identificados como dados de demonstração, apenas neste navegador."
        >
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmSeedOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                await handleLoad();
                setConfirmSeedOpen(false);
              }}
              loading={seeding}
            >
              Confirmar e carregar
            </Button>
          </div>
        </Dialog>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Ao continuar, você concorda com o aviso de privacidade. Dados de crianças são tratados com controle de
          acesso e finalidade específica (LGPD).
        </p>
      </div>
    </div>
  );
}
