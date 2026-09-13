import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowRight, FiArrowLeft, FiEye, FiEyeOff, FiLock, FiMail } from 'react-icons/fi'
import logo1 from "../assets/logo1.webp"

// Helpers Fucntion
import { Validate } from '../helper/validate'

// Api
import { postAPICall } from "../api/api";

import { DASHBOARD_PATH } from "../constant/navigation";
import { useUser } from "../hooks/useUser";
// Types
import type { UserRoles } from '../constant/users'
// Styles
import '../style/loginPage.css'

interface LoginCredentials {
  email: string
  password: string
}

const RedirectToDashboard = (userRole: UserRoles) => {
  const dashboardLink = DASHBOARD_PATH[userRole];
  return dashboardLink;
};


function LoginPage() {
  const navigate = useNavigate()
  const { fetchUser } = useUser()
  const [showPassword, setShowPassword] = useState(false)
  const [loginCredentials, setLoginCredentials] = useState<LoginCredentials>({ email: '', password: '' })
  const [loading, setLoading] = useState(false)

  function handleLoginCredentialsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.currentTarget;
    setLoginCredentials((prev) => ({ ...prev, [name]: value }));
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    Validate(loginCredentials)

    try {
      setLoading(true);

      interface LoginResponse {
        role: UserRoles
      }

      const response = await postAPICall<LoginCredentials, LoginResponse>(
        '/users/login',
        loginCredentials
      );

      // The API wrapper always returns { message, success, data }, so read the payload from `data`
      const responseData: LoginResponse | undefined = response.data;

      if (!responseData || !responseData.role) {
        return
      }

      await fetchUser()

      const userRole = responseData.role as UserRoles;
      const dashboard = RedirectToDashboard(userRole)
      
      navigate(dashboard)
    } catch (err) {
      console.error('Login error:', err);
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      {/* Decorative glows */}
      <div aria-hidden="true" className="login-page__glow login-page__glow--leaf" />
      <div aria-hidden="true" className="login-page__glow login-page__glow--deep" />

      <div className="login-page__wrap shadow-lg rounded-lg">
        {/* Card */}
        <div className="login-card">
          {/* Header */}
          <div className="login-card__header">
            <a href="/" className='login-card_return-icon'>
              <FiArrowLeft />
            </a>

            <div className="login-card__logo">
              <img src={`${logo1}`} alt="School logo" className='w-full h-full object-cover'/>
            </div>
            <h1 className="login-card__title">
              Welcome back
            </h1>
            <p className="login-card__subtitle">
              Sign in to start your session
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {/* Email */}
            <div>
              <label htmlFor="email" className="login-field__label">
                Email
              </label>
              <div className="login-field__control">
                <FiMail
                  aria-hidden="true"
                  className="login-field__icon"
                />
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={loginCredentials.email}
                  onChange={handleLoginCredentialsChange}
                  placeholder="Enter your email"
                  required
                  autoComplete="email"
                  className="login-input"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="login-field__label">
                Password
              </label>
              <div className="login-field__control">
                <FiLock
                  aria-hidden="true"
                  className="login-field__icon"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  id="password"
                  value={loginCredentials.password}
                  onChange={handleLoginCredentialsChange}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="login-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="login-field__toggle"
                >
                  {showPassword ? (
                    <FiEyeOff aria-hidden="true" />
                  ) : (
                    <FiEye aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="login-options">
              <label className="login-options__remember">
                <input type="checkbox" className="login-options__checkbox" />
                Remember me
              </label>
              <a
                href="#forgot-password"
                onClick={(event) => event.preventDefault()}
                className="login-options__link"
              >
                Forgot password?
              </a>
            </div>

            {/* Submit */}
            <div>
              {loading ? (
                <button
                  type="button"
                  className="login-submit"
                  disabled
                >
                  Signing in...
                </button>
              ) : (
                <button
                  type="submit"
                  className="login-submit"
                >
                  Sign in
                  <FiArrowRight
                    aria-hidden="true"
                    className="login-submit__icon"
                  />
                </button>
                
              )}
            </div>

            <p className="login-note">
              Trouble signing in? Contact your school administrator.
            </p>
             
          </form>
        </div>
      </div>
    </main>
  )
}

export default LoginPage
