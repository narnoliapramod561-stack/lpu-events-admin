import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth';
import { ShieldCheck, Mail, KeyRound, ArrowRight, ArrowLeft, RefreshCw, Lock } from 'lucide-react';
import { LpuLogo } from '../common/LpuLogo';

export interface LoginViewProps {
  isExpiredSession?: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({ isExpiredSession = false }) => {
  const { signInWithOtp, verifyOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'EMAIL' | 'OTP' | 'EXPIRED'>(isExpiredSession ? 'EXPIRED' : 'EMAIL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setMessage('');

    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid administrative email address.');
      return;
    }

    setLoading(true);
    try {
      const { error: err } = await signInWithOtp(trimmedEmail);
      if (err) {
        setError(err.message || 'Failed to send OTP code. Please try again.');
      } else {
        setStep('OTP');
        setMessage(`Verification code dispatched to ${trimmedEmail}`);
        setCountdown(60);
      }
    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6 || !/^\d+$/.test(cleanOtp)) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const { error: err } = await verifyOtp(email.trim(), cleanOtp);
      if (err) {
        setError(err.message || 'Invalid or expired verification code.');
      } else {
        setMessage('Access authenticated. Initializing cockpit...');
      }
    } catch (err: any) {
      setError('An error occurred during verification.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-base)',
      padding: '24px',
      position: 'relative'
    }}>
      {/* Background glow orb */}
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255, 107, 0, 0.12) 0%, transparent 70%)',
        filter: 'blur(40px)',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'none'
      }} />

      <div className="card-box" style={{
        width: '100%',
        maxWidth: '460px',
        padding: '36px',
        borderRadius: 'var(--radius-xl)',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
        zIndex: 10
      }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
            <LpuLogo size={64} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
            <h2 className="font-heading" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
              LPU Events
            </h2>
            <span className="badge badge-accent" style={{ padding: '2px 8px', fontSize: '10px' }}>
              ADMIN CONSOLE
            </span>
          </div>

          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0 }}>
            {step === 'EXPIRED' ? 'Security Session Expired' : step === 'OTP' ? 'Enter Email Verification Code' : 'Sign in to administrative console'}
          </p>
        </div>

        {/* Error / Success feedback */}
        {error && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--danger-subtle)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--danger)',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Lock size={16} />
            <span>{error}</span>
          </div>
        )}
        {message && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--success-subtle)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: 'var(--success)',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <ShieldCheck size={16} />
            <span>{message}</span>
          </div>
        )}

        {/* Step: Session Expired */}
        {step === 'EXPIRED' && (
          <div>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px', textAlign: 'center' }}>
              Your administrative session token has expired. Please re-authenticate via OTP to continue accessing your event management workspace.
            </p>
            <button
              onClick={() => { setStep('EMAIL'); setError(''); setMessage(''); }}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              <span>Return to Email Sign In</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Step 1: Email Input */}
        {step === 'EMAIL' && (
          <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label htmlFor="adminEmail" className="form-label">
                Official Administrative Email
              </label>
              <div className="search-input-wrapper">
                <Mail size={16} className="search-input-icon" />
                <input
                  id="adminEmail"
                  type="email"
                  placeholder="e.g. subhamkumar86032@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  data-clarity-mask="True"
                  autoComplete="username"
                  className="form-input search-input"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="pulse-dot" />
                  <span>Sending OTP...</span>
                </>
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 2: OTP Verification */}
        {step === 'OTP' && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="otpCode" className="form-label">
                  6-Digit One-Time Code
                </label>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }} data-clarity-mask="True">
                  Sent to {email}
                </span>
              </div>
              <div className="search-input-wrapper">
                <KeyRound size={16} className="search-input-icon" />
                <input
                  id="otpCode"
                  type="text"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  required
                  data-clarity-mask="True"
                  autoComplete="one-time-code"
                  className="form-input search-input font-mono"
                  style={{ fontSize: '20px', letterSpacing: '0.35em', textAlign: 'center' }}
                  autoFocus
                />
              </div>
            </div>


            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="pulse-dot" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={17} />
                  <span>Authenticate & Enter Console</span>
                </>
              )}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', paddingTop: '6px' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setStep('EMAIL'); setOtp(''); setError(''); setMessage(''); }}
              >
                <ArrowLeft size={14} />
                <span>Change Email</span>
              </button>
              <button
                type="button"
                disabled={countdown > 0 || loading}
                onClick={() => handleRequestOtp()}
                className="btn btn-ghost btn-sm"
                style={{ color: countdown > 0 ? 'var(--text-dim)' : 'var(--accent-primary)', fontWeight: 600 }}
              >
                {countdown > 0 ? `Resend Code (${countdown}s)` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '12px' }}>
            <Lock size={13} />
            <span>Passwordless OTP Gateway • Zero Credential Exposure</span>
          </div>
        </div>
      </div>
    </div>
  );
};
