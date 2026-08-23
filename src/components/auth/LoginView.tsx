import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth';
import {
  ShieldCheck,
  Mail,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Lock,
  Building2,
  ExternalLink
} from 'lucide-react';
import { LpuLogo } from '../common/LpuLogo';

export interface LoginViewProps {
  isExpiredSession?: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({ isExpiredSession = false }) => {
  const { signInWithOtp, verifyOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [step, setStep] = useState<'EMAIL' | 'OTP' | 'EXPIRED'>(isExpiredSession ? 'EXPIRED' : 'EMAIL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(0);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (step === 'OTP' && otpInputRefs.current[0]) {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setMessage('');

    const targetEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(targetEmail)) {
      setError('Please enter a valid university administrative or club email.');
      return;
    }

    setLoading(true);
    try {
      const { error: err } = await signInWithOtp(targetEmail);
      if (err) {
        setError(err.message || 'Failed to dispatch verification code. Please check your connection.');
      } else {
        setStep('OTP');
        setOtpDigits(['', '', '', '', '', '']);
        setMessage(`6-digit authorization code dispatched to ${targetEmail}`);
        setCountdown(60);
      }
    } catch (err: any) {
      setError('An unexpected authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    if (cleaned.length > 1) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < cleaned.length && index + i < 6; i++) {
        newDigits[index + i] = cleaned[i];
      }
      setOtpDigits(newDigits);
      const nextFocus = Math.min(index + cleaned.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = cleaned[0];
    setOtpDigits(newDigits);

    if (index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        otpInputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < pastedData.length; i++) {
      newDigits[i] = pastedData[i];
    }
    setOtpDigits(newDigits);

    const focusIndex = Math.min(pastedData.length, 5);
    otpInputRefs.current[focusIndex]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const fullCode = otpDigits.join('').trim();
    if (fullCode.length !== 6 || !/^\d{6}$/.test(fullCode)) {
      setError('Please enter the full 6-digit authorization code.');
      return;
    }

    setLoading(true);
    try {
      const { error: err } = await verifyOtp(email.trim(), fullCode);
      if (err) {
        setError(err.message || 'Invalid or expired verification code.');
      } else {
        setMessage('Identity verified. Loading administration workspace...');
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
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px 20px',
      backgroundColor: '#fff8f6',
      backgroundImage: `
        radial-gradient(circle at 50% 0%, rgba(255, 107, 0, 0.08) 0%, transparent 60%),
        radial-gradient(circle at 10% 90%, rgba(254, 227, 216, 0.5) 0%, transparent 50%),
        radial-gradient(circle at 90% 90%, rgba(254, 227, 216, 0.5) 0%, transparent 50%),
        linear-gradient(180deg, #fff8f6 0%, #fff1eb 100%)
      `,
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: '#261812',
      position: 'relative',
      overflowX: 'hidden',
      boxSizing: 'border-box'
    }}>

      {/* Top Eyebrow Badge (Outside the Box at the Top - Big & Premium) */}
      <div style={{ marginBottom: '22px', zIndex: 10 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '9px',
          padding: '9px 24px',
          borderRadius: '9999px',
          background: 'linear-gradient(180deg, #ffffff 0%, #fff7f2 100%)',
          border: '1.5px solid #fed7aa',
          boxShadow: '0 10px 28px -6px rgba(255, 107, 0, 0.16), 0 2px 6px rgba(45, 24, 16, 0.04)'
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: '#ff6b00',
            boxShadow: '0 0 10px 2px rgba(255, 107, 0, 0.5)'
          }} />
          <ShieldCheck size={15} style={{ color: '#ea580c' }} />
          <span style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: '13.5px',
            fontWeight: 800,
            letterSpacing: '0.13em',
            textTransform: 'uppercase',
            color: '#832e00',
            lineHeight: 1
          }}>
            OFFICIAL ADMIN PORTAL
          </span>
        </div>
      </div>

      {/* Main Elevated Card Container (Pure, Balanced LPU Palette) */}
      <div style={{
        width: '100%',
        maxWidth: '540px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        border: '1px solid #e2bfb0',
        boxShadow: '0 20px 48px -12px rgba(38, 24, 18, 0.08), 0 2px 8px rgba(38, 24, 18, 0.03)',
        padding: '48px 42px',
        position: 'relative',
        zIndex: 10,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>

        {/* Clean LPU Logo at the top of the box */}
        <div style={{
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <LpuLogo size={92} />
        </div>

        {/* Header inside the box */}
        <div style={{ textAlign: 'center', marginBottom: '28px', width: '100%' }}>
          {/* Centered Main Title */}
          <h1 style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: '28px',
            fontWeight: 800,
            color: '#261812',
            letterSpacing: '-0.025em',
            margin: '0 0 8px 0',
            textAlign: 'center'
          }}>
            LPU Events
          </h1>

          {/* Scope indicator */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 10px',
            borderRadius: '9999px',
            backgroundColor: '#ffeae1',
            border: '1px solid #e2bfb0',
            fontSize: '11.5px',
            color: '#5a4136',
            fontWeight: 600,
            marginBottom: '12px'
          }}>
            <Building2 size={12} style={{ color: '#ff6b00' }} />
            <span>Clubs • Schools • University Authorities</span>
          </div>

          <p style={{
            fontSize: '14px',
            color: '#5a4136',
            lineHeight: 1.55,
            margin: '0 auto',
            maxWidth: '420px'
          }}>
            {step === 'EXPIRED'
              ? 'Your security session has expired. Re-authenticate to access your workspace.'
              : step === 'OTP'
                ? `Enter the 6-digit authorization code dispatched to your email.`
                : 'Sign in to manage campus events, approvals, and venue schedules.'}
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: '#fee2e2',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            color: '#dc2626',
            fontSize: '13px',
            lineHeight: 1.45,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            boxSizing: 'border-box'
          }}>
            <Lock size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* Success Notification */}
        {message && (
          <div style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: '#dcfce7',
            border: '1px solid rgba(22, 163, 74, 0.3)',
            color: '#16a34a',
            fontSize: '13px',
            lineHeight: 1.45,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            boxSizing: 'border-box'
          }}>
            <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{message}</span>
          </div>
        )}

        {/* STEP: EXPIRED SESSION */}
        {step === 'EXPIRED' && (
          <div style={{ width: '100%' }}>
            <button
              type="button"
              onClick={() => { setStep('EMAIL'); setError(''); setMessage(''); }}
              style={{
                width: '100%',
                height: '52px',
                borderRadius: '12px',
                backgroundColor: '#ff6b00',
                color: '#ffffff',
                border: 'none',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(255, 107, 0, 0.25)'
              }}
            >
              <span>Return to Email Sign In</span>
              <ArrowRight size={17} />
            </button>
          </div>
        )}

        {/* STEP 1: EMAIL INPUT */}
        {step === 'EMAIL' && (
          <form onSubmit={handleRequestOtp} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <label
                htmlFor="adminEmail"
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#261812'
                }}
              >
                Official Administrative Email
              </label>

              <div style={{ position: 'relative', width: '100%' }}>
                <Mail
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#8e7164',
                    pointerEvents: 'none'
                  }}
                />
                <input
                  id="adminEmail"
                  type="email"
                  placeholder="e.g. club.lead@lpu.co.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  data-clarity-mask="True"
                  autoComplete="username"
                  autoFocus
                  style={{
                    width: '100%',
                    height: '52px',
                    padding: '0 16px 0 48px',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #d4a896',
                    borderRadius: '12px',
                    color: '#261812',
                    fontSize: '15px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, box-shadow 0.2s'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#ff6b00';
                    e.target.style.boxShadow = '0 0 0 3.5px rgba(255, 107, 0, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#d4a896';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              style={{
                width: '100%',
                height: '52px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ff6b00 0%, #ea580c 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: '15px',
                fontWeight: 700,
                cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !email.trim() ? 0.65 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 6px 18px -4px rgba(255, 107, 0, 0.35)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!loading && email.trim()) {
                  e.currentTarget.style.filter = 'brightness(1.05)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none';
                e.currentTarget.style.transform = 'none';
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={17} className="pulse-dot" />
                  <span>Dispatching Code...</span>
                </>
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: OTP VERIFICATION */}
        {step === 'OTP' && (
          <form onSubmit={handleVerifyOtp} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '11px 15px',
              borderRadius: '10px',
              backgroundColor: '#ffeae1',
              border: '1px solid #e2bfb0',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                <Mail size={14} style={{ color: '#ff6b00', flexShrink: 0 }} />
                <span style={{ color: '#261812', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} data-clarity-mask="True">
                  {email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => { setStep('EMAIL'); setError(''); setMessage(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ff6b00',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                  flexShrink: 0
                }}
              >
                Change
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#261812',
                  textAlign: 'center'
                }}
              >
                6-Digit Verification Code
              </label>

              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '8px'
              }}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    disabled={loading}
                    autoComplete="one-time-code"
                    data-clarity-mask="True"
                    style={{
                      width: '48px',
                      height: '54px',
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      border: digit ? '2px solid #ff6b00' : '1.5px solid #d4a896',
                      color: '#261812',
                      fontSize: '21px',
                      fontWeight: 800,
                      fontFamily: "'JetBrains Mono', monospace",
                      textAlign: 'center',
                      outline: 'none',
                      boxShadow: digit ? '0 0 0 3px rgba(255, 107, 0, 0.12)' : 'none',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#ff6b00';
                      e.target.style.boxShadow = '0 0 0 3px rgba(255, 107, 0, 0.15)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = digit ? '#ff6b00' : '#d4a896';
                      e.target.style.boxShadow = digit ? '0 0 0 3px rgba(255, 107, 0, 0.12)' : 'none';
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otpDigits.join('').length !== 6}
              style={{
                width: '100%',
                height: '52px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ff6b00 0%, #ea580c 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: '15px',
                fontWeight: 700,
                cursor: loading || otpDigits.join('').length !== 6 ? 'not-allowed' : 'pointer',
                opacity: loading || otpDigits.join('').length !== 6 ? 0.65 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 6px 18px -4px rgba(255, 107, 0, 0.35)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!loading && otpDigits.join('').length === 6) {
                  e.currentTarget.style.filter = 'brightness(1.05)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none';
                e.currentTarget.style.transform = 'none';
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={17} className="pulse-dot" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>Authenticate & Enter Console</span>
                </>
              )}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', paddingTop: '2px' }}>
              <button
                type="button"
                onClick={() => { setStep('EMAIL'); setOtpDigits(['', '', '', '', '', '']); setError(''); setMessage(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#5a4136',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  padding: 0
                }}
              >
                <ArrowLeft size={14} />
                <span>Change Email</span>
              </button>

              <button
                type="button"
                disabled={countdown > 0 || loading}
                onClick={() => handleRequestOtp()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: countdown > 0 ? '#8e7164' : '#ff6b00',
                  fontWeight: 700,
                  cursor: countdown > 0 || loading ? 'not-allowed' : 'pointer',
                  fontSize: '12.5px',
                  padding: 0
                }}
              >
                {countdown > 0 ? `Resend Code (${countdown}s)` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        {/* Security Indicator inside the box */}
        <div style={{
          width: '100%',
          marginTop: '28px',
          paddingTop: '16px',
          borderTop: '1px solid #f3eae5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          color: '#8e7164',
          fontSize: '12px'
        }}>
          <Lock size={12} />
          <span>Role-Based Access Control • Zero Credential Exposure</span>
        </div>

      </div>

      {/* Global Student Portal Footer Navigation (Outside the box) */}
      <div style={{
        marginTop: '22px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '13px',
        color: '#5a4136',
        zIndex: 10
      }}>
        <span>Are you a student?</span>
        <a
          href="http://localhost:3000"
          style={{
            color: '#a04100',
            fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px'
          }}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>Explore Student Events Hub</span>
          <ExternalLink size={12} />
        </a>
      </div>

    </div>
  );
};
