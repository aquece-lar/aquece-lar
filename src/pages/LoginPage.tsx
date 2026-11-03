import { useId, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { InvalidCredentialsError } from '@/services/authService';
import logo from '@/assets/logo-aquece-lar.webp';
import styles from './LoginPage.module.css';

type LoginError = 'credentials' | 'unexpected';

function usernameError(value: string): string {
  if (!value.trim()) return 'Informe seu e-mail.';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? '' : 'Informe um e-mail válido.';
}

function passwordError(value: string): string {
  return value ? '' : 'Informe sua senha.';
}

export function LoginPage() {
  const { session, login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const id = useId();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [touched, setTouched] = useState({ username: false, password: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Com a sessão criada, este redirecionamento leva à página pedida antes do login.
  if (session === undefined) return null;
  if (session) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }

  const usernameMessage = touched.username ? usernameError(username) : '';
  const passwordMessage = touched.password ? passwordError(password) : '';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setTouched({ username: true, password: true });
    setError(null);
    if (usernameError(username)) {
      usernameRef.current?.focus();
      return;
    }
    if (passwordError(password)) {
      passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await login(username, password, remember);
    } catch (caught) {
      setSubmitting(false);
      if (caught instanceof InvalidCredentialsError) {
        setError('credentials');
        passwordRef.current?.select();
      } else {
        console.error('Falha no login', caught);
        setError('unexpected');
      }
    }
  }

  return (
    <div className={styles.page}>
      <button
        type="button"
        className={`icon-btn ${styles.themeButton}`}
        aria-label={theme === 'claro' ? 'Ativar tema escuro' : 'Ativar tema claro'}
        onClick={toggleTheme}
      >
        <Icon name={theme === 'claro' ? 'moon' : 'sun'} size={20} />
      </button>

      <header className={styles.panel}>
        <svg className={styles.texture} aria-hidden="true">
          <defs>
            <pattern id={`${id}-calor`} width="160" height="120" patternUnits="userSpaceOnUse">
              <path d="M40 0C25 30 55 90 40 120" />
              <path d="M120 -60C105 -30 135 30 120 60C105 90 135 150 120 180" />
            </pattern>
          </defs>
          <rect className={styles.textureFill} width="100%" height="200%" fill={`url(#${id}-calor)`} />
        </svg>

        <div className={styles.logoWrap}>
          <svg className={styles.rings} viewBox="0 0 720 720" aria-hidden="true">
            <circle cx="360" cy="360" r="168" />
            <circle cx="360" cy="360" r="240" />
            <circle cx="360" cy="360" r="320" />
          </svg>
          <div className={styles.logo}>
            <img src={logo} alt="Logo Aquece Lar" />
            <img src={logo} alt="" aria-hidden="true" className={styles.glow} />
          </div>
        </div>

        <div className={styles.brandText}>
          <p className={styles.brandName}>Aquece Lar</p>
          <p className={styles.tagline}>Orçamentos que aquecem o seu negócio</p>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.heading}>
            <h1 className={styles.title}>Bem-vindo de volta</h1>
            <p className={styles.subtitle}>Acesse com seu e-mail e senha</p>
            <div aria-live="assertive">
              {error && (
                <div className={styles.alert} role="alert">
                  <Icon name="alert" size={20} />
                  {error === 'credentials' ? (
                    <span>
                      <strong>E-mail ou senha incorretos.</strong> Confira os dados e tente novamente.
                    </span>
                  ) : (
                    <span>Não foi possível entrar agora. Tente novamente.</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <form className={styles.form} noValidate onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor={`${id}-usuario`} className={styles.label}>
                E-mail
              </label>
              <div className={styles.control}>
                <Icon name="user" size={20} className={styles.fieldIcon} />
                <input
                  ref={usernameRef}
                  id={`${id}-usuario`}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="seu@email.com"
                  maxLength={160}
                  className={`${styles.input} ${usernameMessage ? styles.invalid : ''}`}
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setError(null);
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                  aria-invalid={usernameMessage ? true : undefined}
                  aria-describedby={`${id}-usuario-erro`}
                />
              </div>
              <div id={`${id}-usuario-erro`} aria-live="polite">
                {usernameMessage && (
                  <p className={styles.fieldError}>
                    <Icon name="info" size={16} />
                    {usernameMessage}
                  </p>
                )}
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor={`${id}-senha`} className={styles.label}>
                Senha
              </label>
              <div className={styles.control}>
                <Icon name="lock" size={20} className={styles.fieldIcon} />
                <input
                  ref={passwordRef}
                  id={`${id}-senha`}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  maxLength={128}
                  className={`${styles.input} ${styles.withToggle} ${passwordMessage ? styles.invalid : ''}`}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  aria-invalid={passwordMessage ? true : undefined}
                  aria-describedby={`${id}-senha-erro`}
                />
                <button
                  type="button"
                  className={styles.toggle}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  aria-controls={`${id}-senha`}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} />
                </button>
              </div>
              <div id={`${id}-senha-erro`} aria-live="polite">
                {passwordMessage && (
                  <p className={styles.fieldError}>
                    <Icon name="info" size={16} />
                    {passwordMessage}
                  </p>
                )}
              </div>
            </div>

            <label className={styles.check}>
              <input
                type="checkbox"
                className={styles.checkInput}
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              <span className={styles.checkBox} aria-hidden="true">
                <Icon name="check" size={14} />
              </span>
              Manter conectado
            </label>

            <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={submitting} aria-busy={submitting}>
              {submitting ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  Entrando…
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>

        <p className={styles.footer}>© Aquece Lar</p>
      </main>
    </div>
  );
}
